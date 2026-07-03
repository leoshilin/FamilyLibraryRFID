// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

exports.main = async (event, context) => {

  const {
    nickName
  } = event

  const safeNickName = (nickName || '').trim()

  console.log(`api_user_register: nickName =${safeNickName} `)

  if (!safeNickName) {

    return {
      success: false,
      message: '用户名不能为空'
    }

  }
  
  try {

    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID

    const exists = await db
      .collection('user')
      .where({
        openid
      })
      .limit(1)
      .get()

    if (exists.data.length > 0) {

      return {
        success: false,
        message: '用户已存在'
      }

    }

    const now = new Date()

    const addRes = await db
      .collection('user')
      .add({

        data: {

          openid,

          nickName: safeNickName,

          role: 'USER',

          status: 'ACTIVE',

          created_at: now,

          updated_at: now

        }

      })

    return {

      success: true,

      userId: addRes._id

    }

  } catch (err) {

    console.error(err)

    return {
      success: false,
      error: err.message
    }

  }

}
