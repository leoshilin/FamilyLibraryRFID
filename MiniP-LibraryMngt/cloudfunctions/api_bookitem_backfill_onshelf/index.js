// 一次性数据回填云函数（仅上线前执行一次，执行后建议下线与删除）
// 作用：为历史 book_item 补齐 on_shelf_at（上架时间）。
// 背景：旧代码在"重新上架"时会把 created_at 刷成上架时间，因此历史记录的
//       created_at 实际就是"上架时间"。回填规则：on_shelf_at 缺失时置为 created_at。
// 注意：微信云开发不支持"把 A 字段原子复制给 B 字段"，故采用分页 + 逐条 update。

const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

const PAGE_SIZE = 100

exports.main = async () => {
  let migrated = 0
  let skipped = 0
  let page = 0

  while (true) {
    const res = await db.collection('book_item')
      .where({ on_shelf_at: _.exists(false) })
      .limit(PAGE_SIZE)
      .skip(page * PAGE_SIZE)
      .get()

    const list = res.data || []
    if (list.length === 0) break

    for (const item of list) {
      // created_at 缺失兜底：用当前时间（极端情况下才触发）
      const onShelfAt = item.created_at || new Date()
      await db.collection('book_item').doc(item._id).update({
        data: { on_shelf_at: onShelfAt }
      })
      migrated++
    }

    page++
    // 已不足一页，结束
    if (list.length < PAGE_SIZE) break
  }

  // 统计仍无 on_shelf_at 的记录（理论上应为 0）
  const remain = await db.collection('book_item')
    .where({ on_shelf_at: _.exists(false) })
    .count()

  return {
    success: true,
    migrated,
    skipped,
    remainWithoutOnShelfAt: remain.total
  }
}
