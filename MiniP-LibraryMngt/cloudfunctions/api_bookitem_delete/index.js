// 云函数入口文件
// 执行彻底删除（非下架）书籍处理
// book_item中设置fg_delete 为true，并在inventory_change_log中记录
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境
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

  // 权限检查：彻底删除图书需 BOOKITEM_DELETE 权限（OWNER/MEMBER，GUEST 无此权限）
  const perm = await checkPermission({
    db,
    openid: wxContext.OPENID,
    permission: PERMISSIONS.BOOKITEM_DELETE,
    familyId
  })
  if (!perm.allowed) {
    return { success: false, message: perm.message }
  }

  console.log(`api_bookitem_delete start, item_id=${item_id}, family_id=${familyId}`)

  // 执行删除前的事务代码
  const transaction = await db.startTransaction()

  try {
    //0. 删除前状态检查，确保可删除
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

    const isNotOffStock = item.inventory_status !== 'off_stock'
    const isDeleted = item.fg_delete === true
    if (isNotOffStock || isDeleted) {
      throw new Error(`书籍${item_id}当前状态${item.inventory_status}下不可删除`)
    }


    // 1️⃣ 更新 book_item 状态
    await db.collection('book_item')
      .where({
        _id: item_id,
        family_id: familyId
      })
      .update({
        data: {
          fg_delete: true,
          updated_at: now
        }
      })

    // 2️⃣ 写入库存变更日志
    await db.collection('inventory_change_log')
      .add({
        data: {
          item_id: item_id,
          family_id: familyId,
          change_type: 'book delete',          
          operator: user._id,
          reason: '管理员删除（逻辑）',
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
      message: '删除操作失败，已回滚'
    }
  }
}