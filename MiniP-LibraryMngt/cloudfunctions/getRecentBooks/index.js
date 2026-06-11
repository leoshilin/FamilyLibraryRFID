// 云函数入口文件
const {
  off
} = require('process')
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
}) // 使用当前云环境
const db = cloud.database()
const _ = db.command

// 云函数入口函数

exports.main = async (event, context) => {
  const {
    familyId
  } = event

  try {
    console.log('getRecentBooks: start')

    // 1️⃣ 获取最近5个上架的实体书，但仅限上架中（不包含已下架的）
    const itemRes = await db.collection('book_item')
      .where({
        status: 'in_stock',
        family_id: familyId,        
        fg_delete: false //非删除数据
      })
      .orderBy('created_at', 'desc')
      .limit(5)
      .get()

    const items = itemRes.data

    console.log(`getRecentBooks: read ${items.length} books from book_item`)
    if (!items.length) {
      return {
        success: true,
        list: []
      }
    }

    // 2️⃣ 提取 book_meta_id（允许重复）
    const metaIdList = items.map(item => item.book_meta_id)

    // 3️⃣ 查询 book_meta
    const metaRes = await db.collection('book_meta')
      .where({
        _id: _.in(metaIdList)
      })
      .get()

    const metaList = metaRes.data

    console.log(`getRecentBooks: read ${metaList.length} meta data from book_meta`)

    // 4️⃣ 合并数据（关键：按实体书顺序映射）
    const finalList = items.map(item => {
      const meta = metaList.find(m => m._id === item.book_meta_id)

      return {
        item_id: item._id,
        family_id: item.family_id,
        book_meta_id: item.book_meta_id,
        title: meta ? meta.title : '？？未知书名？？',
        authors: meta ? meta.authors : '',
        cover_url: meta ? meta.cover_url : '',
        publisher: meta ? meta.publisher : '',
        publishYear: meta ? meta.publish_year : '',
        price: meta ? meta.price : '',
        binding: meta ? meta.binding : '',
        isbn: meta ? meta.isbn : 'ISBN错误',
        isSet: meta ? meta.is_set : false,
        setTotalCount: meta ? meta.set_total_count : 0,
        setIndex: item.set_index,
        status: item.status,
        rfid: item.rfid_tag_id,
        inStockDate: item.created_at, //上架日
        inStockStatus: item.status //上架状态 in_stock, off_stock
      }
    })
    return {
      success: true,
      list: finalList
    }

  } catch (err) {
    return {
      success: false,
      error: err
    }
  }
}