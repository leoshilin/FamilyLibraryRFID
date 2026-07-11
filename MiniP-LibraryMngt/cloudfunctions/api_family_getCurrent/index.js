// 云函数入口文件
// 获取当前登录用户访问中的家庭信息
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

// 引入权限公共模块
const { getCurrentUser, getFamilyRole } = require('./common/permission')

exports.main = async (event) => {

  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  console.log(`api_family_getCurrent: openid=${openid}`)

  try {

    // 1. 获取当前用户
    const user = await getCurrentUser(db, openid)

    if (!user) {
      return { success: false, message: '用户未注册' }
    }

    if (user.status !== 'ACTIVE') {
      return { success: false, message: '用户状态不可用' }
    }

    // 2. 无当前家庭
    if (!user.current_family_id) {
      return {
        success: true,
        family: null,
        role: null,
        bookshelfCount: 0
      }
    }

    // 3. 查询家庭信息
    const familyRes = await db.collection('family')
      .doc(user.current_family_id)
      .get()

    const family = familyRes.data

    if (!family || family.status !== 'ACTIVE') {
      return {
        success: true,
        family: null,
        role: null,
        bookshelfCount: 0
      }
    }

    // 4. 获取用户在该家庭中的角色
    const role = await getFamilyRole(db, user._id, user.current_family_id)

    // 5. 统计 ACTIVE 书架数量
    const bookshelfCountRes = await db.collection('bookshelf')
      .where({
        family_id: user.current_family_id,
        status: 'ACTIVE'
      })
      .count()

    return {
      success: true,
      family: {
        _id: family._id,
        name: family.name,
        status: family.status,
        createdBy: family.created_by,
        createdAt: family.created_at
      },
      role,
      bookshelfCount: bookshelfCountRes.total
    }

  } catch (err) {
    console.error('api_family_getCurrent error:', err)
    return { success: false, message: err.message }
  }

}
