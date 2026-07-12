// 实体书上下架相关 API 封装
// 页面通过此 Service 调用云函数，不直接调用 wx.cloud.callFunction()

const callFunction = async (name, data = {}) => {
  const res = await wx.cloud.callFunction({
    name,
    data
  })
  return res.result
}

// 上架前预检查：book_meta 是否存在、当前家庭是否已存在同书、套装序号是否冲突
// 返回结构：{ success, metaExists, bookMetaId?, isSet?, existingItemCount?, needUserConfirm?, duplicateType? }
const prepareCreate = (isbn, book) => {
  return callFunction('api_bookitem_prepareCreate', {
    isbn,
    book
  })
}

// 正式执行上架（自动创建 book_meta、创建 book_item、写库存日志）
// 返回结构：{ success, bookItem }
const create = (isbn, bookshelfId, book, editionType) => {
  return callFunction('api_bookitem_create', {
    isbn,
    bookshelfId,
    book,
    editionType
  })
}

// 修改指定实体书所在书架（移动图书）
// 返回结构：{ success, bookshelfName? }
const updateBookshelf = (itemId, bookshelfId) => {
  return callFunction('api_bookitem_updateBookshelf', {
    itemId,
    bookshelfId
  })
}

// 重新上架已下架书籍
// 返回结构：{ success }
const restock = (itemId) => {
  return callFunction('api_bookitem_restock', {
    itemId
  })
}

// 执行下架
// 返回结构：{ success }
const offstock = (itemId, reason) => {
  return callFunction('api_bookitem_offstock', {
    itemId,
    reason
  })
}

// 逻辑删除（彻底删除）实体书
// 返回结构：{ success }
const remove = (itemId) => {
  return callFunction('api_bookitem_delete', {
    itemId
  })
}

// 根据实体书 ID 获取详情（关联 book_item + book_meta + bookshelf）
// 返回结构：{ success, bookItem, bookMeta?, bookshelf? }
const get = (itemId) => {
  return callFunction('api_bookitem_get', {
    itemId
  })
}

module.exports = {
  prepareCreate,
  create,
  updateBookshelf,
  restock,
  offstock,
  remove,
  get
}
