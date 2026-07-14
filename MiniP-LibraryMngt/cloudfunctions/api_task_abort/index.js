// PDA 放弃寻书任务执行，回退 pending 状态
// 适用场景：用户无法找到 RFID 信号（距离过远、不在同一房间等），暂时退出，稍后再试。
// 与 api_task_complete(failed) 不同：本接口不标记任务为 failed，任务可被再次轮询领取。
// 无家庭 / 角色校验（PDA 专用）。

const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

/**
 * 云函数入口：放弃寻书任务执行
 * @param {string} taskId - 任务 ID
 * @returns {{ success: boolean, message?: string }}
 */
exports.main = async (event) => {
  const { taskId } = event

  if (!taskId) {
    return { success: false, message: 'taskId不能为空' }
  }

  // 查询当前任务状态
  const taskRes = await db.collection('device_task').doc(taskId).get()
  const task = taskRes.data

  if (!task) {
    return { success: false, message: '任务不存在' }
  }

  // 仅允许 running 状态的任务执行 abort
  if (task.status !== 'running') {
    return {
      success: false,
      message: `当前任务状态为 "${task.status}"，不允许退出（仅 running 状态可退出）`
    }
  }

  // 回退任务状态到 pending，清空设备占用信息
  // 不写入 result，不设置 completed_at
  await db.collection('device_task').doc(taskId).update({
    data: {
      status: 'pending',
      claimed_by_device: db.command.remove(),
      claimed_at: db.command.remove()
    }
  })

  console.log(`api_task_abort: 任务 ${taskId} 已回退到 pending 状态`)

  return { success: true }
}
