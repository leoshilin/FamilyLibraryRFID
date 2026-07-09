# book_search 页面重构建议

> 文档目的：整理 `pages/book_search/book_search.js` 的重构建议，作为后续代码优化参考。
>
> 原则：**当前功能稳定优先，重构以提高可维护性、可扩展性、降低重复代码为目标，不影响现有业务逻辑。**

---

# 1. 页面职责过多（最高优先级）

## 当前问题

当前 `book_search.js` 同时负责：

- UI状态管理
- 搜索条件管理
- API调用
- 图片URL转换
- 分页管理
- ISBN扫码
- 图书上下架
- 图书删除
- 图书重新上架
- 页面跳转
- EventBus通知

一个 Page 已承担了过多业务职责。

随着后续增加：

- RFID绑定
- 借阅
- 收藏
- 批量删除
- 排序
- 更多筛选条件

页面代码很容易增长到 700～1000 行。

---

## 建议

将业务逻辑逐步迁移到 Service。

例如：

```
services/bookSearchService.js
```

提供：

```javascript
search(params)
```

负责：

- API调用
- cover_url转换
- 数据整理

Page 仅负责：

```javascript
const result = await bookSearchService.search(...)
this.setData({
    books: result.books
})
```

---

# 2. fetchBooks() 职责过多

## 当前问题

目前 `fetchBooks()` 同时完成：

- reset处理
- 分页判断
- loading控制
- API调用
- 数据解析
- 图片URL转换
- 分页拼接
- 更新UI

属于典型的"巨型函数"。

---

## 建议

拆分为多个职责单一的方法，例如：

```
fetchBooks()
    ↓
buildSearchParams()
    ↓
queryBooks()
    ↓
replaceCoverUrls()
    ↓
updateBookList()
```

提高可读性和复用性。

---

# 3. 上下架、删除等操作存在大量重复代码

## 当前问题

以下几个函数流程几乎一致：

- handleDelete()
- handleOn()
- handleOff()

共同流程：

```
确认
    ↓
showLoading
    ↓
调用云函数
    ↓
hideLoading
    ↓
Toast提示
    ↓
发送EventBus事件
    ↓
刷新列表
```

存在大量重复代码。

---

## 建议

封装统一方法，例如：

```javascript
executeBookAction({
    api,
    data,
    loadingText,
    successText,
    event
})
```

各业务函数仅负责传递参数。

可显著减少重复代码，提高一致性。

---

# 4. STATUS_MAP 建议移到文件顶部

## 当前问题

目前：

```javascript
const STATUS_MAP = [
    'in_stock',
    'all',
    'off_stock'
]
```

定义在 `fetchBooks()` 内部。

每次调用都会重新创建。

---

## 建议

移动到文件顶部：

```javascript
const STATUS_MAP = Object.freeze([
    'in_stock',
    'all',
    'off_stock'
])
```

避免重复创建，同时表达该常量不可修改。

---

# 5. 下架原因建议统一管理

## 当前问题

当前：

```javascript
const reasons = [
    'scrap',
    'donation',
    'lost'
]

const reasonText = [
    '废旧处理',
    '捐赠',
    '丢失'
]
```

两个数组需要保持完全一致。

后续维护容易出现长度不一致或顺序错误。

---

## 建议

统一为对象数组：

```javascript
const OFF_REASONS = [
    {
        value: 'scrap',
        text: '废旧处理'
    },
    {
        value: 'donation',
        text: '捐赠'
    },
    {
        value: 'lost',
        text: '丢失'
    }
]
```

更加安全，也更容易扩展。

---

# 6. 图片URL转换建议抽取到 Service

## 当前问题

目前：

```
搜索
    ↓
获取临时URL
    ↓
替换cover_url
```

全部写在页面内。

未来其它页面：

- 最近新增
- 图书详情
- 推荐图书

都可能需要重复实现。

---

## 建议

封装公共方法，例如：

```
services/fileService.js
```

提供：

```javascript
convertCloudFileUrls(list, "cover_url")
```

或：

```javascript
bookService.fillCoverTempUrl()
```

实现统一维护。

---

# 7. currentExpandedId 可考虑改为 expandedIndex

## 当前问题

目前使用：

```
item_id
```

控制当前展开项。

虽然可行，但当：

- 删除
- 排序
- 刷新

后，可能出现当前ID不存在的问题。

---

## 建议

如果仅用于当前列表展开状态，可考虑：

```
expandedIndex
```

逻辑更加简单。

（说明：当前实现没有错误，仅作为后续优化建议。）

---

# 8. 建议统一日志管理

## 当前问题

当前存在大量：

```javascript
console.log(...)
```

包括：

- start
- before
- after
- cp1
- done

正式版本通常无需输出。

---

## 建议

建立：

```
utils/logger.js
```

统一提供：

```javascript
logger.debug()
logger.info()
logger.error()
```

未来只需修改一处即可关闭全部调试日志。

---

# 9. Magic String 建议集中管理

## 当前问题

页面中大量直接使用：

```
api_bookitem_delete
api_bookitem_offstock
api_bookitem_restock
```

后续修改接口名称时需要全局搜索。

---

## 建议

建立：

```
constants/apis.js
```

例如：

```javascript
const API = {
    DELETE: "api_bookitem_delete",
    OFFSTOCK: "api_bookitem_offstock",
    RESTOCK: "api_bookitem_restock"
}
```

统一管理接口名称。

---

# 10. 页面跳转逻辑建议抽取

## 当前问题

例如：

```
handleDetail()
```

内部负责：

- navigateTo
- eventChannel
- emit

未来其它页面可能也需要跳转详情。

---

## 建议

抽取：

```javascript
gotoBookDetail(book)
```

提高复用性。

---

# 11. 获取当前图书对象建议封装

## 当前问题

多个函数重复：

```javascript
const index = e.currentTarget.dataset.index
const book = this.data.books[index]
```

包括：

- handleDelete
- handleOn
- handleOff
- handleRFID
- handleDetail

---

## 建议

增加公共方法：

```javascript
getBookFromEvent(e) {
    return this.data.books[
        e.currentTarget.dataset.index
    ]
}
```

减少重复代码。

---

# 12. onLoad 初始化方式值得保留

## 当前情况

目前：

```javascript
loadBookshelves()

fetchBooks()
```

未使用 await，因此天然并行执行。

能够减少页面首次加载等待时间。

---

## 建议

保持当前实现即可。

这是一个合理的设计。

---

# 13. data 建议按职责分组

## 当前问题

当前 data 中混合了：

- 查询条件
- 分页信息
- UI状态
- 页面数据

例如：

```
familyId
keyword
isbn
status
books
page
loading
currentExpandedId
```

可读性逐渐下降。

---

## 建议

后续可考虑按职责组织：

```javascript
data: {
    search: {},
    pagination: {},
    ui: {}
}
```

例如：

```
search.keyword
search.status

pagination.page
pagination.pageSize

ui.loading
ui.currentExpandedId
```

便于后期维护。

> **注意：**
>
> 微信小程序 `setData()` 更新嵌套对象时，需要使用路径写法，例如：
>
> ```javascript
> this.setData({
>     'search.keyword': keyword
> })
> ```
>
> 因此需要结合项目实际情况决定是否采用。

---

# 建议实施优先级

| 优先级 | 建议 | 推荐程度 |
|---------|------|----------|
| ⭐⭐⭐⭐⭐ | 页面职责拆分（Service化） | 必做 |
| ⭐⭐⭐⭐⭐ | fetchBooks() 拆分 | 必做 |
| ⭐⭐⭐⭐⭐ | 抽取 executeBookAction() | 必做 |
| ⭐⭐⭐⭐ | 图片URL转换封装 | 推荐 |
| ⭐⭐⭐⭐ | 常量统一管理 | 推荐 |
| ⭐⭐⭐⭐ | Logger统一管理 | 推荐 |
| ⭐⭐⭐ | data结构优化 | 可选 |
| ⭐⭐⭐ | 跳转方法封装 | 可选 |
| ⭐⭐⭐ | 获取Book对象封装 | 可选 |
| ⭐⭐⭐ | expandedIndex优化 | 可选 |

---

# 总结

当前 `book_search.js` 功能完整、结构清晰，已经具备较好的可读性。但随着 RFID、借阅、批量操作等功能的增加，页面职责将进一步膨胀。

建议优先完成以下三项重构：

1. **将查询逻辑（包括图片URL转换）迁移至 Service 层，Page 仅负责界面更新。**
2. **抽象统一的 `executeBookAction()`，统一处理确认、Loading、云函数调用、Toast、EventBus 和刷新逻辑。**
3. **集中管理常量（状态映射、接口名称、下架原因等），减少 Magic String。**

完成上述重构后，预计页面代码量可减少约 **30%～40%**，整体可维护性和可扩展性将显著提升，也更利于后续 AI 工具（如 Codex）理解和持续维护项目代码。