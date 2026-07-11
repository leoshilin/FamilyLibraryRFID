// 云函数入口文件
// 根据当前微信 openid 查询系统用户，只查询不创建
// 已注册用户返回权限信息，供前端控制 UI 展示
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

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

// 引入权限公共模块
const {
  buildFamilyPermissions
} = require('./common/permission')

exports.main = async (event, context) => {

  try {

    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID
    console.log(`api_user_login: openid =${openid} `)
    
    const userRes = await db
      .collection('user')
      .where({
        openid
      })
      .limit(1)
      .get()

    if (userRes.data.length === 0) {

      return {
        success: true,
        registered: false
      }

    }

    const user = userRes.data[0]

    // 已注册用户：构建当前家庭下的权限集
    const permissions = await buildFamilyPermissions(db, user)

    return {
      success: true,
      registered: true,
      user: toUserEntity(user),
      permissions
    }

  } catch (err) {

    console.error(err)

    return {
      success: false,
      error: err.message
    }

  }

}
