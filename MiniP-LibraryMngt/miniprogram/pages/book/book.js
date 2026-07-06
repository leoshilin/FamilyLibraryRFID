const eventBus = require('../../utils/eventBus')
const EVENTS = require('../../utils/events')
const bookshelfServices = require('../../services/bookshelfServices')

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
    operator: '', //首页传入
    metaExists: false,      // book_meta 是否存在
    canEditMeta: false // 当前是否有权限修改 meta（你现在默认 true）    
  },

  onLoad(options) {
    // options 就是 URL ? 后面的参数
    // mode驱动1，mode = scan, isbn, familyId, : 上架前数据确认 部分数据用户可修改； 
    // mode驱动2，mode=view: 书籍信息只读展示
    // 首先确认book_meta中是否存在主数据，没有再用云函数获取数据信息    
    const mode = options.mode || 'view'
    const isbn = options.isbn || null
    const familyId = options.familyId || null
    const operator = options.operator || null
    this.setData({
      mode,
      isbn,
      familyId,
      operator
    })

    if (mode === 'scan') {
      // 上架前确认，不存在实体书籍，但根据isbn可能存在主数据
      this.loadFromISBN(isbn)
      // 加载当前家庭的书架列表供用户选择
      this.loadBookshelves(familyId)
    } else {
      // 书籍信息展示，使用book_item中id代表实体书籍对象
      const eventChannel = this.getOpenerEventChannel()
      if (!eventChannel) {
        console.warn('没有 eventChannel')
        return
      }
      eventChannel.on('bookData', (book) => {
        if (!book) {
          console.warn('未收到 book 数据')
          return
        }
        this.setData({
          book,
          isbn: book.isbn,
          familyId: book.family_id,
          loading: false,
          metaExists: true,
          submitting: false,
          canEditMeta: false
        })
        console.log(`book on page, title=${book.title}, status=${book.status}`)

        // 查看模式下也加载书架列表，供用户修改书架
        if (book.family_id) {
          this.loadBookshelves(book.family_id, book.bookshelf_id)
        }
      })
    }
  },


  onBack() {
    wx.navigateBack({ delta: 1 })
  },

  // 加载当前家庭的书架列表
  // currentBookshelfId：查看模式下传入书籍当前书架ID，用于定位选择器索引
  async loadBookshelves(familyId, currentBookshelfId) {
    if (!familyId) return

    try {
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

    const { book, operator, familyId } = this.data

    wx.showLoading({ title: '更新中...' })

    try {
      const res = await wx.cloud.callFunction({
        name: 'api_bookitem_updateBookshelf',
        data: {
          itemId: book.item_id,
          familyId: familyId || book.family_id,
          bookshelfId: newBookshelfId,
          operator
        }
      })

      wx.hideLoading()

      if (res.result.success) {
        this.setData({
          bookshelfIndex: index,
          bookshelfId: newBookshelfId,
          'book.bookshelf_id': newBookshelfId,
          'book.bookshelf_name': res.result.bookshelf_name || this.data.bookshelves[index].name
        })
        wx.showToast({ title: '已更新书架', icon: 'success' })

        // 通知其他页面书架已变更
        eventBus.emit(EVENTS.BOOK_META_UPDATED, {
          familyId: familyId || book.family_id
        })
      } else {
        wx.showToast({ title: res.result.message || '更新失败', icon: 'none' })
      }
    } catch (err) {
      wx.hideLoading()
      console.error('onViewBookshelfChange error:', err)
      wx.showToast({ title: '更新失败', icon: 'none' })
    }
  },

  loadFromISBN(isbn){
    console.log('book.loadFromISBN: 收到 ISBN:', isbn)

    wx.showLoading({
      title: '查询书籍信息中...' + isbn
    })

    wx.cloud.callFunction({
      name: 'api_bookmeta_getByIsbn',
      data: { isbn }
    })
    .then(res => {
      if (res.result && res.result.exists) {
        // 来自 book_meta
        console.log('book.loadFromISBN: book existing in meta')

        this.setData({
          book: res.result.book,
          metaExists: true,          
          canEditMeta: false,
          loading: false
        })        
        console.log('book.loadFromISBN: book.cover_url from meta =', res.result.book.cover_url)
        return null
      }

      // meta 不存在，继续查 douban
      // 此处理论上存在douban也无法获取信息的可能，今后可以增加获取的方式（api），应维护为相应的source。
      // api也无法获取到的情况，最终只能后台管理员维护（前台不开放给用户手动登录新书），并注意保持source ='manual'
      console.log('book.loadFromISBN: book not exist in meta, call function api_bookmeta_fetchExternal to get book info')
      return wx.cloud.callFunction({
        name: 'api_bookmeta_fetchExternal',
        data: { isbn }
      })
    })
    .then(res => {
      console.log('book.loadFromISBN: 云函数返回:', res)

      // 1️⃣ 先校验结构
      if (!res) return  // meta 已存在时直接跳过

      const result = res.result
      if (!result || !result.success || !result.book) {
        throw new Error('book.loadFromISBN: 调用云函数api_bookmeta_fetchExternal返回格式异常')
      }

      // 2️⃣ 真正的书籍对象          
      console.log('book.loadFromISBN: book =', result.book)
                     
      // 3️⃣ 更新页面数据
      this.setData({
        book: result.book,
        metaExists: false,
        loading: false,
        error: '',
        // 当前阶段：默认你是系统管理员
        canEditMeta: true
      })
    })
    .catch(err => {
      console.error('book.loadFromISBN: 查询失败:', err)
      this.setData({
        loading: false,
        error: '书籍信息获取失败'
      })
    })
    .finally(() => {
      wx.hideLoading()
    })
  },

  async loadFromId(itemId) {
    this.setData({
      loading: true,
      error: ''
    })

    try {
      const res = await wx.cloud.callFunction({
        name: 'api_bookitem_get',
        data: {
          itemId
        }
      })

      const result = res.result

      if (!result.success) {
        this.setData({
          loading: false,
          error: result.message || '加载失败'
        })
        return
      }

      const book = result.data
      // 避免访问失效：如果有封面，每次扫ISBN过来后重新获取封面图的临时访问地址
      if (book.cover_url) {
        const tempRes = await wx.cloud.getTempFileURL({
          fileList: [book.cover_url]
        })

        book.cover_url = tempRes.fileList[0].tempFileURL
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
          'book.cover_url': fileID
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
          itemId: book.item_id,
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
              itemId: book.item_id,
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
      familyId,
      book
    } = this.data
  
    const res = await wx.cloud.callFunction({
      name: 'api_bookitem_prepareCreate',
      data: {
        isbn,
        familyId,
        book
      }
    })
  
    if (!res.result || !res.result.success) {
      throw new Error(res.result?.message || '准备入库失败')
    }  
    return res.result
  },

  async callCommit() {
    const {
      isbn,
      familyId,
      bookshelfId,
      book,
      editionType,
      operator
    } = this.data
  
    console.log(`callCommit Para: isbn=${isbn},familyId=${familyId},book=${book},editionType=${editionType}`)
    const res = await wx.cloud.callFunction({
      name: 'api_bookitem_create',
      data: {
        isbn,
        familyId,
        operator,
        bookshelfId,
        book,
        editionType
      }
    })
  
    if (!res.result || !res.result.success) {
      throw new Error(res.result?.message || '入库失败')
    }  
    return res.result
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
    const operator = this.data.operator
    console.log(`book.handleOn: book.title=${book.title},operator=${operator}`)

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
        //返回前页
        wx.navigateBack({
          delta: 1
        });

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
                //返回前页
                wx.navigateBack({
                  delta: 1
                });

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
    console.log('下架:', book.title)
  },


})
