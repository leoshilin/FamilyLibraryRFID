// 云函数入口文件
// 获取指定家庭下所有 ACTIVE 书架列表，按 sort_order 升序
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

// 引入权限公共模块
const { PERMISSIONS, checkPermission, getCurrentUser } = require('./common/permission')

exports.main = async (event) => {

  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  console.log(`api_bookshelf_list: openid=${openid}`)

  try {

    // 反查操作人 & 当前家庭：不再由客户端传入 operator/familyId，统一从登录态解析（结论 B+C）
    const user = await getCurrentUser(db, openid)
    if (!user) {
      return { success: false, message: '用户未注册' }
    }
    const familyId = user.current_family_id
    if (!familyId) {
      return { success: false, message: '未选择当前家庭' }
    }

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
        family_id: familyId,
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
        familyId: shelf.family_id,
        name: shelf.name,
        sortOrder: shelf.sort_order,
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
