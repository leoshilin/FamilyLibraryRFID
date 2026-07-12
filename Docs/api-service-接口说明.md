# Cloudfunctions API-Service 接口说明文档

# 0. 当前待处理问题
本章记载内容根据进度更新可能有两类：
 - a. 已知的待修复或待改善事项。（代码侧 + 文档侧均未修正）
 - b. 代码侧已修复的问题。但文档侧还未做更新的事项。（代码侧已修正，文档侧未修正）

由于功能开发为优先，上述已知问题考虑在功能开发稳定后再统一修改。
因此，文档中相关设计和本章节记载的内容可能会有冲突。

---

## 0.1 通用约定
1. **familyId**：仅"目标家庭"类接口（B3/B4/B6）由客户端传入；其余从 `user.currentFamilyId` 解析。
```
openid
↓
user（getCurrentUser）
↓
user.currentFamilyId
```

2. **operator / created_by**：一律由服务端从登录态（`user._id`）解析，客户端不得传入。
3. **登录态**：通过 `cloud.getWXContext().OPENID` → `getCurrentUser(db, openid)` 取得当前用户；未注册或 `status != ACTIVE` 的接口将返回失败。
4. **库存状态字段**：book_item 使用 `inventory_status`（`in_stock` / `off_stock`）。
5. **返回结构**：成功统一含 `success: true`；失败统一含 `success: false` 与 `message`（部分接口含 `reason` 枚举，见各接口"返回"）。
6. **库存时间字段（book_item 三时间语义）**：数据库内部 snake_case（`created_at` / `on_shelf_at` / `updated_at`），API 返回统一 camelCase（`createdAt` / `onShelfAt` / `updatedAt`）。
   - `created_at` / `createdAt`：**实体书数据记录**创建时刻。仅初次上架（`api_bookitem_create`）写入一次，**重新上架不刷新**。
   - `on_shelf_at` / `onShelfAt`：**上架时间**，即当前"在架状态"的起始时刻。初次上架写入；重新上架（`api_bookitem_restock`）刷新；下架 / 更换书架 / 彻底删除 / 绑定解绑RFID 不刷新。用于"最近上架"排序（`api_book_searchRecent`）与"上架期间"筛选（`api_book_search`）及详情页"上架日"展示。
   - `updated_at` / `updatedAt`：记录**末次更新**时刻。任意写操作（下架、重新上架、更换书架、彻底删除、绑定/解绑RFID）均刷新。
7. 所有云函数目录下的common目录是通用模块，但不应该单独维护。该模块下的文件来源是_shared 目录，通过npm run sync-common来同步到所有云函数下。因此，Git Hub可能仅保存_shared 目录一个拷贝。部署时需要执行同步脚本。
---

## 0.2 a类问题（代码侧 + 文档侧均未修正）
无

---

## 0.3 b类问题（代码侧已修正，文档侧未修正）
无

---

# 1. API整体清单

| 编号 | API名称                      | 领域       | 类别 | 实现状态 |
|------ | -------------------------- | -------- |-------- |-------- |
|A1| api_user_login | user | 手机端操作：用户登录与管理 | ✅ 已实现 |
|A2| api_user_register | user | 手机端操作：用户登录与管理 | ✅ 已实现 |
|A3| api_user_get | user | 手机端操作：用户登录与管理 | ✅ 已实现 |
|A4| api_user_update | user | 手机端操作：用户登录与管理 | ✅ 已实现 |
|B1| api_family_getCurrent | family | 手机端操作：家庭主数据 | ✅ 已实现 |
|B2| api_family_create | family | 手机端操作：家庭主数据 | ✅ 已实现 |
|B3| api_family_update | family | 手机端操作：家庭主数据 | ✅ 已实现 |
|B4| api_family_delete | family | 手机端操作：家庭主数据 | ✅ 已实现 |
|B5| api_family_list | family | 手机端操作：家庭主数据 | ✅ 已实现 |
|B6| api_family_switchCurrent | family | 手机端操作：家庭主数据 | ✅ 已实现 |
|C1| api_bookshelf_create | bookshelf | 手机端操作：书架主数据 | ✅ 已实现 |
|C2| api_bookshelf_update | bookshelf | 手机端操作：书架主数据 | ✅ 已实现 |
|C3| api_bookshelf_delete | bookshelf | 手机端操作：书架主数据 | ✅ 已实现 |
|C4| api_bookshelf_list | bookshelf | 手机端操作：书架主数据 | ✅ 已实现 |
|C5| api_bookshelf_reorder | bookshelf | 手机端操作：书架主数据 | ✅ 已实现 |
|D1| api_bookmeta_getByIsbn     | BookMeta | 手机端操作：书本主数据 | ✅ 已实现 |
|D2| api_bookmeta_fetchExternal | BookMeta | 手机端操作：书本主数据 | ✅ 已实现 |
|E1| api_bookitem_prepareCreate | BookItem | 手机端操作：实体书本上下架 | ✅ 已实现 |
|E2| api_bookitem_create        | BookItem | 手机端操作：实体书本上下架 | ✅ 已实现 |
|E3| api_bookitem_offstock      | BookItem | 手机端操作：实体书本上下架 | ✅ 已实现 |
|E4| api_bookitem_restock       | BookItem | 手机端操作：实体书本上下架 | ✅ 已实现 |
|E5| api_bookitem_delete        | BookItem | 手机端操作：实体书本上下架 | ✅ 已实现 |
|E6| api_bookitem_get           | BookItem | 手机端操作：实体书本上下架 | ✅ 已实现 |
|E7| api_bookitem_updateBookshelf           | BookItem | 手机端操作：实体书本上下架 | ✅ 已实现 |
|F1| api_book_search            | Search   | 手机端操作：书本检索 | ✅ 已实现 |
|F2| api_book_searchRecent            | Search   | 手机端操作：书本检索 | ✅ 已实现 |
|G1| api_task_createBindRfid | task | 手机端操作：任务创建 | ✅ 已实现 |
|G2| api_task_createFindBook | task | 手机端操作：任务创建 | ✅ 已实现 |
|G3| api_task_getBindStatus | task | 手机端操作：绑定状态查询 | ✅ 已实现 |
|H1| api_task_unbindRfid | task | 手机端操作：任务执行 | ✅ 已实现 |
|J1| api_task_accept | task | PDA操作：任务执行 | ✅ 已实现 |
|J2| api_task_complete | task | PDA操作：任务执行 | ✅ 已实现 |
|J3| api_task_getRfidBindingInfo | task | PDA操作：任务执行 | ✅ 已实现 |
|J4| api_task_bindRfid | task | PDA操作：任务执行 | ✅ 已实现 |

> 实现状态图例：
> - ✅ 已实现 = 仓库中存在对应云函数且已实现真实业务逻辑。
> - ✅ 已实现 = 仓库中存在对应云函数且已实现真实业务逻辑。
> 注：架构表中的接口命名已与代码实际云函数名对齐（如 `api_rfid_bind` → `api_task_bindRfid`、`api_recentbook_search` → `api_book_searchRecent`），以代码为准。

---

# 2. Service 层（前端封装）定义

> 本章与「第 1 章 API 整体清单」「第 3 章 API 接口详细定义」作为一个整体共同维护：新增 / 改名 / 下线任何 `api_*` 云函数时，必须同步更新本章的 Service 方法定义，确保小程序端调用入口唯一、契约稳定。

## 2.1 设计原则

依据 `.codex/AI_PROJECT_GUIDE.md` 第 6 节「Service 层」，前端调用链为：

```
微信小程序页面
      │
      ▼
Service 层（miniprogram/services/*.js）
      │  唯一允许调用 wx.cloud.callFunction() 的位置
      ▼
Cloud Function API（api_*）
      │
      ▼
Cloud Database
```

约束：

1. **页面禁止直接调用** `wx.cloud.callFunction()`；所有云函数访问必须经 `services/` 封装。
2. `services/` 是**唯一**允许 `wx.cloud.callFunction()` 的位置（对应代码审查已发现的 20 处违规，整改后即消除）。
3. `familyId` / `operator` / `created_by` 一律由服务端从登录态解析（见第 0.1 节），Service 方法签名**不接收**这些字段；B3 / B4 / B6 的"目标家庭" `familyId` 为客户端显式指定，例外列出。
4. 入参 / 返回结构遵循第 0.1 节与第 5 章（错误枚举）：成功 `success: true`，失败 `success: false` + `message`（未来补充 `reason`）。

## 2.2 模块划分

按业务领域将 33 个 `api_*` 归入 7 个 Service 模块，文件位于 `miniprogram/services/`：

| Service 文件 | 领域 | 封装的 API | 状态 |
|---|---|---|---|
| `userServices.js` | 用户 | A1–A4 | ✅ 已实现 |
| `familyServices.js` | 家庭 | B1–B6 | ✅ 已实现 |
| `bookshelfServices.js` | 书架 | C1–C5 | ✅ 已实现 |
| `bookMetaServices.js` | 书本主数据 | D1–D2 | ✅ 已实现 |
| `bookItemServices.js` | 实体书上下架 | E1–E7 | ✅ 已实现 |
| `bookSearchServices.js` | 检索 / 最近 | F1–F2 | ✅ 已实现 |
| `taskServices.js` | 任务 / RFID | G1 / G2 / H1（手机端）+ J1–J4（PDA） | ✅ 已实现 |

> 注：J 系列（PDA 操作）按架构由 Android PDA 直接调用云函数，此处列出仅为「全局 API 视图」统一维护，小程序页面一般不调用。

## 2.3 通用封装实现

所有模块共享同一封装模式：`services/` 下统一维护一个 `_base.js` 公共封装（导出 `callFunction`），各 Service 模块 `require('./_base')` 后仅声明业务方法，页面统一经 Service 调用云函数。

> **关于 `_base.js`**：它位于 `miniprogram/services/` 单一目录，仅此一份，由所有 Service 直接 `require('./_base')`——**不需要任何同步机制**。文档 0.1 第 7 条的同步脚本（`npm run sync-common`）只针对**云函数** `_shared` → `common`（每个云函数目录各一份），与前端 `services/` 无关。

```js
// miniprogram/services/_base.js
// Service 层公共封装：唯一允许调用 wx.cloud.callFunction() 的位置
const callFunction = async (name, data = {}) => {
  const res = await wx.cloud.callFunction({ name, data })
  return res.result
}
module.exports = { callFunction }
```

```js
// miniprogram/services/bookItemServices.js（节选）
const { callFunction } = require('./_base')

const get = (itemId) => callFunction('api_bookitem_get', { itemId })
const remove = (itemId) => callFunction('api_bookitem_delete', { itemId })
// ...
module.exports = { get, prepareCreate, create, updateBookshelf, restock, offstock, remove }
```

> 桩函数（🚧，历史状态）对应的 Service 方法已先行声明并随云函数实现一并转为 ✅ 已实现，无需再改页面 / Service 接口。

## 2.4 Service 方法总览（33 个 API → 方法映射）

| 编号 | API | Service 模块 | Service 方法 | 关键入参 | 实现状态 |
|---|---|---|---|---|---|
| A1 | api_user_login | userServices | `login()` | — | ✅ |
| A2 | api_user_register | userServices | `register(nickName)` | nickName | ✅ |
| A3 | api_user_get | userServices | `getUser(userId?)` | userId? | ✅ |
| A4 | api_user_update | userServices | `updateUser(nickName)` | nickName | ✅ |
| B1 | api_family_getCurrent | familyServices | `getCurrent()` | — | ✅ |
| B2 | api_family_create | familyServices | `create(name?)` | name? | ✅ |
| B3 | api_family_update | familyServices | `update(familyId, name)` | familyId, name | ✅ |
| B4 | api_family_delete | familyServices | `remove(familyId)` | familyId | ✅ |
| B5 | api_family_list | familyServices | `list()` | — | ✅ |
| B6 | api_family_switchCurrent | familyServices | `switchCurrent(familyId)` | familyId | ✅ |
| C1 | api_bookshelf_create | bookshelfServices | `create(name)` | name | ✅ |
| C2 | api_bookshelf_update | bookshelfServices | `update(bookshelfId, name)` | bookshelfId, name | ✅ |
| C3 | api_bookshelf_delete | bookshelfServices | `remove(bookshelfId)` | bookshelfId | ✅ |
| C4 | api_bookshelf_list | bookshelfServices | `list()` | — | ✅ |
| C5 | api_bookshelf_reorder | bookshelfServices | `reorder(orderedBookshelfIds)` | orderedBookshelfIds[] | ✅ |
| D1 | api_bookmeta_getByIsbn | bookMetaServices | `getByIsbn(isbn)` | isbn | ✅ |
| D2 | api_bookmeta_fetchExternal | bookMetaServices | `fetchExternal(isbn)` | isbn | ✅ |
| E1 | api_bookitem_prepareCreate | bookItemServices | `prepareCreate(isbn, book)` | isbn, book | ✅ |
| E2 | api_bookitem_create | bookItemServices | `create(isbn, bookshelfId, book, editionType?)` | isbn, bookshelfId, book, editionType? | ✅ |
| E3 | api_bookitem_offstock | bookItemServices | `offstock(itemId, reason)` | itemId, reason | ✅ |
| E4 | api_bookitem_restock | bookItemServices | `restock(itemId)` | itemId | ✅ |
| E5 | api_bookitem_delete | bookItemServices | `remove(itemId)` | itemId | ✅ |
| E6 | api_bookitem_get | bookItemServices | `get(itemId)` | itemId | ✅ |
| E7 | api_bookitem_updateBookshelf | bookItemServices | `updateBookshelf(itemId, bookshelfId)` | itemId, bookshelfId | ✅ |
| F1 | api_book_search | bookSearchServices | `search(params)` | keyword?, isbn?, bookshelfId?, status?, startDate?, endDate?, page?, pageSize? | ✅ |
| F2 | api_book_searchRecent | bookSearchServices | `searchRecent()` | — | ✅ |
| G1 | api_task_createBindRfid | taskServices | `createBindRfid(bookItemId)` | bookItemId | ✅ |
| G2 | api_task_createFindBook | taskServices | `createFindBook(bookItemId)` | bookItemId | ✅ |
| G3 | api_task_getBindStatus | taskServices | `getBindStatus(params)` | bookItemId? / bookItemIds? | ✅ |
| H1 | api_task_unbindRfid | taskServices | `unbindRfid(bookItemId)` | bookItemId | ✅ |
| J1 | api_task_accept | taskServices | `accept(deviceId)` | deviceId | ✅ |
| J2 | api_task_complete | taskServices | `complete(taskId, status, result?)` | taskId, status, result? | ✅ |
| J3 | api_task_getRfidBindingInfo | taskServices | `getRfidBindingInfo(tid)` | tid | ✅ |
| J4 | api_task_bindRfid | taskServices | `bindRfid(bookItemId, tid, taskId?)` | bookItemId, tid, taskId? | ✅ |

> 入参标注 `?` 的为可选；`familyId` / `operator` / `created_by` 一律服务端解析，不在任何方法签名中出现（B3 / B4 / B6 的"目标家庭" `familyId` 除外，已在方法签名显式列出）。

## 2.5 各模块方法签名定义

### 2.5.1 userServices.js（用户）
```js
login()                                    // → api_user_login        {}
register(nickName)                         // → api_user_register     { nickName }
getUser(userId)                            // → api_user_get          { userId? }              ✅
updateUser(nickName)                       // → api_user_update       { nickName }
```
> 现有 `userServices.js` 已实现 `login` / `register` / `updateUser`，需补 `getUser`（对应 A3 桩函数）。

### 2.5.2 familyServices.js（家庭）
```js
getCurrent()                               // → api_family_getCurrent {}
create(name = '我的家庭')                  // → api_family_create     { name? }
list()                                    // → api_family_list       {}
update(familyId, name)                    // → api_family_update     { familyId, name }
remove(familyId)                          // → api_family_delete     { familyId }
switchCurrent(familyId)                   // → api_family_switchCurrent { familyId }
```
> 已实现；命名沿用既有 `remove` 代表逻辑删除。

### 2.5.3 bookshelfServices.js（书架）
```js
list()                                    // → api_bookshelf_list     {}
create(name)                              // → api_bookshelf_create   { name }
update(bookshelfId, name)                 // → api_bookshelf_update   { bookshelfId, name }
remove(bookshelfId)                       // → api_bookshelf_delete   { bookshelfId }
reorder(orderedBookshelfIds)              // → api_bookshelf_reorder { orderedBookshelfIds }  ✅
```
> 已实现 `list` / `create` / `update` / `remove` / `reorder`；`reorder` 对应 C5，由 mine 页「↑ / ↓」按钮调用以重排书架。

### 2.5.4 bookMetaServices.js（书本主数据）✅ 已实现
```js
getByIsbn(isbn)                           // → api_bookmeta_getByIsbn     { isbn }
fetchExternal(isbn)                       // → api_bookmeta_fetchExternal { isbn }
```

### 2.5.5 bookItemServices.js（实体书上下架）✅ 已实现
```js
prepareCreate(isbn, book)                 // → api_bookitem_prepareCreate  { isbn, book }
create(isbn, bookshelfId, book, editionType) // → api_bookitem_create    { isbn, bookshelfId, book, editionType? }
updateBookshelf(itemId, bookshelfId)      // → api_bookitem_updateBookshelf { itemId, bookshelfId }
restock(itemId)                           // → api_bookitem_restock        { itemId }
offstock(itemId, reason)                  // → api_bookitem_offstock        { itemId, reason }
remove(itemId)                            // → api_bookitem_delete          { itemId }
get(itemId)                               // → api_bookitem_get             { itemId }
```

### 2.5.6 bookSearchServices.js（检索 / 最近）✅ 已实现
```js
search({ keyword, isbn, bookshelfId, status, startDate, endDate, page, pageSize })
                                        // → api_book_search   { keyword?, isbn?, bookshelfId?, status?, startDate?, endDate?, page?, pageSize? }
searchRecent()                           // → api_book_searchRecent {}
```

### 2.5.7 taskServices.js（任务 / RFID）✅ 已实现
```js
// —— 手机端创建 / 解绑 ——
createBindRfid(bookItemId)                // → api_task_createBindRfid    { bookItemId }
createFindBook(bookItemId)                // → api_task_createFindBook    { bookItemId }
unbindRfid(bookItemId)                    // → api_task_unbindRfid        { bookItemId }
getBindStatus(params)                    // → api_task_getBindStatus      { bookItemId? / bookItemIds? }  ✅
// —— PDA 执行（Android 直连，此处仅作全局视图维护）——
accept(deviceId)                          // → api_task_accept            { deviceId }
complete(taskId, status, result)          // → api_task_complete          { taskId, status, result? }
getRfidBindingInfo(tid)                   // → api_task_getRfidBindingInfo { tid }
bindRfid(bookItemId, tid, taskId)         // → api_task_bindRfid          { bookItemId, tid, taskId? }
```
> `bindRfid` 的 `taskId` 为可选：用于关联 `rfid_bind_log.task_id`；不传时按 `book_item_id` 反查进行中的 `bind_rfid` 任务。`deviceId` 为可选：作为 `rfid_bind_log.operator`（PDA 设备ID），不传时回退到任务领取设备，再回退到固定串 `"PDA"`。

## 2.6 维护约定

- 任何 `api_*` 云函数的**新增 / 改名 / 下线 / 入参变更**，必须同步更新：第 1 章清单、第 3 章详细定义、本章 2.4 映射表与 2.5 签名。
- Service 方法命名语义化（动词 + 资源），不暴露云函数名；云函数名变更时只需改 `callFunction(name, ...)` 一处。
- 历史桩函数（🚧）对应的 Service 方法已随云函数实现一并转为 ✅ 已实现，页面 / Service 契约保持稳定。

---

# 3. API接口详细定义
## A. 手机端操作：用户登录与管理

整体流程
```
进入小程序
      ↓
api_user_login
      ↓
registered=false
      ↓
显示 未注册用户
      ↓
点击注册
      ↓
api_user_register
      ↓
注册成功
      ↓
api_user_login
      ↓
显示用户信息
```

### A1. api_user_login
#### 功能
根据当前微信账号查询系统用户。只查询，绝不创建。

#### 入参
```json
{}
```

#### 处理规则
- 获取 openid（`cloud.getWXContext()`）
- 查询 user
- 已注册用户：构建当前家庭下的权限集 `permissions`（`buildFamilyPermissions`）


#### 权限
- 无（仅登录态 / 注册校验，返回是否已注册）

#### 返回
**已注册：**
```json
{
  "success": true,
  "registered": true,
  "user": {
    "_id": "u001",
    "nickName": "方大大",
    "currentFamilyId": "f001",
    "role": "USER",
    "status": "ACTIVE"
  },
  "permissions": {
    "family": ["FAMILY_UPDATE", "FAMILY_DELETE", "..."],
    "bookshelf": ["BOOKSHELF_CREATE", "BOOKSHELF_LIST", "..."],
    "bookitem": ["BOOKITEM_SEARCH", "BOOKITEM_UPDATE", "..."]
  }
}
```

**未注册：**
```json
{
  "success": true,
  "registered": false
}
```

> 说明：代码实际在已注册时一并返回当前家庭的权限集 `permissions`，供前端控制 UI 展示（对应需求文档 RBAC Lite）。

---

### A2. api_user_register
#### 功能
注册系统用户。

#### 调用入口
```
我的
↓
未注册用户
↓
注册
```

#### 入参
```json
{
  "nickName": "方大大"
}
```
> openid 从 `cloud.getWXContext()` 获取，不接收客户端传入。

#### 处理规则
- 获取 openid
- 检查 user 是否存在
  - 存在：返回失败
  - 不存在：创建 user


#### 权限
- 无（注册接口；已注册用户不可重复注册）

#### 返回
```json
{
  "success": true,
  "userId": "u001"
}
```

---

### A3. api_user_get
#### 功能
获取用户信息（按 userId 或当前登录用户）。

用于：
```
我的页
↓
app.login() 之后取当前用户档案（getUser）
↓
家庭成员查看等场景（getUser(userId)）
```

#### 入参
```json
{
  "userId": "u001"
}
```
或
```json
{}
```
> 不传 `userId` 时根据 openid 获取当前登录用户（并返回当前家庭权限集）。传 `userId` 时按 `_id` 返回该用户基础档案。

#### 处理规则
- 获取 openid（`cloud.getWXContext()`）
- 传 `userId`：按 `_id` 查询 user，仅返回基础档案（**不返回权限集**，避免暴露他人家庭权限）
- 不传 `userId`：按 openid 解析当前用户（`getCurrentUser`），并构建当前家庭权限集 `buildFamilyPermissions`（与 `api_user_login` 返回语义一致）

#### 权限
- 无（登录态；查看用户自身或指定用户信息）

#### 返回
**当前登录用户（不传 userId）：**
```json
{
  "success": true,
  "user": {
    "_id": "u001",
    "openid": "oXXX",
    "nickName": "方大大",
    "currentFamilyId": "f001",
    "role": "USER",
    "status": "ACTIVE",
    "createdAt": "datetime",
    "updatedAt": "datetime"
  },
  "permissions": { "...": "..." }
}
```

**指定用户（传 userId）：**
```json
{
  "success": true,
  "user": {
    "_id": "u001",
    "openid": "oXXX",
    "nickName": "方大大",
    "currentFamilyId": "f001",
    "role": "USER",
    "status": "ACTIVE",
    "createdAt": "datetime",
    "updatedAt": "datetime"
  }
}
```

**失败：**
```json
{ "success": false, "message": "用户未注册" }
```
```json
{ "success": false, "message": "用户不存在" }
```

> 说明：所有字段统一 camelCase（见 0.1 通用约定）。`permissions` 仅在不传 `userId`（当前用户）时返回，结构与 `api_user_login` 一致，前端可直接用于 UI 控制。

### A4. api_user_update
#### 功能
更新当前登录用户的昵称。

#### 入参
```json
{
  "nickName": "方大大"
}
```

#### 处理规则
- 前置：用户须已注册且 `status = ACTIVE`，否则返回：
  ```json
  { "success": false, "message": "用户不存在" }
  ```
  或
  ```json
  { "success": false, "message": "用户状态不可用" }
  ```

#### 权限
- 无（登录态；当前用户须已注册且 status=ACTIVE）

#### 返回
**成功：**
```json
{
  "success": true,
  "user": { "nickName": "方大大", "updatedAt": "datetime" }
}
```

**失败：**
```json
{ "success": false, "message": "用户名不能为空" }
```

**异常：**
```json
{ "success": false, "error": "..." }
```

---

## B. 手机端操作：家庭主数据

### B1. api_family_getCurrent
#### 功能
获取当前登录用户访问中的家庭（不一定是用户创建的家庭，也可能是用户加入的家庭）。

#### 入参
```json
{}
```
> familyId 由服务端从 `user.currentFamilyId` 解析（见 0.4），不接收客户端传入。

#### 处理规则
（暂无）


#### 权限
- 无（登录态；返回当前访问家庭信息）

#### 返回
**成功（有家庭）：**
```json
{
  "success": true,
  "family": {
    "_id": "familyId",
    "name": "我的家庭",
    "status": "ACTIVE",
    "createdBy": "userId",
    "createdAt": "datetime"
  },
  "role": "OWNER",
  "bookshelfCount": 1
}
```

**无家庭：**
```json
{
  "success": true,
  "family": null,
  "role": null,
  "bookshelfCount": 0
}
```

---

### B2. api_family_create
#### 功能
登录用户创建家庭。

#### 入参
```json
{
  "name": "我的家庭"
}
```
> name 可选，为空时默认"我的家庭"。familyId 由服务端创建，不接收客户端传入。

#### 处理规则
- 校验用户是否已作为 `OWNER` 创建过家庭（一个用户只可创建一个家庭），失败返回"当前用户已创建家庭"
- 创建默认书架"我的书架"
- 在 `user_family` 建立 `OWNER` 关系
- 更新 `user.currentFamilyId`


#### 权限
- 所需权限：`FAMILY_CREATE`
- 允许角色：任意已注册用户（PUBLIC，不依赖家庭角色）；ADMIN 拥有全部
- 校验方式：服务端经 `checkPermission` 校验；未授权返回 `{ "success": false, "message": "无权限操作" }`

#### 返回
**成功：**
```json
{
  "success": true,
  "familyId": "familyId",
  "bookshelfId": "bookshelfId",
  "family": {
    "_id": "familyId",
    "name": "我的家庭",
    "status": "ACTIVE"
  }
}
```

**失败：**
```json
{ "success": false, "message": "用户未注册" }
```
```json
{ "success": false, "message": "当前用户已创建家庭" }
```

---

### B3. api_family_update
#### 功能
更新指定家庭的名称信息。

#### 入参
```json
{
  "familyId": "familyId",
  "name": "新的家庭名称"
}
```
> 此处 familyId 为**目标家庭**，由客户端指定（语义正确，予以保留）。

#### 处理规则


#### 权限
- 所需权限：`FAMILY_UPDATE`
- 允许角色：ADMIN（系统管理员，拥有全部）、OWNER（MEMBER、GUEST 无此权限）
- 校验方式：服务端经 `checkPermission` 校验；未授权返回 `{ "success": false, "message": "无权限操作" }`

#### 返回
**成功：**
```json
{
  "success": true,
  "family": {
    "_id": "familyId",
    "name": "新的家庭名称",
    "status": "ACTIVE",
    "updatedAt": "datetime"
  }
}
```

**失败：**
```json
{ "success": false, "message": "家庭名称不能为空" }
```
```json
{ "success": false, "message": "无权限修改家庭" }
```

---

### B4. api_family_delete
#### 功能
删除指定家庭，逻辑删除，不做物理删除。

#### 入参
```json
{
  "familyId": "familyId"
}
```
> 此处 familyId 为**目标家庭**，由客户端指定（语义正确，予以保留）。

#### 处理规则
- 获取当前登录用户：openid → user
- 校验用户已注册且 `status = ACTIVE`
- 校验 familyId 必填
- 查询目标 family
- 若家庭不存在或已 `DISABLED`，返回失败
- 删除前检查该家庭下是否存在 `status = ACTIVE` 的书架，若存在 ACTIVE 书架则拒绝删除
- 若允许删除：更新 `family.status = DISABLED`，写入 `updated_by`、`updated_at`
- 如果当前用户的 `currentFamilyId === familyId`：删除 `user.currentFamilyId` 字段（不能写 null）


#### 权限
- 所需权限：`FAMILY_DELETE`
- 允许角色：ADMIN（系统管理员，拥有全部）、OWNER（MEMBER、GUEST 无此权限）
- 校验方式：服务端经 `checkPermission` 校验；未授权返回 `{ "success": false, "message": "无权限操作" }`

#### 返回
**成功：**
```json
{ "success": true }
```

**失败：**
```json
{ "success": false, "message": "familyId不能为空" }
```
```json
{ "success": false, "message": "家庭不存在" }
```
```json
{ "success": false, "message": "无权限删除家庭" }
```
```json
{ "success": false, "message": "当前家庭下存在有效书架，请先删除书架" }
```

---

### B5. api_family_list
#### 功能
获取当前用户所属的全部家庭（自建 + 受邀加入）。

#### 入参
无（openid 后端解析）

#### 处理规则
- 该接口**不做 RBAC 校验**（仅 `getCurrentUser`）


#### 权限
- 无（登录态；列出当前用户所属全部家庭，文档注明不做 RBAC 校验）

#### 返回
```json
{
  "success": true,
  "list": [ { "familyId": "...", "name": "...", "role": "...", "status": "...", "isCurrent": true } ]
}
```

无家庭返回：
```json
{
  "success": true,
  "list": []
}
```

---

### B6. api_family_switchCurrent
#### 功能
切换当前登录用户的默认访问家庭（`user.currentFamilyId`）。

> 仅校验"登录用户是否属于目标家庭"（`user_family` 存在对应记录），不做 `OWNER` / `MEMBER` 角色级权限校验；任何已激活家庭成员均可切换。
> 切换后影响后续依赖 `currentFamilyId` 默认值的接口。

#### 入参
```json
{
  "familyId": "familyId"
}
```
> 此处 familyId 为**目标家庭**，由客户端指定（语义正确，予以保留）。

#### 处理规则
- 获取当前登录用户：openid → user（`getCurrentUser`）
- 校验 familyId 必填
- 校验用户已注册且 `status = ACTIVE`
- 查询 `user_family` 校验用户属于该家庭（userId + familyId 存在记录）
- 查询目标 family，必须存在且 `status = ACTIVE`
- 更新 `user.currentFamilyId = familyId`
- 不写 `updated_at` / `updated_by`；不做角色权限校验


#### 权限
- 无（仅校验用户是否属于目标家庭 user_family，不做角色级权限校验）

#### 返回
**成功：**
```json
{ "success": true }
```

**失败：**
```json
{ "success": false, "message": "familyId不能为空" }
```
```json
{ "success": false, "message": "用户未注册" }
```
```json
{ "success": false, "message": "用户状态不可用" }
```
```json
{ "success": false, "message": "用户不属于该家庭" }
```
```json
{ "success": false, "message": "家庭不存在或已失效" }
```

**异常：**
```json
{ "success": false, "message": "<err.message>" }
```

---

## C. 手机端操作：书架主数据

### C1. api_bookshelf_create
#### 功能
在指定家庭下创建书架。

#### 入参
```json
{
  "name": "书架名称"
}
```
> familyId 由服务端从 `user.currentFamilyId` 解析（见 0.4），不接收客户端传入。

#### 处理规则
- name 必填，trim 后不能为空
- 当前用户必须已注册且 `status = ACTIVE`
- 目标家庭必须存在且 `status = ACTIVE`
- 同一家庭下 ACTIVE 书架数量不能超过 99
- sort_order 由后端计算：当前 ACTIVE 书架最大 sort_order + 1
- 创建时写入：familyId、name、sort_order、status = ACTIVE、created_by、created_at


#### 权限
- 所需权限：`BOOKSHELF_CREATE`
- 允许角色：ADMIN（系统管理员，拥有全部）、OWNER、MEMBER（GUEST 无此权限）
- 校验方式：服务端经 `checkPermission` 校验；未授权返回 `{ "success": false, "message": "无权限操作" }`

#### 返回
```json
{
  "success": true,
  "bookshelfId": "bookshelfId",
  "bookshelf": {
    "_id": "bookshelfId",
    "familyId": "familyId",
    "name": "书架名称",
    "sortOrder": 2,
    "status": "ACTIVE"
  }
}
```

---

### C2. api_bookshelf_update
#### 功能
修改指定书架名称。

#### 入参
```json
{
  "bookshelfId": "bookshelfId",
  "name": "新的书架名称"
}
```
> familyId 由服务端从书架记录（bookshelf.familyId）取得，不接收客户端传入。

#### 处理规则
- bookshelfId 必填
- name 必填
- 查询书架，取得 familyId
- 书架必须存在且 `status = ACTIVE`
- 只修改名称，不修改 familyId、sort_order
- 写入 updated_by、updated_at


#### 权限
- 所需权限：`BOOKSHELF_UPDATE`
- 允许角色：ADMIN（系统管理员，拥有全部）、OWNER、MEMBER（GUEST 无此权限）
- 校验方式：服务端经 `checkPermission` 校验；未授权返回 `{ "success": false, "message": "无权限操作" }`

#### 返回
```json
{
  "success": true,
  "bookshelf": {
    "_id": "bookshelfId",
    "familyId": "familyId",
    "name": "新的书架名称",
    "sortOrder": 1,
    "status": "ACTIVE",
    "updatedAt": "datetime"
  }
}
```

---

### C3. api_bookshelf_delete
#### 功能
逻辑删除指定书架。

#### 入参
```json
{
  "bookshelfId": "bookshelfId"
}
```
> familyId 由服务端从书架记录（bookshelf.familyId）取得，不接收客户端传入。

#### 处理规则
- bookshelfId 必填
- 查询书架，取得 familyId
- 书架必须存在且 `status = ACTIVE`
- 删除前检查该书架下是否存在有效在架图书：`book_item.bookshelf_id = bookshelfId` 且 `inventory_status = in_stock` 且 `fg_delete` 不为 true，若存在则拒绝删除
- 若允许删除：更新 `bookshelf.status = DISABLED`，写入 `updated_by`、`updated_at`
- 删除后重排同家庭下剩余 ACTIVE 书架的 sort_order


#### 权限
- 所需权限：`BOOKSHELF_DELETE`
- 允许角色：ADMIN（系统管理员，拥有全部）、OWNER、MEMBER（GUEST 无此权限）
- 校验方式：服务端经 `checkPermission` 校验；未授权返回 `{ "success": false, "message": "无权限操作" }`

#### 返回
**成功：**
```json
{ "success": true }
```

**失败：**
```json
{ "success": false, "message": "该书架下存在在架图书，无法删除" }
```

---

### C4. api_bookshelf_list
#### 功能
查询指定家庭下 ACTIVE 书架列表。

#### 入参
```json
{}
```
> familyId 由服务端从 `user.currentFamilyId` 解析（见 0.4），不接收客户端传入。

#### 处理规则
- 当前用户必须属于该家庭，或为 ADMIN
- 按 sort_order 升序返回
- 默认只返回 `status = ACTIVE`


#### 权限
- 所需权限：`BOOKSHELF_LIST`
- 允许角色：ADMIN（系统管理员，拥有全部）、OWNER、MEMBER、GUEST
- 校验方式：服务端经 `checkPermission` 校验；未授权返回 `{ "success": false, "message": "无权限操作" }`

#### 返回
```json
{
  "success": true,
  "list": [
    {
      "_id": "bookshelfId",
      "familyId": "familyId",
      "name": "我的书架",
      "sortOrder": 1,
      "status": "ACTIVE",
      "bookCount": 100
    }
  ]
}
```
> `bookCount`：在架图书数

---

### C5. api_bookshelf_reorder —— ✅ 已实现
#### 功能
指定家庭下书架的重新排序（sort_order）。客户端传入有序的书架 ID 数组，服务端按数组顺序对当前家庭下**全部 ACTIVE 书架**重排 `sort_order`（从 1 开始递增）。

> **实现状态说明**：`api_bookshelf_reorder` 已实现真实排序逻辑（见 `cloudfunctions/api_bookshelf_reorder/index.js`）；`bookshelfServices.reorder()` 已封装；mine 页「↑ / ↓」按钮点击后交换本地顺序并调用 `reorder` 持久化。

#### 入参
```json
{
  "orderedBookshelfIds": ["bs001", "bs002", "bs003"]
}
```
- `orderedBookshelfIds`：`string[]`，书架 ID 的有序数组。**必须覆盖当前家庭下全部 ACTIVE 书架**，数组顺序即目标排序。
- `familyId` / `operator` 由服务端从登录态解析（`user.current_family_id` 与 openid），不接收客户端传入。

#### 处理规则
1. **参数校验**：`orderedBookshelfIds` 必须为非空数组，否则返回 `{ success: false, message: 'orderedBookshelfIds不能为空' }`。
2. **解析操作人**：经 `getCurrentUser(db, openid)` 反查当前用户与 `current_family_id`；未注册返回 `'用户未注册'`，未选择家庭返回 `'未选择当前家庭'`。
3. **权限校验**：`checkPermission(BOOKSHELF_UPDATE, familyId)`；仅 OWNER / MEMBER 可操作，GUEST 无权限。
4. **查询集合**：拉取当前家庭下 `status: 'ACTIVE'` 的全部书架。
5. **覆盖性校验（三道门槛）**：
   - 数组内不得重复（`inputSet.size !== orderedBookshelfIds.length` → `'书架顺序存在重复'`）；
   - 数组长度须等于 ACTIVE 书架总数（`inputSet.size !== existingIds.length` → `'书架顺序必须覆盖当前家庭全部书架'`）；
   - 每个 ACTIVE 书架 ID 都必须出现在数组中（否则 `'书架顺序包含无效或越权书架'`）。
6. **写入顺序**：按数组顺序逐条 `update`：`sort_order = idx + 1`，并写入 `updated_by`、`updated_at`；以 `Promise.all` 并发写入（云数据库不支持事务批量）。

#### 权限
- 所需权限：`BOOKSHELF_UPDATE`
- 允许角色：ADMIN（系统管理员，拥有全部）、OWNER、MEMBER（GUEST 无此权限）
- 校验方式：服务端经 `checkPermission` 校验；未授权返回 `{ "success": false, "message": "无权限操作" }`

#### 返回
**成功：**
```json
{ "success": true }
```
**失败（示例）：**
```json
{ "success": false, "message": "书架顺序必须覆盖当前家庭全部书架" }
```

---

## D. 手机端操作：书本主数据

### D1. api_bookmeta_getByIsbn
（原 getBookMeta）

#### 功能
按 ISBN 查询系统级主数据。用于：
```
扫码
↓
先查本系统
↓
存在直接使用
```

#### 入参
```json
{
  "isbn": "9787111122334"
}
```

#### 处理规则
（暂无）


#### 权限
- 无（登录态；按 ISBN 查询系统主数据，无家庭资源上下文）

#### 返回
**成功且系统已存在该 ISBN 主数据：**
```json
{
  "success": true,
  "exists": true,
  "book": {
    "isbn": "9787111122334",
    "title": "...",
    "authors": "...",
    "publisher": "...",
    "publishYear": "...",
    "price": "...",
    "binding": "...",
    "isSet": false,
    "setTotalCount": null,
    "coverUrl": "",
    "source": "douban"
  }
}
```

**成功但系统不存在该 ISBN 主数据（正常分支，前端据此转 fetchExternal）：**
```json
{
  "success": true,
  "exists": false
}
```

**失败（ISBN 缺失 / 系统异常）：**
```json
{ "success": false, "message": "ISBN缺失" }
```
```json
{ "success": false, "message": "<err.message>" }
```
> 说明：已统一为 `success` 标志（见 0.4 通用约定、第 5 章错误枚举）。`exists` 仅用于区分"系统已存在 / 不存在"两种**成功**结果（不存在不是错误，是转外部源抓取的正常前置条件），因此仍随 `success: true` 一并返回。原文档的 `{ "exists": false }`（无 `success`）与 D2 的 `{ "success": ... }` 不一致问题已在本次修改中统一——见遗留问题 6。

---

### D2. api_bookmeta_fetchExternal
（原 getBookFromDouban_v2）

#### 功能
从外部数据源抓取书籍信息。

当前：豆瓣 HTML 解析。
未来：豆瓣、OpenLibrary、Google Books、国家图书馆，都可以统一挂到这里。

#### 入参
```json
{
  "isbn": "9787111122334"
}
```

#### 处理规则
（暂无）


#### 权限
- 无（登录态；从外部数据源抓取书籍信息）

#### 返回
```json
{
  "success": true,
  "book": {
    "isbn": "9787111122334",
    "title": "...",
    "authors": "...",
    "publisher": "...",
    "publishYear": "...",
    "price": "...",
    "binding": "...",
    "isSet": false,
    "setTotalCount": null,
    "coverUrl": "",
    "source": "douban"
  }
}
```
> 失败返回：`{ "success": false, "error": "..." }` 或 `{ "success": false, "message": "ISBN missing" }`。封面 `coverUrl` 因豆瓣版权保护通常为空，需用户拍摄上传补全。

---

## E. 手机端操作：实体书本上下架

### E1. api_bookitem_prepareCreate
（原 prepareInStock）

#### 功能
上架前预检查：book_meta 是否存在、当前家庭是否已存在同书、套装序号是否冲突。用于：
```
扫码ISBN
↓
调用prepareCreate
↓
决定是否需要用户确认
↓
进入确认页
```

#### 入参
```json
{
  "isbn": "9787111122334",
  "book": {
    "isbn": "9787111122334",
    "setIndex": 1
  }
}
```
> familyId 由服务端从 `user.currentFamilyId` 解析（见 0.4），不接收客户端传入。

#### 处理规则
（暂无）


#### 权限
- 所需权限：`BOOKITEM_CREATE`
- 允许角色：ADMIN（系统管理员，拥有全部）、OWNER、MEMBER（GUEST 无此权限）
- 校验方式：服务端经 `checkPermission` 校验；未授权返回 `{ "success": false, "message": "无权限操作" }`

#### 返回
```json
{
  "success": true,
  "metaExists": true,
  "bookMetaId": "xxx",
  "isSet": true,
  "existingItemCount": 3,
  "needUserConfirm": true,
  "duplicateType": "set_conflict"
}
```

---

### E2. api_bookitem_create
（原 commitInStock）

#### 功能
正式执行上架。

包含：
- 自动创建 book_meta（不存在时）
- 创建 book_item
- 写库存日志

#### 入参
```json
{
  "isbn": "9787111122334",
  "bookshelfId": "bs001",
  "editionType": "original",
  "book": {
    "title": "...",
    "authors": "...",
    "publisher": "...",
    "publishYear": "...",
    "price": "...",
    "binding": "...",
    "coverUrl": "",
    "isSet": false,
    "setTotalCount": null,
    "source": ""
  }
}
```
> familyId 与 operator 由服务端从登录态解析（见 0.4），**不接收客户端传入**。原文档入参中的 `familyId`、`operator` 已移除。

#### 处理规则
- 当前用户须已注册且 `status = ACTIVE`
- familyId 取自 `user.currentFamilyId`（缺失返回"未选择当前家庭"）


#### 权限
- 所需权限：`BOOKITEM_CREATE`
- 允许角色：ADMIN（系统管理员，拥有全部）、OWNER、MEMBER（GUEST 无此权限）
- 校验方式：服务端经 `checkPermission` 校验；未授权返回 `{ "success": false, "message": "无权限操作" }`

#### 返回
```json
{
  "success": true,
  "bookItem": {
    "_id": "bi00001",
    "familyId": "familyId",
    "bookshelfId": "bs001",
    "bookMetaId": "bm00001",
    "setIndex": null,
    "editionType": "original",
    "inventoryStatus": "in_stock",
    "rfidTid": null,
    "fgDelete": false,
    "createdAt": "datetime",
    "onShelfAt": "datetime",
    "updatedAt": "datetime"
  }
}
```
> 返回完整 bookItem 实体对象（camelCase），而非仅仅 bookItemId。
> 三时间字段语义见 0.4 通用约定「库存时间字段」。本接口写入：`createdAt`（记录创建，仅此一次）、`onShelfAt`（上架时间，本次写入）、`updatedAt`（本次写入）。

---

### E3. api_bookitem_offstock
（原 offBookItem）

#### 功能
执行下架。

包含：
- 状态校验（仅 `in_stock` 可下架）
- 更新 book_item.inventory_status = off_stock
- 写库存日志

#### 入参
```json
{
  "itemId": "xxx",
  "reason": "捐赠"
}
```
> familyId 与 operator 由服务端从登录态解析（见 0.4），**不接收客户端传入**。原文档入参中的 `family_id`、`operator` 已移除。
> 注：本接口入参字段已统一为 camelCase `itemId`（与 api_bookitem_get / updateBookshelf 一致，见 0.2 命名统一专项）。

#### 处理规则
- 当前用户须已注册且 `status = ACTIVE`
- `item.inventory_status !== 'in_stock'` 时抛错拒绝
- 仅刷新 `updated_at`；**不改动** `on_shelf_at`（下架不改变"上架时间"语义）


#### 权限
- 所需权限：`BOOKITEM_OFFSTOCK`
- 允许角色：ADMIN（系统管理员，拥有全部）、OWNER、MEMBER（GUEST 无此权限）
- 校验方式：服务端经 `checkPermission` 校验；未授权返回 `{ "success": false, "message": "无权限操作" }`

#### 返回
```json
{ "success": true }
```

---

### E4. api_bookitem_restock
（原 onBookItem）

#### 功能
重新上架已下架书籍。

包含：
- 状态校验（仅 `off_stock` 且 `fg_delete = false` 可重新上架）
- 恢复 `inventory_status = in_stock`
- 写库存日志（`reason: '重新上架'`）

#### 入参
```json
{
  "itemId": "xxx"
}
```
> familyId 与 operator 由服务端从登录态解析（见 0.4），**不接收客户端传入**。原文档入参中的 `family_id`、`operator` 已移除。
> 注：本接口入参字段已统一为 camelCase `itemId`（与 api_bookitem_get / updateBookshelf 一致，见 0.2 命名统一专项）。

#### 处理规则
- 当前用户须已注册且 `status = ACTIVE`
- `item.inventory_status !== 'off_stock'` 时抛错拒绝
- 恢复 `inventory_status = in_stock`，并**刷新 `on_shelf_at`（上架时间）与 `updated_at`**；**不改动 `created_at`**（记录创建时间保持初次上架时的值）
  > 由此修复"重新上架导致'最近上架'列表重排"的历史问题（见"六、遗留问题"第 5 条）：重新上架现在只更新"上架时间 `on_shelf_at`"，`created_at` 不被刷新。


#### 权限
- 所需权限：`BOOKITEM_RESTOCK`
- 允许角色：ADMIN（系统管理员，拥有全部）、OWNER、MEMBER（GUEST 无此权限）
- 校验方式：服务端经 `checkPermission` 校验；未授权返回 `{ "success": false, "message": "无权限操作" }`

#### 返回
```json
{ "success": true }
```

> 历史行为（已废弃）：旧代码在重新上架时会刷新 `created_at` 为当前时间，导致"最近上架"列表把重新上架的书排到最前。现按"库存时间字段"语义拆分为刷新 `on_shelf_at` + `updated_at`，`created_at` 保持首次上架值。

---

### E5. api_bookitem_delete
（原 deleteBookItem）

#### 功能
逻辑删除（彻底删除）。

执行：`fg_delete = false` → `true`。
前提：`inventory_status = off_stock`（禁止 `in_stock → fg_delete = true`）。

#### 入参
```json
{
  "itemId": "xxx"
}
```
> familyId 与 operator 由服务端从登录态解析（见 0.4），**不接收客户端传入**。原文档入参中的 `family_id`、`operator` 已移除。
> 注：本接口入参字段已统一为 camelCase `itemId`（与 api_bookitem_get / updateBookshelf 一致，见 0.2 命名统一专项）。

#### 处理规则
- 当前用户须已注册且 `status = ACTIVE`
- 校验 `item.inventory_status === 'off_stock'`，否则拒绝
- 仅刷新 `updated_at`；**不改动** `on_shelf_at`


#### 权限
- 所需权限：`BOOKITEM_DELETE`
- 允许角色：ADMIN（系统管理员，拥有全部）、OWNER、MEMBER（GUEST 无此权限）
- 校验方式：服务端经 `checkPermission` 校验；未授权返回 `{ "success": false, "message": "无权限操作" }`

#### 返回
```json
{ "success": true }
```

---

### E6. api_bookitem_get
（原 getBookItem）

> 需研究：该函数被 `async loadFromId(itemId)` 调用，但 `loadFromId` 没有被任何地方调用。接口已实现但当前无调用方，待确认是否保留或接入页面。

#### 功能
根据实体书 ID（`itemId`）获取实体书详情。

自动关联 book_item + book_meta + bookshelf，返回完整展示对象（三层结构）。

#### 入参
```json
{
  "itemId": "xxx"
}
```
> 注：本接口入参字段为 camelCase `itemId`，与 E3/E4/E5 已统一（见 0.2 命名统一专项）。

#### 处理规则
（暂无）


#### 权限
- 所需权限：`BOOKITEM_SEARCH`
- 允许角色：ADMIN（系统管理员，拥有全部）、OWNER、MEMBER、GUEST
- 校验方式：服务端经 `checkPermission` 校验；未授权返回 `{ "success": false, "message": "无权限操作" }`

#### 返回
```json
{
  "success": true,
  "bookItem": {
    "_id": "bi00001",
    "familyId": "familyId",
    "bookshelfId": "bs001",
    "bookMetaId": "bm00001",
    "setIndex": null,
    "editionType": "original",
    "inventoryStatus": "in_stock",
    "rfidTid": null,
    "fgDelete": false,
    "createdAt": "datetime",
    "onShelfAt": "datetime",
    "updatedAt": "datetime"
  },
  "bookMeta": {
    "_id": "bm00001",
    "isbn": "9787111122334",
    "title": "...",
    "authors": "...",
    "publisher": "...",
    "publishYear": "...",
    "price": "...",
    "binding": "...",
    "coverUrl": "",
    "isSet": false,
    "setTotalCount": 0,
    "source": "douban"
  },
  "bookshelf": {
    "_id": "bs001",
    "familyId": "familyId",
    "name": "我的书架",
    "sortOrder": 1,
    "status": "ACTIVE"
  }
}
```
> book_meta / bookshelf 不存在时对应字段为 null（容错），不抛错。

---

### E7. api_bookitem_updateBookshelf
#### 功能
修改指定实体书所在书架（移动图书）。

#### 入参
```json
{
  "itemId": "xxx",
  "bookshelfId": "bookshelfId"
}
```
> familyId 与 operator 由服务端从登录态解析（见 0.4），**不接收客户端传入**。原文档入参中的 `familyId`、`operator` 已移除。

#### 处理规则
- familyId 取自 `user.currentFamilyId`
- 仅刷新 `updated_at`（书架变更不改变"上架时间"，故 `on_shelf_at` 不改动）


#### 权限
- 所需权限：`BOOKITEM_UPDATE`
- 允许角色：ADMIN（系统管理员，拥有全部）、OWNER、MEMBER（GUEST 无此权限）
- 校验方式：服务端经 `checkPermission` 校验；未授权返回 `{ "success": false, "message": "无权限操作" }`

#### 返回
**成功：**
```json
{
  "success": true,
  "bookshelfName": "..."
}
```

**失败：**
```json
{ "success": false, "message": "itemId不能为空" }
```
```json
{ "success": false, "message": "bookshelfId不能为空" }
```
```json
{ "success": false, "message": "目标书架不存在或已失效" }
```
```json
{ "success": false, "message": "目标书架不属于当前家庭" }
```
```json
{ "success": false, "message": "书籍不存在或已删除" }
```
```json
{ "success": false, "message": "书架未变更" }
```

---

## F. 手机端操作：书本检索

### F1. api_book_search
（原 searchBooks）

#### 功能
图书检索。

支持：
- ISBN 精确筛选（与 Keyword 取交集 `_.and`）
- Keyword 模糊筛选
  - 标题模糊
  - 作者模糊
- bookshelfId：书架筛选
- 状态筛选：上架、下架
- 时间筛选：上架期间
- 分页

#### 入参
```json
{
  "keyword": "三体",
  "isbn": "9787111122334",
  "bookshelfId": "bs001",
  "status": "in_stock",
  "startDate": "2026-01-01",
  "endDate": "2026-06-30",
  "page": 1,
  "pageSize": 20
}
```
> familyId 由服务端从 `user.currentFamilyId` 解析（见 0.4），不接收客户端传入。
> `isbn`、`bookshelfId` 为原文档遗漏的参数，已补录。

#### 处理规则
- 默认 `status = in_stock`、默认 `pageSize = 10`、按 `on_shelf_at` 倒序（上架时间，非记录创建时间）
- `isbn` 与 `keyword` 取交集（`_.and`）


#### 权限
- 所需权限：`BOOKITEM_SEARCH`
- 允许角色：ADMIN（系统管理员，拥有全部）、OWNER、MEMBER、GUEST
- 校验方式：服务端经 `checkPermission` 校验；未授权返回 `{ "success": false, "message": "无权限操作" }`

#### 返回
```json
{
  "success": true,
  "data": [
    {
      "itemId": "bi00001",
      "familyId": "familyId",
      "bookshelfId": "bs001",
      "bookshelfName": "我的书架",
      "status": "in_stock",
      "onShelfAt": "datetime",
      "rfidTid": null,
      "title": "三体",
      "authors": "...",
      "coverUrl": "",
      "isbn": "9787111122334",
      "price": "...",
      "publisher": "...",
      "publishYear": "...",
      "binding": "...",
      "isSet": false,
      "setTotalCount": 0
    }
  ],
  "total": 56
}
```

---

### F2. api_book_searchRecent
（原 getRecentBooks / api_recentbook_search）

#### 功能
首页最近上架书籍。

规则：
- `inventory_status = in_stock`
- `fg_delete = false`
- 按 `on_shelf_at` 倒序（上架时间，非记录创建时间）
- 最多 5 条

#### 入参
```json
{}
```
> familyId 由服务端从 `user.currentFamilyId` 解析（见 0.4），不接收客户端传入。

#### 处理规则
- 当前用户须已注册且 `status = ACTIVE`
- familyId 取自 `user.currentFamilyId`（缺失返回"未选择当前家庭"）
- 关联 book_meta 拼装展示字段


#### 权限
- 所需权限：`RECENTBOOK_SEARCH`
- 允许角色：ADMIN（系统管理员，拥有全部）、OWNER、MEMBER、GUEST
- 校验方式：服务端经 `checkPermission` 校验；未授权返回 `{ "success": false, "message": "无权限操作" }`

#### 返回
```json
{
  "success": true,
  "list": [
    {
      "itemId": "bi00001",
      "familyId": "familyId",
      "bookMetaId": "bm00001",
      "title": "三体",
      "authors": "...",
      "coverUrl": "",
      "publisher": "...",
      "publishYear": "...",
      "price": "...",
      "binding": "...",
      "isbn": "9787111122334",
      "isSet": false,
      "setTotalCount": 0,
      "setIndex": null,
      "inventoryStatus": "in_stock",
      "rfidTid": null,
      "onShelfAt": "datetime",
      "inStockStatus": "in_stock"
    }
  ]
}
```
> 无数据时返回 `{ "success": true, "list": [] }`；异常返回 `{ "success": false, "error": "..." }`。

---

## G. 手机端操作：任务创建

### G1. api_task_createBindRfid —— ✅ 已实现
#### 功能
创建 RFID 绑定任务。用于：
```
图书检索页
↓
点击【绑定RFID】
↓
创建 bind_rfid 任务
↓
PDA 后续轮询获取
```

> **实现状态说明**：`api_task_createBindRfid` 已实现真实创建逻辑（写入 `device_task`，状态 `pending`）。

#### 入参（规划）
```json
{
  "bookItemId": "bi00001"
}
```
> created_by / operator 由服务端从登录态解析，不接收客户端传入。

#### 处理规则（已实现）
（暂无）


#### 权限
- 解析当前用户与 `current_family_id`；校验 `RFID_TASK_CREATE_BIND` 权限。
- 校验 `bookItemId` 对应 `book_item` 存在、`fg_delete=false` 且 `inventory_status=in_stock`（下架书不可发起）。
- 向 `device_task` 写入 `{ task_type:'bind_rfid', book_item_id, status:'pending', created_by, created_at }`；返回 `{ success:true, task:{ taskId, taskType, bookItemId, status:'pending' } }`。

#### 权限
- 所需权限：`RFID_TASK_CREATE_BIND`
- 允许角色：ADMIN（系统管理员，拥有全部）、OWNER、MEMBER（GUEST 无此权限）
- 校验方式：服务端经 `checkPermission` 校验；未授权返回 `{ "success": false, "message": "无权限操作" }`

#### 返回（规划）
```json
{
  "success": true,
  "task": { "...": "..." }
}
```
> 返回 task 对象，而非仅仅 taskId。

---

### G2. api_task_createFindBook —— ✅ 已实现
#### 功能
创建寻书任务。用于：
```
图书详情页
↓
点击【寻找图书】
↓
创建 find_book 任务
↓
PDA 后续执行
```

> **实现状态说明**：`api_task_createFindBook` 已实现真实创建逻辑（写入 `device_task`，`target_tid` 取图书已绑标签；未绑 RFID 拒绝）。

#### 入参（规划）
```json
{
  "bookItemId": "bi00001"
}
```
> operator 由服务端从登录态解析，不接收客户端传入。

#### 处理规则（已实现）
（暂无）


#### 权限
- 解析当前用户与 `current_family_id`；校验 `RFID_TASK_CREATE_FIND` 权限。
- 校验 `bookItemId` 对应 `book_item` 存在、在架、未删除；**未绑定 RFID（`rfid_tid` 为空）则拒绝**（设计：未绑标签不可寻书）。
- 向 `device_task` 写入 `{ task_type:'find_book', book_item_id, target_tid: book_item.rfid_tid, status:'pending', created_by, created_at }`；返回 `{ success:true, taskId }`。

#### 权限
- 所需权限：`RFID_TASK_CREATE_FIND`
- 允许角色：ADMIN（系统管理员，拥有全部）、OWNER、MEMBER（GUEST 无此权限）
- 校验方式：服务端经 `checkPermission` 校验；未授权返回 `{ "success": false, "message": "无权限操作" }`

#### 返回（规划）
```json
{
  "success": true,
  "taskId": "task00002"
}
```

---

### G3. api_task_getBindStatus —— ✅ 已实现
#### 功能
查询图书 RFID 绑定任务状态（轻量读接口）。用于：
```
图书详情页 / 检索列表页
↓
渲染「绑定中… / 重新绑定中…」状态
↓
避免列表逐条发起查询
```

> **实现状态说明**：`api_task_getBindStatus` 已实现真实查询逻辑（按 `book_item_id` + `task_type='bind_rfid'` + `status ∈ [pending, running]` 判定 `inProgress`，一次批量返回映射）。

#### 入参（规划）
```json
{
  "bookItemId": "bi00001"        // 单查（详情页）
}
```
```json
{
  "bookItemIds": ["bi00001", "bi00002"]   // 批量（列表页，一次查询）
}
```
> `bookItemId` 与 `bookItemIds` 二选一；前端不传 `familyId` / `operator`，由服务端按登录态解析当前家庭。
> 注意：列表页应传 `bookItemIds[]` 批量查询，**严禁列表逐条调用**，以免产生 N 次云函数请求。

#### 处理规则（已实现）
1. 反查当前用户与 `current_family_id`；未登录 / 未选家庭返回失败。
2. **归属校验**：先按 `_id in bookItemIds AND family_id = 当前家庭 AND fg_delete=false` 过滤，仅对归属本家庭的 `book_item_id` 继续查询（防止越权探测其它家庭的 RFID 绑定状态；`device_task` 无 `family_id` 字段，故需经 `book_item` 反查）。
3. 查询 `device_task`：`book_item_id in 允许的 id AND task_type='bind_rfid'`。
4. 归并状态：该图书存在 `status ∈ [pending, running]` 的任务则 `inProgress=true`，`status` 取进行中任务状态（running 优先于 pending）；无进行中时 `status` 取最新任务状态或 `null`。
5. 返回 `{ [itemId]: { inProgress, status } }` 映射（包含请求的全部 id，未授权 / 不存在的 id 占位为 `{ inProgress:false, status:null }`，便于前端直接按 id 取用）。
6. `in` 查询按每批 100 拆分，避免微信云数据库数组长度约束。

> **容错说明（健壮性）**：本接口对 `device_task` 的查询包裹了 `try/catch`。若 `device_task` 集合尚未创建（云端报 `-502005 database collection not exists`），接口**不抛错**、降级为「全部 `inProgress:false`」并返回 `success:true`，使详情页 / 列表页仍能按 `rfid_tid` 正常渲染「已绑定 / 未绑定」按钮，仅「绑定中…」态暂不显示。请见 §4.5 用 `script_init_collections` 补齐缺失集合。

#### 权限
- 仅需登录且已选择当前家庭（本接口为只读查询，不要求 `RFID_TASK_CREATE_BIND` / `RFID_UNBIND`；GUEST 也可读取，用于展示进行中态）。
- 越权探测通过「归属校验」拦截：非本家庭的 `book_item_id` 一律返回 `{ inProgress:false, status:null }`。

#### 返回（规划）
```json
{
  "success": true,
  "map": {
    "bi00001": { "inProgress": true, "status": "pending" },
    "bi00002": { "inProgress": false, "status": null }
  }
}
```

---

## H. 手机端操作：任务执行

### H1. api_task_unbindRfid —— ✅ 已实现
#### 功能
主动解绑 RFID。

当前版本虽然业务中未出现入口，但未来（图书详情 → 解绑 RFID）大概率会需要，建议现在预留。

> **实现状态说明**：`api_task_unbindRfid` 已实现真实解绑逻辑（事务清空 `rfid_tid` + 写 `rfid_bind_log`）。
> 注：架构表原用名 `api_rfid_unbind`，已与代码实现名 `api_task_unbindRfid` 对齐。

#### 入参（规划）
```json
{
  "bookItemId": "bi00001"
}
```
> operator 由服务端从登录态解析，不接收客户端传入。原文档入参写作 `{ "bookItemId", "operator"" }`（非法 JSON），已修正。

#### 处理规则（已实现）
（暂无）


#### 权限
- 解析当前用户与 `current_family_id`；校验 `RFID_UNBIND` 权限（OWNER；MEMBER/GUEST 无）。
- 校验 `book_item` 存在、未删除；`rfid_tid` 为空则提示未绑定。
- **事务**：置 `book_item.rfid_tid=null` + `updated_at`；写 `rfid_bind_log`（`action_type:'unbind'`，`old_tid=原标签`，`new_tid`/`task_id` 不适用写 `null`，`operator=user._id`）。提交失败回滚。

#### 权限
- 所需权限：`RFID_UNBIND`
- 允许角色：ADMIN（系统管理员，拥有全部）、OWNER（MEMBER、GUEST 无此权限）
- 校验方式：服务端经 `checkPermission` 校验；未授权返回 `{ "success": false, "message": "无权限操作" }`

#### 返回（规划）
```json
{ "success": true }
```

---

## J. PDA操作：任务执行

### J1. api_task_accept —— ✅ 已实现
（原 api_task_claim）

#### 功能
PDA 领取待执行任务。

规则：
- 仅 PDA 调用
- 从 pending / running 中按创建时间排序
- 返回一个任务
- 返回后立即更新状态为 running

对应设计文档：
```
PDA无任务
↓
api_task_accept
↓
获得任务
↓
running
```

> **实现状态说明**：`api_task_accept` 已实现真实领取逻辑（pending/running 升序取 1 条置 running）；并在领取时经 `book_item → book_meta` 关联返回 `isbn` / `title` / `authors` 展示字段（`device_task` 不冗余存储展示字段，见数据库表结构设计 §3.9）。

#### 入参（规划）
```json
{
  "deviceId": "pda001"
}
```

#### 处理规则（已实现）
（暂无）


#### 权限
- 无家庭 / 角色校验（PDA 专用）。
- 从 `device_task` 取 `status in ['pending','running']` 按 `created_at` 升序 1 条；置 `status:'running'`、`claimed_by_device=deviceId`、`claimed_at`。
- **展示字段实时关联**：`device_task` 仅存调度字段（`book_item_id` / `target_tid`），不冗余保存 ISBN / 书名 / 作者。领取后由本接口经 `book_item.book_meta_id → book_meta` 反查拼装 `isbn` / `title` / `authors`，随任务一并返回（供 PDA 直接显示并校验 ISBN）。任一关联缺失或异常均降级为空字符串，不影响领取主流程。
- 返回 `{ success:true, task:{ taskId, taskType, bookItemId, targetTid, isbn, title, authors } }`，无任务返回 `{ success:true, task:null }`。

#### 权限
- 无（PDA 专用；按 deviceId 领取待执行任务，不做家庭角色校验）

#### 返回（规划）
**有任务：**
```json
{
  "success": true,
  "task": {
    "taskId": "task00001",
    "taskType": "bind_rfid",
    "bookItemId": "bi00001",
    "targetTid": "",
    "isbn": "9787111122334",
    "title": "三体",
    "authors": "刘慈欣"
  }
}
```

**无任务：**
```json
{
  "success": true,
  "task": null
}
```

---

### J2. api_task_complete —— ✅ 已实现
#### 功能
提交任务执行结果。适用于：bind_rfid、find_book。

> **实现状态说明**：`api_task_complete` 已实现真实提交逻辑（更新任务最终状态 / 结果）。

#### 入参（规划）
```json
{
  "taskId": "task00001",
  "status": "success",
  "result": {
    "message": "completed"
  }
}
```

#### 处理规则（已实现）
（暂无）


#### 权限
- 无家庭 / 角色校验（PDA 专用）。
- `status` 须为 `success`/`failed`，否则拒绝；更新 `device_task` 的 `status`/`result`/`completed_at`。
- 注：bind_rfid 的实际绑定 / 解绑由 **J4（api_task_bindRfid）** 执行；本接口只记录任务最终状态。

#### 权限
- 无（PDA 专用；提交任务执行结果）

#### 返回（规划）
```json
{ "success": true }
```

---

### J3. api_task_getRfidBindingInfo —— ✅ 已实现
#### 功能
绑定流程真正执行业务逻辑的部分。根据 RFID TID 查询当前绑定状态，用于 PDA 扫描标签后确认。流程：
```
扫描TID
↓
查询当前是否已绑定
↓
显示旧书信息
↓
用户确认是否解绑
```

> **实现状态说明**：`api_task_getRfidBindingInfo` 已实现真实查询逻辑（按 `rfid_tid` 反查占用图书）。
> 注：架构表原用名 `api_rfid_getBindingInfo`，已与代码实现名 `api_task_getRfidBindingInfo` 对齐。

#### 入参（规划）
```json
{
  "tid": "E280699500000001"
}
```

#### 处理规则（已实现）
（暂无）


#### 权限
- 无家庭 / 角色校验（PDA 专用）。
- 按 `rfid_tid=tid` 且 `fg_delete=false` 查 `book_item`；命中则关联 `book_meta` 取 `title`/`isbn`，返回 `{ success:true, bound:true, book:{ bookItemId, title, isbn } }`；未命中返回 `{ success:true, bound:false }`。

#### 权限
- 无（PDA 专用；按 RFID TID 查询绑定状态）

#### 返回（规划，未绑定）
```json
{
  "success": true,
  "bound": false
}
```

#### 返回（规划，已绑定）
```json
{
  "success": true,
  "bound": true,
  "book": {
    "bookItemId": "bi00002",
    "title": "三体",
    "isbn": "9787536692930"
  }
}
```

---

### J4. api_task_bindRfid —— ✅ 已实现
#### 功能
执行 RFID 绑定（核心接口）。

实现场景 A / 场景 B / 场景 C / 场景 D 全部统一处理。内部负责：
- book1 旧标签解绑
- tid 旧书解绑
- book1 绑定 tid
- 写 rfid_bind_log

无需 PDA 自己判断。

> **实现状态说明**：`api_task_bindRfid` 已实现真实绑定逻辑（事务处理 4 种绑定场景 A/B/C/D + 写 `rfid_bind_log`）。
> 注：架构表原用名 `api_rfid_bind`，已与代码实现名 `api_task_bindRfid` 对齐。

#### 入参（规划）
```json
{
  "bookItemId": "bi00001",
  "tid": "E280699500000001"
}
```
> operator 由服务端从登录态解析，不接收客户端传入。

#### 处理规则（已实现）
（暂无）


#### 权限
- 无家庭 / 角色校验（PDA 专用）。
- 解析 `taskId`（未传则按 `book_item_id` 反查进行中 `bind_rfid` 任务）；`operator` 取入参 `deviceId`，其次用关联任务的领取设备 `claimed_by_device`，均取不到时固定串 `"PDA"`（PDA 无微信登录态，不得使用 `user._id`）。`task_id` 可选（无关联任务为 `null`）。
- 查目标 `book1`（须未删除）与占用 `tid` 的其它书 `book2`；**事务**内：必要时解绑 `book2` → 绑定 `book1.rfid_tid=tid` → 写 `rfid_bind_log`（`action_type` 视是否涉及旧书/旧标签取 `rebind` 或 `bind`；`new_tid` 为本次标签、`old_book_item_id`/`old_tid` 不适用写 `null`）。返回 `{ success:true, action:'bind'|'rebind' }`；失败回滚。对应设计 4 场景 A/B/C/D。

#### 权限
- 无（PDA 专用；执行 RFID 绑定）

#### 返回（规划）
```json
{
  "success": true,
  "action": "rebind"
}
```
> action：`bind` / `rebind`

---

# 4. 一次性数据迁移工具（script_data_migration）

> **性质：临时工具，非业务接口。** 本云函数**不在**第 1 章「API 整体清单」中，因为它不是面向手机端 / PDA 的业务接口，而是运维期用于调整数据库表结构（改字段名、增减字段、迁移历史数据）的一次性脚本。

## 4.1 用途
将线上历史数据对齐到最新设计文档（`家庭图书管理系统数据库表结构设计.md`），消除「代码 / 设计 / 历史数据」三方字段差异。代码逻辑根据临时迁移目标而不断变化，此处不做逻辑说明。

## 4.2 幂等性与安全性
- **幂等**：仅处理「仍含旧字段」的记录（`_.exists(true)`）；已迁移记录因旧字段被删除而不再命中，可**重复执行**、安全不报错。
- **分批**：每批 `BATCH_SIZE = 100`，按 `while` 循环推进；集合规模变化或超时后可再次执行，断点续跑。
- **仅运维**：不接收任何业务入参，不依赖家庭角色；仅由管理员在云端测试手动触发。

## 4.3 使用方式（部署新代码前必做）
1. 在微信开发者工具中右键部署 `script_data_migration`（上传并部署：云端安装依赖）。
2. 右键 → 云端测试，测试参数输入 `{}`，点击运行测试。
3. 如遇超时，请在云开发控制台把云函数超时时间调到 20 秒以上，再执行一次（幂等，可重复）。
4. 返回 `success: true` 且 `stats.errors` 为空，即迁移完成。

## 4.4 重要提醒
- **需要数据迁移前必须先成功执行一次**，否则读写新字段的api函数会运行错误
- 执行后应**及时下架 / 不再调用**本函数；它属于一次性迁移工具，不应保留在常态调用链路中。
- 如后续又有表结构变更，可改写本函数（保留幂等与分批模式）后再次执行。

---

# 4.5 一次性集合初始化工具（script_init_collections）

> **性质：临时工具，非业务接口。** 本云函数**不在**第 1 章「API 整体清单」中。用于首次部署 / 环境重建时补齐 RFID 任务链路所需的云数据库集合。

## 4.5.1 背景
经核查，RFID 任务链路依赖以下集合，但仓库此前**没有任何建集合脚本**（仅有 `script_data_migration` 做字段迁移、不创建集合）。首次部署后云端缺少这些集合，会导致相关云函数调用失败（典型报错 `-502005 database collection not exists: device_task`）。

| 集合 | 依赖该集合的云函数 |
| --- | --- |
| `device_task` | `api_task_createBindRfid`、`api_task_createFindBook`、`api_task_accept`、`api_task_complete`、`api_task_bindRfid`、`api_task_getBindStatus` |
| `rfid_bind_log` | `api_task_bindRfid`、`api_task_unbindRfid` |

## 4.5.2 幂等性与安全性
- **幂等**：集合已存在时 `db.createCollection` 会抛「已存在」错误（`errCode -502003`），本函数捕获后视为成功，**可重复执行**、安全不报错。
- **仅运维**：不接收任何业务入参，不依赖家庭角色；仅由管理员在云端测试手动触发。

## 4.5.3 使用方式（部署新代码前必做）
1. 在微信开发者工具中右键部署 `script_init_collections`（上传并部署：云端安装依赖）。
2. 右键 → 云端测试，测试参数输入 `{}`，点击运行测试。
3. 返回 `success: true` 即表示 `device_task` / `rfid_bind_log` 已就绪（已存在也会返回成功）。
4. 执行后本函数可保留，建议与 `script_data_migration` 同样仅在运维期调用。

> 注：本函数仅创建空集合。若后续需要为 `device_task.book_item_id`、`rfid_bind_log.book_item_id` 等字段建索引以提升查询性能，可在云开发控制台手动创建。

---

# 5. 通用错误返回规范（错误枚举）

## 5.1 统一返回结构

> 与 0.1 通用约定一致：所有接口**成功**统一含 `success: true`；**失败**统一含 `success: false` 与 `message`（人类可读信息）。

**成功：**
```json
{ "success": true, "...": "..." }
```

**失败（通用）：**
```json
{ "success": false, "message": "<人类可读错误描述>" }
```

## 5.2 失败原因枚举（reason）

登录态与权限校验统一由 `_shared/permission.js` 的 `checkPermission` 完成。该校验对每个失败场景给定一个 `reason` 枚举值（机器可读），便于前端 / 上层按类型分支、埋点、国际化。

> **现状（待系统化，即遗留问题 5.2）**：当前真实云函数在 `checkPermission` 返回 `allowed: false` 时，仅透传 `perm.message`（`return { success: false, message: perm.message }`），**未将 `reason` 透出到接口响应**。因此 `reason` 目前是"代码内部已实现、接口层面未暴露"的状态。建议后续在失败响应中统一补充 `reason` 字段：
> ```json
> { "success": false, "message": "<错误信息>", "reason": "PERMISSION_DENIED" }
> ```

### reason 枚举表

| reason | message（当前实际文案） | 触发场景 | 建议前端动作 |
|--------|----------------------|---------|------------|
| `MISSING_DB` | 缺少数据库对象 | 云函数初始化未注入数据库对象（内部错误） | 提示"系统异常"，上报监控 |
| `MISSING_PERMISSION` | 缺少权限定义 | 调用 `checkPermission` 时未传入 `permission`（开发期错误） | 提示"系统异常"，上报监控 |
| `USER_NOT_FOUND` | 用户未注册 | `openid` 查不到 user（未注册 / 已删除） | 引导走注册流程 |
| `USER_DISABLED` | 用户状态不可用 | `user.status !== 'ACTIVE'` | 提示"账号不可用" |
| `MISSING_FAMILY_ID` | 缺少家庭ID | 需要家庭上下文但无法解析出 `familyId` | 提示"请先选择家庭" |
| `NOT_FAMILY_MEMBER` | 用户不属于该家庭 | 目标家庭无该用户的 `user_family` 关系 | 提示"无该家庭权限" |
| `PERMISSION_DENIED` | 无权限操作 | 角色 / 权限不满足 `hasPermission` | 提示"无操作权限" |

> 说明：上表 `message` 文案取自 `_shared/permission.js` 当前实现，属服务端文案。若前端做国际化，应以 `reason` 为 key 做映射，而非依赖 `message` 文本。

## 5.3 其他失败返回约定

- **参数校验失败**：接口在调用 `checkPermission` 前自行校验入参（如必填项为空），直接返回 `{ success: false, message: "<具体字段>不能为空" }`，不进入 `checkPermission`，因此无 `reason`。
- **业务规则拒绝**：如"书架下存在在架图书，无法删除""当前家庭已存在有效书架"等，返回 `{ success: false, message: "<业务提示>" }`；如需细分，可补充业务级 `reason`（建议后续扩展，如 `SHELF_NOT_EMPTY` 等）。
- **系统异常**：`try/catch` 捕获后返回 `{ success: false, message: "<err.message>" }`（老接口写法为 `{ success: false, "error": "..." }`，建议统一为 `message`）。
- **特殊成功分支**：`api_bookmeta_getByIsbn` 的 `{ success: true, exists: false }` 属"调用成功但系统内无此书"的**正常成功**结果（非失败），用于驱动前端转外部源抓取，不应视为错误。

## 5.4 推荐（系统化）目标结构

```json
// 失败（系统化后）
{
  "success": false,
  "message": "无权限操作",
  "reason": "PERMISSION_DENIED"
}
```

```json
// 成功
{
  "success": true,
  "...业务字段": "..."
}
```

> **推进建议**：在 `checkPermission` 的调用封装处（或新增 `fail(reason)` 辅助函数）统一把 `reason` + `message` 包成 `{ success: false, message, reason }`，避免各接口散落 `return { success: false, message }`，从而把遗留问题 3 的"错误枚举"真正落到接口契约层。

---


# 6. 遗留问题

1. **通用失败返回 / 错误枚举未系统化**：权限校验经 `checkPermission` 统一产出 `reason` 错误枚举（见 `_shared/permission.js`），但当前真实云函数仅把 `message` 透传给前端、**未透传 `reason`**（见各接口"返回-失败"示例）。已新增第 5 章《通用错误返回规范（错误枚举）》集中说明推荐结构与枚举表；后续统一在失败响应中补充 `reason` 字段，使前端可按错误类型分支。

---