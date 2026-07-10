/* Function
 * 如果 meta 不存在 → 创建
 * 创建 book_item（含 set_index）
 */

// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境

// 写入时做格式清洗
function normalizeInput(input) {
  return {
    isbn: input.isbn,
    title: input.title ?? '',
    authors: input.authors ?? '',
    publisher: input.publisher ?? '',
    publish_year: input.publish_year ?? '',
    price: input.price ?? '',
    binding: input.binding ?? '',
    cover_url: input.cover_url ?? '',

    is_set: input.is_set ?? false,
    set_total_count: input.set_total_count ?? null,
    source: input.source ?? '',
    created_at: input.created_at
  }
}
// 云函数入口函数
exports.main = async (event) => {
  console.log('api_bookitem_create start')
  const {
    isbn,
    familyId,
    operator,
    bookshelfId,
    book,
    editionType
  } = event

  const db = cloud.database()
  const now = new Date()

  console.log('api_bookitem_create params:', {
    isbn,
    familyId,
    operator,
    bookshelfId,
    book,
    editionType
  })
  
  // 1️⃣ 查 meta
  let metaRes = await db.collection('book_meta')
    .where({ isbn })
    .limit(1)
    .get()

  let bookMetaId

  if (metaRes.data.length === 0) {
    //book_meta中不存在，则使用前端页面输入的数据创建主数据（首先做格式清洗）
    
    // 格式清洗
    const cleanMeta = normalizeInput({      
        isbn: isbn,
        title: book.title,
        authors: book.authors,
        publisher: book.publisher,
        publish_year: book.publishYear,
        price: book.price,
        source: book.source,
        is_set: book.isSet,        
        set_total_count: book.setTotalCount,
        binding: book.binding,
        cover_url: book.cover_url,    
        created_at: now      
    })

    // 写入
    const insertRes = await db.collection('book_meta').add({
      data: cleanMeta
    })
    bookMetaId = insertRes._id
    console.log('api_bookitem_create params: create book in book_meta done: ',bookMetaId)
  } else {
    bookMetaId = metaRes.data[0]._id
    console.log('api_bookitem_create params: found book in book_meta done: ',bookMetaId)
  }

  // 2️⃣ 创建 book_item  
    const itemRes = await db.collection('book_item').add({
    data: {
      family_id: familyId,      
      bookshelf_id: bookshelfId,
      book_meta_id: bookMetaId,
      set_index: book.isSet ? book.setIndex : null,
      edition_type: editionType,
      status: 'in_stock',
      rfid_tag_id: null,
      fg_delete: false,
      created_at: now,
      updated_at: now
    }
  })
  console.log('api_bookitem_create params: create book in book_item done: ',itemRes._id)

  // 组装返回的 bookItem 实体（camelCase，对齐文档 A2：返回完整实体而非仅 ID）
  const itemId = itemRes._id
  const bookItem = {
    _id: itemId,
    familyId: familyId,
    bookshelfId: bookshelfId,
    bookMetaId: bookMetaId,
    setIndex: book.isSet ? book.setIndex : null,
    editionType: editionType,
    status: 'in_stock',
    rfidTagId: null,
    fgDelete: false,
    createdAt: now,
    updatedAt: now
  }

  // 3. 写入库存变更日志
  await db.collection('inventory_change_log')
    .add({
      data: {
        item_id: itemId,
        family_id: familyId,
        change_type: 'in_stock',
        reason: 'new book',
        operator: operator,
        created_at: now
      }
    })

  return {
    success: true,
    bookItem: bookItem
  }
}