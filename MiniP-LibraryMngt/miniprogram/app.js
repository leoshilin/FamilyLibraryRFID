// app.js
App({
  globalData: {
    env: "",
    // 登录用户信息
    currentUser: null,
    // 是否注册
    registered: false
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

    const res = await wx.cloud.callFunction({
      name: 'api_user_login'
    })

    if (
      res.result.success &&
      res.result.registered
    ) {

      this.globalData.currentUser =
        res.result.user

      this.globalData.registered = true

    } else {

      this.globalData.currentUser = null

      this.globalData.registered = false

    }

    return this.globalData
  }

})
