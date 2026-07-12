// 执行 RFID 绑定（核心接口，PDA 调用）
// 统一处理 4 种绑定场景（设计文档 F4.3）：
//   场景A：book1未绑、tid未用        → 直接绑定（action=bind）
//   场景B：book1未绑、tid已被book2用 → 先解绑book2，再绑定book1（action=rebind）
//   场景C：book1已绑tid2、tid未用     → book1改绑tid，旧tid2自然失效（action=rebind）
//   场景D：book1已绑tid2、tid已被book2用 → 解绑book2 + book1改绑tid（action=rebind）
// 事务：必要时解绑旧书 → 绑定新书 → 写 rfid_bind_log。
// operator（PDA 无微信登录态）：优先用入参 deviceId，其次用关联任务领取设备 claimed_by_device，
//   均取不到时固定串 "PDA"。
// rfid_bind_log 字段语义（设计：bind / rebind / unbind 三类动作下，各字段必填规则不同，
//   但数据库层 new_tid / task_id 等均为可选，不适用者写 null）：
//   book_item_id 必填；new_tid 仅 bind/rebind 有值；old_tid 仅 unbind 与含旧标签的 rebind 有值；
//   old_book_item_id 仅 tid 被它书占用时（场景B/D）有值；task_id 视关联任务可有可无。
// 无家庭 / 角色校验（PDA 专用）。

const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境

const db = cloud.database()
const _ = db.command

// 云函数入口函数
exports.main = async (event) => {
  const { bookItemId, tid, taskId: inputTaskId, deviceId: inputDeviceId } = event
  const now = new Date()

  if (!bookItemId || !tid) {
    return { success: false, message: 'bookItemId/tid不能为空' }
  }

  // —— 解析关联任务（用于 task_id 与 operator 回退） ——
  let taskId = inputTaskId || null
  let taskClaimedBy = '' // 任务领取设备
  if (taskId) {
    const tRes = await db.collection('device_task').doc(taskId).get()
    taskClaimedBy = (tRes.data && tRes.data.claimed_by_device) || ''
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
      taskClaimedBy = tRes.data[0].claimed_by_device || ''
    }
  }

  // operator：PDA 无微信登录态 → 设备ID；取不到则固定串 "PDA"
  const operator = inputDeviceId || taskClaimedBy || 'PDA'

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
    //    字段填充：new_tid 始终为本次绑定标签 tid（bind/rebind 必填，unbind 不适用时 null）；
    //             old_book_item_id 仅场景B/D 有值；old_tid 仅含旧标签的 rebind(C/D) 有值；
    //             task_id 可选（无关联任务时为 null）；operator 见上方解析。
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

    console.log(`api_task_bindRfid: book_item ${bookItemId} 绑定 tid ${tid}，action=${actionType}，operator=${operator}`)

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
