// 云函数入口文件
// 创建家庭：注册用户可创建家庭并成为 OWNER，同时创建默认书架
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

// 引入权限公共模块
const { PERMISSIONS, checkPermission } = require('./common/permission')

exports.main = async (event) => {

  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  const { name } = event
  const familyName = (name || '').trim() || '我的家庭'

  console.log(`api_family_create: openid=${openid}, name=${familyName}`)

  try {

    // 1. 权限检查：注册用户即可创建家庭
    const perm = await checkPermission({
      db,
      openid,
      permission: PERMISSIONS.FAMILY_CREATE
    })

    if (!perm.allowed) {
      return { success: false, message: perm.message }
    }

    const user = perm.user

    // 2. 检查用户是否已创建过家庭（一个用户只能创建一个家庭）
    const existingOwner = await db.collection('user_family')
      .where({
        user_id: user._id,
        role: 'OWNER'
      })
      .limit(1)
      .get()

    if (existingOwner.data.length > 0) {
      return { success: false, message: '当前用户已创建家庭' }
    }

    const now = new Date()

    // 3. 使用事务：创建家庭 + 默认书架 + user_family 关系
    const transaction = await db.startTransaction()

    try {

      // 3a. 创建家庭
      const familyRes = await transaction.collection('family').add({
        data: {
          name: familyName,
          status: 'ACTIVE',
          created_by: user._id,
          created_at: now
        }
      })

      const familyId = familyRes._id

      // 3b. 创建默认书架
      const bookshelfRes = await transaction.collection('bookshelf').add({
        data: {
          name: '我的书架',
          family_id: familyId,
          sort_order: 1,
          status: 'ACTIVE',
          created_by: user._id,
          created_at: now
        }
      })

      // 3c. 在 user_family 中建立 OWNER 关系
      await transaction.collection('user_family').add({
        data: {
          user_id: user._id,
          family_id: familyId,
          role: 'OWNER',
          joined_at: now
        }
      })

      // 3d. 更新用户的当前家庭
      await transaction.collection('user').doc(user._id).update({
        data: {
          current_family_id: familyId
        }
      })

      await transaction.commit()

      return {
        success: true,
        familyId: familyId,
        bookshelfId: bookshelfRes._id,
        family: {
          _id: familyId,
          name: familyName,
          status: 'ACTIVE'
        }
      }

    } catch (txErr) {
      await transaction.rollback()
      console.error('事务失败，已回滚:', txErr)
      return { success: false, message: '创建家庭失败，已回滚' }
    }

  } catch (err) {
    console.error('api_family_create error:', err)
    return { success: false, message: err.message }
  }

}
