// 云函数入口文件
// 执行彻底删除（非下架）书籍处理
// book_item中设置fg_delete 为true，并在inventory_change_log中记录
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境
const db = cloud.database()
const _ = db.command

// 云函数入口函数
exports.main = async (event) => {
  const {
    item_id,
    family_id,
    operator
  } = event
  const now = new Date()
  console.log(`api_bookitem_delete start, item_id=${item_id}, family_id=${family_id}, operator=${operator}`)

  // 执行删除前的事务代码
  const transaction = await db.startTransaction()

  try {
    //0. 删除前状态检查，确保可删除
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

    const isNotOffStock = item.inventory_status !== 'off_stock'
    const isDeleted = item.fg_delete === true
    if (isNotOffStock || isDeleted) {
      throw new Error(`书籍${item_id}当前状态${item.inventory_status}下不可删除`)
    }


    // 1️⃣ 更新 book_item 状态
    await db.collection('book_item')
      .where({
        _id: item_id,
        family_id: family_id
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
          family_id: family_id,
          change_type: 'book delete',          
          operator: operator,
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