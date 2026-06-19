// index.js
const eventBus = require('../../utils/eventBus')
const EVENTS = require('../../utils/events')

Page({
  data: {
    isbn: '',
    bookInfo: null,
    recentBooks: [],
    familyId: 'fm00001',
    operator: 'admin-shilin',

    //页面是否需要更新的控制，靠eventBus触发事件后更新该控制符号，然后在回到页面onShow时做判断并更新
    needRefresh: false
  },
 
  scanISBN() {
    const {  
      familyId,
      operator
    } = this.data
  
    wx.scanCode({
      scanType: ['barCode'],
      success: res => {
        const isbn = res.result
        console.log('扫描到 ISBN:', isbn)
        
        wx.showToast({
          title: '扫码成功',
          icon: 'success',
          duration: 800
        })

         // 扫码成功后跳转二级页面                     
        wx.navigateTo({
          url: `/pages/book/book?mode=scan&isbn=${isbn}&familyId=${familyId}&operator=${operator}`
        })
      },
      fail: err => {
        console.error('扫码失败：', err)
        wx.showToast({
          title: '扫码失败',
          icon: 'none'
        })
      }
    })
  },

  /*getBookByISBN(isbn) {
    wx.cloud.callFunction({
      name: 'api_bookmeta_fetchExternal',
      data: { isbn },
      success: res => {
        wx.showModal({
          title: '图书信息',
          content: JSON.stringify(res.result),
          showCancel: false
        })
      },
      fail: err => {
        wx.showModal({
          title: '查询失败',
          content: JSON.stringify(err),
          showCancel: false
        })
      }
    })
  },*/
  
  // 获取最近上架书籍信息
  onLoad() {
    //页面载入时首次刷新页面，并设置更新控制器 = false
    this.api_recentbook_search()
    this.data.needRefresh=false

    // 设置 eventBus中触发事件的响应函数，此处不做更新，仅仅标志“脏状态”
    this.refreshHandler = (payload) => {      
      console.log(`index pg payload is: familyId = ${payload.familyId}`)
      if (payload.familyId === this.data.familyId) {
      this.data.needRefresh = true
      }
    }

    // 监听到 书本上架，下架，删除 需要刷新页面
    eventBus.on(EVENTS.BOOK_ITEM_LISTED, this.refreshHandler)
    eventBus.on(EVENTS.BOOK_ITEM_UNLISTED, this.refreshHandler)
    eventBus.on(EVENTS.BOOK_ITEM_DELETED, this.refreshHandler)
    // 监听到 书本主数据变更（封面图etc） 需要刷新页面
    eventBus.on(EVENTS.BOOK_META_UPDATED, this.refreshHandler)
  },

  onUnload() {
    eventBus.off(EVENTS.BOOK_ITEM_LISTED, this.refreshHandler)
    eventBus.off(EVENTS.BOOK_ITEM_UNLISTED, this.refreshHandler)
    eventBus.off(EVENTS.BOOK_ITEM_DELETED, this.refreshHandler)
    eventBus.off(EVENTS.BOOK_META_UPDATED, this.refreshHandler)
  },

  onShow() {
    //页面刷新，判断页面刷新控制器的状态（由eventBus触发的事件响应中设置）后调用刷新
    console.log(`index pg onShow, needRefresh is ${this.data.needRefresh}`)
    if (this.data.needRefresh) {
      this.api_recentbook_search()
      this.data.needRefresh = false
    }
  },

  async api_recentbook_search() {
    const {    
      familyId      
    } = this.data  

    try {
      const res = await wx.cloud.callFunction({
        name: 'api_recentbook_search',
        data: { familyId }
      })

      if (res.result.success) {
        this.setData({
          recentBooks: res.result.list
        })
      }
      console.log('Page api_recentbook_search: recentBooks=', this.data.recentBooks)

    } catch (err) {
      console.error('获取最近书籍失败', err)
    }
  },

  // 页面下拉触发
  onPullDownRefresh() {
    console.log("用户下拉刷新首页");
    this.loadHomeData(() => {
      // 数据加载完成后停止下拉刷新
      wx.stopPullDownRefresh();
    });
  },

  // 加载首页数据方法
  loadHomeData(callback) {    
    this.api_recentbook_search()
  },
  
  // 最近上架书目清单中点击书籍跳转到书籍详情页
  onBookTap(e) {
    //const id = e.currentTarget.dataset.id
    const operator = this.data.operator

    console.log (`navigate to url: /pages/book/book?mode=view&operator=${operator}`)
    const book = e.currentTarget.dataset.book
    console.log('before jump, book=',book)
    wx.navigateTo({
      url: `/pages/book/book?mode=view&operator=${operator}`,
      success: (res) => {
        res.eventChannel.emit('bookData', book)
        console.log('emit done')
      }              
    })
  },

  // 最近上架-查看全部 点击后跳转到书籍查询页
  onViewAllTap() {
    const familyId = this.data.familyId
    const operator = this.data.operator
    
    wx.navigateTo({
      url: `/pages/book-search/book-search?familyId=${familyId}&operator=${operator}`
    })
  }
});
