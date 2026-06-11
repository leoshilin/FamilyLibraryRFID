// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境

const db = cloud.database()

// 读取book_meta时做格式清洗（面向页面展示层）
function normalizeOutput(meta) {
  return {    
    isbn: meta.isbn,
    title: meta.title ?? '',
    authors: meta.authors ?? '',
    publisher: meta.publisher ?? '',
    publishYear: meta.publish_year ?? '',
    price: meta.price ?? '',
    binding: meta.binding ?? '',
    cover_url: meta.cover_url ?? '',
    isSet: meta.is_set ?? false,
    setTotalCount: meta.set_total_count ?? '',
    setIndex: null, // ⚠️ book_meta 中永远不提供  
    source: meta.source ?? ''
  }
}

// 云函数入口函数
exports.main = async (event, context) => {
  const { isbn } = event

  if (!isbn) {
    return { exists: false }    
  }

  try {
    // 1️⃣ 查询 book_meta
    const metaRes = await db
      .collection('book_meta')
      .where({ isbn })
      .limit(1)
      .get()

    // 2️⃣ 如果不存在，返回“空结构”，由前端或 douban 云函数继续处理
    if (!metaRes.data || metaRes.data.length === 0) {
      return {
        exists: false
      }
    }

    // 3️⃣ 组装返回结构（对齐 douban）
    const meta = metaRes.data[0]
    const cleanOutputMeta = normalizeOutput(meta)

    return {
      exists: true,
      book: cleanOutputMeta
    }
  } catch (err) {
    // 4️⃣ 处理“表不存在”等系统错误
    console.error('[getBookMeta] error:', err)
    throw err
  }
}