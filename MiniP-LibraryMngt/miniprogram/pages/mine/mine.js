const userServices = require('../../services/userServices')

Page({

  data: {

    registered: false,

    user: null,

    family: null,

    stats: {

      bookshelfCount: 0,

      bookCount: 0

    },

    bookshelves: [],

    // 当前家庭下的用户权限集
    permissions: {}

  },

  async onShow() {

    const app = getApp()
  
    console.log('before login')
  
    await app.login()
  
    console.log('after login')
  
    console.log(app.globalData)
  
    await this.initPage()
  
  },

  async initPage() {

    const app = getApp()

    const {
      registered,
      currentUser,
      permissions
    } = app.globalData

    console.log(
      'Mine init:',
      registered,
      currentUser
    )

    //
    // 未注册用户
    //
    if (!registered) {

      this.setData({
        registered: false,
        user: null,
        family: null,
        bookshelves: [],
        permissions: {}
      })

      return

    }

    //
    // 已注册用户：加载用户信息与权限
    //
    this.setData({
      registered: true,
      user: currentUser,
      permissions
    })

    //
    // 后续调用（第二部分实现）
    //
    // await this.loadFamily()
    // await this.loadBookshelf()

  },

  async onRegisterTap() {

    wx.showLoading({
      title: '注册中...'
    })
  
    try {
  
      const result = await userServices.register(
        '书虫虫'
      )
  
      console.log(
        'api_user_register result:',
        result
      )
  
      if (!result.success) {
  
        wx.showToast({
  
          title:
            result.message ||
            '注册失败',
  
          icon: 'none'
  
        })
  
        return
  
      }
  
      //
      // 重新获取登录用户信息
      //
      const app = getApp()
  
      await app.login()
  
      //
      // 刷新Mine页面
      //
      await this.initPage()
  
      wx.showToast({
  
        title: '注册成功',
  
        icon: 'success'
  
      })
  
    }
    catch(err) {
  
      console.error(
        'register failed',
        err
      )
  
      wx.showToast({
  
        title: '注册失败',
  
        icon: 'none'
  
      })
  
    }
    finally {
  
      wx.hideLoading()
  
    }
  
  },

  async onEditUserTap() {

    const currentName =
      this.data.user.nickName
  
    wx.showModal({
  
      title: '修改用户名',
  
      editable: true,
  
      placeholderText: currentName,
  
      success: async (res) => {
  
        if (!res.confirm) {
          return
        }
  
        const nickName =
          (res.content || '').trim()
  
        if (!nickName) {
  
          wx.showToast({
  
            title: '用户名不能为空',
  
            icon: 'none'
  
          })
  
          return
  
        }
  
        await this.updateUserName(
          nickName
        )
  
      }
  
    })
  
  },

  async updateUserName(nickName) {

    wx.showLoading({
  
      title: '保存中...'
  
    })
  
    try {
  
      const result =
        await userServices.updateUser(
          nickName
        )
  
      if (!result.success) {
  
        wx.showToast({
  
          title:
            result.message ||
            '修改失败',
  
          icon: 'none'
  
        })
  
        return
  
      }
  
      const app = getApp()
  
      await app.login()
  
      await this.initPage()
  
      wx.showToast({
  
        title: '修改成功',
  
        icon: 'success'
  
      })
  
    }
    catch(err) {
  
      console.error(err)
  
      wx.showToast({
  
        title: '修改失败',
  
        icon: 'none'
  
      })
  
    }
    finally {
  
      wx.hideLoading()
  
    }
  
  }

})
