// 任务 / RFID 相关 API 封装
// 页面通过此 Service 调用云函数，不直接调用 wx.cloud.callFunction()
// 说明：G1/G2/H1 由手机端发起；J1–J4 由 PDA 直连调用（小程序页面一般不直接调用，
//       此处仍统一封装，保证 Service 层是唯一调用入口）。

const { callFunction } = require('./_base')

// —— 手机端：创建任务 ——

// 创建 RFID 绑定任务（PDA 后续轮询执行）
const createBindRfid = (bookItemId) => {
  return callFunction('api_task_createBindRfid', { bookItemId })
}

// 创建寻书任务（仅已绑定 RFID 的图书可发起）
const createFindBook = (bookItemId) => {
  return callFunction('api_task_createFindBook', { bookItemId })
}

// 手机端主动解绑 RFID（无需 PDA，一般用于标签损毁不可读场景）
const unbindRfid = (bookItemId) => {
  return callFunction('api_task_unbindRfid', { bookItemId })
}

// —— PDA：任务执行（Android 直连，此处仅作统一封装） ——

// PDA 领取一个待执行任务
const accept = (deviceId) => {
  return callFunction('api_task_accept', { deviceId })
}

// PDA 提交任务执行结果
const complete = (taskId, status, result) => {
  return callFunction('api_task_complete', { taskId, status, result })
}

// PDA 扫描 TID 后查询当前绑定状态
const getRfidBindingInfo = (tid) => {
  return callFunction('api_task_getRfidBindingInfo', { tid })
}

// PDA 执行 RFID 绑定（核心接口，内部处理 4 种绑定场景）
// taskId 可选：用于关联 rfid_bind_log；不传时按 book_item_id 反查进行中任务
// deviceId 可选：PDA 设备ID，作为 rfid_bind_log.operator；不传时回退到任务领取设备，再回退到固定串 "PDA"
const bindRfid = (bookItemId, tid, taskId, deviceId) => {
  return callFunction('api_task_bindRfid', { bookItemId, tid, taskId, deviceId })
}

module.exports = {
  createBindRfid,
  createFindBook,
  unbindRfid,
  accept,
  complete,
  getRfidBindingInfo,
  bindRfid
}
