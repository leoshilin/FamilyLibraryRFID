// 云函数入口文件
// 处理指定单本书籍的下架处理（'废旧处理', '捐赠', '丢失' etc），并保存inventory_change_log
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
}) // 使用当前云环境
const db = cloud.database()
const _ = db.command

const { PERMISSIONS, RESOURCE_TYPES, checkPermission, getCurrentUser } = require('./common/permission')

// 云函数入口函数
exports.main = async (event) => {

  const {
    itemId: item_id,
    reason
  } = event
  const now = new Date()

  // 反查操作人：不再由客户端传入 operator，统一从登录态解析当前用户
  const wxContext = cloud.getWXContext()
  const user = await getCurrentUser(db, wxContext.OPENID)
  if (!user) {
    return { success: false, message: '用户未注册' }
  }

  // 反查当前家庭：不再由客户端传入 familyId，统一从登录态解析（结论 B+C）
  const familyId = user.currentFamilyId
  if (!familyId) {
    return { success: false, message: '未选择当前家庭' }
  }

  // 权限检查：下架图书需 BOOKITEM_OFFSTOCK 权限（OWNER/MEMBER，GUEST 无此权限）
  const perm = await checkPermission({
    db,
    openid: wxContext.OPENID,
    permission: PERMISSIONS.BOOKITEM_OFFSTOCK,
    familyId
  })
  if (!perm.allowed) {
    return { success: false, message: perm.message }
  }

  console.log(`api_bookitem_offstock start, item_id=${item_id}, family_id=${familyId}, reason=${reason}`)

  // 执行下架的事务代码
  const transaction = await db.startTransaction()

  try {
    //0. 下架前状态检查，确保可下架
    const itemRes = await transaction.collection('book_item')
      .where({
        _id: item_id,
        family_id: familyId
      })
      .get()

    if (!itemRes.data.length) {
      throw new Error(`当前家庭${familyId}下不存在书籍${item_id}`)
    }

    const item = itemRes.data[0]

    if (item.inventory_status !== 'in_stock') {
      throw new Error(`书籍${item_id}当前状态${item.inventory_status}下不可下架`)
    }


    // 1️⃣ 更新 book_item 状态
    await db.collection('book_item')
      .where({
        _id: item_id,
        family_id: familyId
      })
      .update({
        data: {
          inventory_status: 'off_stock',
          updated_at: now
        }
      })

    // 2️⃣ 写入库存变更日志
    await db.collection('inventory_change_log')
      .add({
        data: {
          item_id: item_id,
          family_id: familyId,
          change_type: 'off_stock',
          reason: reason,
          operator: user._id,
          created_at: now
        }
      })

    // 3️⃣ 提交事务
    await transaction.commit()

    return {
      success: true
    }
  } catch (err) {
    console.error('事务失败，准备回滚:', err)

    // 4️⃣ 回滚
    await transaction.rollback()

    return {
      success: false,
      message: '下架操作失败，已回滚'
    }
  }
}