/* Function
 * 修改指定实体书籍所在的书架
 * 入参：itemId, familyId, bookshelfId（operator 由服务端从登录态反查，不再由客户端传入）
 * 权限：BOOKITEM_UPDATE
 */

// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境

const db = cloud.database()

// 引入权限公共模块
const {
  PERMISSIONS,
  RESOURCE_TYPES,
  checkPermission,
  getCurrentUser
} = require('./common/permission')

// 云函数入口函数
exports.main = async (event) => {
  console.log('api_bookitem_updateBookshelf: start')

  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  const {
    itemId,
    bookshelfId
  } = event

  console.log(`api_bookitem_updateBookshelf: openid=${openid}, itemId=${itemId}, bookshelfId=${bookshelfId}`)

  // 参数校验
  if (!itemId) {
    return { success: false, message: 'itemId不能为空' }
  }
  if (!bookshelfId) {
    return { success: false, message: 'bookshelfId不能为空' }
  }

  // 反查操作人 & 当前家庭：不再由客户端传入 operator/familyId（结论 A+B+C）
  const user = await getCurrentUser(db, openid)
  if (!user) {
    return { success: false, message: '用户未注册' }
  }
  const familyId = user.current_family_id
  if (!familyId) {
    return { success: false, message: '未选择当前家庭' }
  }

  try {

    // 1. 权限检查：通过 resourceType + resourceId 解析 familyId
    const perm = await checkPermission({
      db,
      openid,
      permission: PERMISSIONS.BOOKITEM_UPDATE,
      familyId,
      resourceType: RESOURCE_TYPES.BOOK_ITEM,
      resourceId: itemId
    })

    if (!perm.allowed) {
      return { success: false, message: perm.message }
    }

    // 2. 校验目标书架存在且属于同一家庭
    const bookshelfRes = await db.collection('bookshelf')
      .doc(bookshelfId)
      .get()

    const bookshelf = bookshelfRes.data

    if (!bookshelf || bookshelf.status !== 'ACTIVE') {
      return { success: false, message: '目标书架不存在或已失效' }
    }

    if (bookshelf.family_id !== familyId) {
      return { success: false, message: '目标书架不属于当前家庭' }
    }

    // 3. 校验书籍存在且属于当前家庭
    const itemRes = await db.collection('book_item')
      .where({
        _id: itemId,
        family_id: familyId,
        fg_delete: false
      })
      .get()

    if (!itemRes.data.length) {
      return { success: false, message: '书籍不存在或已删除' }
    }

    const item = itemRes.data[0]

    // 书架未变更则直接返回成功
    if (item.bookshelf_id === bookshelfId) {
      return { success: true, message: '书架未变更' }
    }

    // 4. 更新书籍所在书架
    const now = new Date()
    await db.collection('book_item').doc(itemId).update({
      data: {
        bookshelf_id: bookshelfId,
        updated_at: now
        // book_item 不再保留 operator：移动书架操作人统一记录于 inventory_change_log
      }
    })

    console.log(`api_bookitem_updateBookshelf: 书籍${itemId}书架已更新为${bookshelfId}`)

    return {
      success: true,
      bookshelfName: bookshelf.name
    }

  } catch (err) {
    console.error('api_bookitem_updateBookshelf error:', err)
    return { success: false, message: err.message }
  }

}
