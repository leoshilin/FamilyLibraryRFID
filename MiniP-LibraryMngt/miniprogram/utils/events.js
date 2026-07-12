// utils/events.js

const EVENTS = {
  BOOK_META_CREATED: 'bookMetaCreated', //书本主数据（book_meta)  新增
  BOOK_META_UPDATED: 'bookMetaUpdated', //书本主数据（book_meta)  变更

  BOOK_ITEM_LISTED: 'bookItemListed',   //实体书本上架（包含已下架书本的再次上架）
  BOOK_ITEM_UNLISTED: 'bookItemUnlisted', //实体书本下架
  BOOK_ITEM_DELETED: 'bookItemDeleted',  //实体书本的逻辑删除

  // RFID 绑定任务状态变化（创建绑定任务 / 解绑成功），供列表页即时更新对应项的进行中态
  // payload: { itemId, inProgress, rfidTid? }
  RFID_TASK_CHANGED: 'rfidTaskChanged'
}

module.exports = EVENTS