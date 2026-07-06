/**
 * 数据迁移云函数：script_data_migration
 * 用途：批量修正 book_item 和 inventory_change_log 表中的字段值
 *
 * 处理逻辑：
 * 1. book_item 表：所有行统一设置 bookshelf_id / family_id / operator（存在则更新，不存在则追加）
 * 2. inventory_change_log 表：所有行统一设置 family_id / operator（存在则更新，不存在则追加）
 * 3. inventory_change_log 表：所有行新增 bookshelf_id 字段
 *
 * 使用方式：
 *   在微信开发者工具中右键部署该云函数后，
 *   在云开发控制台 → 云函数 → script_data_migration → 测试 中直接触发即可。
 */

const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

// ==================== 目标值常量 ====================
const TARGET_BOOKSHELF_ID = '188ebdaf6a4b73ab0074c6b50a49ee91'
const TARGET_FAMILY_ID = '188ebdaf6a4b73ab0074c6b410e78ba7'
const TARGET_OPERATOR = 'e3193f066a47cbf2001b42ea40e4a8f1'

// 每批获取的记录数（云函数 get() 单次上限 100）
const BATCH_SIZE = 100

exports.main = async (event) => {
  console.log('=== 数据迁移脚本开始 ===')

  const results = {
    book_item: {
      total: 0,
      updated: 0,
      failed: 0,
      errors: []
    },
    inventory_change_log: {
      total: 0,
      updated: 0,
      failed: 0,
      errors: []
    }
  }

  // ============================================
  // 1. 更新 book_item 表
  //    bookshelf_id / family_id / operator 统一赋值
  // ============================================
  console.log('--- 开始处理 book_item 表 ---')

  try {
    const countRes = await db.collection('book_item').count()
    results.book_item.total = countRes.total
    console.log(`book_item 总记录数: ${countRes.total}`)

    if (countRes.total === 0) {
      console.log('book_item 表为空，跳过')
    } else {
      let skip = 0

      while (true) {
        // 分批获取记录 ID
        const batch = await db.collection('book_item')
          .skip(skip)
          .limit(BATCH_SIZE)
          .field({ _id: true })
          .get()

        if (batch.data.length === 0) break

        // 逐条更新（update 会自动设置字段，不存在则创建）
        for (const item of batch.data) {
          try {
            await db.collection('book_item').doc(item._id).update({
              data: {
                bookshelf_id: TARGET_BOOKSHELF_ID,
                family_id: TARGET_FAMILY_ID,
                operator: TARGET_OPERATOR
              }
            })
            results.book_item.updated++
          } catch (err) {
            results.book_item.failed++
            results.book_item.errors.push({
              _id: item._id,
              error: err.message
            })
            console.error(`book_item ${item._id} 更新失败:`, err.message)
          }
        }

        const processed = skip + batch.data.length
        console.log(`book_item 进度: ${processed}/${countRes.total}`)

        skip += batch.data.length
        if (batch.data.length < BATCH_SIZE) break
      }
    }
  } catch (err) {
    console.error('book_item 表处理异常:', err)
    results.book_item.errors.push({ error: err.message })
  }

  // ============================================
  // 2 & 3. 更新 inventory_change_log 表
  //    family_id / operator 统一赋值
  //    新增 bookshelf_id 字段
  // ============================================
  console.log('--- 开始处理 inventory_change_log 表 ---')

  try {
    const countRes = await db.collection('inventory_change_log').count()
    results.inventory_change_log.total = countRes.total
    console.log(`inventory_change_log 总记录数: ${countRes.total}`)

    if (countRes.total === 0) {
      console.log('inventory_change_log 表为空，跳过')
    } else {
      let skip = 0

      while (true) {
        // 分批获取记录 ID
        const batch = await db.collection('inventory_change_log')
          .skip(skip)
          .limit(BATCH_SIZE)
          .field({ _id: true })
          .get()

        if (batch.data.length === 0) break

        // 逐条更新（update 会自动设置字段，不存在则创建）
        for (const item of batch.data) {
          try {
            await db.collection('inventory_change_log').doc(item._id).update({
              data: {
                family_id: TARGET_FAMILY_ID,
                operator: TARGET_OPERATOR,
                bookshelf_id: TARGET_BOOKSHELF_ID
              }
            })
            results.inventory_change_log.updated++
          } catch (err) {
            results.inventory_change_log.failed++
            results.inventory_change_log.errors.push({
              _id: item._id,
              error: err.message
            })
            console.error(`inventory_change_log ${item._id} 更新失败:`, err.message)
          }
        }

        const processed = skip + batch.data.length
        console.log(`inventory_change_log 进度: ${processed}/${countRes.total}`)

        skip += batch.data.length
        if (batch.data.length < BATCH_SIZE) break
      }
    }
  } catch (err) {
    console.error('inventory_change_log 表处理异常:', err)
    results.inventory_change_log.errors.push({ error: err.message })
  }

  // ============================================
  // 输出汇总结果
  // ============================================
  console.log('=== 数据迁移脚本完成 ===')
  console.log('汇总结果:')
  console.log(JSON.stringify(results, null, 2))

  return {
    success: true,
    message: '数据迁移完成',
    results
  }
}
