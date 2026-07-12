// 书本主数据相关 API 封装
// 页面通过此 Service 调用云函数，不直接调用 wx.cloud.callFunction()

const { callFunction } = require('./_base')

// 按 ISBN 查询系统级主数据（book_meta）
// 返回结构：{ success, exists, book?, bookMetaId? }
const getByIsbn = (isbn) => {
  return callFunction('api_bookmeta_getByIsbn', {
    isbn
  })
}

// 从外部数据源抓取书籍信息（ISBN → 书名/作者/封面等）
// 返回结构：{ success, book }
const fetchExternal = (isbn) => {
  return callFunction('api_bookmeta_fetchExternal', {
    isbn
  })
}

module.exports = {
  getByIsbn,
  fetchExternal
}
