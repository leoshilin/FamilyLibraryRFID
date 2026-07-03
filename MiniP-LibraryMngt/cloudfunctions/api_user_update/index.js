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

  const safeNickName = (nickName || '').trim()

  if (!safeNickName) {

    return {
      success: false,
      message: '用户名不能为空'
    }

  }

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

    const user = userRes.data[0]
    const userId = user._id

    if (user.status !== 'ACTIVE') {

      return {
        success: false,
        message: '用户状态不可用'
      }

    }

    const now = new Date()

    await db
      .collection('user')
      .doc(userId)
      .update({

        data: {

          nickName: safeNickName,

          updated_at: now

        }

      })

    return {
      success: true,
      user: {
        ...user,
        nickName: safeNickName,
        updated_at: now
      }
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
