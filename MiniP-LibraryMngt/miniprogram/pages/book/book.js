const eventBus = require('../../utils/eventBus')
const EVENTS = require('../../utils/events')
const bookshelfServices = require('../../services/bookshelfServices')
const familyServices = require('../../services/familyServices')
const bookMetaServices = require('../../services/bookMetaServices')
const bookItemServices = require('../../services/bookItemServices')
const taskServices = require('../../services/taskServices')

Page({
    
  data: {
    familyId: '', // 当前家庭（首页参数传入）
    bookshelfId: '', // 当前书架（从书架选择中获取）
    bookshelfIndex: 0, // 书架选择器索引
    bookshelves: [], // 书架列表
    mode: 'view', // scan | view
    isbn: '',
    loading: true,
    submitting: false,
    error: '',
    book: {},
    metaExists: false,      // book_meta 是否存在
    canEditMeta: false, // 当前是否有权限修改 meta（你现在默认 true）

    // —— RFID 绑定交互状态 ——
    canBind: false,      // 是否有 RFID_TASK_CREATE_BIND 权限（绑定 / 重新绑定）
    canUnbind: false,    // 是否有 RFID_UNBIND 权限（解绑）
    canFindBook: false,  // 是否有 RFID_TASK_CREATE_FIND 权限（寻书）
    isBound: false,      // 是否已绑定 RFID（rfid_tid 非空）
    showRfid: false,     // 是否展示 RFID 按钮区（仅 in_stock 展示）
    bindInProgress: false, // 是否存在进行中的绑定任务（pending/running）
    findInProgress: false, // 是否存在进行中的寻书任务（pending/running）
    bindStatusLoading: true, // 读取绑定任务状态期间禁用 RFID 按钮，防止「置灰前抢点」竞态
    busy: false          // 动作乐观锁，防止重复点击
  },

  onLoad(options) {
    // options 就是 URL ? 后面的参数
    // mode驱动1，mode = scan, isbn : 上架前数据确认 部分数据用户可修改； 
    // mode驱动2，mode=view: 书籍信息只读展示
    // 首先确认book_meta中是否存在主数据，没有再用云函数获取数据信息    
    // 注意：familyId 不再由 URL 传入，改由服务端按 currentFamilyId 解析；
    //       前端仅本地记录（展示/书架选择/事件通知），不再下传给云函数
    const mode = options.mode || 'view'
    const isbn = options.isbn || null
    this.setData({
      mode,
      isbn
    })

    if (mode === 'scan') {
      // 上架前确认，不存在实体书籍，但根据isbn可能存在主数据
      this.loadFromISBN(isbn)
      // 加载当前家庭的书架列表供用户选择（familyId 由 loadBookshelves 内部解析）
      this.loadBookshelves()
    } else {
      // 书籍信息展示，使用book_item中id代表实体书籍对象
      const eventChannel = this.getOpenerEventChannel()
      if (!eventChannel) {
        console.warn('没有 eventChannel')
        return
      }
      eventChannel.on('bookData', async (book) => {
        if (!book) {
          console.warn('未收到 book 数据')
          return
        }
        // 归一化状态字段：搜索结果返回 inventoryStatus / inStockStatus，
        // 而详情页 WXML 使用 book.status 控制底部操作区，此处补齐以免按钮消失
        if (!book.status) {
          book.status = book.inventoryStatus || book.inStockStatus || ''
        }
        this.setData({
          book,
          isbn: book.isbn,
          familyId: book.familyId,
          loading: false,
          metaExists: true,
          submitting: false,
          canEditMeta: false
        })
        console.log(`book on page, title=${book.title}, status=${book.status}`)

        // 确保权限已加载（应用启动即触发，此处兜底 await，避免 race 导致 RFID 按钮被隐藏）
        await this.ensurePermissions()

        // 依据 book 推导 RFID 展示态（isBound / showRfid）
        this.refreshRfidState()

        // 查询当前绑定任务状态，渲染「绑定中 / 重新绑定中」
        this.loadBindStatus()

        // 查看模式下也加载书架列表，供用户修改书架
        if (book.familyId) {
          this.loadBookshelves(book.bookshelfId)
        }
      })
    }
  },


  onBack() {
    wx.navigateBack({ delta: 1 })
  },

  // 加载当前家庭的书架列表
  // currentBookshelfId：查看模式下传入书籍当前书架ID，用于定位选择器索引
  // 说明：familyId 不再由前端下传，统一由服务端按 currentFamilyId 解析；
  //       此处仅本地获取当前家庭用于触发加载与本地守卫，并把其记入 data.familyId 供事件通知使用
  async loadBookshelves(currentBookshelfId) {
    try {
      const current = await familyServices.getCurrent()
      const familyId = (current && current.family && current.family._id) || ''
      if (!familyId) return

      // 记录当前家庭，供事件总线通知（如 BOOK_ITEM_LISTED）使用
      this.setData({ familyId })

      const result = await bookshelfServices.list(familyId)

      if (result.success && result.list.length > 0) {
        // 定位当前书架在列表中的索引
        let index = 0
        if (currentBookshelfId) {
          const found = result.list.findIndex(s => s._id === currentBookshelfId)
          if (found >= 0) index = found
        }

        this.setData({
          bookshelves: result.list,
          bookshelfId: result.list[index]._id,
          bookshelfIndex: index
        })
      }
    } catch (err) {
      console.error('loadBookshelves error:', err)
    }
  },

  // 书架选择变更（scan模式）
  onBookshelfChange(e) {
    const index = e.detail.value
    this.setData({
      bookshelfIndex: index,
      bookshelfId: this.data.bookshelves[index]._id
    })
  },

  // 书架选择变更（view模式），修改后调用云函数更新
  async onViewBookshelfChange(e) {
    const index = e.detail.value
    const newBookshelfId = this.data.bookshelves[index]._id
    const oldBookshelfId = this.data.bookshelfId

    // 书架未变更则不处理
    if (newBookshelfId === oldBookshelfId) return

    const { book, familyId } = this.data

    wx.showLoading({ title: '更新中...' })

    try {
      const res = await bookItemServices.updateBookshelf(book.itemId, newBookshelfId)

      wx.hideLoading()

      if (res.success) {
        this.setData({
          bookshelfIndex: index,
          bookshelfId: newBookshelfId,
          'book.bookshelfId': newBookshelfId,
          'book.bookshelfName': res.bookshelfName || this.data.bookshelves[index].name
        })
        wx.showToast({ title: '已更新书架', icon: 'success' })

        // 通知其他页面书架已变更
        eventBus.emit(EVENTS.BOOK_META_UPDATED, {
          familyId: familyId || book.familyId
        })
      } else {
        wx.showToast({ title: res.message || '更新失败', icon: 'none' })
      }
    } catch (err) {
      wx.hideLoading()
      console.error('onViewBookshelfChange error:', err)
      wx.showToast({ title: '更新失败', icon: 'none' })
    }
  },

  async loadFromISBN(isbn){
    console.log('book.loadFromISBN: 收到 ISBN:', isbn)

    wx.showLoading({
      title: '查询书籍信息中...' + isbn
    })

    try {
      // 1️⃣ 先查本系统主数据（book_meta）
      const result = await bookMetaServices.getByIsbn(isbn)
      // 统一以 success 判断云函数调用是否成功
      if (!result || !result.success) {
        throw new Error('book.loadFromISBN: 调用云函数api_bookmeta_getByIsbn返回异常')
      }

      if (result.exists) {
        // 来自 book_meta
        console.log('book.loadFromISBN: book existing in meta')

        this.setData({
          book: result.book,
          metaExists: true,
          canEditMeta: false,
          loading: false
        })
        console.log('book.loadFromISBN: book.coverUrl from meta =', result.book.coverUrl)
        return
      }

      // 2️⃣ meta 不存在（exists=false 属正常分支），继续查外部数据源
      // 此处理论上存在外部源也无法获取信息的可能，今后可以增加获取的方式（api），应维护为相应的 source。
      // api 也无法获取到的情况，最终只能后台管理员维护（前台不开放给用户手动登录新书），并注意保持 source ='manual'
      console.log('book.loadFromISBN: book not exist in meta, call function api_bookmeta_fetchExternal to get book info')
      const extResult = await bookMetaServices.fetchExternal(isbn)
      if (!extResult || !extResult.success || !extResult.book) {
        throw new Error('book.loadFromISBN: 调用云函数api_bookmeta_fetchExternal返回格式异常')
      }

      console.log('book.loadFromISBN: book =', extResult.book)

      // 3️⃣ 真正的书籍对象
      this.setData({
        book: extResult.book,
        metaExists: false,
        loading: false,
        error: '',
        // 当前阶段：默认你是系统管理员
        canEditMeta: true
      })
    } catch (err) {
      console.error('book.loadFromISBN: 查询失败:', err)
      this.setData({
        loading: false,
        error: '书籍信息获取失败'
      })
    } finally {
      wx.hideLoading()
    }
  },

  async loadFromId(itemId) {
    this.setData({
      loading: true,
      error: ''
    })

    try {
      const result = await bookItemServices.get(itemId)

      if (!result.success) {
        this.setData({
          loading: false,
          error: result.message || '加载失败'
        })
        return
      }

      const { bookItem, bookMeta, bookshelf } = result

      // 拍平为页面所需的单层 book 结构（保持原有字段名，兼容页面其它逻辑）
      const book = {
        // —— 来自 bookMeta ——
        title: bookMeta?.title || '',
        authors: bookMeta?.authors || '',
        coverUrl: bookMeta?.coverUrl || '',
        publisher: bookMeta?.publisher || '',
        publishYear: bookMeta?.publishYear || '',
        price: bookMeta?.price || '',
        binding: bookMeta?.binding || '',
        isbn: bookMeta?.isbn || '',
        isSet: bookMeta?.isSet ?? false,
        setTotalCount: bookMeta?.setTotalCount || 0,
        // —— 来自 bookItem ——
        setIndex: bookItem?.setIndex,
        rfidTid: bookItem?.rfidTid,
        inStockDate: bookItem?.onShelfAt,
        status: bookItem?.inventoryStatus,
        // —— 来自 bookshelf（详情页展示用）——
        bookshelfId: bookItem?.bookshelfId || bookshelf?._id || '',
        bookshelfName: bookshelf?.name || ''
      }

      // 避免访问失效：如果有封面，每次扫ISBN过来后重新获取封面图的临时访问地址
      if (book.coverUrl) {
        const tempRes = await wx.cloud.getTempFileURL({
          fileList: [book.coverUrl]
        })

        book.coverUrl = tempRes.fileList[0].tempFileURL
      }

      this.setData({
        book: book,
        metaExists: true, // 详情模式默认meta已存在
        loading: false
      })
    } catch (err) {
      console.error('book.loadFromId error:', err)

      this.setData({
        loading: false,
        error: '网络异常，请稍后重试'
      })
    }
  },

  async onTakeCoverPhoto() {
    //已存在主数据不允许前端更新封面图
    if (this.data.metaExists) return

    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['camera'],
      success: async (res) => {
        const originalPath = res.tempFiles[0].tempFilePath
        try {
          const compressedPath = await this.compressAndResize(originalPath)
  
          //上传到云存储
          this.uploadCover(compressedPath)
        } catch (err) {          
          console.warn('图片压缩失败，使用原图上传', err)
          // 压缩失败兜底：直接上传原图
          this.uploadCover(originalPath)          
        }
      }      
    })
  },

  compressAndResize(filePath) {
    return new Promise((resolve, reject) => {  
      wx.getImageInfo({
        src: filePath,
        success: info => {  
          const maxWidth = 300
          const ratio = info.width / info.height
  
          let targetWidth = info.width
          let targetHeight = info.height
  
          if (info.width > maxWidth) {
            targetWidth = maxWidth
            targetHeight = maxWidth / ratio
          }

          const query = wx.createSelectorQuery()  
          query.select('#coverCanvas')
            .fields({ node: true, size: true })
            .exec(res => {

              const canvas = res[0].node
              const ctx = canvas.getContext('2d')

              // 设置真实像素尺寸
              canvas.width = targetWidth
              canvas.height = targetHeight

              const img = canvas.createImage()
              img.src = filePath

              img.onload = () => {

                ctx.clearRect(0, 0, targetWidth, targetHeight)
                ctx.drawImage(img, 0, 0, targetWidth, targetHeight)

                wx.canvasToTempFilePath({
                  canvas: canvas,
                  fileType: 'jpg',
                  quality: 0.5,
                  success: res => resolve(res.tempFilePath),
                  fail: reject
                })
              }
              img.onerror = reject
            })
        },
        fail: reject
      })  
    })
  },  

  uploadCover(filePath) {
    const cloudPath = `book_covers/${this.data.isbn}_${Date.now()}.jpg`
  
    wx.cloud.uploadFile({
      cloudPath,
      filePath,
      success: res => {
        const fileID = res.fileID
  
         // 这里只更新前端状态
        this.setData({
          'book.coverUrl': fileID
        })

        wx.showToast({
          title: '封面已上传',
          icon: 'success'
        })
      },

      fail: err => {
        console.error('上传失败', err)
        wx.showToast({
          title: '上传失败',
          icon: 'none'
        })
      }              
    })
  },
  
  async onConfirmInStock() {
    //本页面上架按钮的action，
    //首先确认book_meta是否存在，不存在则创建主数据
    //其次确认book_item是否存在（需要考虑套装书中setIndex),不存在或用户决定作为新书上架则完成book_item中实体书创建
    const { book, metaExists,familyId } = this.data
    try {
      wx.showLoading({ title: '检查中...' })
      
      // 套装情况下需要做输入检查
      if (book.isSet) {
        // book_meta不存在，需要对套装总本数做检查
        if (!metaExists){
          if (!book.setTotalCount || book.setTotalCount < 2 ) {
            wx.showToast({
              title: '套装总册数不正确 (2本以上)',
              icon: 'none'
            })
            return
          }
        }
        // 无论book_meta中是否存在，是套装的情况下需要检查套装第几本的输入合法性
        if (!book.setIndex || book.setIndex == 0 || book.setIndex > book.setTotalCount) {
          wx.showToast({
            title: '当前册数不正确 (1~总册数)',
            icon: 'none'
          })
          return
        }
      }

      const prepareRes = await this.callPrepare()
  
      const {
        needUserConfirm,
        existingItemCount,
        duplicateType
      } = prepareRes
      console.log(`book-confirm.onConfirmInStock: needUserConfirm=${needUserConfirm}, existingItemCount=${existingItemCount}, duplicateType=${duplicateType}`)

      wx.hideLoading()

      if (!needUserConfirm) {
        await this.callCommit()
        wx.showToast({ title: '入库成功', icon: 'success' })
        console.log('book-confirm.onConfirmInStock: 入库成功！')

        //eventBus中注册共有事件，供其他页面响应更新
        eventBus.emit(EVENTS.BOOK_ITEM_LISTED, {
          itemId: book.itemId,
          familyId: familyId
        })        
        //返回前页
        wx.navigateBack({ delta: 1 }); 
        return
      }

      let message = ''

      if (duplicateType === 'normal') {
        message = `当前已有 ${existingItemCount} 本相同书籍，是否作为不同的新书仍然上架？`
      } else if (duplicateType === 'set_conflict') {
        message = `该套装的第 ${this.data.setIndex} 本已存在，是否作为不同的新书仍然上架？`
      }

      wx.showModal({
        title: '存在重复书籍',
        content: message,
        success: async (res) => {
          if (res.confirm) {
            wx.showLoading({ title: '入库中...' })
            await this.callCommit()
            wx.hideLoading()
            wx.showToast({
              title: '入库成功',
              icon: 'success'
            })

            //eventBus中注册共有事件，供其他页面响应更新
            eventBus.emit(EVENTS.BOOK_ITEM_LISTED, {
              itemId: book.itemId,
              familyId: familyId
            })
            //返回前页
            wx.navigateBack({
              delta: 1
            });
            
          }
        }
      })
    } catch (err) {
      wx.hideLoading()
      wx.showModal({
        title: '错误',
        content: err.message,
        showCancel: false
      })
    }
  },

  async callPrepare() {
    const {
      isbn,
      book
    } = this.data

    const result = await bookItemServices.prepareCreate(isbn, book)

    if (!result || !result.success) {
      throw new Error(result?.message || '准备入库失败')
    }
    return result
  },

  async callCommit() {
    const {
      isbn,
      bookshelfId,
      book,
      editionType
    } = this.data

    console.log(`callCommit Para: isbn=${isbn},book=${book},editionType=${editionType}`)
    const result = await bookItemServices.create(isbn, bookshelfId, book, editionType)

    if (!result || !result.success) {
      throw new Error(result?.message || '入库失败')
    }
    return result
  },  

  // 用户在页面上操作是否套装书，当非套装书时需要清空相关变量
  onIsSetChange(e) {
    const checked = e.detail.value
    if (!checked) {
      this.setData({
        'book.isSet': false,
        'book.setTotalCount': null,
        'book.setIndex': null
      })
    } else {
      this.setData({
        'book.isSet': true
      })
    }  },

  // 套装书情况下前端输入套装书共几本
  onSetTotalCountInput(e) {
    console.log('onSetTotalCountInput start')

    const value = e.detail.value

    // 允许用户暂时输入空字符串（正在编辑）
    if (value === '') {
      this.setData({
        'book.setTotalCount': ''
      })
      return
    }
  
    const numberValue = Number(value)
  
    // 防止 NaN
    if (isNaN(numberValue) || numberValue < 0) {
      return
    }
  
    this.setData({
      'book.setTotalCount': numberValue
    })
  },

  // 套装书情况下前端输入套装书第几本
  onSetIndexInput(e) {
    console.log('onSetIndexInput start')

    const value = e.detail.value

    if (value === '') {
      this.setData({
        'book.setIndex': ''
      })
      return
    }

    const numberValue = Number(value)

    if (isNaN(numberValue) || numberValue < 0) {
      return
    }

    this.setData({
      'book.setIndex': numberValue
    })
    console.log('onSetIndexInput： book.setIndex 设定完成 =',numberValue)
  },

  // 书籍上架成功后，返回到首页并刷新首页
  /*gobackHome() {
    console.log('book-confirm.gobackHome: start')

     // 获取页面栈
     const pages = getCurrentPages();
     // pages 数组，最后一个是当前页面
     // 假设首页是 pages[0]
     const homePage = pages.find(p => p.route === "pages/index/index");

     if (homePage) {
       // 调用首页自定义刷新方法
       if (homePage.loadHomeData) {
         homePage.loadHomeData();
       }
     }

     // 4️⃣ 返回首页
     wx.navigateBack({ delta: 1 }); // 返回上一页
  },
*/

   //重新上架
   async handleOn() {
    console.log('book.handleOn start')

    const book = this.data.book

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
        //返回前页
        wx.navigateBack({
          delta: 1
        });

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

  handleOff() {
    console.log('book.handleOff: start')
    
    const book = this.data.book

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

            try {
              const result = await bookItemServices.offstock(book.itemId, reason)

              wx.hideLoading()

              if (result.success) {
                wx.showToast({
                  title: '已下架'
                })
                //eventBus中注册共有事件，供其他页面响应更新
                eventBus.emit(EVENTS.BOOK_ITEM_UNLISTED, {
                  itemId: book.itemId,
                  familyId: book.familyId
                })
                //返回前页
                wx.navigateBack({
                  delta: 1
                });

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
    console.log('下架:', book.title)
  },

  // 彻底删除（查看模式）
  async onDelete() {
    console.log('book.onDelete start')

    const book = this.data.book

    if (!book || !book.itemId) {
      wx.showToast({ title: '书籍数据异常', icon: 'none' })
      return
    }

    const { confirm } = await wx.showModal({
      title: '彻底删除确认',
      content: `确定彻底删除《${book.title}》吗？删除后无法恢复，请慎重`
    })

    if (!confirm) return

    wx.showLoading({ title: '删除中...' })

    try {
      // familyId 由服务端按 currentFamilyId 解析，前端不再下传
      const result = await bookItemServices.remove(book.itemId)

      wx.hideLoading()

      if (result.success) {
        wx.showToast({ title: '已删除' })

        //eventBus中注册共有事件，供其他页面响应更新
        eventBus.emit(EVENTS.BOOK_ITEM_DELETED, {
          itemId: book.itemId,
          familyId: book.familyId
        })
        //返回前页
        wx.navigateBack({ delta: 1 })
      } else {
        throw new Error(result.message || '操作失败')
      }
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: '删除书籍失败', icon: 'none' })
      console.error(err)
    }
  },

  // ========================
  // RFID 绑定 / 解绑
  // ========================

  // 依据 isBound + bindInProgress 推导 RFID 区域是否展示（仅 in_stock 图书展示 RFID 按钮）
  refreshRfidState() {
    const book = this.data.book
    const showRfid = !!(book && book.itemId) && book.status === 'in_stock'
    this.setData({
      showRfid,
      isBound: !!(book && book.rfidTid)
    })
  },

  // 查询本书的绑定任务及寻书任务状态（详情页单查）
  async loadBindStatus() {
    const itemId = this.data.book && this.data.book.itemId
    if (!itemId) return
    // 加载期间禁用按钮，待状态确认后再放开 / 保持置灰，杜绝置灰前的抢点窗口
    this.setData({ bindStatusLoading: true })
    try {
      const res = await taskServices.getBindStatus({ bookItemId: itemId })
      if (res && res.success && res.map) {
        const st = res.map[itemId] || { inProgress: false, status: null, findInProgress: false, findStatus: null }
        this.setData({
          bindInProgress: st.inProgress,
          findInProgress: st.findInProgress,
          bindStatusLoading: false
        })
      } else {
        this.setData({ bindStatusLoading: false })
      }
    } catch (err) {
      console.error('book.loadBindStatus error:', err)
      this.setData({ bindStatusLoading: false })
    }
  },

  // 从服务端重载 book_item（刷新 rfid_tid / 在架状态），用于 onShow 自愈
  async refreshBookFromServer() {
    const itemId = this.data.book && this.data.book.itemId
    if (!itemId) return
    try {
      const result = await bookItemServices.get(itemId)
      if (!result || !result.success) return
      const { bookItem, bookshelf } = result
      this.setData({
        'book.rfidTid': bookItem && bookItem.rfidTid ? bookItem.rfidTid : '',
        'book.status': bookItem && bookItem.inventoryStatus,
        'book.bookshelfId': (bookItem && bookItem.bookshelfId) || (bookshelf && bookshelf._id) || '',
        'book.bookshelfName': (bookshelf && bookshelf.name) || ''
      })
      this.refreshRfidState()
      this.loadBindStatus()
    } catch (err) {
      console.error('book.refreshBookFromServer error:', err)
    }
  },

  // 页面重新展示（从列表返回）时：重载 book + 重查任务状态，实现 PDA 完成后的状态自愈
  onShow() {
    // 重新展示时刷新权限门控（例如从「我的」页登录/切换家庭后返回），实现 RFID 按钮自愈
    this.ensurePermissions()
    if (this.data.book && this.data.book.itemId) {
      this.refreshBookFromServer()
    }
  },

  // 等待全局权限加载完成，并刷新本页 RFID 按钮门控（canBind / canUnbind / canFindBook）
  // 同时打印到 console 便于确认权限是否到位
  async ensurePermissions() {
    const app = getApp()
    if (app && app.ensureLogin) {
      await app.ensureLogin()
    }
    const perms = (app && app.globalData.permissions) || {}
    this.setData({
      canBind: !!perms.canCreateBindRfidTask,
      canUnbind: !!perms.canUnbindRfid,
      canFindBook: !!perms.canCreateFindBookTask
    })
    console.log('[book] RFID 权限门控: canBind=', this.data.canBind, 'canUnbind=', this.data.canUnbind, 'canFindBook=', this.data.canFindBook, 'permissions=', perms)
  },

  // 绑定 / 重新绑定 RFID
  // 绑定：直接创建 bind_rfid 任务；重新绑定：先确认再创建
  async onBindRFID() {
    console.log('book.onBindRFID: start')

    // 进行中（B/D 态）禁止重复发起
    if (this.data.busy || this.data.bindInProgress) {
      console.log('book.onBindRFID: 存在进行中任务，忽略重复点击')
      return
    }

    const book = this.data.book
    if (!book || !book.itemId) {
      wx.showToast({ title: '书籍数据异常', icon: 'none' })
      return
    }

    // 重新绑定需用户确认
    if (this.data.isBound) {
      const { confirm } = await wx.showModal({
        title: '确认重新绑定',
        content: '该书已绑定 RFID，确认重新绑定吗？原标签将在 PDA 绑定新标签后被覆盖。'
      })
      if (!confirm) return
    }

    this.setData({ busy: true })
    wx.showLoading({ title: '发起中...' })

    try {
      const result = await taskServices.createBindRfid(book.itemId)
      wx.hideLoading()

      if (result && result.success) {
        // 乐观置「进行中」：立即切到 B/D 态，防止重复点击，并通知列表页
        this.setData({ bindInProgress: true, busy: false })
        eventBus.emit(EVENTS.RFID_TASK_CHANGED, {
          itemId: book.itemId,
          inProgress: true
        })
        wx.showToast({ title: '已发起绑定任务，等待 PDA 执行', icon: 'none' })
      } else {
        this.setData({ busy: false })
        wx.showToast({ title: (result && result.message) || '发起失败', icon: 'none' })
        // 服务端可能因「已有进行中任务」而拒绝（防重复），刷新状态让按钮置灰
        this.loadBindStatus()
      }
    } catch (err) {
      wx.hideLoading()
      this.setData({ busy: false })
      console.error('book.onBindRFID error:', err)
      wx.showToast({ title: '发起失败', icon: 'none' })
    }
  },

  // 解绑 RFID：先扫码 ISBN 与本书比对，通过后再调 H1 主动解绑（避免误触）
  async onUnbindRFID() {
    console.log('book.onUnbindRFID: start')

    // 进行中（D 态）禁止解绑
    if (this.data.busy || this.data.bindInProgress) {
      console.log('book.onUnbindRFID: 存在进行中任务，忽略')
      return
    }

    const book = this.data.book
    if (!book || !book.itemId) {
      wx.showToast({ title: '书籍数据异常', icon: 'none' })
      return
    }

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
      console.log('book.onUnbindRFID: 用户取消扫码')
      return
    }

    // ISBN 比对：归一化后比较，防止连字符 / 空格差异导致误判
    if (!this.compareIsbn(scanned, book.isbn)) {
      wx.showToast({ title: '扫描的 ISBN 与本书不一致，无法解绑', icon: 'none' })
      return
    }

    this.setData({ busy: true })
    wx.showLoading({ title: '解绑中...' })

    try {
      const result = await taskServices.unbindRfid(book.itemId)
      wx.hideLoading()

      if (result && result.success) {
        // 解绑即时生效：清空本地 rfid_tid，切回 A 态
        this.setData({
          'book.rfidTid': '',
          isBound: false,
          bindInProgress: false,
          busy: false
        })
        eventBus.emit(EVENTS.RFID_TASK_CHANGED, {
          itemId: book.itemId,
          inProgress: false,
          rfidTid: ''
        })
        wx.showToast({ title: '已解绑', icon: 'success' })
      } else {
        this.setData({ busy: false })
        wx.showToast({ title: (result && result.message) || '解绑失败', icon: 'none' })
      }
    } catch (err) {
      wx.hideLoading()
      this.setData({ busy: false })
      console.error('book.onUnbindRFID error:', err)
      wx.showToast({ title: '解绑失败', icon: 'none' })
    }
  },

  // 归一化比较 ISBN：去除非数字字母字符（连字符 / 空格）并忽略大小写
  compareIsbn(a, b) {
    const norm = (s) => (s || '').replace(/[^0-9Xx]/g, '').toUpperCase()
    return norm(a) === norm(b)
  },

  // ========================
  // 寻书（物理定位）
  // ========================

  // 发起寻书任务（仅已绑定 RFID 的 in_stock 图书可用）
  async onFindBook() {
    console.log('book.onFindBook: start')

    // 进行中（findInProgress）禁止重复发起
    if (this.data.busy || this.data.findInProgress) {
      console.log('book.onFindBook: 存在进行中寻书任务，忽略重复点击')
      return
    }

    const book = this.data.book
    if (!book || !book.itemId) {
      wx.showToast({ title: '书籍数据异常', icon: 'none' })
      return
    }

    // 二次校验：未绑定 RFID 不可寻书（按钮已条件渲染，但防止竞态）
    if (!book.rfidTid) {
      wx.showToast({ title: '该书未绑定RFID，无法寻书', icon: 'none' })
      return
    }

    this.setData({ busy: true })
    wx.showLoading({ title: '发起中...' })

    try {
      const result = await taskServices.createFindBook(book.itemId)
      wx.hideLoading()
      this.setData({ busy: false })

      if (result && result.success) {
        // 乐观置「进行中」，防止重复点击
        this.setData({ findInProgress: true })
        wx.showToast({ title: '已发起寻书任务，请使用PDA寻书', icon: 'none' })
      } else {
        // 服务端可能因「已有进行中任务」而拒绝（防重复），刷新状态让按钮置灰
        if (result && result.code === 'TASK_IN_PROGRESS') {
          this.setData({ findInProgress: true })
          wx.showToast({ title: '已有进行中的寻书任务', icon: 'none' })
        } else {
          wx.showToast({ title: (result && result.message) || '发起失败', icon: 'none' })
        }
      }
    } catch (err) {
      wx.hideLoading()
      this.setData({ busy: false })
      console.error('book.onFindBook error:', err)
      wx.showToast({ title: '发起失败', icon: 'none' })
    }
  }


})
