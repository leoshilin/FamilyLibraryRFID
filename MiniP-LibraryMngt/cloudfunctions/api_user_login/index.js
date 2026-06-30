// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {

  try {

    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID
    console.log(`api_user_login: openid =${openid} `)
    
    const userRes = await db
      .collection('user')
      .where({
        openid
      })
      .limit(1)
      .get()

    if (userRes.data.length === 0) {

      return {
        success: true,
        registered: false
      }

    }

    return {
      success: true,
      registered: true,
      user: userRes.data[0]
    }

  } catch (err) {

    console.error(err)

    return {
      success: false,
      error: err.message
    }

  }

}