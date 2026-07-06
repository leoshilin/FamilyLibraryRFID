const eventBus = require('../../utils/eventBus')
const EVENTS = require('../../utils/events')
const bookshelfServices = require('../../services/bookshelfServices')

Page({
  data: {
    familyId: '', //首页传入
    operator: '', //首页传入
    keyword: '',
    isbn: '', // ISBN精确匹配
    showAdvanced: false,

    statusOptions: [
      '仅搜索上架中图书',
      '包含已下架图书',
      '仅搜索已下架图书'
    ],
    statusIndex: 0,

    startDate: '',
    endDate: '',

    // 书架筛选
    bookshelfOptions: [{ name: '全部书架', _id: '' }], // 首项为"全部"
    bookshelfIndex: 0,

    books: [],    
    page: 1,
    pageSize: 10,
    loadingMore: false,
    hasMore: true,

    currentExpandedId: null, // 当前滑开的行        
  },
  
  onLoad(options) {
    console.log('book_search.onLoad: start')
    console.log('book_search: currentExpandedId:', this.data.currentExpandedId)
    
    this.setData ({
      familyId: options.familyId || null,
      operator:  options.operator || null
    })

    // 加载书架列表（用于高级搜索中的书架筛选）
    this.loadBookshelves()

    this.fetchBooks(true)
  },

  // 加载书架列表
  async loadBookshelves() {
    const familyId = this.data.familyId
    if (!familyId) return

    try {
      const result = await bookshelfServices.list(familyId)
      if (result.success) {
        // 首项为"全部书架"，后面追加实际书架
        this.setData({
          bookshelfOptions: [{ name: '全部书架', _id: '' }, ...result.list]
        })
      }
    } catch (err) {
      console.error('loadBookshelves error:', err)
    }
  },

  onKeywordInput(e) {
    this.setData({ keyword: e.detail.value })
  },

  onIsbnInput(e) {
    this.setData({ isbn: e.detail.value })
  },

  // 扫码检索ISBN
  onScanISBN() {
    wx.scanCode({
      scanType: ['barCode'],
      success: res => {
        const isbn = res.result
        console.log('扫描到 ISBN:', isbn)
        this.setData({ isbn })
        // 扫码后自动检索
        this.onSearch()
      },
      fail: err => {
        console.error('扫码失败：', err)
      }
    })
  },

  onBookshelfChange(e) {
    this.setData({ bookshelfIndex: e.detail.value })
  },

  toggleAdvanced() {
    this.setData({
      showAdvanced: !this.data.showAdvanced
    })
  },

  onStatusChange(e) {
    this.setData({ statusIndex: e.detail.value })
  },

  onStartDateChange(e) {
    this.setData({ startDate: e.detail.value })
  },

  onEndDateChange(e) {
    this.setData({ endDate: e.detail.value })
  },  

  //搜索按钮 或 高级搜索按钮的action
  onSearch() {
    this.setData({
      page: 1,
      books: [],
      hasMore: true,
      showAdvanced: false,
      
      //页面控制，执行检索时收起展开行
      currentExpandedId: null,    
    })

    this.fetchBooks(true)
  },

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
        hasMore: true,
        books: []
      })
    }

    if (this.data.loadingMore || !this.data.hasMore) return
    
    console.log('book_search.fetchBooks: CP1')

    this.setData({ loadingMore: true })

    const res = await wx.cloud.callFunction({
      name: 'api_book_search',
      data: {   
        familyId: this.data.familyId,     
        keyword: this.data.keyword,
        isbn: this.data.isbn,
        bookshelfId: this.data.bookshelfOptions[this.data.bookshelfIndex]._id,
        status: STATUS_MAP[this.data.statusIndex],
        startDate: this.data.startDate,
        endDate: this.data.endDate,        
        page: this.data.page,
        pageSize: this.data.pageSize
      }
    })

    const list = res.result.data || []
    console.log(`book_search.fetchBooks read ${list.length} books from api_book_search`)

    // 替换所有cover_url 原来的cloud云地址为可访问的临时访问地址
    // 1️⃣ 取出所有非空 fileID
    const fileList = list
      .filter(item => item.cover_url)
      .map(item => item.cover_url)

    // 2️⃣ 批量获取临时地址
    if (fileList.length > 0) {
      const tempRes = await wx.cloud.getTempFileURL({
        fileList
      })

      // 3️⃣ 建立映射关系
      const urlMap = {}
      tempRes.fileList.forEach(file => {
        urlMap[file.fileID] = file.tempFileURL
      })

      // 4️⃣ 替换原 cover_url
      list.forEach(item => {
        if (item.cover_url && urlMap[item.cover_url]) {
          item.cover_url = urlMap[item.cover_url]
        }
      })
    }

    const books = reset ? list : this.data.books.concat(list)
    const total = res.result.total
    this.setData({
      books,
      loadingMore: false,
      page: this.data.page + 1,
      hasMore: books.length < total 
    })
  },
  
  onBookTap(e) {
    console.log('onBookTap start')
    const index = e.currentTarget.dataset.index

    const books = this.data.books
    const itemId = books[index].item_id
    console.log('itemId is:',itemId)

    const currentId = this.data.currentExpandedId
    console.log('currentId before set is:',currentId)

    this.setData({
      currentExpandedId: currentId === itemId ? null : itemId
    })
  },

  handleOff(e) {
    console.log('handleOff: start')

    const index = e.currentTarget.dataset.index
    const book = this.data.books[index]

    // 下架逻辑
    wx.showActionSheet({
      itemList: ['废旧处理', '捐赠', '丢失'],
      success: (res) => {

        const reasons = ['scrap', 'donation', 'lost']
        const reason = reasons[res.tapIndex]
        const reasonText = ['废旧处理', '捐赠', '丢失'][res.tapIndex]

        wx.showModal({
          title: '确认下架',
          content: `确定将《${book.title}》标记为${reasonText}吗？`,
          success: async (confirmRes) => {

            if (!confirmRes.confirm) return

            wx.showLoading({
              title: '处理中...'
            })

            const operator = this.data.operator

            try {
              const result = await wx.cloud.callFunction({
                name: 'api_bookitem_offstock',
                data: {
                  item_id: book.item_id,
                  family_id: book.family_id,
                  operator: operator,
                  reason: reason
                }
              })

              wx.hideLoading()

              if (result.result.success) {
                wx.showToast({
                  title: '已下架'
                })
                //eventBus中注册共有事件，供其他页面响应更新
                eventBus.emit(EVENTS.BOOK_ITEM_UNLISTED, {
                  itemId: book.item_id,
                  familyId: book.family_id
                })
                //本页面需马上更新
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
    console.log('下架:', this.data.books[index].title)
  },

  handleRFID(e){
    console.log('handleRFID start')

    const index = e.currentTarget.dataset.index
    const book = this.data.books[index]
    this.setData({
     currentExpandedId: null
   })

    console.log('绑定RFID:', book.title)

    
    // RFID逻辑
  },

  //彻底删除
  async handleDelete(e){
    console.log('handleDelete start')

    const index = e.currentTarget.dataset.index
    const book = this.data.books[index]
    const operator = this.data.operator
    console.log(`handleDelete: operator=${operator}`)
     this.setData({
      currentExpandedId: null
    })

    console.log('彻底删除:', book.title)
    // 彻底删除前确认
    const {
      confirm
    } = await wx.showModal({
      title: '彻底删除确认',
      content: `确定彻底删除《${book.title}》吗？删除后无法恢复，请慎重`
    })
    if (!confirm) return

    // 彻底删除
    wx.showLoading({
      title: '删除中...'
    })

    try {
      const result = await wx.cloud.callFunction({
        name: 'api_bookitem_delete',
        data: {
          item_id: book.item_id,
          family_id: book.family_id,
          operator: operator
        }
      })

      wx.hideLoading()

      if (result.result.success) {
        wx.showToast({
          title: '已删除'
        })

        //eventBus中注册共有事件，供其他页面响应更新
        eventBus.emit(EVENTS.BOOK_ITEM_DELETED, {
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
        title: '删除书籍失败',
        icon: 'none'
      })
      console.error(err)
    }
    console.log('删除书籍完毕:', book.title)
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
    const operator = this.data.operator
    console.log(`handleOn: operator=${operator}`)

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
          item_id: book.item_id,
          family_id: book.family_id,
          operator: operator
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

  /*loadMore() {
    console.log('loadMore start')
    if (!this.data.loadingMore) {
      this.fetchBooks()
    }
  },
  */



  })
