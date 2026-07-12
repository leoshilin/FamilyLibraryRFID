// PDA 领取一个待执行任务
// 仅 PDA 调用：从 pending / running 中按创建时间升序取一个，置为 running 避免重复执行。
// device_task 仅作为精简任务队列（只存 book_item_id / target_tid 等调度字段，不冗余存储展示字段）；
// 领取后经 book_item → book_meta 关联补齐 ISBN / 书名 / 作者等展示字段返回，供 PDA 直接显示并校验 ISBN。
// 无家庭 / 角色校验（PDA 专用）。

const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境

const db = cloud.database()
const _ = db.command

// 云函数入口函数
exports.main = async (event) => {
  const { deviceId } = event
  const now = new Date()

  if (!deviceId) {
    return { success: false, message: 'deviceId不能为空' }
  }

  // 从 pending / running 中按创建时间升序取一个（兼容 PDA 断线导致的 running 残留）
  const res = await db.collection('device_task')
    .where({
      status: _.in(['pending', 'running'])
    })
    .orderBy('created_at', 'asc')
    .limit(1)
    .get()

  if (!res.data.length) {
    return { success: true, task: null }
  }

  const task = res.data[0]

  // 领取后置为 running，记录处理设备与时间
  await db.collection('device_task').doc(task._id).update({
    data: {
      status: 'running',
      claimed_by_device: deviceId,
      claimed_at: now
    }
  })

  console.log(`api_task_accept: 设备 ${deviceId} 领取任务 ${task._id} (${task.task_type})`)

  // 关联展示字段：device_task 仅存 book_item_id，展示所需的 ISBN / 书名 / 作者
  // 在领取时经 book_item → book_meta 反查拼装返回，避免冗余写入任务表。
  // 任一一环缺失或异常均降级为空字符串，不影响任务领取主流程。
  const display = await buildTaskDisplay(task.book_item_id)

  return {
    success: true,
    task: {
      taskId: task._id,
      taskType: task.task_type,
      bookItemId: task.book_item_id || '',
      targetTid: task.target_tid || '',
      isbn: display.isbn,
      title: display.title,
      authors: display.authors
    }
  }
}

// 经 book_item → book_meta 反查展示字段（ISBN / 书名 / 作者）。
// 任务表不冗余保存展示字段，此处为唯一来源；任意异常降级为空，保障领取接口健壮。
async function buildTaskDisplay(bookItemId) {
  const empty = { isbn: '', title: '', authors: '' }
  if (!bookItemId) {
    return empty
  }
  try {
    const itemRes = await db.collection('book_item').doc(bookItemId).get()
    const item = itemRes.data
    if (!item || !item.book_meta_id) {
      return empty
    }
    const metaRes = await db.collection('book_meta').doc(item.book_meta_id).get()
    const meta = metaRes.data
    if (!meta) {
      return empty
    }
    return {
      isbn: meta.isbn || '',
      title: meta.title || '',
      authors: meta.authors || ''
    }
  } catch (e) {
    console.error('api_task_accept: 关联展示字段失败，已降级为空:', e)
    return empty
  }
}
