// 云函数入口文件
// 切换用户的当前默认家庭
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

// 引入权限公共模块
const { getCurrentUser } = require('./common/permission')

exports.main = async (event) => {

  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  const { familyId } = event

  console.log(`api_family_switchCurrent: openid=${openid}, familyId=${familyId}`)

  // 参数校验
  if (!familyId) {
    return { success: false, message: 'familyId不能为空' }
  }

  try {

    // 1. 获取当前用户
    const user = await getCurrentUser(db, openid)

    if (!user) {
      return { success: false, message: '用户未注册' }
    }

    if (user.status !== 'ACTIVE') {
      return { success: false, message: '用户状态不可用' }
    }

    // 2. 检查用户是否属于该家庭
    const ufRes = await db.collection('user_family')
      .where({
        userId: user._id,
        familyId: familyId
      })
      .limit(1)
      .get()

    if (ufRes.data.length === 0) {
      return { success: false, message: '用户不属于该家庭' }
    }

    // 3. 确认家庭存在且状态为 ACTIVE
    const familyRes = await db.collection('family')
      .doc(familyId)
      .get()

    if (!familyRes.data || familyRes.data.status !== 'ACTIVE') {
      return { success: false, message: '家庭不存在或已失效' }
    }

    // 4. 更新 currentFamilyId
    await db.collection('user').doc(user._id).update({
      data: {
        currentFamilyId: familyId
      }
    })

    return { success: true }

  } catch (err) {
    console.error('api_family_switchCurrent error:', err)
    return { success: false, message: err.message }
  }

}
