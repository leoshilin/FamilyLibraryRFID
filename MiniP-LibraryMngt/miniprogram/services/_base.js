// Service 层公共封装
// 唯一允许调用 wx.cloud.callFunction() 的位置（见 Docs/api-service-接口说明.md 第 2.1 节）。
// 所有业务 Service 模块统一 require 本文件，避免在 6+ 个 service 中重复定义同一份封装。
// 注：本文件位于 miniprogram/services/ 单一目录，仅此一份，无需任何同步脚本
// （文档 0.1 第 7 条的同步机制仅针对云函数 _shared → common，与前端 services 无关）。

const callFunction = async (name, data = {}) => {
  const res = await wx.cloud.callFunction({
    name,
    data
  })
  return res.result
}

module.exports = {
  callFunction
}
