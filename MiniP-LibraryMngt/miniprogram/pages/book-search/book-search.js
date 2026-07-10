const eventBus = require('../../utils/eventBus')
const EVENTS = require('../../utils/events')
const bookshelfServices = require('../../services/bookshelfServices')
const familyServices = require('../../services/familyServices')

Page({
  data: {
    familyId: '',        // 首页传入

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

    // 查询结果
    books: [],

    page: 1,
    pageSize: 10,

    loadingMore: false,
    hasMore: true,

    // 页面首次渲染完成标记：过渡动画期间不展示底栏消息，
    // 避免“正在加载更多图书…”抢先盖在首页 TabBar 位置
    pageReady: false,

    currentExpandedId: null
  },

  onLoad(options) {
    console.log('book_search.onLoad: start')

    // familyId 不再由 URL 传入，改由服务端按 currentFamilyId 解析；
    // 前端仅本地解析当前家庭用于书架筛选触发器与本地守卫
    this.initCurrentFamily()
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
  
          data.startDate = this.data.startDate
  
          data.endDate = this.data.endDate
  
        }
  
        const res = await wx.cloud.callFunction({
  
          name: 'api_book_search',
  
          data
  
        })
  
        const list = res.result.data || []
  
        console.log(
  
          `book_search.fetchBooks read ${list.length} books from api_book_search`
  
        )
  
        // ========================
        // cover转换临时地址
        // ========================
  
        const fileList = list
  
          .filter(item => item.cover_url)
  
          .map(item => item.cover_url)
  
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
  
              item.cover_url &&
  
              urlMap[item.cover_url]
  
            ) {
  
              item.cover_url =
  
                urlMap[item.cover_url]
  
            }
  
          })
  
        }
  
        const books = reset
  
          ? list
  
          : this.data.books.concat(list)
  
        const total = res.result.total
  
        this.setData({
  
          books,
  
          loadingMore: false,
  
          page: this.data.page + 1,
  
          hasMore: books.length < total
  
        })
  
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

    const itemId = books[index].item_id
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

              const result = await wx.cloud.callFunction({

                name: 'api_bookitem_offstock',

                data: {

                  item_id: book.item_id,

                  reason

                }

              })

              wx.hideLoading()

              if (result.result.success) {

                wx.showToast({
                  title: '已下架'
                })

                eventBus.emit(EVENTS.BOOK_ITEM_UNLISTED, {

                  itemId: book.item_id,

                  familyId: book.family_id

                })

                this.fetchBooks(true)

              } else {

                throw result.result.error

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

  handleRFID(e) {

    console.log('handleRFID start')

    const index = e.currentTarget.dataset.index
    const book = this.data.books[index]

    this.setData({
      currentExpandedId: null
    })

    console.log('绑定RFID:', book.title)

    // TODO：
    // 后续进入 RFID 绑定流程

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

      const result = await wx.cloud.callFunction({

        name: 'api_bookitem_delete',

        data: {

          item_id: book.item_id

        }

      })

      wx.hideLoading()

      if (result.result.success) {

        wx.showToast({

          title: '已删除'

        })

        eventBus.emit(EVENTS.BOOK_ITEM_DELETED, {

          itemId: book.item_id,

          familyId: book.family_id

        })

        this.fetchBooks(true)

      } else {

        throw result.result.error

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
      const result = await wx.cloud.callFunction({
        name: 'api_bookitem_restock',
        data: {
          item_id: book.item_id
        }
      })

      wx.hideLoading()

      if (result.result.success) {
        wx.showToast({
          title: '已重新上架'
        })

        //eventBus中注册共有事件，供其他页面响应更新
        eventBus.emit(EVENTS.BOOK_ITEM_LISTED, {
          itemId: book.item_id,
          familyId: book.family_id
        })
        //立即刷新本页数据
        this.fetchBooks(true)
      } else {
        throw result.result.error
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
