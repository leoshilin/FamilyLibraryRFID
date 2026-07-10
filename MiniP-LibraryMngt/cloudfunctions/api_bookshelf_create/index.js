// 云函数入口文件
// 在指定家庭下创建书架，自动计算 sort_order，上限 99
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

// 引入权限公共模块
const { PERMISSIONS, checkPermission, getCurrentUser } = require('./common/permission')

exports.main = async (event) => {

  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  const { name } = event

  console.log(`api_bookshelf_create: openid=${openid}, name=${name}`)

  const safeName = (name || '').trim()
  if (!safeName) {
    return { success: false, message: '书架名称不能为空' }
  }

  try {

    // 反查操作人 & 当前家庭：不再由客户端传入 operator/familyId，统一从登录态解析（结论 B+C）
    const user = await getCurrentUser(db, openid)
    if (!user) {
      return { success: false, message: '用户未注册' }
    }
    const familyId = user.currentFamilyId
    if (!familyId) {
      return { success: false, message: '未选择当前家庭' }
    }

    // 1. 权限检查
    const perm = await checkPermission({
      db,
      openid,
      permission: PERMISSIONS.BOOKSHELF_CREATE,
      familyId
    })

    if (!perm.allowed) {
      return { success: false, message: perm.message }
    }

    // 2. 确认家庭存在且状态为 ACTIVE
    const familyRes = await db.collection('family')
      .doc(familyId)
      .get()

    const family = familyRes.data

    if (!family || family.status !== 'ACTIVE') {
      return { success: false, message: '家庭不存在或已失效' }
    }

    // 3. 统计当前 ACTIVE 书架数量，检查上限
    const countRes = await db.collection('bookshelf')
      .where({
        familyId: familyId,
        status: 'ACTIVE'
      })
      .count()

    if (countRes.total >= 99) {
      return { success: false, message: '书架数量已达上限（99个）' }
    }

    // 4. 计算 sort_order：当前最大 sort_order + 1
    const maxSortRes = await db.collection('bookshelf')
      .where({
        familyId: familyId,
        status: 'ACTIVE'
      })
      .orderBy('sort_order', 'desc')
      .limit(1)
      .get()

    const sortOrder = maxSortRes.data.length > 0
      ? maxSortRes.data[0].sort_order + 1
      : 1

    const now = new Date()

    // 5. 创建书架
    const bookshelfRes = await db.collection('bookshelf').add({
      data: {
        name: safeName,
        familyId: familyId,
        sort_order: sortOrder,
        status: 'ACTIVE',
        created_by: perm.user._id,
        created_at: now
      }
    })

    return {
      success: true,
      bookshelfId: bookshelfRes._id,
      bookshelf: {
        _id: bookshelfRes._id,
        familyId: familyId,
        name: safeName,
        sort_order: sortOrder,
        status: 'ACTIVE'
      }
    }

  } catch (err) {
    console.error('api_bookshelf_create error:', err)
    return { success: false, message: err.message }
  }

}
