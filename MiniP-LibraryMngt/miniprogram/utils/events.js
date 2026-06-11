// utils/events.js

const EVENTS = {
  BOOK_META_CREATED: 'bookMetaCreated', //书本主数据（book_meta)  新增
  BOOK_META_UPDATED: 'bookMetaUpdated', //书本主数据（book_meta)  变更

  BOOK_ITEM_LISTED: 'bookItemListed',   //实体书本上架（包含已下架书本的再次上架）
  BOOK_ITEM_UNLISTED: 'bookItemUnlisted', //实体书本下架
  BOOK_ITEM_DELETED: 'bookItemDeleted'  //实体书本的逻辑删除
}

module.exports = EVENTS