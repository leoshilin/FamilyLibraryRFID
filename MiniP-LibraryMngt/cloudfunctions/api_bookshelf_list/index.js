// 云函数入口文件
// 获取指定家庭下所有 ACTIVE 书架列表，按 sort_order 升序
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

// 引入权限公共模块
const { PERMISSIONS, checkPermission } = require('./common/permission')

exports.main = async (event) => {

  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  const { familyId } = event

  console.log(`api_bookshelf_list: openid=${openid}, familyId=${familyId}`)

  // 参数校验
  if (!familyId) {
    return { success: false, message: 'familyId不能为空' }
  }

  try {

    // 1. 权限检查
    const perm = await checkPermission({
      db,
      openid,
      permission: PERMISSIONS.BOOKSHELF_LIST,
      familyId
    })

    if (!perm.allowed) {
      return { success: false, message: perm.message }
    }

    // 2. 查询该家庭下所有 ACTIVE 书架，按 sort_order 升序
    const bookshelfRes = await db.collection('bookshelf')
      .where({
        familyId: familyId,
        status: 'ACTIVE'
      })
      .orderBy('sort_order', 'asc')
      .get()

    // 3. 逐个查询在架图书数量
    const list = []

    for (let i = 0; i < bookshelfRes.data.length; i++) {

      const shelf = bookshelfRes.data[i]

      const countRes = await db.collection('book_item')
        .where({
          bookshelf_id: shelf._id,
          inventory_status: 'in_stock',
          fg_delete: _.neq(true)
        })
        .count()

      list.push({
        _id: shelf._id,
        familyId: shelf.familyId,
        name: shelf.name,
        sort_order: shelf.sort_order,
        status: shelf.status,
        bookCount: countRes.total
      })

    }

    return {
      success: true,
      list
    }

  } catch (err) {
    console.error('api_bookshelf_list error:', err)
    return { success: false, message: err.message }
  }

}
