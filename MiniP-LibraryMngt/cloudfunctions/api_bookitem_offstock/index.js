// 云函数入口文件
// 处理指定单本书籍的下架处理（'废旧处理', '捐赠', '丢失' etc），并保存inventory_change_log
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
}) // 使用当前云环境
const db = cloud.database()
const _ = db.command

// 云函数入口函数
exports.main = async (event) => {

  const {
    item_id,
    family_id,
    operator,
    reason
  } = event
  const now = new Date()
  console.log(`api_bookitem_offstock start, item_id=${item_id}, family_id=${family_id}, reason=${reason},operator=${operator}`)

  // 执行下架的事务代码
  const transaction = await db.startTransaction()

  try {
    //0. 下架前状态检查，确保可下架
    const itemRes = await transaction.collection('book_item')
      .where({
        _id: item_id,
        family_id: family_id
      })
      .get()

    if (!itemRes.data.length) {
      throw new Error(`当前家庭${family_id}下不存在书籍${item_id}`)
    }

    const item = itemRes.data[0]

    if (item.inventory_status !== 'in_stock') {
      throw new Error(`书籍${item_id}当前状态${item.inventory_status}下不可下架`)
    }


    // 1️⃣ 更新 book_item 状态
    await db.collection('book_item')
      .where({
        _id: item_id,
        family_id: family_id
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
          family_id: family_id,
          change_type: 'off_stock',
          reason: reason,
          operator: operator,
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