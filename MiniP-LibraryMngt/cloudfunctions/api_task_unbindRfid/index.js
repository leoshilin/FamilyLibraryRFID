// 手机端主动解绑 RFID
// 适用场景：标签损毁不可读，无需 PDA 读写标签 EPC。
// 事务：清空 book_item.rfid_tid + 写 rfid_bind_log（action_type = unbind）。

const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境

const db = cloud.database()
const _ = db.command

const { PERMISSIONS, RESOURCE_TYPES, checkPermission, getCurrentUser } = require('./common/permission')

// 云函数入口函数
exports.main = async (event) => {
  const { bookItemId } = event
  const now = new Date()

  // 反查操作人
  const wxContext = cloud.getWXContext()
  const user = await getCurrentUser(db, wxContext.OPENID)
  if (!user) {
    return { success: false, message: '用户未注册' }
  }

  // 反查当前家庭
  const familyId = user.current_family_id
  if (!familyId) {
    return { success: false, message: '未选择当前家庭' }
  }

  // 权限校验：RFID_UNBIND（OWNER，MEMBER / GUEST 无此权限）
  const perm = await checkPermission({
    db,
    openid: wxContext.OPENID,
    permission: PERMISSIONS.RFID_UNBIND,
    familyId
  })
  if (!perm.allowed) {
    return { success: false, message: perm.message }
  }

  if (!bookItemId) {
    return { success: false, message: 'bookItemId不能为空' }
  }

  // 校验目标图书存在、未删除
  const itemRes = await db.collection('book_item')
    .where({
      _id: bookItemId,
      family_id: familyId,
      fg_delete: false
    })
    .limit(1)
    .get()

  if (!itemRes.data.length) {
    return { success: false, message: '书籍不存在或已删除' }
  }

  const item = itemRes.data[0]

  // 未绑定 RFID 则无需解绑
  if (!item.rfid_tid) {
    return { success: false, message: '该图书未绑定RFID' }
  }

  const transaction = await db.startTransaction()

  try {
    // 1️⃣ 清空 book_item.rfid_tid（同时刷新 updated_at）
    await transaction.collection('book_item')
      .where({
        _id: bookItemId,
        family_id: familyId
      })
      .update({
        data: {
          rfid_tid: null,
          updated_at: now
        }
      })

    // 2️⃣ 写 RFID 绑定历史（解绑）
    //    unbind 动作下：new_tid 不适用（无新标签）→ null；task_id 为手机端主动解绑（无任务）→ null；
    //    old_tid 记录被解绑的原标签；operator 为当前登录用户。
    await transaction.collection('rfid_bind_log').add({
      data: {
        book_item_id: bookItemId,
        new_tid: null,
        old_tid: item.rfid_tid,
        action_type: 'unbind',
        created_at: now,
        task_id: null,
        operator: user._id
      }
    })

    await transaction.commit()

    console.log(`api_task_unbindRfid: 解绑 book_item ${bookItemId} 原标签 ${item.rfid_tid}`)

    return { success: true }
  } catch (err) {
    console.error('api_task_unbindRfid 事务失败，回滚:', err)
    await transaction.rollback()
    return { success: false, message: '解绑操作失败，已回滚' }
  }
}
