// 云函数入口文件
// 获取用户信息：
//  - 不传 userId：返回当前登录用户（按 openid 解析）+ 当前家庭权限集
//  - 传 userId：返回该指定用户的基础档案（用于家庭成员查看等场景）
// 对应设计文档 A3（api_user_get）。需求依据：F1 用户注册登录管理、F2 家庭创建与成员管理。
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

// 将 user 文档转换为前端实体（camelCase，对齐规范：API 返回全部 camelCase）
function toUserEntity(user) {
  if (!user) return null
  return {
    _id: user._id,
    openid: user.openid,
    nickName: user.nickName,
    currentFamilyId: user.current_family_id,
    role: user.role,
    status: user.status,
    createdAt: user.created_at,
    updatedAt: user.updated_at
  }
}

// 引入权限公共模块（与 api_user_login 一致）
const {
  getCurrentUser,
  buildFamilyPermissions
} = require('./common/permission')

exports.main = async (event, context) => {

  const { userId } = event

  try {

    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID
    console.log(`api_user_get: userId =${userId || '(current)'} openid =${openid}`)

    // —— 指定用户：仅按 _id 返回基础档案，不返回权限集（避免暴露他人家庭权限）——
    if (userId) {

      const targetRes = await db
        .collection('user')
        .doc(userId)
        .get()

      const target = targetRes.data

      if (!target) {
        return { success: false, message: '用户不存在' }
      }

      return {
        success: true,
        user: toUserEntity(target)
      }

    }

    // —— 当前登录用户：按 openid 解析 ——
    const user = await getCurrentUser(db, openid)

    if (!user) {
      return { success: false, message: '用户未注册' }
    }

    // 已注册用户：构建当前家庭下的权限集（与 api_user_login 返回语义一致）
    const permissions = await buildFamilyPermissions(db, user)

    return {
      success: true,
      user: toUserEntity(user),
      permissions
    }

  } catch (err) {

    console.error(err)

    return {
      success: false,
      message: err.message
    }

  }

}
