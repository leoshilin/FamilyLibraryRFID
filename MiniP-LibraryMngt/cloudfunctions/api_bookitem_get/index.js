// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境
const db = cloud.database()

// 引入权限公共模块
const { PERMISSIONS, RESOURCE_TYPES, checkPermission } = require('./common/permission')

// 将 book_item 文档转换为前端实体（camelCase，对齐文档 A6）
function toBookItemEntity(item) {
  if (!item) return null
  return {
    _id: item._id,
    familyId: item.family_id,
    bookshelfId: item.bookshelf_id,
    bookMetaId: item.book_meta_id,
    setIndex: item.set_index,
    editionType: item.edition_type,
    inventoryStatus: item.inventory_status,
    rfidTagId: item.rfid_tag_id || null,
    fgDelete: item.fg_delete || false,
    createdAt: item.created_at,
    onShelfAt: item.on_shelf_at || null,
    updatedAt: item.updated_at
  }
}

// 将 book_meta 文档转换为前端实体（camelCase，对齐文档 A6）
function toBookMetaEntity(meta) {
  if (!meta) return null
  return {
    _id: meta._id,
    isbn: meta.isbn,
    title: meta.title ?? '',
    authors: meta.authors ?? '',
    publisher: meta.publisher ?? '',
    publishYear: meta.publish_year ?? '',
    price: meta.price ?? '',
    binding: meta.binding ?? '',
    cover_url: meta.cover_url ?? '',
    isSet: meta.is_set ?? false,
    setTotalCount: meta.set_total_count ?? 0,
    source: meta.source ?? ''
  }
}

// 将 bookshelf 文档转换为前端实体（camelCase，对齐文档 A6）
function toBookshelfEntity(shelf) {
  if (!shelf) return null
  return {
    _id: shelf._id,
    familyId: shelf.familyId,
    name: shelf.name,
    sortOrder: shelf.sort_order,
    status: shelf.status
  }
}

// 云函数入口函数
// 使用 book_item 的 id 查询，自动关联 book_meta 与 bookshelf，返回完整展示对象
exports.main = async (event, context) => {
  console.log('api_bookitem_get: start')
  const { itemId } = event
  if (!itemId) {
    return {
      success: false,
      message: '缺少 itemId'
    }
  }

  // 权限检查：查询实体书需 BOOKITEM_SEARCH 权限（OWNER/MEMBER/GUEST 均具备）
  // 通过 resourceType + resourceId 由书籍自身解析所属家庭并校验家庭归属与权限
  const wxContext = cloud.getWXContext()
  const perm = await checkPermission({
    db,
    openid: wxContext.OPENID,
    permission: PERMISSIONS.BOOKITEM_SEARCH,
    resourceType: RESOURCE_TYPES.BOOK_ITEM,
    resourceId: itemId
  })
  if (!perm.allowed) {
    return { success: false, message: perm.message }
  }

  try {
    // 1️⃣ 查询 book_item
    const itemRes = await db.collection('book_item')
                              .doc(itemId)
                              .get()

    if (!itemRes.data) {
      return {
        success: false,
        message: '未找到实体书'
      }
    }

    const bookItem = toBookItemEntity(itemRes.data)
    console.log(`api_bookitem_get: read book_item done, itemId=${itemId}`)

    // 2️⃣ 查询 book_meta（可能不存在，容错）
    let bookMeta = null
    try {
      const metaRes = await db.collection('book_meta')
                              .doc(bookItem.bookMetaId)
                              .get()
      bookMeta = toBookMetaEntity(metaRes.data || null)
    } catch (e) {
      // meta 不存在时，忽略异常
      bookMeta = null
    }
    console.log(`api_bookitem_get: read book_meta done, exists=${!!bookMeta}`)

    // 3️⃣ 查询 bookshelf（可能不存在或已失效，容错）
    let bookshelf = null
    try {
      const shelfRes = await db.collection('bookshelf')
                              .doc(bookItem.bookshelfId)
                              .get()
      bookshelf = toBookshelfEntity(shelfRes.data || null)
    } catch (e) {
      bookshelf = null
    }
    console.log(`api_bookitem_get: read bookshelf done, exists=${!!bookshelf}`)

    // 返回完整展示对象（对齐文档 A6：bookItem + bookMeta + bookshelf）
    return {
      success: true,
      bookItem,
      bookMeta,
      bookshelf
    }

  } catch (err) {

    console.error('api_bookitem_get error:', err)

    return {
      success: false,
      message: '数据库查询失败'
    }
  }
}
