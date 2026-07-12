// PDA 提交任务执行结果
// 仅 PDA 调用：记录任务最终状态（success / failed）与结果，置 completed_at。
// 注：bind_rfid 的实际绑定 / 解绑由 J4（api_task_bindRfid）执行；本接口只更新任务状态。
// 无家庭 / 角色校验（PDA 专用）。

const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境

const db = cloud.database()
const _ = db.command

// 云函数入口函数
exports.main = async (event) => {
  const { taskId, status, result } = event
  const now = new Date()

  if (!taskId) {
    return { success: false, message: 'taskId不能为空' }
  }

  if (!['success', 'failed'].includes(status)) {
    return { success: false, message: '无效的任务状态' }
  }

  // 更新任务状态与结果（不限制原状态，允许重复提交覆盖）
  await db.collection('device_task').doc(taskId).update({
    data: {
      status,
      result: result || {},
      completed_at: now
    }
  })

  console.log(`api_task_complete: 任务 ${taskId} 提交结果 status=${status}`)

  return { success: true }
}
