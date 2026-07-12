// 执行 RFID 绑定（核心接口，PDA 调用）
// 统一处理 4 种绑定场景（设计文档 F4.3）：
//   场景A：book1未绑、tid未用        → 直接绑定（action=bind）
//   场景B：book1未绑、tid已被book2用 → 先解绑book2，再绑定book1（action=rebind）
//   场景C：book1已绑tid2、tid未用     → book1改绑tid，旧tid2自然失效（action=rebind）
//   场景D：book1已绑tid2、tid已被book2用 → 解绑book2 + book1改绑tid（action=rebind）
// 事务：必要时解绑旧书 → 绑定新书 → 写 rfid_bind_log。
// operator / task_id 取自关联任务（created_by）；无任务时占位空串。无家庭 / 角色校验（PDA 专用）。

const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境

const db = cloud.database()
const _ = db.command

// 云函数入口函数
exports.main = async (event) => {
  const { bookItemId, tid, taskId: inputTaskId } = event
  const now = new Date()

  if (!bookItemId || !tid) {
    return { success: false, message: 'bookItemId/tid不能为空' }
  }

  // —— 解析关联任务与操作人 ——
  let taskId = inputTaskId || ''
  let operator = ''
  if (taskId) {
    const tRes = await db.collection('device_task').doc(taskId).get()
    operator = (tRes.data && tRes.data.created_by) || ''
  } else {
    // 未显式传 taskId 时，按 book_item_id 反查进行中的绑定任务
    const tRes = await db.collection('device_task')
      .where({
        book_item_id: bookItemId,
        task_type: 'bind_rfid',
        status: _.in(['pending', 'running'])
      })
      .orderBy('created_at', 'desc')
      .limit(1)
      .get()
    if (tRes.data.length) {
      taskId = tRes.data[0]._id
      operator = tRes.data[0].created_by || ''
    }
  }

  // —— 校验目标图书 ——
  const book1Res = await db.collection('book_item')
    .where({
      _id: bookItemId,
      fg_delete: false
    })
    .limit(1)
    .get()

  if (!book1Res.data.length) {
    return { success: false, message: '书籍不存在或已删除' }
  }

  const book1 = book1Res.data[0]
  const oldTid1 = book1.rfid_tid || null // book1 当前标签（可能已绑）

  // —— 查找 tid 是否已被其它图书占用（book2） ——
  const book2Res = await db.collection('book_item')
    .where({
      rfid_tid: tid,
      fg_delete: false,
      _id: _.neq(bookItemId)
    })
    .limit(1)
    .get()

  const book2 = book2Res.data.length ? book2Res.data[0] : null
  const oldBookItemId = book2 ? book2._id : null

  const transaction = await db.startTransaction()

  try {
    // 1️⃣ 若 tid 被 book2 占用，先解绑 book2
    if (book2) {
      await transaction.collection('book_item')
        .where({ _id: book2._id })
        .update({
          data: {
            rfid_tid: null,
            updated_at: now
          }
        })
    }

    // 2️⃣ 绑定 book1 到 tid（若 book1 已绑旧标签，此处自然完成改绑）
    await transaction.collection('book_item')
      .where({ _id: bookItemId })
      .update({
        data: {
          rfid_tid: tid,
          updated_at: now
        }
      })

    // 3️⃣ 写 RFID 绑定历史
    //    action_type：涉及旧书解绑 / 旧标签改绑即为 rebind，否则 bind
    const actionType = (book2 || oldTid1) ? 'rebind' : 'bind'
    await transaction.collection('rfid_bind_log').add({
      data: {
        book_item_id: bookItemId,
        new_tid: tid,
        old_book_item_id: oldBookItemId,
        old_tid: oldTid1,
        action_type: actionType,
        created_at: now,
        task_id: taskId,
        operator: operator
      }
    })

    await transaction.commit()

    console.log(`api_task_bindRfid: book_item ${bookItemId} 绑定 tid ${tid}，action=${actionType}`)

    return {
      success: true,
      action: actionType // bind / rebind
    }
  } catch (err) {
    console.error('api_task_bindRfid 事务失败，回滚:', err)
    await transaction.rollback()
    return { success: false, message: '绑定操作失败，已回滚' }
  }
}
