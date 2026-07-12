const callUserApi = async (name, data = {}) => {

  const res = await wx.cloud.callFunction({
    name,
    data
  })

  return res.result

}

const login = async () => {

  return callUserApi('api_user_login')

}

const register = async (nickName) => {

  return callUserApi(
    'api_user_register',
    {
      nickName
    }
  )

}

const updateUser = async (nickName) => {

  return callUserApi(
    'api_user_update',
    {
      nickName
    }
  )

}

// 获取用户信息：不传 userId 取当前登录用户（含权限集），传 userId 取指定用户基础档案
const getUser = async (userId) => {

  return callUserApi(
    'api_user_get',
    userId ? { userId } : {}
  )

}

module.exports = {
  login,
  register,
  updateUser,
  getUser
}
