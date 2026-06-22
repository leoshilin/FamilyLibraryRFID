Page({

  data: {

    user: {
      nickName: '方大大',
      role: 'OWNER'
    },

    family: {
      familyId: 'fm00001',
      name: '方家图书馆'
    },

    stats: {
      bookshelfCount: 3,
      bookCount: 568
    },

    bookshelves: [
      {
        _id: 'bs001',
        name: '客厅书架',
        bookCount: 126
      },
      {
        _id: 'bs002',
        name: '儿童书架',
        bookCount: 218
      },
      {
        _id: 'bs003',
        name: '书房书架',
        bookCount: 224
      }
    ]

  },

  onLoad() {
    this.loadMineData()
  },

  async loadMineData() {

    // TODO:
    // api_user_get
    // api_family_get
    // api_bookshelf_list

  },

  onSwitchFamily() {

    wx.showToast({
      title: '待开发',
      icon: 'none'
    })

  },

  onRenameFamily() {

    wx.showToast({
      title: '待开发',
      icon: 'none'
    })

  },

  onBookshelfTap(e) {

    const bookshelfId = e.currentTarget.dataset.id

    console.log('bookshelfId=', bookshelfId)

    // TODO
  },

  onAddBookshelf() {

    wx.showToast({
      title: '待开发',
      icon: 'none'
    })

  },

  onAbout() {

    wx.showToast({
      title: '待开发',
      icon: 'none'
    })

  }

})