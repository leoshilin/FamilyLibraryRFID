// 创建 RFID 绑定任务
// 手机端发起，PDA 后续轮询领取并执行。
// 仅校验目标图书存在、在架、未删除；同一图书可重复发起（PDA 端按状态去重）。

const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境

const db = cloud.database()
const _ = db.command

const { PERMISSIONS, RESOURCE_TYPES, checkPermission, getCurrentUser } = require('./common/permission')

// 云函数入口函数
exports.main = async (event) => {
  const { bookItemId } = event
  const now = new Date()

  // 反查操作人
  const wxContext = cloud.getWXContext()
  const user = await getCurrentUser(db, wxContext.OPENID)
  if (!user) {
    return { success: false, message: '用户未注册' }
  }

  // 反查当前家庭
  const familyId = user.current_family_id
  if (!familyId) {
    return { success: false, message: '未选择当前家庭' }
  }

  // 权限校验：RFID_TASK_CREATE_BIND（OWNER / MEMBER，GUEST 无此权限）
  const perm = await checkPermission({
    db,
    openid: wxContext.OPENID,
    permission: PERMISSIONS.RFID_TASK_CREATE_BIND,
    familyId
  })
  if (!perm.allowed) {
    return { success: false, message: perm.message }
  }

  if (!bookItemId) {
    return { success: false, message: 'bookItemId不能为空' }
  }

  // 校验目标图书存在且在架、未删除
  const itemRes = await db.collection('book_item')
    .where({
      _id: bookItemId,
      family_id: familyId,
      fg_delete: false
    })
    .limit(1)
    .get()

  if (!itemRes.data.length) {
    return { success: false, message: '书籍不存在或已删除' }
  }

  const item = itemRes.data[0]
  if (item.inventory_status !== 'in_stock') {
    return { success: false, message: '仅上架中的图书可发起绑定任务' }
  }

  // 防重复：若该书已存在进行中（pending/running）的绑定任务，则拒绝新建。
  // 这是防止手机端在「读取任务状态 → 置灰按钮」的间隙抢点导致重复建任务的
  // 权威拦截（前端置灰只是体验优化，无法彻底杜绝竞态）。
  // 注意 device_task 无 family_id 字段，这里仅按 book_item_id 去重即可
  // （同一实体书不会跨家庭），且需确认目标图书归属当前家庭（上面已校验）。
  let hasInProgress = false
  try {
    const inProgressRes = await db.collection('device_task')
      .where({
        book_item_id: bookItemId,
        task_type: 'bind_rfid',
        status: _.in(['pending', 'running'])
      })
      .limit(1)
      .get()
    hasInProgress = inProgressRes.data.length > 0
  } catch (e) {
    // device_task 集合尚未创建等异常：降级放行（无任务可重复）
    console.error('api_task_createBindRfid: 查询进行中任务失败，已降级放行:', e)
  }
  if (hasInProgress) {
    return {
      success: false,
      code: 'TASK_IN_PROGRESS',
      message: '该书已有进行中的绑定任务，请勿重复发起'
    }
  }

  // 创建 device_task（bind_rfid）
  const taskRes = await db.collection('device_task').add({
    data: {
      task_type: 'bind_rfid',
      book_item_id: bookItemId,
      status: 'pending',
      created_by: user._id,
      created_at: now
    }
  })

  console.log(`api_task_createBindRfid: 创建绑定任务 ${taskRes._id} for book_item ${bookItemId}`)

  return {
    success: true,
    task: {
      taskId: taskRes._id,
      taskType: 'bind_rfid',
      bookItemId,
      status: 'pending'
    }
  }
}
