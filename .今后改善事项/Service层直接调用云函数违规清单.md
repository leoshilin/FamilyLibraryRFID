# Service 层违规调用云函数（wx.cloud.callFunction）清单与改善方案

> 生成日期：2025-07-12
> 分析对象：`MiniP-LibraryMngt/miniprogram`
> 分析基线：`main` 分支，已 `git pull` 至最新提交 `8bb695d unify design doc`

---

## 1. 设计原则（引用）

依据 `.codex/AI_PROJECT_GUIDE.md` 第 6 节「当前设计原则 / Service 层」：

> 页面不得直接调用：`wx.cloud.callFunction()`
> 统一调用：`services/` 中的 API。

总体架构要求为：**微信小程序页面 → Service 层 → Cloud Function API → Cloud Database**。
即所有页面（含 `pages/` 下的页面逻辑）必须经由 `services/` 封装后再访问云函数，
不得在页面 `.js` 中直接书写 `wx.cloud.callFunction({ name, data })`。

---

## 2. 分析方法与判定口径

1. 全量检索 `miniprogram` 目录下所有 `wx.cloud.callFunction` / `.callFunction(` 调用点（含多行换行写法，初版 grep 因换行漏检已通过宽松模式补全）。
2. 逐文件阅读上下文，区分以下三类：
   - **合规封装**：`services/*.js` 内部的调用 —— 这是设计允许的唯一直接调用点。
   - **违规调用**：`pages/*.js` 内部直接调用 —— 本次报告对象。
   - **非执行文本**：`example/index.js` 中以模板字符串赋值给 `callFunctionCode` 仅用于页面展示代码样例，**不发起请求**，不计入违规，但原调用栈需单独说明。
3. 现有 Service 层现状：`userServices.js`、`familyServices.js`、`bookshelfServices.js` 三个文件已建封装；
   **book / bookItem / bookMeta / search / recent 业务尚未建立任何 Service 文件**，这是本批违规的根因。

---

## 3. 违规总览

| 页面文件 | 违规处数 | 涉及的云函数（api_xxx） |
|---|---:|---|
| `pages/book/book.js` | 9 | `api_bookitem_updateBookshelf`、`api_bookmeta_getByIsbn`、`api_bookmeta_fetchExternal`、`api_bookitem_get`、`api_bookitem_prepareCreate`、`api_bookitem_create`、`api_bookitem_restock`、`api_bookitem_offstock`、`api_bookitem_delete` |
| `pages/book-search/book-search.js` | 4 | `api_book_search`、`api_bookitem_offstock`、`api_bookitem_delete`、`api_bookitem_restock` |
| `pages/index/index.js` | 1 | `api_book_searchRecent` |
| `pages/example/index.js` | 6 | `quickstartFunctions`（演示云函数，非本项目业务 API） |
| **合计** | **20** | 见上 |

> 说明：`mine.js`、`settings.js`、`app.js`、各 `services/*.js` 经核查**无违规**。

---

## 4. 违规明细

### 4.1 `pages/book/book.js`（9 处）

| 行号 | 所在方法 | 云函数 | 调用方式 | 建议归属 Service 方法 |
|---:|---|---|---|---|
| 140 | `onViewBookshelfChange` | `api_bookitem_updateBookshelf` | `await wx.cloud.callFunction` | `bookServices.updateBookshelf(itemId, bookshelfId)` |
| 180 | `loadFromISBN` | `api_bookmeta_getByIsbn` | `wx.cloud.callFunction().then` | `bookMetaServices.getByIsbn(isbn)` |
| 209 | `loadFromISBN`（.then 链） | `api_bookmeta_fetchExternal` | `return wx.cloud.callFunction` | `bookMetaServices.fetchExternal(isbn)` |
| 257 | `loadFromId` | `api_bookitem_get` | `await wx.cloud.callFunction` | `bookServices.get(itemId)` |
| 535 | `callPrepare` | `api_bookitem_prepareCreate` | `await wx.cloud.callFunction` | `bookServices.prepareCreate(isbn, book)` |
| 558 | `callCommit` | `api_bookitem_create` | `await wx.cloud.callFunction` | `bookServices.create(isbn, bookshelfId, book, editionType)` |
| 684 | `handleOn` | `api_bookitem_restock` | `await wx.cloud.callFunction` | `bookServices.restock(itemId)` |
| 749 | `handleOff` | `api_bookitem_offstock` | `await wx.cloud.callFunction` | `bookServices.offstock(itemId, reason)` |
| 814 | `onDelete` | `api_bookitem_delete` | `await wx.cloud.callFunction` | `bookServices.delete(itemId)` |

### 4.2 `pages/book-search/book-search.js`（4 处）

| 行号 | 所在方法 | 云函数 | 调用方式 | 建议归属 Service 方法 |
|---:|---|---|---|---|
| 443 | `fetchBooks` | `api_book_search` | `await wx.cloud.callFunction` | `bookSearchServices.search(params)` |
| 628 | `handleOff` | `api_bookitem_offstock` | `await wx.cloud.callFunction` | `bookServices.offstock(itemId, reason)` |
| 747 | `handleDelete` | `api_bookitem_delete` | `await wx.cloud.callFunction` | `bookServices.delete(itemId)` |
| 854 | `handleOn` | `api_bookitem_restock` | `await wx.cloud.callFunction` | `bookServices.restock(itemId)` |

### 4.3 `pages/index/index.js`（1 处）

| 行号 | 所在方法 | 云函数 | 调用方式 | 建议归属 Service 方法 |
|---:|---|---|---|---|
| 123 | `api_book_searchRecent` | `api_book_searchRecent` | `await wx.cloud.callFunction` | `bookSearchServices.searchRecent()` |

### 4.4 `pages/example/index.js`（6 处真实调用 + 2 处展示文本）

该页面为微信云开发 **quickstart 脚手架示例页**，调用的是演示云函数 `quickstartFunctions`，并非本项目业务 `api_*` 系列。

| 行号 | 所在方法 | 云函数 / type | 是否执行 |
|---:|---|---|---|
| 168 | `deleteRecord` | `quickstartFunctions` / `deleteRecord` | 是 |
| 217 | `onInsertConfirm` | `quickstartFunctions` / `insertRecord` | 是 |
| 244 | `getOpenId` | `quickstartFunctions` / `getOpenId` | 是 |
| 300 | `getCodeSrc` | `quickstartFunctions` / `getMiniProgramCode` | 是 |
| 359 | `getRecord` | `quickstartFunctions` / `selectRecord` | 是 |
| 392 | `updateRecord` | `quickstartFunctions` / `updateRecord` | 是 |
| 546 | — | `callFunctionCode`（模板字符串） | 否（仅展示） |
| 575 | — | `callFunctionCode`（模板字符串） | 否（仅展示） |

---

## 5. 根因分析

- **缺失的 Service 边界**：`user / family / bookshelf` 三组业务已有对应 Service 封装，相关页面（如 `book.js` 已通过 `familyServices.getCurrent()`、`bookshelfServices.list()` 访问）均合规；
  唯独 **book / bookItem / bookMeta / search / recent** 业务自始未建立 Service 文件，页面在开发时"无封装可用"，只能直接调用 `wx.cloud.callFunction()`。
- **示例页污染**：`example/` 为 quickstart 遗留脚手架，既未删除也未纳入 Service 约束，属于独立问题（建议整体下线下架，而非补封装）。
- **缺乏静态约束**：仓库当前没有 ESLint / 提交钩子拦截页面层直接调用 `wx.cloud.callFunction`，导致违规得以混入库中。

---

## 6. 改善方案建议

### 6.1 补齐 Service 封装层（核心动作）

新增（或合并）以下 Service 文件，统一封装 book 相关云函数：

**`services/bookServices.js`**（book / bookItem 实体业务）

```js
// 书籍与实体书（book_item）API 封装
// 页面通过此 Service 调用云函数，不直接调用 wx.cloud.callFunction()

const callFunction = async (name, data = {}) => {
  const res = await wx.cloud.callFunction({ name, data })
  return res.result
}

const get            = (itemId)                 => callFunction('api_bookitem_get', { itemId })
const prepareCreate = (isbn, book)             => callFunction('api_bookitem_prepareCreate', { isbn, book })
const create         = (isbn, bookshelfId, book, editionType) =>
                                            callFunction('api_bookitem_create', { isbn, bookshelfId, book, editionType })
const updateBookshelf= (itemId, bookshelfId)   => callFunction('api_bookitem_updateBookshelf', { itemId, bookshelfId })
const restock        = (itemId)                 => callFunction('api_bookitem_restock', { itemId })
const offstock       = (itemId, reason)         => callFunction('api_bookitem_offstock', { itemId, reason })
const remove         = (itemId)                 => callFunction('api_bookitem_delete', { itemId })

module.exports = { get, prepareCreate, create, updateBookshelf, restock, offstock, remove }
```

**`services/bookMetaServices.js`**（主数据 / 外部元数据）

```js
const callFunction = async (name, data = {}) => {
  const res = await wx.cloud.callFunction({ name, data })
  return res.result
}

const getByIsbn   = (isbn) => callFunction('api_bookmeta_getByIsbn', { isbn })
const fetchExternal = (isbn) => callFunction('api_bookmeta_fetchExternal', { isbn })

module.exports = { getByIsbn, fetchExternal }
```

**`services/bookSearchServices.js`**（检索 / 最近上架）

```js
const callFunction = async (name, data = {}) => {
  const res = await wx.cloud.callFunction({ name, data })
  return res.result
}

const search       = (params) => callFunction('api_book_search', params)
const searchRecent = ()       => callFunction('api_book_searchRecent')

module.exports = { search, searchRecent }
```

### 6.2 页面改造（仅替换调用，不改业务逻辑）

以 `book.js` 为例：

```js
// 改造前（book.js:140 行附近）
const res = await wx.cloud.callFunction({
  name: 'api_bookitem_updateBookshelf',
  data: { itemId: book.itemId, bookshelfId: newBookshelfId }
})

// 改造后
const bookServices = require('../../services/bookServices')
const res = await bookServices.updateBookshelf(book.itemId, newBookshelfId)
```

- `book-search.js` 的 `fetchBooks` 改用 `bookSearchServices.search(data)`，`handleOff/handleDelete/handleOn` 改用 `bookServices.*`。
- `index.js` 的 `api_book_searchRecent` 改用 `bookSearchServices.searchRecent()`。
- `loadFromISBN` 涉及 `.then` 链式写法（第 180、209 行），改造时建议整体改为 `async/await` 并分别调用 `bookMetaServices.getByIsbn` 与 `bookMetaServices.fetchExternal`，同时保留原有的 success/exists 分支判断。

### 6.3 示例页处理

`example/` 为 quickstart 脚手架、调用 `quickstartFunctions` 演示云函数，与业务无关：

- **推荐**：从生产构建中删除（或在 `app.json` 的 `pages` 列表移除、移入 `cloudfunctions` 演示区），从根源消除 6 处违规。
- 若需保留作教学样例，至少应注明"示例页不受 Service 层约束"，避免被误读为业务代码。

### 6.4 增加约束防止回潮

- 在仓库根新增 `miniprogram/.eslintrc.js`，配置规则禁止在 `pages/**` 目录下引用 `wx.cloud.callFunction`（或全局禁止页面层直接调用，仅 `services/**` 豁免）。
- 在 `scripts/`（仓库已有 `cloudfunctions/scripts`）或 CI 中增加提交前检查，命中即阻断。

---

## 7. 分批实施优先级

| 优先级 | 动作 | 范围 | 说明 |
|---|---|---|---|
| P0 | 新增 `bookServices.js` | book 业务 | 9 处违规集中于此，收益最大 |
| P0 | 新增 `bookSearchServices.js` | 检索/最近 | 覆盖 `book-search.js`(4) + `index.js`(1) |
| P1 | 新增 `bookMetaServices.js` | 主数据 | 覆盖 `book.js` 的 2 处 meta 调用 |
| P1 | 改造 `book.js` / `book-search.js` / `index.js` | 三个页面 | 引用新 Service，删除直接调用 |
| P2 | 处理 `example/` 示例页 | 脚手架 | 删除或标注，消除 6 处 |
| P2 | 增加 ESLint / 提交钩子约束 | 工程化 | 防止违规回潮 |

---

## 8. 结论

当前共 **20 处**页面层直接调用 `wx.cloud.callFunction()` 的违规，其中 14 处集中在 `book` / `book-search` / `index` 三个业务页面（均因 book 业务缺失 Service 层所致），6 处来自 quickstart 示例页。
合规页面（`mine`、`settings`、以及已建封装的 `family`/`bookshelf` 相关逻辑）可作为改造样板。
建议按第 7 节优先级补齐 `services/` 并完成页面改造；本报告仅作问题盘点，**未改动任何代码**。
