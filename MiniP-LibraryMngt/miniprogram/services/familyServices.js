// 家庭相关 API 封装
// 页面通过此 Service 调用云函数，不直接调用 wx.cloud.callFunction()

const callFunction = async (name, data = {}) => {
  const res = await wx.cloud.callFunction({
    name,
    data
  })
  return res.result
}

// 获取当前用户访问中的家庭
const getCurrent = () => {
  return callFunction('api_family_getCurrent')
}

// 获取当前用户所属的所有家庭列表
const list = () => {
  return callFunction('api_family_list')
}

// 创建家庭（可选 name，默认为"我的家庭"）
const create = (name) => {
  return callFunction('api_family_create', {
    name: name || '我的家庭'
  })
}

// 修改家庭名称
const update = (familyId, name) => {
  return callFunction('api_family_update', {
    familyId,
    name
  })
}

// 逻辑删除家庭
const remove = (familyId) => {
  return callFunction('api_family_delete', {
    familyId
  })
}

// 切换当前默认家庭
const switchCurrent = (familyId) => {
  return callFunction('api_family_switchCurrent', {
    familyId
  })
}

module.exports = {
  getCurrent,
  list,
  create,
  update,
  remove,
  switchCurrent
}
