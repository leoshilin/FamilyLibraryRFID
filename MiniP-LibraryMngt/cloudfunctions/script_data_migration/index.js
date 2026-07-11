/**
 * 一次性数据迁移云函数：script_data_migration
 * 用途：将 3 张集合（user / user_family / bookshelf）中残留的 camelCase 字段，
 *       按最新设计文档（家庭图书管理系统数据库表结构设计.md）统一重命名为 snake_case。
 *
 * 背景（对应 命名规范审查报告-20250711.md 第二节「数据库设计文档中的违反项」）：
 *   - user.currentFamilyId        → current_family_id
 *   - user_family.userId          → user_id
 *   - user_family.familyId       → family_id
 *   - bookshelf.familyId          → family_id
 *
 * 处理逻辑：
 *   对每张集合分批读取「仍存在旧 camelCase 字段」的记录，
 *   将旧字段值复制到新 snake_case 字段，并删除旧字段。
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

// 字段迁移映射：{ 集合名: { 旧字段名(camelCase): 新字段名(snake_case) } }
const FIELD_MAP = {
  user: {
    currentFamilyId: 'current_family_id'
  },
  user_family: {
    userId: 'user_id',
    familyId: 'family_id'
  },
  bookshelf: {
    familyId: 'family_id'
  }
}

// 统计汇总（含每张集合每个字段的迁移成功数）
function createStats() {
  const stats = {
    scanned: 0, // 扫描到的待迁移记录数
    errors: [] // 失败明细（含 collection、_id、message）
  }
  Object.keys(FIELD_MAP).forEach((coll) => {
    Object.keys(FIELD_MAP[coll]).forEach((oldField) => {
      const key = `${coll}.${oldField}→${FIELD_MAP[coll][oldField]}`
      stats[key] = 0
    })
  })
  return stats
}

// 构造某集合「仍存在任一旧字段」的查询条件
function buildWhere(coll) {
  const conditions = Object.keys(FIELD_MAP[coll]).map((oldField) => ({
    [oldField]: _.exists(true)
  }))
  return _.or(conditions)
}

// 单条迁移：旧字段 → 新字段（并删除旧字段）
async function migrateDoc(coll, doc, stats) {
  const data = {}

  Object.keys(FIELD_MAP[coll]).forEach((oldField) => {
    const newField = FIELD_MAP[coll][oldField]
    const value = doc[oldField]

    // 仅当旧字段有有效值（非空）时才写入新字段，
    // 遵循可选字段不存空值的设计原则（空值仅删除旧字段，不新建空字段）
    if (value) {
      data[newField] = value
      stats[`${coll}.${oldField}→${newField}`] += 1
    }

    // 无论是否有有效值，均删除旧字段
    data[oldField] = _.remove()
  })

  if (Object.keys(data).length === 0) {
    return
  }

  try {
    await db.collection(coll)
      .doc(doc._id)
      .update({ data })
  } catch (err) {
    console.error(`迁移失败 ${coll}.${doc._id}:`, err)
    stats.errors.push({ collection: coll, _id: doc._id, message: err.message })
  }
}

// 分批处理「仍存在任一旧字段」的集合记录
async function batchMigrateCollection(coll, stats) {
  while (true) {
    const res = await db.collection(coll)
      .where(buildWhere(coll))
      .limit(BATCH_SIZE)
      .get()

    const docs = res.data || []
    if (docs.length === 0) {
      break
    }

    stats.scanned += docs.length

    for (const doc of docs) {
      await migrateDoc(coll, doc, stats)
    }

    // 本批不足一批，说明已无剩余记录
    if (docs.length < BATCH_SIZE) {
      break
    }
  }
}

exports.main = async (event) => {
  console.log('=== 数据库字段命名迁移脚本开始（camelCase → snake_case）===')

  const stats = createStats()

  try {
    for (const coll of Object.keys(FIELD_MAP)) {
      await batchMigrateCollection(coll, stats)
    }

    const summary = Object.keys(stats)
      .filter((k) => k !== 'scanned' && k !== 'errors')
      .map((k) => `${k}: ${stats[k]}`)
      .join('，')

    console.log(`=== 迁移完成：扫描 ${stats.scanned} 条；${summary}；失败 ${stats.errors.length} 条 ===`)

    return {
      success: true,
      message: '数据库字段命名迁移完成（camelCase → snake_case）',
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
