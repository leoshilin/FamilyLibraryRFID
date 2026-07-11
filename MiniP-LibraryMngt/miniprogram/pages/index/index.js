// index.js
const eventBus = require('../../utils/eventBus')
const EVENTS = require('../../utils/events')
const familyServices = require('../../services/familyServices')

Page({
  data: {
    isbn: '',
    bookInfo: null,
    recentBooks: [],
    familyId: '', // 当前家庭ID（由 api_family_getCurrent 动态获取）

    //页面是否需要更新的控制，靠eventBus触发事件后更新该控制符号，然后在回到页面onShow时做判断并更新
    needRefresh: false
  },
 
  scanISBN() {
    const {  
      familyId
    } = this.data

    if (!familyId) {
      wx.showToast({ title: '请先选择家庭', icon: 'none' })
      return
    }
  
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
          url: `/pages/book/book?mode=scan&isbn=${isbn}`
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
 
  
  // 页面载入时设置 eventBus 监听，数据加载在 onShow 中触发
  onLoad() {
    this.data.needRefresh = false

    // 设置 eventBus中触发事件的响应函数，此处不做更新，仅仅标志"脏状态"
    this.refreshHandler = (payload) => {      
      console.log(`index pg payload is: familyId = ${payload.familyId}`)
      // 家庭ID未加载或匹配时都需要刷新
      if (!this.data.familyId || payload.familyId === this.data.familyId) {
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
    //每次显示页面时重新加载当前家庭（处理家庭切换场景），并按需刷新最近书籍
    console.log(`index pg onShow, needRefresh is ${this.data.needRefresh}`)
    this.loadCurrentFamily(this.data.needRefresh)
    this.data.needRefresh = false
  },

  // 加载当前家庭信息，forceRefresh 为 true 时强制刷新最近书籍
  async loadCurrentFamily(forceRefresh = false) {
    try {
      const result = await familyServices.getCurrent()

      if (result.success && result.family) {
        const familyChanged = this.data.familyId !== result.family._id
        this.setData({ familyId: result.family._id })

        // 家庭变更或需要刷新时重新加载最近书籍
        if (familyChanged || forceRefresh) {
          this.api_book_searchRecent()
        }
      } else {
        // 无当前家庭，清空数据
        this.setData({
          familyId: '',
          recentBooks: []
        })
      }
    } catch (err) {
      console.error('loadCurrentFamily error:', err)
    }
  },

  async api_book_searchRecent() {
    const {    
      familyId      
    } = this.data  

    if (!familyId) return

    try {
      const res = await wx.cloud.callFunction({
        name: 'api_book_searchRecent',
        data: {}
      })

      if (res.result.success) {
        const list = res.result.list || []
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
              if (urlMap[item.coverUrl]) {
                item.coverUrl = urlMap[item.coverUrl]
              }
            })
          
          }
          this.setData({
          recentBooks: list
        })
      }
      console.log('Page api_book_searchRecent: recentBooks=', this.data.recentBooks)

    } catch (err) {
      console.error('获取最近书籍失败', err)
    }
  },

  // 页面下拉触发
  onPullDownRefresh() {
    console.log("用户下拉刷新首页");
    this.loadCurrentFamily(true)
    wx.stopPullDownRefresh();
  },

  // 加载首页数据方法
  loadHomeData(callback) {    
    this.loadCurrentFamily(true)
  },
  
  // 最近上架书目清单中点击书籍跳转到书籍详情页
  onBookTap(e) {
    //const id = e.currentTarget.dataset.id
    const book = e.currentTarget.dataset.book
    console.log('before jump, book=',book)
    wx.navigateTo({
      url: `/pages/book/book?mode=view`,
      success: (res) => {
        res.eventChannel.emit('bookData', book)
        console.log('emit done')
      }              
    })
  },

  // 跳转到设置页面
  goSetting() {
    wx.navigateTo({
      url: '/pages/settings/settings'
    })
  },

  // 最近上架-查看全部 点击后跳转到书籍查询页
  onViewAllTap() {
    const familyId = this.data.familyId

    if (!familyId) {
      wx.showToast({ title: '请先选择家庭', icon: 'none' })
      return
    }
    
    wx.navigateTo({
      url: '/pages/book-search/book-search'
    })
  }
});
