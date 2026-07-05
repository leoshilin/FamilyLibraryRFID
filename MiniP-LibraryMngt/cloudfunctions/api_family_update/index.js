// 云函数入口文件
// 修改指定家庭的名称
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

// 引入权限公共模块
const { PERMISSIONS, checkPermission } = require('./common/permission')

exports.main = async (event) => {

  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  const { familyId, name } = event

  console.log(`api_family_update: openid=${openid}, familyId=${familyId}, name=${name}`)

  // 参数校验
  if (!familyId) {
    return { success: false, message: 'familyId不能为空' }
  }

  const safeName = (name || '').trim()
  if (!safeName) {
    return { success: false, message: '家庭名称不能为空' }
  }

  try {

    // 1. 权限检查
    const perm = await checkPermission({
      db,
      openid,
      permission: PERMISSIONS.FAMILY_UPDATE,
      familyId
    })

    if (!perm.allowed) {
      return { success: false, message: perm.message }
    }

    // 2. 查询家庭，确保存在且状态为 ACTIVE
    const familyRes = await db.collection('family')
      .doc(familyId)
      .get()

    const family = familyRes.data

    if (!family || family.status !== 'ACTIVE') {
      return { success: false, message: '家庭不存在' }
    }

    const now = new Date()

    // 3. 更新家庭名称
    await db.collection('family').doc(familyId).update({
      data: {
        name: safeName,
        updated_by: perm.user._id,
        updated_at: now
      }
    })

    return {
      success: true,
      family: {
        _id: family._id,
        name: safeName,
        status: family.status,
        updated_at: now
      }
    }

  } catch (err) {
    console.error('api_family_update error:', err)
    return { success: false, message: err.message }
  }

}
