// PDA 扫描 TID 后查询当前绑定状态
// 仅 PDA 调用：根据 RFID TID 反查占用该标签的图书，供用户确认是否解绑。
// rfid_tid 为唯一值；无家庭 / 角色校验（PDA 专用）。

const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境

const db = cloud.database()
const _ = db.command

// 云函数入口函数
exports.main = async (event) => {
  const { tid } = event

  if (!tid) {
    return { success: false, message: 'tid不能为空' }
  }

  // 查询占用该标签的图书（未删除）
  const itemRes = await db.collection('book_item')
    .where({
      rfid_tid: tid,
      fg_delete: false
    })
    .limit(1)
    .get()

  if (!itemRes.data.length) {
    return { success: true, bound: false }
  }

  const item = itemRes.data[0]

  // 关联 book_meta 取展示字段
  const metaRes = await db.collection('book_meta').doc(item.book_meta_id).get()
  const meta = metaRes.data || {}

  console.log(`api_task_getRfidBindingInfo: TID ${tid} 已绑定 book_item ${item._id}`)

  return {
    success: true,
    bound: true,
    book: {
      bookItemId: item._id,
      title: meta.title || '',
      isbn: meta.isbn || ''
    }
  }
}
