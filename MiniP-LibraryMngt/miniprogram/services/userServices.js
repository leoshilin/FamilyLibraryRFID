const { callFunction } = require('./_base')

const login = async () => {

  return callFunction('api_user_login')

}

const register = async (nickName) => {

  return callFunction(
    'api_user_register',
    {
      nickName
    }
  )

}

const updateUser = async (nickName) => {

  return callFunction(
    'api_user_update',
    {
      nickName
    }
  )

}

// 获取用户信息：不传 userId 取当前登录用户（含权限集），传 userId 取指定用户基础档案
const getUser = async (userId) => {

  return callFunction(
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
