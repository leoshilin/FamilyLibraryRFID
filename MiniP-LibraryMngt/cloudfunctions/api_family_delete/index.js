// 云函数入口文件
// 逻辑删除指定家庭：检查无 ACTIVE 书架后标记为 DISABLED
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

// 引入权限公共模块
const { PERMISSIONS, checkPermission } = require('./common/permission')

exports.main = async (event) => {

  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  const { familyId } = event

  console.log(`api_family_delete: openid=${openid}, familyId=${familyId}`)

  // 参数校验
  if (!familyId) {
    return { success: false, message: 'familyId不能为空' }
  }

  try {

    // 1. 权限检查
    const perm = await checkPermission({
      db,
      openid,
      permission: PERMISSIONS.FAMILY_DELETE,
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

    // 3. 检查是否存在 ACTIVE 书架
    const activeBookshelves = await db.collection('bookshelf')
      .where({
        familyId: familyId,
        status: 'ACTIVE'
      })
      .count()

    if (activeBookshelves.total > 0) {
      return { success: false, message: '当前家庭下存在有效书架，请先删除书架' }
    }

    // 3b. 删除家庭守卫：检查是否仍有其他成员以该家庭为当前家庭
    // 豁免删除者本人（其 currentFamilyId 会在事务 4b 中清除）
    const _ = db.command
    const otherMemberRes = await db.collection('user')
      .where({
        currentFamilyId: familyId,
        _id: _.neq(perm.user._id)
      })
      .limit(1)
      .get()

    if (otherMemberRes.data && otherMemberRes.data.length > 0) {
      return { success: false, message: '还有其他成员正以该家庭为当前家庭，无法删除' }
    }

    const now = new Date()

    // 4. 使用事务：删除家庭 + 清理用户 currentFamilyId
    const transaction = await db.startTransaction()

    try {

      // 4a. 逻辑删除家庭
      await transaction.collection('family').doc(familyId).update({
        data: {
          status: 'DISABLED',
          updated_by: perm.user._id,
          updated_at: now
        }
      })

      // 4b. 如果当前用户的 currentFamilyId 等于被删除的家庭，清除该字段
      if (perm.user.currentFamilyId === familyId) {
        // 使用 remove 命令删除字段（遵循可选字段不存 null 的设计原则）
        const _ = db.command
        await transaction.collection('user').doc(perm.user._id).update({
          data: {
            currentFamilyId: _.remove()
          }
        })
      }

      await transaction.commit()

      return { success: true }

    } catch (txErr) {
      await transaction.rollback()
      console.error('事务失败，已回滚:', txErr)
      return { success: false, message: '删除家庭失败，已回滚' }
    }

  } catch (err) {
    console.error('api_family_delete error:', err)
    return { success: false, message: err.message }
  }

}
