/**
 * 一次性数据迁移云函数：script_data_migration
 * 用途：修复 book_item 集合与最新设计文档（家庭图书管理系统数据库表结构设计.md）的字段差异。
 *       本函数是「改字段名 / 增减字段 / 迁移历史数据」用途的临时工具，非业务接口。
 *
 * 背景（对应 .今后改善事项/DB差异0711.md 修复1、修复2）：
 *   - 修复1：book_item 的 RFID 字段，代码侧曾写作 rfid_tag_id，设计文档 3.6 规定为 rfid_tid（唯一索引）。
 *            本脚本将历史记录的 rfid_tag_id 值迁移到 rfid_tid，并删除旧的 rfid_tag_id 字段。
 *   - 修复2：book_item 曾写入 operator（重新上架 / 更换书架），设计文档 3.6 不保留该字段
 *            （上下架操作人统一记录于 inventory_change_log）。本脚本删除 book_item 上残留的 operator 字段。
 *
 * 处理逻辑：
 *   1. 分批读取所有「仍存在 rfid_tag_id 字段」的 book_item，把其值复制给 rfid_tid 并删除 rfid_tag_id。
 *   2. 分批读取所有「仍存在 operator 字段」的 book_item，删除 operator 字段。
 *
 * 幂等性：仅处理仍含旧字段的记录；已迁移记录因旧字段被删除而不再命中，可重复执行、安全不报错。
 *
 * ⚠️ 一次性工具：仅由管理员在云端测试手动执行一次（部署新代码前），日常运行不应调用此函数。
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

// 统计汇总
function createStats() {
  return {
    scanned: 0,        // 扫描到的待迁移记录数
    rfidMigrated: 0,    // rfid_tag_id → rfid_tid 迁移成功数
    operatorRemoved: 0, // 删除 operator 字段成功数
    errors: []          // 失败明细（含 _id、字段、错误信息）
  }
}

// 单条迁移：rfid_tag_id → rfid_tid（并删除旧字段）；删除 operator 字段
async function migrateBookItem(doc, stats) {
  const data = {}

  if (doc.rfid_tag_id !== undefined) {
    // 将 RFID 绑定值迁移到设计字段 rfid_tid（未绑定即为 null），随后删除旧字段
    data.rfid_tid = doc.rfid_tag_id
    data.rfid_tag_id = _.remove()
  }

  if (doc.operator !== undefined) {
    // book_item 不再保留 operator，删除残留字段
    data.operator = _.remove()
  }

  if (Object.keys(data).length === 0) {
    return
  }

  try {
    await db.collection('book_item')
      .doc(doc._id)
      .update({ data })
    if (doc.rfid_tag_id !== undefined) stats.rfidMigrated += 1
    if (doc.operator !== undefined) stats.operatorRemoved += 1
  } catch (err) {
    console.error(`迁移失败 itemId=${doc._id}:`, err)
    stats.errors.push({ _id: doc._id, message: err.message })
  }
}

// 分批处理「仍存在任一旧字段」的 book_item
async function batchMigrate() {
  const stats = createStats()

  while (true) {
    const res = await db.collection('book_item')
      .where(_.or([
        { rfid_tag_id: _.exists(true) },
        { operator: _.exists(true) }
      ]))
      .limit(BATCH_SIZE)
      .get()

    const docs = res.data || []
    if (docs.length === 0) {
      break
    }

    stats.scanned += docs.length

    for (const doc of docs) {
      await migrateBookItem(doc, stats)
    }

    // 本批不足一批，说明已无剩余记录
    if (docs.length < BATCH_SIZE) {
      break
    }
  }

  return stats
}

exports.main = async (event) => {
  console.log('=== book_item 字段迁移脚本开始（rfid_tag_id→rfid_tid，移除 operator）===')

  try {
    const stats = await batchMigrate()
    console.log(`=== 迁移完成：扫描 ${stats.scanned} 条，rfid 迁移 ${stats.rfidMigrated} 条，` +
      `operator 移除 ${stats.operatorRemoved} 条，失败 ${stats.errors.length} 条 ===`)

    return {
      success: true,
      message: 'book_item 字段迁移完成（rfid_tag_id→rfid_tid，移除 operator）',
      stats
    }
  } catch (err) {
    console.error('迁移脚本异常:', err)
    return {
      success: false,
      message: '迁移脚本执行异常',
      error: err.message
    }
  }
}
