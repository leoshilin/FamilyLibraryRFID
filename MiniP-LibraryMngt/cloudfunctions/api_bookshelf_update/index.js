// 云函数入口文件
// 修改指定书架的名称
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

  const { bookshelfId, name } = event

  console.log(`api_bookshelf_update: openid=${openid}, bookshelfId=${bookshelfId}, name=${name}`)

  // 参数校验
  if (!bookshelfId) {
    return { success: false, message: 'bookshelfId不能为空' }
  }

  const safeName = (name || '').trim()
  if (!safeName) {
    return { success: false, message: '书架名称不能为空' }
  }

  try {

    // 1. 权限检查：通过 resourceType + resourceId 解析 familyId
    const perm = await checkPermission({
      db,
      openid,
      permission: PERMISSIONS.BOOKSHELF_UPDATE,
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

    const now = new Date()

    // 3. 更新书架名称
    await db.collection('bookshelf').doc(bookshelfId).update({
      data: {
        name: safeName,
        updated_by: perm.user._id,
        updated_at: now
      }
    })

    return {
      success: true,
      bookshelf: {
        _id: bookshelf._id,
        familyId: bookshelf.familyId,
        name: safeName,
        sort_order: bookshelf.sort_order,
        status: bookshelf.status,
        updated_at: now
      }
    }

  } catch (err) {
    console.error('api_bookshelf_update error:', err)
    return { success: false, message: err.message }
  }

}
