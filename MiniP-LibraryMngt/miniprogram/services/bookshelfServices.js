// 书架相关 API 封装
// 页面通过此 Service 调用云函数，不直接调用 wx.cloud.callFunction()

const callFunction = async (name, data = {}) => {
  const res = await wx.cloud.callFunction({
    name,
    data
  })
  return res.result
}

// 获取指定家庭下的书架列表（按 sort_order 升序）
const list = (familyId) => {
  return callFunction('api_bookshelf_list', {
    familyId
  })
}

// 在指定家庭下创建书架
const create = (familyId, name) => {
  return callFunction('api_bookshelf_create', {
    familyId,
    name
  })
}

// 修改书架名称
const update = (bookshelfId, name) => {
  return callFunction('api_bookshelf_update', {
    bookshelfId,
    name
  })
}

// 逻辑删除书架
const remove = (bookshelfId) => {
  return callFunction('api_bookshelf_delete', {
    bookshelfId
  })
}

module.exports = {
  list,
  create,
  update,
  remove
}
