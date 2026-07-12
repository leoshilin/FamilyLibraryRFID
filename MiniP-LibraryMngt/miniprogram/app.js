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

  // 登录 Promise 缓存：保证整个应用生命周期内只真正调用一次 api_user_login，
  // 避免首页/详情/检索页因 permissions 未就绪而隐藏 RFID 按钮（见 ensureLogin）
  _loginPromise: null,

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

    // 应用启动即加载权限到 globalData，避免先进入首页/详情/检索页时
    // permissions 仍为空对象，导致 RFID 绑定/解绑按钮被静默隐藏
    this.ensureLogin()
  },

  // 幂等登录：并发/重复调用只触发一次真实云函数请求，返回缓存的 Promise。
  // 切换家庭等需要刷新权限的场景请直接调用 login()
  ensureLogin() {
    if (!this._loginPromise) {
      this._loginPromise = this.login()
    }
    return this._loginPromise
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

      console.log('[login] 权限已加载: registered=true, permissions=', this.globalData.permissions)

    } else {

      this.globalData.currentUser = null

      this.globalData.registered = false

      this.globalData.permissions = {}

      console.log('[login] 未注册或登录失败: registered=false, permissions={}')

    }

    // 更新缓存为最新结果，使 ensureLogin 始终返回最新权限（如切换家庭后重新 login）
    this._loginPromise = Promise.resolve(this.globalData)

    return this.globalData
  }

})
