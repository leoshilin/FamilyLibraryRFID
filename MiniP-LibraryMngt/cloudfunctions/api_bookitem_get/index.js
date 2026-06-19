// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境
const db = cloud.database()

// 云函数入口函数
// 使用book_item 的 id查询
exports.main = async (event, context) => {
  console.log('api_bookitem_get: start')
  const { itemId } = event
  if (!itemId) {
    return {
      success: false,
      message: '缺少 itemId'
    }
  }

  try {
    // 1️⃣ 查询 book_item
    const itemRes = await db.collection('book_item')
                            .doc(itemId)
                            .get()

    if (!itemRes.data) {
      return {
        success: false,
        message: '未找到实体书'
      }
    }

    const bookItem = itemRes.data    
    console.log(`api_bookitem_get: read ${bookItem ? 1 : 0} books from book_item`)

     // 2️⃣ 查询 book_meta（可能不存在）
     let bookMeta = null

     try {
       const metaRes = await db.collection('book_meta')
                               .doc(bookItem.book_meta_id)
                               .get()
 
       bookMeta = metaRes.data || null
 
     } catch (e) {
       // meta 不存在时，忽略异常
       bookMeta = null
     }
     
     console.log(`api_bookitem_get: read ${bookMeta ? 1 : 0} Meta data from book_meta`)
 
     // 3️⃣ 拼接返回对象（meta 不存在时返回空值：为了适配页面显示）
     const book = {
       title: bookMeta?.title || '',
       authors: bookMeta?.authors || '',
       cover_url: bookMeta?.cover_url || '',
       publisher: bookMeta?.publisher || '',
       publishYear: bookMeta?.publish_year || '',
       price: bookMeta?.price || '',
       binding: bookMeta?.binding || '',
       isbn: bookMeta?.isbn || 'ISBN错误',
       isSet: bookMeta?.is_set ?? false,
       setTotalCount: bookMeta?.set_total_count || 0,
       setIndex: bookItem.set_index,
       rfid: bookItem.rfid_tag_id,
       inStockDate: bookItem.created_at       
     }
 
     return {
       success: true,
       data: book
     }
 
   } catch (err) {
 
     console.error('api_bookitem_get error:', err)
 
     return {
       success: false,
       message: '数据库查询失败'
     }
   }
 }