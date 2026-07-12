// PDA 领取一个待执行任务
// 仅 PDA 调用：从 pending / running 中按创建时间升序取一个，置为 running 避免重复执行。
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

  return {
    success: true,
    task: {
      taskId: task._id,
      taskType: task.task_type,
      bookItemId: task.book_item_id || '',
      targetTid: task.target_tid || ''
    }
  }
}
