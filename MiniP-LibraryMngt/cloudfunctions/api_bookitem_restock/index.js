// 云函数入口文件
// 处理指定单本已下架书籍的再次上架处理，并保存inventory_change_log

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
    itemId: item_id
  } = event
  const now = new Date()

  // 反查操作人：不再由客户端传入 operator，统一从登录态解析当前用户
  const wxContext = cloud.getWXContext()
  const user = await getCurrentUser(db, wxContext.OPENID)
  if (!user) {
    return { success: false, message: '用户未注册' }
  }

  // 反查当前家庭：不再由客户端传入 familyId，统一从登录态解析（结论 B+C）
  const familyId = user.current_family_id
  if (!familyId) {
    return { success: false, message: '未选择当前家庭' }
  }

  // 权限检查：重新上架图书需 BOOKITEM_RESTOCK 权限（OWNER/MEMBER，GUEST 无此权限）
  const perm = await checkPermission({
    db,
    openid: wxContext.OPENID,
    permission: PERMISSIONS.BOOKITEM_RESTOCK,
    familyId
  })
  if (!perm.allowed) {
    return { success: false, message: perm.message }
  }

  console.log(`onBokItem start, item_id=${item_id}, family_id=${familyId}`)

  // 执行重新上架的事务代码
  const transaction = await db.startTransaction()
  try {
    //0. 重新上架前状态检查，确保可重新上架
    const itemRes = await transaction.collection('book_item')
      .where({
        _id: item_id,
        family_id: familyId,
        fg_delete: false
      })
      .get()

    if (!itemRes.data.length) {
      throw new Error(`当前家庭${familyId}下不存在书籍${item_id}`)
    }

    const item = itemRes.data[0]

    if (item.inventory_status !== 'off_stock') {
      throw new Error(`书籍${item_id}当前状态${item.inventory_status}下不可重新上架`)
    }

    // 1️⃣ 更新 book_item 状态
    await db.collection('book_item')
      .where({
        _id: item_id,
        family_id: familyId
      })
      .update({
        data: {
          inventory_status: 'in_stock',
          on_shelf_at: now,
          updated_at: now
          // book_item 不再保留 operator：上下架操作人统一记录于 inventory_change_log（见步骤 2）
        }
      })

    // 2️⃣ 写入库存变更日志
    await db.collection('inventory_change_log')
      .add({
        data: {
          item_id: item_id,
          family_id: familyId,
          change_type: 'in_stock',
          reason: '重新上架',
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
      message: '重新上架操作失败，已回滚'
    }
  }
}