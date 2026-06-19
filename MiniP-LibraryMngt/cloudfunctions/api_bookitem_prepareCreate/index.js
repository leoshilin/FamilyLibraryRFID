/* -----------------------
function:
查找 book_meta（按 ISBN）
查找该家庭 book_item
按是否套装 + set_index 判断重复
-------------------------- */

// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境

// 云函数入口函数
exports.main = async (event) => {
  const { isbn, familyId, book } = event
  const db = cloud.database()
  console.log(`api_bookitem_prepareCreate start: isbn=${isbn}, familyId=${familyId}, book.isbn=${book.isbn}, book.setIndex=${book.setIndex}`)

  // 1️⃣ 查 meta
  const metaRes = await db.collection('book_meta')
    .where({ isbn })
    .limit(1)
    .get()
  
  //情况1：book_meta中不存在，book_item中也不会存在（系统逻辑保证）
  if (metaRes.data.length === 0) {
    console.log('api_bookitem_prepareCreate: book meta not existing')
    return {
      success: true,
      bookMetaId: null,
      metaExists: false,
      existingItemCount: 0,
      needUserConfirm: false
    }
  }
  
  // 情况 2：meta 已存在，需根据是否套装做进一步判断 book_item中是否已存在
  const meta = metaRes.data[0]
  const bookMetaId = meta._id
  const isSetFromDB = meta.is_set

  // 2️⃣ 查 item 
  const itemRes = await db.collection('book_item')
    .where({
      family_id: familyId,
      book_meta_id: bookMetaId
    })
    .get()

  const existingItemCount = itemRes.data.length
  let needUserConfirm = false
  let duplicateType = null

  if (!isSetFromDB) { // 非套装书
    console.log('api_bookitem_prepareCreate: 非套装书，重复上架')
    if (existingItemCount  > 0) {
      needUserConfirm = true
      duplicateType = 'normal'
    }
  } else { // 套装书
    // 如果页面没有填写第几本，视为错误
    if (!book.setIndex) {
      console.log('api_bookitem_prepareCreate: 套装书但未给出第几本')
      return {
        success: false,
        message: '请填写套装中的第几本'
      }
    }
    
    // 查找是否已存在相同 set_index
    const conflict = itemRes.data.find(
      item => item.set_index === book.setIndex
    )

    if (conflict) {
      console.log('api_bookitem_prepareCreate: 套装书，本书已上架')
      needUserConfirm = true
      duplicateType = 'set_conflict'
    }
  }
  
  console.log('api_bookitem_prepareCreate: done, before return')
  return {
    success: true,
    metaExists: true,
    bookMetaId,
    isSet: isSetFromDB,
    existingItemCount: itemRes.data.length,
    needUserConfirm,
    duplicateType
  }
}
