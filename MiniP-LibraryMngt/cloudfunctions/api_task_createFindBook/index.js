// 创建寻书任务
// 手机端发起，PDA 后续轮询领取并进入"盖革计数器"寻书模式。
// 仅已绑定 RFID 的图书可发起（设计：未绑定 RFID 的书籍不可使用寻书功能）。

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

  // 权限校验：RFID_TASK_CREATE_FIND（OWNER / MEMBER，GUEST 无此权限）
  const perm = await checkPermission({
    db,
    openid: wxContext.OPENID,
    permission: PERMISSIONS.RFID_TASK_CREATE_FIND,
    familyId
  })
  if (!perm.allowed) {
    return { success: false, message: perm.message }
  }

  if (!bookItemId) {
    return { success: false, message: 'bookItemId不能为空' }
  }

  // 校验目标图书存在、在架、未删除
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
    return { success: false, message: '仅上架中的图书可发起寻书任务' }
  }

  // 未绑定 RFID 的图书无法寻书（物理定位依赖标签信号）
  if (!item.rfid_tid) {
    return { success: false, message: '未绑定RFID的图书无法发起寻书任务' }
  }

  // 创建 device_task（find_book），target_tid 写入当前图书已绑定的标签
  const taskRes = await db.collection('device_task').add({
    data: {
      task_type: 'find_book',
      book_item_id: bookItemId,
      target_tid: item.rfid_tid,
      status: 'pending',
      created_by: user._id,
      created_at: now
    }
  })

  console.log(`api_task_createFindBook: 创建寻书任务 ${taskRes._id} for book_item ${bookItemId}`)

  return {
    success: true,
    taskId: taskRes._id
  }
}
