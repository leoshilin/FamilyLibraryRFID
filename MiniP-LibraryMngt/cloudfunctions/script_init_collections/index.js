/**
 * 一次性集合初始化云函数：script_init_collections
 *
 * 背景（对应修复：详情页 api_task_getBindStatus 报
 *   「-502005 database collection not exists: device_task」）：
 *   经核查，RFID 任务链路依赖以下云数据库集合，但仓库此前没有任何建集合脚本，
 *   首次部署后云端缺少这些集合，导致相关云函数调用失败。
 *
 * 需要创建的集合：
 *   - device_task   : RFID 绑定 / 查找等 PDA 任务。
 *                     api_task_createBindRfid / api_task_accept / api_task_complete /
 *                     api_task_bindRfid / api_task_unbindRfid / api_task_getBindStatus 均依赖。
 *   - rfid_bind_log : RFID 绑定 / 解绑历史流水。
 *                     api_task_bindRfid / api_task_unbindRfid 写入。
 *
 * 幂等性：集合已存在时 db.createCollection 会抛「已存在」错误，本函数捕获后视为成功，
 *         可重复执行、安全不报错。
 *
 * ⚠️ 一次性工具：仅由管理员在云端测试手动执行一次（部署新代码前），日常运行不应调用此函数。
 *
 * 使用方式：
 *   1. 在微信开发者工具中右键部署该云函数（上传并部署：云端安装依赖）
 *   2. 右键 → 云端测试，测试参数输入 {}，点击运行测试
 *   3. 如遇超时，请在云开发控制台将超时时间调整为 20 秒以上
 */

const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境

const db = cloud.database()

// RFID 任务链路所需的集合（缺失会导致相关云函数 -502005 失败）
const REQUIRED_COLLECTIONS = ['device_task', 'rfid_bind_log']

// 创建单个集合；已存在视为成功，其它错误视为失败
async function ensureCollection(name) {
  try {
    await db.createCollection(name)
    return { name, created: true, ok: true }
  } catch (err) {
    // 已存在：errCode -502003（collection already exists），视为成功
    const code = err && err.errCode
    if (code === -502003) {
      return { name, created: false, ok: true, note: '已存在' }
    }
    return {
      name,
      created: false,
      ok: false,
      message: (err && (err.errMsg || err.message)) || String(err)
    }
  }
}

// 云函数入口函数
exports.main = async (event) => {
  console.log('=== 集合初始化脚本开始（device_task / rfid_bind_log）===')

  const results = []
  for (const name of REQUIRED_COLLECTIONS) {
    const r = await ensureCollection(name)
    results.push(r)
    console.log(`createCollection ${name}:`, JSON.stringify(r))
  }

  const failed = results.filter(r => !r.ok)
  if (failed.length) {
    return {
      success: false,
      message: `以下集合创建失败：${failed.map(r => r.name).join(', ')}`,
      results
    }
  }

  console.log('=== 集合初始化完成 ===')
  return {
    success: true,
    message: `集合初始化完成：${REQUIRED_COLLECTIONS.join(', ')}`,
    results
  }
}
