// 云函数入口文件
// 指定家庭下书架的重新排序（sort_order）
// 对应设计文档 C5（api_bookshelf_reorder）。需求依据：F3 书架创建与管理（书架列表按 sort_order 展示）。
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

// 引入权限公共模块（与 api_bookshelf_update / api_bookshelf_list 一致）
const {
  PERMISSIONS,
  checkPermission,
  getCurrentUser
} = require('./common/permission')

exports.main = async (event) => {

  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  const { orderedBookshelfIds } = event

  console.log(`api_bookshelf_reorder: openid=${openid}`)

  // 参数校验
  if (!Array.isArray(orderedBookshelfIds) || orderedBookshelfIds.length === 0) {
    return { success: false, message: 'orderedBookshelfIds不能为空' }
  }

  try {

    // 反查操作人 & 当前家庭：familyId 统一从登录态解析（结论 B+C）
    const user = await getCurrentUser(db, openid)
    if (!user) {
      return { success: false, message: '用户未注册' }
    }
    const familyId = user.current_family_id
    if (!familyId) {
      return { success: false, message: '未选择当前家庭' }
    }

    // 1. 权限检查（书架维度，BOOKSHELF_UPDATE：OWNER / MEMBER，GUEST 无）
    const perm = await checkPermission({
      db,
      openid,
      permission: PERMISSIONS.BOOKSHELF_UPDATE,
      familyId
    })

    if (!perm.allowed) {
      return { success: false, message: perm.message }
    }

    // 2. 查询当前家庭全部 ACTIVE 书架
    const existingRes = await db.collection('bookshelf')
      .where({
        family_id: familyId,
        status: 'ACTIVE'
      })
      .get()

    const existingIds = existingRes.data.map(s => s._id)

    // 3. 覆盖性校验：顺序数组必须与当前家庭 ACTIVE 书架集合完全一致（无遗漏、无多余、无重复）
    const inputSet = new Set(orderedBookshelfIds)

    if (orderedBookshelfIds.length !== inputSet.size) {
      return { success: false, message: '书架顺序存在重复' }
    }

    if (inputSet.size !== existingIds.length) {
      return { success: false, message: '书架顺序必须覆盖当前家庭全部书架' }
    }

    for (const id of existingIds) {
      if (!inputSet.has(id)) {
        return { success: false, message: '书架顺序包含无效或越权书架' }
      }
    }

    const now = new Date()

    // 4. 按传入顺序重排 sort_order（逐条更新；云数据库不支持事务批量，这里以 Promise.all 并发写入）
    const tasks = orderedBookshelfIds.map((id, idx) =>
      db.collection('bookshelf').doc(id).update({
        data: {
          sort_order: idx + 1,
          updated_by: perm.user._id,
          updated_at: now
        }
      })
    )

    await Promise.all(tasks)

    return { success: true }

  } catch (err) {
    console.error('api_bookshelf_reorder error:', err)
    return { success: false, message: err.message }
  }

}
