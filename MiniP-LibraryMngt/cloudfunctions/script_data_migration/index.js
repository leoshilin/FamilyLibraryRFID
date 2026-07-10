/**
 * 数据迁移云函数：script_data_migration
 * 用途：将 book_item 表中历史数据的 status 字段，统一迁移为 inventory_status 字段
 *
 * 背景（E-8 跨文档字段命名冲突修复）：
 *   - 数据库设计文档规定 book_item 的状态字段为 inventory_status（enum: in_stock / off_stock）
 *   - 历史数据中该状态曾存于 status 字段，本脚本执行后自动将其迁移到 inventory_status
 *
 * 处理逻辑：
 *   1. 分批读取所有「仍包含旧 status 字段」的 book_item 记录
 *   2. 逐条将 inventory_status 设为原 status 的值，并删除旧的 status 字段
 *   3. 返回迁移汇总（待迁移总数 / 成功数 / 失败明细）
 *
 * 幂等性：仅处理仍存在 status 字段的记录；已迁移（仅含 inventory_status）的记录不会被重复处理。
 *          重复执行安全，不会重复写入或报错。
 *
 * 使用方式：
 *   1. 在微信开发者工具中右键部署该云函数（上传并部署：云端安装依赖）
 *   2. 右键 → 云端测试，测试参数输入 {}，点击运行测试
 *   3. 如遇超时，请在云开发控制台将超时时间调整为 20 秒以上
 */

const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

// 单批读取条数（云数据库单次 get 上限附近，分批避免超时）
const BATCH_SIZE = 100

exports.main = async (event) => {
  console.log('=== book_item.status → inventory_status 迁移脚本开始 ===')

  const results = {
    total: 0,        // 待迁移记录数
    migrated: 0,      // 成功迁移数
    errors: []         // 失败记录（含 _id 与错误信息）
  }

  try {
    // 每轮重新查询「仍存在 status 字段」的记录；已迁移记录因 status 被删除而不再命中，
    // 因此无需 skip，自然推进到下一批，且对集合规模变化稳健。
    while (true) {
      const res = await db.collection('book_item')
        .where({ status: _.exists(true) })
        .limit(BATCH_SIZE)
        .get()

      const docs = res.data || []
      if (docs.length === 0) {
        break
      }

      results.total += docs.length

      // 逐条迁移：inventory_status = 原 status，并移除旧 status 字段
      for (const doc of docs) {
        try {
          await db.collection('book_item')
            .doc(doc._id)
            .update({
              data: {
                inventory_status: doc.status,
                status: _.remove()
              }
            })
          results.migrated += 1
        } catch (err) {
          console.error(`迁移失败 itemId=${doc._id}:`, err)
          results.errors.push({ _id: doc._id, message: err.message })
        }
      }

      // 本批不足一批，说明已无剩余记录
      if (docs.length < BATCH_SIZE) {
        break
      }
    }

    console.log(`=== 迁移完成：共 ${results.total} 条，成功 ${results.migrated} 条，失败 ${results.errors.length} 条 ===`)
  } catch (err) {
    console.error('迁移脚本异常:', err)
    return {
      success: false,
      message: '迁移脚本执行异常',
      error: err.message,
      results
    }
  }

  return {
    success: true,
    message: 'book_item 状态字段迁移完成',
    results
  }
}
