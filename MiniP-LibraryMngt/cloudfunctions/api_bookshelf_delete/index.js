// 云函数入口文件
// 逻辑删除指定书架：检查无在架图书后标记为 DISABLED，并重排 sort_order
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

// 引入权限公共模块
const {
  PERMISSIONS,
  RESOURCE_TYPES,
  checkPermission
} = require('./common/permission')

exports.main = async (event) => {

  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  const { bookshelfId } = event

  console.log(`api_bookshelf_delete: openid=${openid}, bookshelfId=${bookshelfId}`)

  // 参数校验
  if (!bookshelfId) {
    return { success: false, message: 'bookshelfId不能为空' }
  }

  try {

    // 1. 权限检查
    const perm = await checkPermission({
      db,
      openid,
      permission: PERMISSIONS.BOOKSHELF_DELETE,
      resourceType: RESOURCE_TYPES.BOOKSHELF,
      resourceId: bookshelfId
    })

    if (!perm.allowed) {
      return { success: false, message: perm.message }
    }

    // 2. 查询书架，确保存在且状态为 ACTIVE
    const bookshelfRes = await db.collection('bookshelf')
      .doc(bookshelfId)
      .get()

    const bookshelf = bookshelfRes.data

    if (!bookshelf || bookshelf.status !== 'ACTIVE') {
      return { success: false, message: '书架不存在或已失效' }
    }

    // 3. 检查该书架下是否有在架图书
    const activeItemsRes = await db.collection('book_item')
      .where({
        bookshelf_id: bookshelfId,
        inventory_status: 'in_stock',
        fg_delete: db.command.neq(true)
      })
      .count()

    if (activeItemsRes.total > 0) {
      return { success: false, message: '该书架下存在在架图书，无法删除' }
    }

    const now = new Date()
    const familyId = bookshelf.family_id

    // 4. 使用事务：删除书架 + 重排 sort_order
    const transaction = await db.startTransaction()

    try {

      // 4a. 逻辑删除书架
      await transaction.collection('bookshelf').doc(bookshelfId).update({
        data: {
          status: 'DISABLED',
          updated_by: perm.user._id,
          updated_at: now
        }
      })

      // 4b. 查询同家庭下剩余 ACTIVE 书架，按 sort_order 升序
      const remainingRes = await transaction.collection('bookshelf')
        .where({
          family_id: familyId,
          status: 'ACTIVE'
        })
        .orderBy('sort_order', 'asc')
        .get()

      // 4c. 重排 sort_order 为 1, 2, 3...
      for (let i = 0; i < remainingRes.data.length; i++) {
        const shelf = remainingRes.data[i]
        const newOrder = i + 1
        if (shelf.sort_order !== newOrder) {
          await transaction.collection('bookshelf').doc(shelf._id).update({
            data: {
              sort_order: newOrder,
              updated_at: now
            }
          })
        }
      }

      await transaction.commit()

      return { success: true }

    } catch (txErr) {
      await transaction.rollback()
      console.error('事务失败，已回滚:', txErr)
      return { success: false, message: '删除书架失败，已回滚' }
    }

  } catch (err) {
    console.error('api_bookshelf_delete error:', err)
    return { success: false, message: err.message }
  }

}
