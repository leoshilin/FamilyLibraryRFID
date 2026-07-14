// 查询 RFID 绑定任务及寻书任务状态（轻量读接口）
// 手机端详情页 / 检索列表页用于渲染「绑定中 / 重新绑定中」状态以及
// 「寻书任务进行中」状态，避免列表逐条发起查询。
//
// 入参（二选一）：
//   bookItemId  : 单查，字符串
//   bookItemIds : 批量，字符串数组
// 返回：
//   { success, map: { [bookItemId]: { inProgress, status, findInProgress, findStatus } } }
//   inProgress     : 是否存在 bind_rfid 任务且 status ∈ [pending, running]
//   status         : 进行中绑定任务的 status（pending/running）；无进行中时为最新任务的 status 或 null
//   findInProgress : 是否存在 find_book 任务且 status ∈ [pending, running]
//   findStatus     : 进行中寻书任务的 status（pending/running）；无进行中时为 null
//
// 说明：device_task 无 family_id 字段，故先按当前家庭校验 book_item_id 归属，
//       再查询任务，防止越权探测其它家庭的任务状态。

const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境

const db = cloud.database()
const _ = db.command

const { getCurrentUser } = require('./common/permission')

// 单次 _.in 查询的安全上限（微信云数据库对 in 数组长度有约束）
const BATCH_SIZE = 100

// 将某本图书的 bind_rfid 任务列表归并为绑定状态
// tasks 期望已按 created_at 倒序
function buildBindStatus(tasks) {
  if (!tasks.length) {
    return { inProgress: false, status: null }
  }
  // 进行中：running 优先于 pending
  const active =
    tasks.find(t => t.status === 'running') ||
    tasks.find(t => t.status === 'pending')

  return {
    inProgress: !!active,
    status: active ? active.status : tasks[0].status
  }
}

// 云函数入口函数
exports.main = async (event) => {
  const { bookItemId, bookItemIds } = event

  // 归一化为去重后的 id 数组
  const idSet = new Set()
  if (Array.isArray(bookItemIds) && bookItemIds.length) {
    bookItemIds.forEach(id => id && idSet.add(id))
  } else if (bookItemId) {
    idSet.add(bookItemId)
  }
  const idList = [...idSet]

  if (!idList.length) {
    return { success: true, map: {} }
  }

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

  // 1️⃣ 校验这些 book_item_id 属于当前家庭（防止越权探测其它家庭任务状态）
  const allowedSet = new Set()
  for (let i = 0; i < idList.length; i += BATCH_SIZE) {
    const batch = idList.slice(i, i + BATCH_SIZE)
    const res = await db.collection('book_item')
      .where({
        _id: _.in(batch),
        family_id: familyId,
        fg_delete: false
      })
      .field({ _id: true })
      .limit(BATCH_SIZE)
      .get()
    res.data.forEach(d => allowedSet.add(d._id))
  }

  // 2️⃣ 查询绑定任务及寻书任务（仅查询归属本家庭的 item；device_task 无 family_id 字段）
  //    容错：若 device_task 集合尚未创建（-502005 资源不存在），则视为「无进行中任务」
  //          降级返回，不让查询失败阻断详情页 / 列表页渲染（前端本就按 rfid_tid 判断
  //          已绑定 / 未绑定，仅 inProgress 来自本接口）。
  const taskMap = {} // itemId -> { bind: [], find: [] }
  const allowedIds = [...allowedSet]
  try {
    for (let i = 0; i < allowedIds.length; i += BATCH_SIZE) {
      const batch = allowedIds.slice(i, i + BATCH_SIZE)
      // 一次查询同时获取 bind_rfid 和 find_book 两种类型的任务
      const res = await db.collection('device_task')
        .where({
          book_item_id: _.in(batch),
          task_type: _.in(['bind_rfid', 'find_book'])
        })
        .field({ book_item_id: true, task_type: true, status: true, created_at: true })
        .limit(1000)
        .get()
      res.data.forEach(t => {
        const id = t.book_item_id
        if (!taskMap[id]) taskMap[id] = { bind: [], find: [] }
        if (t.task_type === 'bind_rfid') {
          taskMap[id].bind.push(t)
        } else if (t.task_type === 'find_book') {
          taskMap[id].find.push(t)
        }
      })
    }
  } catch (err) {
    // 集合不存在 / 其它读取异常：记日志并降级为「全部无进行中任务」，保证页面不崩溃
    console.error('api_task_getBindStatus: 查询 device_task 失败，已降级为无进行中任务:', err)
  }

  // 3️⃣ 归并状态，按请求顺序返回（未授权 / 不存在的 item 也占位，便于前端直接按 id 取用）
  const map = {}
  idList.forEach(id => {
    if (!allowedSet.has(id)) {
      map[id] = { inProgress: false, status: null, findInProgress: false, findStatus: null }
      return
    }
    const group = taskMap[id] || { bind: [], find: [] }
    const bindTasks = group.bind.slice().sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at)
    )
    const findTasks = group.find.slice().sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at)
    )
    const bindStatus = buildBindStatus(bindTasks)
    const findStatus = buildBindStatus(findTasks) // 复用同一归并逻辑
    map[id] = {
      inProgress: bindStatus.inProgress,
      status: bindStatus.status,
      findInProgress: findStatus.inProgress,
      findStatus: findStatus.status
    }
  })

  return { success: true, map }
}
