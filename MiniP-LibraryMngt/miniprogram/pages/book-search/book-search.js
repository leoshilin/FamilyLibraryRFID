const eventBus = require('../../utils/eventBus')
const EVENTS = require('../../utils/events')
const bookshelfServices = require('../../services/bookshelfServices')
const familyServices = require('../../services/familyServices')
const bookSearchServices = require('../../services/bookSearchServices')
const bookItemServices = require('../../services/bookItemServices')
const taskServices = require('../../services/taskServices')

Page({
  data: {
    familyId: '',        // 首页传入

    // RFID 权限门控（无 RFID_TASK_CREATE_BIND 隐藏绑定/重绑；无 RFID_UNBIND 隐藏解绑）
    canBind: false,
    canUnbind: false,

    // 批量读取绑定任务状态期间为 true，期间禁用 RFID 按钮，防止「置灰前抢点」竞态
    bindStatusLoading: false,

    // 检索模式：isbn / condition
    searchMode: 'isbn',

    // 条件检索是否折叠（true=显示摘要）
    conditionCollapsed: false,
    conditionSummary: [],

    // ISBN 精确检索
    isbn: '',

    // 条件检索
    keyword: '',

    statusOptions: [
      '仅搜索上架中图书',
      '包含已下架图书',
      '仅搜索已下架图书'
    ],
    statusIndex: 0,

    startDate: '',
    endDate: '',

    // 书架筛选
    bookshelfOptions: [
      {
        name: '全部书架',
        _id: ''
      }
    ],
    bookshelfIndex: 0,

    // RFID 绑定筛选
    rfidBindOptions: [
      '全部',
      '仅搜索已绑定',
      '仅搜索未绑定'
    ],
    rfidBindIndex: 0,

    // 查询结果
    books: [],

    page: 1,
    pageSize: 10,

    loadingMore: false,
    hasMore: true,

    // 页面首次渲染完成标记：过渡动画期间不展示底栏消息，
    // 避免“正在加载更多图书…”抢先盖在首页 TabBar 位置
    pageReady: false,

    currentExpandedId: null,

    // 标记：从详情页返回后是否需要刷新列表（由 eventBus 事件置位，onShow 消费）
    needRefresh: false
  },

  onLoad(options) {
    console.log('book_search.onLoad: start')

    // 确保权限已加载后再设置 RFID 门控（应用启动即触发，此处兜底 await，避免 race 导致按钮隐藏）
    this.ensurePermissions()

    // 监听来自详情页（或其它页面）的书籍变更事件，置位 needRefresh；
    // 实际刷新在 onShow 中执行，避免在事件回调里直接刷新造成重复请求
    this.refreshHandler = () => {
      this.data.needRefresh = true
    }
    eventBus.on(EVENTS.BOOK_ITEM_LISTED, this.refreshHandler)
    eventBus.on(EVENTS.BOOK_ITEM_UNLISTED, this.refreshHandler)
    eventBus.on(EVENTS.BOOK_ITEM_DELETED, this.refreshHandler)

    // 监听 RFID 任务状态变化（详情页创建绑定任务 / 解绑成功），即时更新对应项
    this.rfidChangedHandler = (payload) => {
      if (!payload || !payload.itemId) return
      const books = this.data.books
      const updates = {}
      books.forEach((b, i) => {
        if (b.itemId === payload.itemId) {
          updates[`books[${i}].bindInProgress`] = !!payload.inProgress
          if (payload.rfidTid !== undefined) {
            updates[`books[${i}].rfidTid`] = payload.rfidTid
          }
        }
      })
      if (Object.keys(updates).length) this.setData(updates)
    }
    eventBus.on(EVENTS.RFID_TASK_CHANGED, this.rfidChangedHandler)

    // familyId 不再由 URL 传入，改由服务端按 currentFamilyId 解析；
    // 前端仅本地解析当前家庭用于书架筛选触发器与本地守卫
    this.initCurrentFamily()
  },

  onShow() {
    // 重新展示时刷新权限门控（例如从「我的」页登录/切换家庭后返回），实现 RFID 按钮自愈
    this.ensurePermissions()

    // 从详情页（重新上架/下架/删除/RFID）返回后，若发生过书籍变更则刷新列表；
    // 否则重新查询绑定任务状态，实现 PDA 完成后的状态自愈
    if (this.data.needRefresh) {
      this.data.needRefresh = false
      this.fetchBooks(true)
    } else {
      this.loadBindStatuses()
    }
  },

  // 等待全局权限加载完成，并刷新本页 RFID 按钮门控（canBind / canUnbind）
  // 同时打印到 console 便于确认权限是否到位
  async ensurePermissions() {
    const app = getApp()
    if (app && app.ensureLogin) {
      await app.ensureLogin()
    }
    const perms = (app && app.globalData.permissions) || {}
    this.setData({
      canBind: !!perms.canCreateBindRfidTask,
      canUnbind: !!perms.canUnbindRfid
    })
    console.log('[book-search] RFID 权限门控: canBind=', this.data.canBind, 'canUnbind=', this.data.canUnbind, 'permissions=', perms)
  },

  onUnload() {
    eventBus.off(EVENTS.BOOK_ITEM_LISTED, this.refreshHandler)
    eventBus.off(EVENTS.BOOK_ITEM_UNLISTED, this.refreshHandler)
    eventBus.off(EVENTS.BOOK_ITEM_DELETED, this.refreshHandler)
    eventBus.off(EVENTS.RFID_TASK_CHANGED, this.rfidChangedHandler)
  },

  // 本地解析当前家庭并记录到 data.familyId（不下传给云函数）
  async initCurrentFamily() {
    try {
      const current = await familyServices.getCurrent()
      const familyId = (current && current.family && current.family._id) || ''
      this.setData({ familyId })
    } catch (err) {
      console.error('initCurrentFamily error:', err)
    } finally {
      this.loadBookshelves()
      this.fetchBooks(true)
    }
  },

  onReady() {
    // 首次渲染完成、且跳转过渡动画结束后再展示底栏消息，
    // 避免“正在加载更多图书…”在滑动过程中抢先盖在首页 TabBar 位置。
    // onReady 紧随首次渲染触发，仍处于过渡动画期内，
    // 故延后约一个过渡时长(350ms)再置位，确保页面已完全呈现
    setTimeout(() => {
      this.setData({
        pageReady: true
      })
    }, 350)
  },

  // ========================
  // 书架
  // ========================

  async loadBookshelves() {

    const familyId = this.data.familyId

    if (!familyId) return

    try {

      const result = await bookshelfServices.list(familyId)

      if (result.success) {

        this.setData({
          bookshelfOptions: [
            {
              name: '全部书架',
              _id: ''
            },
            ...result.list
          ]
        })

      }

    } catch (err) {

      console.error('loadBookshelves error:', err)

    }

  },

  // ========================
  // 检索方式
  // ========================

  onSearchModeChange(e) {

    const mode = e.currentTarget.dataset.mode

    this.setData({
      searchMode: mode
    })

    if (mode === 'isbn') {

      this.setData({
        keyword: '',
        startDate: '',
        endDate: '',
        bookshelfIndex: 0,
        statusIndex: 0,
        rfidBindIndex: 0,
        conditionCollapsed: false
      })

    } else {

      this.setData({
        isbn: '',
        conditionCollapsed: false
      })

    }

  },

  // 展开条件筛选
  expandConditionFilter() {
    this.setData({
      conditionCollapsed: false
    })
  },

  // ========================
  // 输入事件
  // ========================

  onISBNInput(e) {

    this.setData({
      isbn: e.detail.value.trim()
    })

  },

  onClearISBN() {

    this.setData({
      isbn: ''
    })

  },

  onKeywordInput(e) {

    this.setData({
      keyword: e.detail.value
    })

  },

  onBookshelfChange(e) {

    this.setData({
      bookshelfIndex: Number(e.detail.value)
    })

  },

  onStatusChange(e) {

    this.setData({
      statusIndex: Number(e.detail.value)
    })

  },

  onRfidBindChange(e) {

    this.setData({
      rfidBindIndex: Number(e.detail.value)
    })

  },

  onStartDateChange(e) {

    this.setData({
      startDate: e.detail.value
    })

  },

  onEndDateChange(e) {

    this.setData({
      endDate: e.detail.value
    })

  },

  // ========================
  // 搜索触发
  // ========================

    // ISBN扫码
    onScanISBN() {

      wx.scanCode({
  
        scanType: ['barCode'],
  
        success: (res) => {
  
          const isbn = (res.result || '').trim()
  
          console.log('扫描到 ISBN:', isbn)
  
          this.setData({
            isbn
        }, () => {

            // 扫码成功后立即搜索
            this.doSearch()

        })
  
        },
  
        fail: (err) => {
  
          console.error('扫码失败：', err)
  
        }
  
      })
  
    },
  
    // ========================
    // 搜索
    // ========================
  
    doSearch() {

      // 条件检索搜索完成后自动收起
      const collapse =
        this.data.searchMode === 'condition'
    
      this.setData({
    
        page: 1,
        books: [],
        hasMore: true,
        loadingMore: false,
        currentExpandedId: null,
        conditionCollapsed: collapse,
        conditionSummary: this.getConditionSummary()
    
      })
    
      this.fetchBooks(true)
    
    },

    //计算筛选摘要的方法
    getConditionSummary() {

      const summary = []
    
      if (this.data.keyword) {
        summary.push({
          label: '关键词',
          value: this.data.keyword
        })
      }
    
      if (this.data.statusIndex !== 0) {
        summary.push({
          label: '状态',
          value: this.data.statusOptions[this.data.statusIndex]
        })
      }
    
      if (this.data.bookshelfIndex !== 0) {
        summary.push({
          label: '书架',
          value:
            this.data.bookshelfOptions[
              this.data.bookshelfIndex
            ].name
        })
      }

      if (this.data.rfidBindIndex !== 0) {
        summary.push({
          label: 'RFID绑定',
          value: this.data.rfidBindOptions[this.data.rfidBindIndex]
        })
      }
    
      if (this.data.startDate || this.data.endDate) {
    
        summary.push({
    
          label: '上架时间',
    
          value:
            `${this.data.startDate || '不限'} ~ ${
              this.data.endDate || '不限'
            }`
    
        })
    
      }
    
      return summary
    
    },
  
    // ========================
    // 数据获取
    // ========================
  
    async fetchBooks(reset = false) {
  
      console.log('book_search.fetchBooks: start')
  
      const STATUS_MAP = [
  
        'in_stock',
  
        'all',
  
        'off_stock'
  
      ]
  
      if (reset) {
  
        this.setData({
  
          page: 1,
  
          books: [],
  
          hasMore: true
  
        })
  
      }
  
      if (this.data.loadingMore || !this.data.hasMore) {
  
        return
  
      }
  
      this.setData({
  
        loadingMore: true
  
      })
  
      try {
  
        const data = {

          page: this.data.page,

          pageSize: this.data.pageSize

        }
  
        if (this.data.searchMode === 'isbn') {
  
          data.isbn = this.data.isbn
  
        } else {
  
          data.keyword = this.data.keyword
  
          data.bookshelfId =
            this.data.bookshelfOptions[
              this.data.bookshelfIndex
            ]._id
  
          data.status =
            STATUS_MAP[this.data.statusIndex]

          // RFID 绑定筛选
          const RFID_BIND_MAP = ['', 'bound', 'unbound']
          data.rfidBind = RFID_BIND_MAP[this.data.rfidBindIndex]

          data.startDate = this.data.startDate
  
          data.endDate = this.data.endDate
  
        }
  
        const res = await bookSearchServices.search(data)

        if (!res || !res.success) {
          wx.showToast({
            title: res.result?.message || '查询失败',
            icon: 'none'
          })
          this.setData({ loadingMore: false })
          return
        }

        const list = res.data || []
  
        console.log(
  
          `book_search.fetchBooks read ${list.length} books from api_book_search`
  
        )
  
        // ========================
        // cover转换临时地址
        // ========================
  
        const fileList = list
  
          .filter(item => item.coverUrl)
  
          .map(item => item.coverUrl)
  
        if (fileList.length > 0) {
  
          const tempRes = await wx.cloud.getTempFileURL({
  
            fileList
  
          })
  
          const urlMap = {}
  
          tempRes.fileList.forEach(file => {
  
            urlMap[file.fileID] = file.tempFileURL
  
          })
  
          list.forEach(item => {
  
            if (
  
              item.coverUrl &&
  
              urlMap[item.coverUrl]
  
            ) {
  
              item.coverUrl =
  
                urlMap[item.coverUrl]
  
            }
  
          })
  
        }
  
        const books = reset
  
          ? list
  
          : this.data.books.concat(list)
  
        const total = res.total
  
        this.setData({

          books,

          loadingMore: false,

          page: this.data.page + 1,

          hasMore: books.length < total

        })

        // 列表加载完成后批量查询绑定任务状态，渲染「绑定中 / 重新绑定中」
        this.loadBindStatuses()

      } catch (err) {
  
        console.error('fetchBooks error:', err)
  
        this.setData({
  
          loadingMore: false
  
        })
  
        wx.showToast({
  
          title: '查询失败',
  
          icon: 'none'
  
        })
  
      }
  
    },
  
      // ========================
  // 列表交互
  // ========================

  onBookTap(e) {

    console.log('onBookTap start')

    const index = e.currentTarget.dataset.index
    const books = this.data.books

    const itemId = books[index].itemId
    const currentId = this.data.currentExpandedId

    this.setData({
      currentExpandedId: currentId === itemId ? null : itemId
    })

  },

  // ========================
  // 下架
  // ========================

  handleOff(e) {

    console.log('handleOff: start')

    const index = e.currentTarget.dataset.index
    const book = this.data.books[index]

    this.setData({
      currentExpandedId: null
    })

    wx.showActionSheet({

      itemList: ['废旧处理', '捐赠', '丢失'],

      success: (res) => {

        const reasons = [
          'scrap',
          'donation',
          'lost'
        ]

        const reasonTexts = [
          '废旧处理',
          '捐赠',
          '丢失'
        ]

        const reason = reasons[res.tapIndex]
        const reasonText = reasonTexts[res.tapIndex]

        wx.showModal({

          title: '确认下架',

          content: `确定将《${book.title}》标记为${reasonText}吗？`,

          success: async (confirmRes) => {

            if (!confirmRes.confirm) return

            wx.showLoading({
              title: '处理中...'
            })

            try {

              const result = await bookItemServices.offstock(book.itemId, reason)

              wx.hideLoading()

              if (result.success) {

                wx.showToast({
                  title: '已下架'
                })

                eventBus.emit(EVENTS.BOOK_ITEM_UNLISTED, {

                  itemId: book.itemId,

                  familyId: book.familyId

                })

                this.fetchBooks(true)

              } else {

                throw new Error(result.message || '操作失败')

              }

            } catch (err) {

              wx.hideLoading()

              wx.showToast({

                title: '下架失败',

                icon: 'none'

              })

              console.error(err)

            }

          }

        })

      }

    })

  },

  // ========================
  // RFID
  // ========================

  // 批量查询在架图书的绑定任务状态，合并到列表项（一次查询，避免 N 次调用）
  async loadBindStatuses() {
    const books = this.data.books
    if (!books || !books.length) return

    const ids = books
      .filter(b => b.inventoryStatus === 'in_stock')
      .map(b => b.itemId)
      .filter(Boolean)

    if (!ids.length) return

    // 加载期间禁用所有 RFID 按钮，待状态确认后再放开 / 保持置灰
    this.setData({ bindStatusLoading: true })
    try {
      const res = await taskServices.getBindStatus({ bookItemIds: ids })
      if (!res || !res.success || !res.map) {
        this.setData({ bindStatusLoading: false })
        return
      }

      const map = res.map
      const updates = {}
      books.forEach((b, i) => {
        if (b.inventoryStatus === 'in_stock') {
          const st = map[b.itemId] || { inProgress: false, status: null }
          updates[`books[${i}].bindInProgress`] = st.inProgress
        }
      })
      updates.bindStatusLoading = false
      if (Object.keys(updates).length) this.setData(updates)
    } catch (err) {
      console.error('book_search.loadBindStatuses error:', err)
      this.setData({ bindStatusLoading: false })
    }
  },

  // 绑定 / 重新绑定 RFID（列表页展开区）
  async handleBind(e) {
    console.log('handleBind start')

    const index = e.currentTarget.dataset.index
    const book = this.data.books[index]

    // 进行中（B/D 态）或状态加载中禁止重复发起
    if (!book || book.bindInProgress || this.data.bindStatusLoading) {
      console.log('handleBind: 存在进行中任务或状态加载中，忽略点击')
      return
    }

    this.setData({ currentExpandedId: null })

    // 重新绑定需用户确认
    if (book.rfidTid) {
      const { confirm } = await wx.showModal({
        title: '确认重新绑定',
        content: '该书已绑定 RFID，确认重新绑定吗？原标签将在 PDA 绑定新标签后被覆盖。'
      })
      if (!confirm) return
    }

    wx.showLoading({ title: '发起中...' })

    try {
      const result = await taskServices.createBindRfid(book.itemId)
      wx.hideLoading()

      if (result && result.success) {
        // 乐观置「进行中」，即时切到 B/D 态并通知其它页面
        this.setData({ [`books[${index}].bindInProgress`]: true })
        eventBus.emit(EVENTS.RFID_TASK_CHANGED, {
          itemId: book.itemId,
          inProgress: true
        })
        wx.showToast({ title: '已发起绑定任务，等待 PDA 执行', icon: 'none' })
      } else {
        wx.showToast({ title: (result && result.message) || '发起失败', icon: 'none' })
        // 服务端可能因「已有进行中任务」而拒绝（防重复），刷新状态让按钮置灰
        this.loadBindStatuses()
      }
    } catch (err) {
      wx.hideLoading()
      console.error('handleBind error:', err)
      wx.showToast({ title: '发起失败', icon: 'none' })
    }
  },

  // 解绑 RFID（列表页展开区）：先扫码 ISBN 比对，通过后再调 H1 主动解绑
  async handleUnbind(e) {
    console.log('handleUnbind start')

    const index = e.currentTarget.dataset.index
    const book = this.data.books[index]

    // 进行中（D 态）或状态加载中禁止解绑
    if (!book || book.bindInProgress || this.data.bindStatusLoading) {
      console.log('handleUnbind: 存在进行中任务或状态加载中，忽略')
      return
    }

    this.setData({ currentExpandedId: null })

    // 调起扫码，扫描实体书 ISBN 做实体确认
    let scanned = ''
    try {
      const scanRes = await new Promise((resolve, reject) => {
        wx.scanCode({
          scanType: ['barCode'],
          success: resolve,
          fail: reject
        })
      })
      scanned = (scanRes.result || '').trim()
    } catch (err) {
      console.log('handleUnbind: 用户取消扫码')
      return
    }

    // ISBN 比对：归一化后比较，防止连字符 / 空格差异导致误判
    if (!this.compareIsbn(scanned, book.isbn)) {
      wx.showToast({ title: '扫描的 ISBN 与本书不一致，无法解绑', icon: 'none' })
      return
    }

    wx.showLoading({ title: '解绑中...' })

    try {
      const result = await taskServices.unbindRfid(book.itemId)
      wx.hideLoading()

      if (result && result.success) {
        // 解绑即时生效：清空本地 rfid_tid，切回 A 态
        this.setData({
          [`books[${index}].rfidTid`]: '',
          [`books[${index}].bindInProgress`]: false
        })
        eventBus.emit(EVENTS.RFID_TASK_CHANGED, {
          itemId: book.itemId,
          inProgress: false,
          rfidTid: ''
        })
        wx.showToast({ title: '已解绑', icon: 'success' })
      } else {
        wx.showToast({ title: (result && result.message) || '解绑失败', icon: 'none' })
      }
    } catch (err) {
      wx.hideLoading()
      console.error('handleUnbind error:', err)
      wx.showToast({ title: '解绑失败', icon: 'none' })
    }
  },

  // 归一化比较 ISBN：去除非数字字母字符（连字符 / 空格）并忽略大小写
  compareIsbn(a, b) {
    const norm = (s) => (s || '').replace(/[^0-9Xx]/g, '').toUpperCase()
    return norm(a) === norm(b)
  },

  // ========================
  // 删除
  // ========================

  async handleDelete(e) {

    console.log('handleDelete start')

    const index = e.currentTarget.dataset.index
    const book = this.data.books[index]

    this.setData({
      currentExpandedId: null
    })

    const { confirm } = await wx.showModal({

      title: '彻底删除确认',

      content: `确定彻底删除《${book.title}》吗？删除后无法恢复，请慎重`

    })

    if (!confirm) return

    wx.showLoading({

      title: '删除中...'

    })

    try {

      const result = await bookItemServices.remove(book.itemId)

      wx.hideLoading()

      if (result.success) {

        wx.showToast({

          title: '已删除'

        })

        eventBus.emit(EVENTS.BOOK_ITEM_DELETED, {

          itemId: book.itemId,

          familyId: book.familyId

        })

        this.fetchBooks(true)

      } else {

        throw new Error(result.message || '操作失败')

      }

    } catch (err) {

      wx.hideLoading()

      wx.showToast({

        title: '删除书籍失败',

        icon: 'none'

      })

      console.error(err)

    }

  },

  //跳转到详情页
  handleDetail(e){
    console.log('handleDetail start')

    const index = e.currentTarget.dataset.index
    const book = this.data.books[index]
    this.setData({
      currentExpandedId: null
    })

    console.log('详情展示:', book.title)

    wx.navigateTo({
      url: `/pages/book/book?mode=view`,
      success: (res) => {
        res.eventChannel.emit('bookData', book)
        console.log('emit done')
      }
    })
    console.log (`navigate to url: /pages/book/book?mode=view`)
    console.log('before jump, book=',book)
  },

  //重新上架
  async handleOn(e) {
    console.log('handleOn start')

    const index = e.currentTarget.dataset.index
    const book = this.data.books[index]

    this.setData({
      currentExpandedId: null
    })

    console.log('重新上架准备:', book.title)

    // 重新上架前确认
    const {
      confirm
    } = await wx.showModal({
      title: '确认重新上架吗？',
      content: `确定重新上架《${book.title}》吗？`
    })
    if (!confirm) return

    // 重新上架
    wx.showLoading({
      title: '重新上架中...'
    })

    try {
      const result = await bookItemServices.restock(book.itemId)

      wx.hideLoading()

      if (result.success) {
        wx.showToast({
          title: '已重新上架'
        })

        //eventBus中注册共有事件，供其他页面响应更新
        eventBus.emit(EVENTS.BOOK_ITEM_LISTED, {
          itemId: book.itemId,
          familyId: book.familyId
        })
        //立即刷新本页数据
        this.fetchBooks(true)
      } else {
        throw new Error(result.message || '操作失败')
      }
    } catch (err) {
      wx.hideLoading()
      wx.showToast({
        title: '重新上架失败',
        icon: 'none'
      })
      console.error(err)
    }

    console.log('重新上架完毕:', book.title)
  },

  onReachBottom() {
    console.log('onReachBottom start')
    if (!this.data.loadingMore) {
      this.fetchBooks(false)
    }
  },

})
