// app.js
const userServices = require('./services/userServices')

App({
  globalData: {
    env: "cloud1-7gyxpvk57f520e6a",
    // 登录用户信息
    currentUser: null,
    // 是否注册
    registered: false,
    // 当前家庭下的用户权限集（由 api_user_login 返回）
    permissions: {}
  },
  
  
  async onLaunch() {    
    if (!wx.cloud) {
      console.error("请使用 2.2.3 或以上的基础库以使用云能力");
      return
    }
        
    // 初始化云环境
    wx.cloud.init({
      env: this.globalData.env,
      traceUser: true,
    })
  },

  async login() {

    const result = await userServices.login()

    if (
      result.success &&
      result.registered
    ) {

      this.globalData.currentUser =
        result.user

      this.globalData.registered = true

      // 存储权限信息，供各页面控制 UI 展示
      this.globalData.permissions =
        result.permissions || {}

    } else {

      this.globalData.currentUser = null

      this.globalData.registered = false

      this.globalData.permissions = {}

    }

    return this.globalData
  }

})
