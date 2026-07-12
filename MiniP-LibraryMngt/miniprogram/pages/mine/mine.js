const userServices = require('../../services/userServices')
const familyServices = require('../../services/familyServices')
const bookshelfServices = require('../../services/bookshelfServices')

Page({

  data: {

    registered: false,

    user: null,

    family: null,

    familyRole: '',

    stats: {

      bookshelfCount: 0,

      bookCount: 0

    },

    bookshelves: [],

    // 当前家庭下的用户权限集
    permissions: {},

    // 家庭选择弹窗
    showFamilyPicker: false,
    familyList: [],

    // 家庭表单弹窗（创建 / 编辑）
    showFamilyForm: false,
    familyFormMode: 'create',
    familyFormName: '',
    editingFamilyId: '',

    // 书架表单弹窗（创建 / 编辑）
    showBookshelfForm: false,
    bookshelfFormMode: 'create',
    bookshelfFormName: '',
    editingBookshelfId: ''

  },

  async onShow() {

    const app = getApp()

    // 使用幂等的 ensureLogin：应用启动已触发过登录时直接复用缓存，避免重复云调用
    await app.ensureLogin()

    await this.initPage()

  },

  async initPage() {

    const app = getApp()

    const {
      registered,
      currentUser,
      permissions
    } = app.globalData

    //
    // 未注册用户
    //
    if (!registered) {

      this.setData({
        registered: false,
        user: null,
        family: null,
        familyRole: '',
        bookshelves: [],
        permissions: {}
      })

      return

    }

    //
    // 已注册用户：优先通过 Service 获取当前登录用户权威信息；
    // 若云函数尚未部署导致 getUser 失败，则回退到 app.login() 已写入的全局 currentUser，
    // 保证页面在常态下（云函数就绪）走 Service，异常时仍可用。
    //
    try {

      const me = await userServices.getUser()

      if (me && me.success) {

        this.setData({
          registered: true,
          user: me.user,
          permissions: me.permissions || permissions
        })

      } else {

        console.warn('getUser failed, fallback to globalData.currentUser:', me && me.message)
        this.setData({
          registered: true,
          user: currentUser,
          permissions
        })

      }

    } catch (err) {
      console.error('getUser error, fallback to globalData.currentUser:', err)
      this.setData({
        registered: true,
        user: currentUser,
        permissions
      })
    }

    await this.loadFamily()
    await this.loadBookshelves()

  },

  // ========================
  //  家庭相关
  // ========================

  async loadFamily() {

    try {

      const result = await familyServices.getCurrent()

      if (!result.success) {
        console.warn('getCurrent failed:', result.message)
        return
      }

      this.setData({
        family: result.family,
        familyRole: result.role || '',
        'stats.bookshelfCount': result.bookshelfCount || 0
      })

    } catch (err) {
      console.error('loadFamily error:', err)
    }

  },

  // 点击当前家庭卡片 → 弹出家庭选择器
  async onFamilyTap() {

    // 先获取家庭列表
    wx.showLoading({ title: '加载中...' })

    try {

      const result = await familyServices.list()

      if (result.success) {
        this.setData({
          familyList: result.list,
          showFamilyPicker: true
        })
      } else {
        wx.showToast({ title: result.message, icon: 'none' })
      }

    } catch (err) {
      console.error(err)
      wx.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }

  },

  // 关闭家庭选择器
  onCloseFamilyPicker() {
    this.setData({ showFamilyPicker: false })
  },

  // 切换当前家庭
  async onSwitchFamily(e) {

    const { familyId } = e.currentTarget.dataset

    // 已经是当前家庭，不操作
    if (familyId === this.data.family?._id) {
      this.setData({ showFamilyPicker: false })
      return
    }

    wx.showLoading({ title: '切换中...' })

    try {

      const result = await familyServices.switchCurrent(familyId)

      if (!result.success) {
        wx.showToast({ title: result.message, icon: 'none' })
        return
      }

      // 重新登录刷新权限
      const app = getApp()
      await app.login()

      this.setData({ showFamilyPicker: false })

      // 刷新页面
      await this.initPage()

      wx.showToast({ title: '已切换', icon: 'success' })

    } catch (err) {
      console.error(err)
      wx.showToast({ title: '切换失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }

  },

  // ========================
  //  家庭创建 / 编辑 / 删除
  // ========================

  // 打开创建家庭表单
  onOpenCreateFamily() {
    this.setData({
      showFamilyForm: true,
      familyFormMode: 'create',
      familyFormName: '',
      editingFamilyId: '',
      showFamilyPicker: false  // 关闭选择器
    })
  },

  // 打开编辑家庭表单
  onEditFamily(e) {

    const { familyId, name } = e.currentTarget.dataset

    this.setData({
      showFamilyForm: true,
      familyFormMode: 'edit',
      familyFormName: name,
      editingFamilyId: familyId,
      showFamilyPicker: false  // 关闭选择器
    })

  },

  // 家庭名称输入
  onFamilyNameInput(e) {
    this.setData({ familyFormName: e.detail.value })
  },

  // 关闭家庭表单
  onCloseFamilyForm() {
    this.setData({
      showFamilyForm: false,
      familyFormName: '',
      editingFamilyId: ''
    })
  },

  // 提交家庭表单
  async onSubmitFamily() {

    const { familyFormMode, familyFormName, editingFamilyId } = this.data
    const name = (familyFormName || '').trim()

    if (!name) {
      wx.showToast({ title: '名称不能为空', icon: 'none' })
      return
    }

    wx.showLoading({ title: familyFormMode === 'create' ? '创建中...' : '保存中...' })

    try {

      let result

      if (familyFormMode === 'create') {
        result = await familyServices.create(name)
      } else {
        result = await familyServices.update(editingFamilyId, name)
      }

      if (!result.success) {
        wx.showToast({ title: result.message, icon: 'none' })
        return
      }

      this.setData({ showFamilyForm: false })

      // 重新登录刷新权限
      const app = getApp()
      await app.login()

      // 刷新页面
      await this.initPage()

      wx.showToast({
        title: familyFormMode === 'create' ? '创建成功' : '修改成功',
        icon: 'success'
      })

    } catch (err) {
      console.error(err)
      wx.showToast({ title: '操作失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }

  },

  // 删除家庭
  async onDeleteFamily(e) {

    const { familyId, name } = e.currentTarget.dataset

    wx.showModal({
      title: '确认删除',
      content: `确定要删除家庭「${name}」吗？\n删除后无法恢复。`,
      confirmText: '删除',
      confirmColor: '#e74c3c',
      success: async (res) => {

        if (!res.confirm) return

        wx.showLoading({ title: '删除中...' })

        try {

          const result = await familyServices.remove(familyId)

          if (!result.success) {
            wx.showToast({ title: result.message, icon: 'none' })
            return
          }

          this.setData({ showFamilyPicker: false })

          // 重新登录刷新权限
          const app = getApp()
          await app.login()

          // 刷新页面
          await this.initPage()

          wx.showToast({ title: '已删除', icon: 'success' })

        } catch (err) {
          console.error(err)
          wx.showToast({ title: '删除失败', icon: 'none' })
        } finally {
          wx.hideLoading()
        }

      }
    })

  },

  // ========================
  //  书架相关
  // ========================

  async loadBookshelves() {

    // 没有当前家庭则跳过
    if (!this.data.family) {
      this.setData({ bookshelves: [] })
      return
    }

    try {

      const result = await bookshelfServices.list(this.data.family._id)

      if (result.success) {
        this.setData({ bookshelves: result.list })
      }

    } catch (err) {
      console.error('loadBookshelves error:', err)
    }

  },

  // 打开创建书架表单
  onOpenCreateBookshelf() {
    this.setData({
      showBookshelfForm: true,
      bookshelfFormMode: 'create',
      bookshelfFormName: '',
      editingBookshelfId: ''
    })
  },

  // 打开编辑书架表单
  onEditBookshelf(e) {

    const { bookshelfId, name } = e.currentTarget.dataset

    this.setData({
      showBookshelfForm: true,
      bookshelfFormMode: 'edit',
      bookshelfFormName: name,
      editingBookshelfId: bookshelfId
    })

  },

  // 书架名称输入
  onBookshelfNameInput(e) {
    this.setData({ bookshelfFormName: e.detail.value })
  },

  // 关闭书架表单
  onCloseBookshelfForm() {
    this.setData({
      showBookshelfForm: false,
      bookshelfFormName: '',
      editingBookshelfId: ''
    })
  },

  // 提交书架表单
  async onSubmitBookshelf() {

    const { bookshelfFormMode, bookshelfFormName, editingBookshelfId, family } = this.data
    const name = (bookshelfFormName || '').trim()

    if (!name) {
      wx.showToast({ title: '名称不能为空', icon: 'none' })
      return
    }

    if (!family) {
      wx.showToast({ title: '请先创建家庭', icon: 'none' })
      return
    }

    wx.showLoading({ title: bookshelfFormMode === 'create' ? '创建中...' : '保存中...' })

    try {

      let result

      if (bookshelfFormMode === 'create') {
        result = await bookshelfServices.create(family._id, name)
      } else {
        result = await bookshelfServices.update(editingBookshelfId, name)
      }

      if (!result.success) {
        wx.showToast({ title: result.message, icon: 'none' })
        return
      }

      this.setData({ showBookshelfForm: false })

      // 刷新书架列表
      await this.loadBookshelves()

      wx.showToast({
        title: bookshelfFormMode === 'create' ? '创建成功' : '修改成功',
        icon: 'success'
      })

    } catch (err) {
      console.error(err)
      wx.showToast({ title: '操作失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }

  },

  // 删除书架
  async onDeleteBookshelf(e) {

    const { bookshelfId, name } = e.currentTarget.dataset

    wx.showModal({
      title: '确认删除',
      content: `确定要删除书架「${name}」吗？`,
      confirmText: '删除',
      confirmColor: '#e74c3c',
      success: async (res) => {

        if (!res.confirm) return

        wx.showLoading({ title: '删除中...' })

        try {

          const result = await bookshelfServices.remove(bookshelfId)

          if (!result.success) {
            wx.showToast({ title: result.message, icon: 'none' })
            return
          }

          // 刷新书架列表
          await this.loadBookshelves()

          wx.showToast({ title: '已删除', icon: 'success' })

        } catch (err) {
          console.error(err)
          wx.showToast({ title: '删除失败', icon: 'none' })
        } finally {
          wx.hideLoading()
        }

      }
    })

  },

  // 上移书架（与上一个交换顺序）
  async onMoveBookshelfUp(e) {

    const { index } = e.currentTarget.dataset
    const i = Number(index)

    if (i <= 0) return  // 已在最顶部，不处理

    const list = this.data.bookshelves.slice()
    const tmp = list[i - 1]
    list[i - 1] = list[i]
    list[i] = tmp

    // 乐观更新，立即反馈
    this.setData({ bookshelves: list })
    await this.persistBookshelfOrder()

  },

  // 下移书架（与下一个交换顺序）
  async onMoveBookshelfDown(e) {

    const { index } = e.currentTarget.dataset
    const i = Number(index)

    const len = this.data.bookshelves.length
    if (i >= len - 1) return  // 已在最底部，不处理

    const list = this.data.bookshelves.slice()
    const tmp = list[i + 1]
    list[i + 1] = list[i]
    list[i] = tmp

    // 乐观更新，立即反馈
    this.setData({ bookshelves: list })
    await this.persistBookshelfOrder()

  },

  // 将当前书架顺序持久化到云端（调用 bookshelfServices.reorder）
  async persistBookshelfOrder() {

    const orderedIds = this.data.bookshelves.map(b => b._id)

    wx.showLoading({ title: '排序中...' })

    try {

      const result = await bookshelfServices.reorder(orderedIds)

      if (!result.success) {
        wx.showToast({ title: result.message || '排序失败', icon: 'none' })
        // 回滚：重新拉取权威顺序
        await this.loadBookshelves()
        return
      }

      wx.showToast({ title: '已排序', icon: 'success' })

    } catch (err) {
      console.error('persistBookshelfOrder error:', err)
      wx.showToast({ title: '排序失败', icon: 'none' })
      await this.loadBookshelves()
    } finally {
      wx.hideLoading()
    }

  },

  // ========================
  //  用户相关（已有功能保持不变）
  // ========================

  async onRegisterTap() {

    wx.showLoading({
      title: '注册中...'
    })
  
    try {
  
      const result = await userServices.register(
        '书虫虫'
      )
  
      if (!result.success) {
  
        wx.showToast({
          title: result.message || '注册失败',
          icon: 'none'
        })
  
        return
  
      }
  
      const app = getApp()
      await app.login()
      await this.initPage()
  
      wx.showToast({
        title: '注册成功',
        icon: 'success'
      })
  
    } catch (err) {
      console.error('register failed', err)
      wx.showToast({ title: '注册失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  
  },

  async onEditUserTap() {

    const currentName = this.data.user.nickName
  
    wx.showModal({
      title: '修改用户名',
      editable: true,
      placeholderText: currentName,
      success: async (res) => {
  
        if (!res.confirm) return
  
        const nickName = (res.content || '').trim()
  
        if (!nickName) {
          wx.showToast({ title: '用户名不能为空', icon: 'none' })
          return
        }
  
        await this.updateUserName(nickName)
  
      }
    })
  
  },

  async updateUserName(nickName) {

    wx.showLoading({ title: '保存中...' })
  
    try {
  
      const result = await userServices.updateUser(nickName)
  
      if (!result.success) {
        wx.showToast({ title: result.message || '修改失败', icon: 'none' })
        return
      }
  
      const app = getApp()
      await app.login()
      await this.initPage()
  
      wx.showToast({ title: '修改成功', icon: 'success' })
  
    } catch (err) {
      console.error(err)
      wx.showToast({ title: '修改失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  
  }

})
