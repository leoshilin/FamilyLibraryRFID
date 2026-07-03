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

module.exports = {
  login,
  register,
  updateUser
}
