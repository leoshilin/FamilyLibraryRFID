// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {

  const {
    nickName
  } = event

  try {

    const wxContext = cloud.getWXContext()

    const openid = wxContext.OPENID

    const userRes = await db
      .collection('user')
      .where({
        openid
      })
      .limit(1)
      .get()

    if (userRes.data.length === 0) {

      return {
        success: false,
        message: '用户不存在'
      }

    }

    const userId = userRes.data[0]._id

    await db
      .collection('user')
      .doc(userId)
      .update({

        data: {

          nickName,

          updated_at: new Date()

        }

      })

    return {
      success: true
    }

  }
  catch(err) {

    console.error(err)

    return {

      success: false,

      error: err.message

    }

  }

}