// 云函数入口文件
// 获取当前用户所属的所有家庭列表（自己创建的 + 受邀加入的）
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

// 引入权限公共模块
const { getCurrentUser } = require('./common/permission')

exports.main = async (event) => {

  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  console.log(`api_family_list: openid=${openid}`)

  try {

    // 1. 获取当前用户
    const user = await getCurrentUser(db, openid)

    if (!user) {
      return { success: false, message: '用户未注册' }
    }

    if (user.status !== 'ACTIVE') {
      return { success: false, message: '用户状态不可用' }
    }

    // 2. 查询 user_family 中该用户的所有记录
    const ufRes = await db.collection('user_family')
      .where({
        userId: user._id
      })
      .get()

    if (ufRes.data.length === 0) {
      return {
        success: true,
        list: []
      }
    }

    // 3. 获取所有关联家庭的详情
    const familyIds = ufRes.data.map(uf => uf.familyId)
    const familyRes = await db.collection('family')
      .where({
        _id: db.command.in(familyIds)
      })
      .get()

    // 4. 构建家庭 ID → 家庭详情的映射
    const familyMap = {}
    familyRes.data.forEach(f => {
      familyMap[f._id] = f
    })

    // 5. 构建返回列表
    const list = ufRes.data.map(uf => {
      const family = familyMap[uf.familyId]
      return {
        familyId: uf.familyId,
        name: family ? family.name : '(已删除)',
        role: uf.role,
        status: family ? family.status : 'DISABLED',
        isCurrent: uf.familyId === user.currentFamilyId
      }
    })

    return {
      success: true,
      list
    }

  } catch (err) {
    console.error('api_family_list error:', err)
    return { success: false, message: err.message }
  }

}
