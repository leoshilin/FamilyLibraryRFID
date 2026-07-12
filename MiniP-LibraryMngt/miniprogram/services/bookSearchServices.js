// 图书检索 / 最近上架相关 API 封装
// 页面通过此 Service 调用云函数，不直接调用 wx.cloud.callFunction()

const callFunction = async (name, data = {}) => {
  const res = await wx.cloud.callFunction({
    name,
    data
  })
  return res.result
}

// 图书检索（支持 ISBN 精确、关键词模糊、书架筛选、状态筛选、上架期间筛选、分页）
// params: { keyword?, isbn?, bookshelfId?, status?, startDate?, endDate?, page?, pageSize? }
// 返回结构：{ success, data: [], total }
const search = (params = {}) => {
  return callFunction('api_book_search', params)
}

// 首页最近上架书籍（inventory_status = in_stock，按 on_shelf_at 倒序，最多 5 条）
// 返回结构：{ success, list: [] }
const searchRecent = () => {
  return callFunction('api_book_searchRecent')
}

module.exports = {
  search,
  searchRecent
}
