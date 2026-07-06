// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境
const db = cloud.database()
const _ = db.command

// 云函数入口函数
exports.main = async (event) => {
  console.log('api_book_search: start') 
  console.log('收到参数:', event)
  const {
    familyId,
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

    if (!familyId) {
      return {
        success: false,
        message: 'familyId 必填'
      }
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
      itemMatch.status = 'in_stock'
    } else if (status === 'off_stock') {
      itemMatch.status = 'off_stock'
    }

    // ---- 书架筛选 ----
    if (bookshelfId) {
      itemMatch.bookshelf_id = bookshelfId
    }

    // ---- 上架时间筛选 ----
    if (startDate || endDate) {
      const dateCond = []

      if (startDate) {
        dateCond.push(_.gte(new Date(startDate)))
      }

      if (endDate) {
        dateCond.push(_.lte(new Date(endDate + ' 23:59:59')))
      }

      itemMatch.created_at = dateCond.length === 1 ?
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

    // ===============================
    // 3️⃣ 聚合查询（核心）
    // ===============================

    //构建agg：聚合查询构建器。在执行.end 前并没有结果
    const agg = await db.collection('book_item')
      .aggregate()

      // item 层筛选
      .match(itemMatch)

      // 关联 meta
      .lookup({
        from: 'book_meta',
        localField: 'book_meta_id',
        foreignField: '_id',
        as: 'meta'
      })

      // meta 数组转对象
      .unwind({
        path: '$meta',
        preserveNullAndEmptyArrays: true
      })

      // 关联 bookshelf（获取书架名称）
      .lookup({
        from: 'bookshelf',
        localField: 'bookshelf_id',
        foreignField: '_id',
        as: 'bookshelf'
      })

      // bookshelf 数组转对象
      .unwind({
        path: '$bookshelf',
        preserveNullAndEmptyArrays: true
      })

    // meta 匹配
    const hasMetaMatch = (keyword && keyword.trim()) || (isbn && isbn.trim())
    if (hasMetaMatch) {
      agg.match(metaMatch)
    }

    // 排序
    agg.sort({
      created_at: -1
    })

    // 分页
    agg.skip(skip)
    agg.limit(pageSize)

    //.end 执行查询，并赋值
    const aggregateRes = await agg.end()

    console.log('itemMatch =', itemMatch)

    // 获取整体数据的总条数 total,返回前端做分页判断处理
    const countAgg = await db.collection('book_item')
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
      .match(metaMatch)
      .count('total')
      .end()

    const total = countAgg.list.length ? countAgg.list[0].total : 0

    const list = aggregateRes.list || []

    // ===============================
    // 4️⃣ 组装最终返回结构
    // ===============================

    const result = list.map(item => ({
      // ===== item 字段 =====
      item_id: item._id,
      family_id: item.family_id,
      bookshelf_id: item.bookshelf_id || '',
      bookshelf_name: item.bookshelf?.name || '',
      status: item.status,
      created_at: item.created_at,
      rfid_tag_id: item.rfid_tag_id || null,

      // ===== meta 字段 =====
      title: item.meta?.title || '',
      authors: item.meta?.authors || '',
      cover_url: item.meta?.cover_url || '',
      isbn: item.meta?.isbn || '',
      price: item.meta?.price || '',
      publisher: item.meta?.publisher || '',
      publish_year: item.meta?.publish_year || '',
      binding: item.meta?.binding || '',
      is_set: item.meta?.is_set || false,
      set_total_count: item.meta?.set_total_count || 0
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
