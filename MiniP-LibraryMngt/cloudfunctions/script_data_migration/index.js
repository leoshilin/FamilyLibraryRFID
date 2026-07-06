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
 *   1. 在微信开发者工具中右键部署该云函数（上传并部署：云端安装依赖）
 *   2. 右键 → 云端测试，测试参数输入 {}，点击运行测试
 *
 * 注意：如遇超时，请在云开发控制台将超时时间调整为 20 秒以上。
 */

const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

// ==================== 目标值常量 ====================
const TARGET_BOOKSHELF_ID = '188ebdaf6a4b73ab0074c6b50a49ee91'
const TARGET_FAMILY_ID = '188ebdaf6a4b73ab0074c6b410e78ba7'
const TARGET_OPERATOR = 'e3193f066a47cbf2001b42ea40e4a8f1'

exports.main = async (event) => {
  console.log('=== 数据迁移脚本开始 ===')

  const results = {
    book_item: { total: 0, updated: 0, errors: [] },
    inventory_change_log: { total: 0, updated: 0, errors: [] }
  }

  // ============================================
  // 1. 更新 book_item 表
  //    使用 where({}).update() 批量更新，一次调用完成全部记录
  // ============================================
  console.log('--- 开始处理 book_item 表 ---')

  try {
    const countRes = await db.collection('book_item').count()
    results.book_item.total = countRes.total
    console.log(`book_item 总记录数: ${countRes.total}`)

    if (countRes.total > 0) {
      // where({}).update() 批量更新所有记录（云函数端无条数限制）
      const updateRes = await db.collection('book_item')
        .where({})
        .update({
          data: {
            bookshelf_id: TARGET_BOOKSHELF_ID,
            family_id: TARGET_FAMILY_ID,
            operator: TARGET_OPERATOR
          }
        })

      results.book_item.updated = updateRes.stats.updated
      console.log(`book_item 更新完成: ${updateRes.stats.updated}/${countRes.total}`)
    } else {
      console.log('book_item 表为空，跳过')
    }
  } catch (err) {
    console.error('book_item 表处理异常:', err)
    results.book_item.errors.push(err.message)
  }

  // ============================================
  // 2 & 3. 更新 inventory_change_log 表
  //    family_id / operator 统一赋值 + 新增 bookshelf_id 字段
  // ============================================
  console.log('--- 开始处理 inventory_change_log 表 ---')

  try {
    const countRes = await db.collection('inventory_change_log').count()
    results.inventory_change_log.total = countRes.total
    console.log(`inventory_change_log 总记录数: ${countRes.total}`)

    if (countRes.total > 0) {
      // where({}).update() 批量更新所有记录（云函数端无条数限制）
      const updateRes = await db.collection('inventory_change_log')
        .where({})
        .update({
          data: {
            family_id: TARGET_FAMILY_ID,
            operator: TARGET_OPERATOR,
            bookshelf_id: TARGET_BOOKSHELF_ID
          }
        })

      results.inventory_change_log.updated = updateRes.stats.updated
      console.log(`inventory_change_log 更新完成: ${updateRes.stats.updated}/${countRes.total}`)
    } else {
      console.log('inventory_change_log 表为空，跳过')
    }
  } catch (err) {
    console.error('inventory_change_log 表处理异常:', err)
    results.inventory_change_log.errors.push(err.message)
  }

  // ============================================
  // 输出汇总结果
  // ============================================
  console.log('=== 数据迁移脚本完成 ===')
  console.log('汇总结果:', JSON.stringify(results, null, 2))

  return {
    success: true,
    message: '数据迁移完成',
    results
  }
}
