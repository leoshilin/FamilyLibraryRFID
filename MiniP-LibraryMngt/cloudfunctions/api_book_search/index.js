// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境
const db = cloud.database()
const _ = db.command

const { PERMISSIONS, RESOURCE_TYPES, checkPermission, getCurrentUser } = require('./common/permission')

// 云函数入口函数
exports.main = async (event) => {
  console.log('api_book_search: start')
  console.log('收到参数:', event)
  const {
    keyword = '',
    isbn = '',
    bookshelfId = '',
    status = 'in_stock',
    startDate,
    endDate,
    page = 1,
    pageSize = 10
  } = event

  try {

    // 反查操作人 & 当前家庭：不再由客户端传入 operator/familyId，统一从登录态解析（结论 B+C）
    const wxContext = cloud.getWXContext()
    const user = await getCurrentUser(db, wxContext.OPENID)
    if (!user) {
      return { success: false, message: '用户未注册' }
    }
    const familyId = user.currentFamilyId
    if (!familyId) {
      return { success: false, message: '未选择当前家庭' }
    }

    // 权限检查：检索图书需 BOOKITEM_SEARCH 权限（OWNER/MEMBER/GUEST 均具备）
    const perm = await checkPermission({
      db,
      openid: wxContext.OPENID,
      permission: PERMISSIONS.BOOKITEM_SEARCH,
      familyId
    })
    if (!perm.allowed) {
      return { success: false, message: perm.message }
    }

    const skip = (page - 1) * pageSize

    // ===============================
    // 1️⃣ 构造 book_item 基础筛选
    // ===============================

    let itemMatch = {
      family_id: familyId,
      fg_delete: false //书本逻辑删除标志
    }

    // ---- 状态筛选 ----
    if (status === 'in_stock') {
      itemMatch.inventory_status = 'in_stock'
    } else if (status === 'off_stock') {
      itemMatch.inventory_status = 'off_stock'
    }

    // ---- 书架筛选 ----
    if (bookshelfId) {
      itemMatch.bookshelf_id = bookshelfId
    }

    // ---- 上架时间筛选（基于 on_shelf_at，而非记录创建时间 created_at）----
    if (startDate || endDate) {
      const dateCond = []

      if (startDate) {
        dateCond.push(_.gte(new Date(startDate)))
      }

      if (endDate) {
        dateCond.push(_.lte(new Date(endDate + ' 23:59:59')))
      }

      itemMatch.on_shelf_at = dateCond.length === 1 ?
        dateCond[0] :
        _.and(dateCond)
    }

    // ===============================
    // 2️⃣ 构造 meta 匹配条件（模糊 + ISBN精确）
    // ===============================

    let metaMatch = {}

    // 书名或作者模糊匹配
    if (keyword && keyword.trim()) {
      const reg = db.RegExp({
        regexp: keyword.trim(),
        options: 'i'
      })

      const keywordCond = _.or([{
          'meta.title': reg
        },
        {
          'meta.authors': reg
        }
      ])

      // 如果同时有 ISBN 精确匹配，取交集
      if (isbn && isbn.trim()) {
        metaMatch = _.and([
          keywordCond,
          { 'meta.isbn': isbn.trim() }
        ])
      } else {
        metaMatch = keywordCond
      }
    } else if (isbn && isbn.trim()) {
      // 仅 ISBN 精确匹配
      metaMatch = { 'meta.isbn': isbn.trim() }
    }

    const hasMetaMatch = (keyword && keyword.trim()) || (isbn && isbn.trim())

    // ===============================
    // 3️⃣ 聚合查询（核心）
    // ===============================
    // 注意：aggregate 的 match/lookup/unwind/sort/skip/limit 等方法
    // 返回新的 Aggregate 对象，必须捕获返回值才能正确构建管道

    // 构建基础管道：item筛选 → 关联meta → 关联bookshelf
    let agg = db.collection('book_item')
      .aggregate()
      .match(itemMatch)
      .lookup({
        from: 'book_meta',
        localField: 'book_meta_id',
        foreignField: '_id',
        as: 'meta'
      })
      .unwind({
        path: '$meta',
        preserveNullAndEmptyArrays: true
      })
      .lookup({
        from: 'bookshelf',
        localField: 'bookshelf_id',
        foreignField: '_id',
        as: 'bookshelf'
      })
      .unwind({
        path: '$bookshelf',
        preserveNullAndEmptyArrays: true
      })

    // meta 匹配（ISBN / 关键词）
    if (hasMetaMatch) {
      agg = agg.match(metaMatch)
    }

    // 排序 + 分页（按上架时间 on_shelf_at 倒序）
    agg = agg.sort({ on_shelf_at: -1 })
    agg = agg.skip(skip)
    agg = agg.limit(pageSize)

    // 执行查询
    const aggregateRes = await agg.end()

    console.log('itemMatch =', itemMatch)
    console.log('metaMatch =', metaMatch)

    // ===============================
    // 3️⃣-2 获取总条数（用于前端分页）
    // ===============================
    let countAgg = db.collection('book_item')
      .aggregate()
      .match(itemMatch)
      .lookup({
        from: 'book_meta',
        localField: 'book_meta_id',
        foreignField: '_id',
        as: 'meta'
      })
      .unwind({
        path: '$meta',
        preserveNullAndEmptyArrays: true
      })
      .lookup({
        from: 'bookshelf',
        localField: 'bookshelf_id',
        foreignField: '_id',
        as: 'bookshelf'
      })
      .unwind({
        path: '$bookshelf',
        preserveNullAndEmptyArrays: true
      })

    if (hasMetaMatch) {
      countAgg = countAgg.match(metaMatch)
    }

    countAgg = countAgg.count('total')

    const countResult = await countAgg.end()
    const total = countResult.list.length ? countResult.list[0].total : 0

    const list = aggregateRes.list || []

    // ===============================
    // 4️⃣ 组装最终返回结构
    // ===============================

    const result = list.map(item => ({
      // ===== item 字段（统一 camelCase，对齐规范） =====
      itemId: item._id,
      familyId: item.family_id,
      bookshelfId: item.bookshelf_id || '',
      bookshelfName: item.bookshelf?.name || '',
      inventoryStatus: item.inventory_status,
      onShelfAt: item.on_shelf_at || null,
      rfidTid: item.rfid_tid || null,

      // ===== meta 字段（统一 camelCase，对齐规范） =====
      title: item.meta?.title || '',
      authors: item.meta?.authors || '',
      coverUrl: item.meta?.cover_url || '',
      isbn: item.meta?.isbn || '',
      price: item.meta?.price || '',
      publisher: item.meta?.publisher || '',
      publishYear: item.meta?.publish_year || '',
      binding: item.meta?.binding || '',
      isSet: item.meta?.is_set || false,
      setTotalCount: item.meta?.set_total_count || 0
    }))

    return {
      success: true,
      data: result,
      total
    }

    }
    catch (err) {
      console.error('api_book_search error:', err)

      return {
        success: false,
        message: '查询失败'
      }
    }
}
