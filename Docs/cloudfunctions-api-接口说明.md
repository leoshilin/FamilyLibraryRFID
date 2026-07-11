# Cloudfunctions API 接口说明文档

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

## 0.2 命名统一专项（API / 前端实体层，已完成）

> 范围：API 入参 / 返回（前端实体）全链路 camelCase；数据库内部字段保持 snake_case。

### 已完成内容
- **API 入参统一为 camelCase**：`itemId`（offstock / restock / delete / get / updateBookshelf 跨接口一致，不再混用 `item_id`）、`familyId`、`bookshelfId`、`coverUrl`、`bookMetaId` 等。
- **API 返回统一为 camelCase**：`createdAt` / `updatedAt` / `createdBy`、`sortOrder`、`coverUrl`、`bookshelfName`、`itemId` / `familyId` / `bookshelfId` / `bookMetaId`、`publishYear` / `isSet` / `setTotalCount` 等（见各接口"返回"示例）。
- **前端实体（miniprogram）已对齐**：发送与读取均不再使用 snake_case；历史混用项（`item_id` ↔ `itemId`、`family_id` ↔ `familyId` 等）已消除。
- **映射器边界**：snake_case 的 DB 与 camelCase 的 API 之间由映射器转换 —— `toUserEntity` / `toBookItemEntity` / `toBookMetaEntity` / `toBookshelfEntity`（DB→API）与 `normalizeInput`（API→DB）。

### 仍待处理
数据库设计层面仍有 4 个 camelCase 字段属于 **DB 内部命名**，需作为独立迁移专项处理（改动 DB 设计文档 + 代码 DB 写入 + 迁移脚本，影响面大，故与 API/app 层解耦）：

| 表 | 当前字段（DB 内部 camelCase） | 应为（snake_case） |
|----|------------------------------|-------------------|
| `user` | `currentFamilyId` | `current_family_id` |
| `user_family` | `userId` | `user_id` |
| `user_family` | `familyId` | `family_id` |
| `bookshelf` | `familyId` | `family_id` |


## 0.3 文档与代码一致性
本文档请求/返回示例已与代码实现保持一致（camelCase 实体 + snake_case DB 内部字段）。如后续发现代码与文档不一致，记录于"3. 遗留问题"。


# 1. API整体清单

| 编号 | API名称                      | 领域       | 类别 | 实现状态 |
|------ | -------------------------- | -------- |-------- |-------- |
|A1| api_user_login | user | 手机端操作：用户登录与管理 | ✅ 已实现 |
|A2| api_user_register | user | 手机端操作：用户登录与管理 | ✅ 已实现 |
|A3| api_user_get | user | 手机端操作：用户登录与管理 | 🚧 脚手架（桩函数，业务逻辑未实现） |
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
|C5| api_bookshelf_reorder | bookshelf | 手机端操作：书架主数据 | 🚧 脚手架（桩函数，业务逻辑未实现） |
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
|G1| api_task_createBindRfid | task | 手机端操作：任务创建 | 🚧 脚手架（桩函数，业务逻辑未实现） |
|G2| api_task_createFindBook | task | 手机端操作：任务创建 | 🚧 脚手架（桩函数，业务逻辑未实现） |
|H1| api_task_unbindRfid | task | 手机端操作：任务执行 | 🚧 脚手架（桩函数，业务逻辑未实现） |
|J1| api_task_accept | task | PDA操作：任务执行 | 🚧 脚手架（桩函数，业务逻辑未实现） |
|J2| api_task_complete | task | PDA操作：任务执行 | 🚧 脚手架（桩函数，业务逻辑未实现） |
|J3| api_task_getRfidBindingInfo | task | PDA操作：任务执行 | 🚧 脚手架（桩函数，业务逻辑未实现） |
|J4| api_task_bindRfid | task | PDA操作：任务执行 | 🚧 脚手架（桩函数，业务逻辑未实现） |

> 实现状态图例：
> - ✅ 已实现 = 仓库中存在对应云函数且已实现真实业务逻辑。
> - 🚧 脚手架 = 仓库中已存在对应云函数文件，但当前仅为**桩函数**（只回显 `event` 与微信上下文，未实现业务逻辑）；下方内容为设计约定，待填充实现。
> 注：架构表中的接口命名已与代码实际云函数名对齐（如 `api_rfid_bind` → `api_task_bindRfid`、`api_recentbook_search` → `api_book_searchRecent`），以代码为准。

---

# 2. API接口详细定义
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

### A3. api_user_get —— 🚧 脚手架（桩函数）
#### 功能
获取用户信息（按 userId 或当前登录用户）。

> **实现状态说明**：仓库中 `api_user_get` 当前仅为桩函数（回显 event 与微信上下文），未实现真实查询逻辑。下方为设计约定。

#### 入参（规划）
```json
{
  "userId": "u001"
}
```
或
```json
{}
```
> 不传 userId 时根据 openid 获取当前登录用户。

#### 处理规则（规划）
（暂无）


#### 权限
- 无（登录态；查看用户自身或指定用户信息）

#### 返回（规划）
```json
{
  "success": true,
  "user": {
    "_id": "u001",
    "nickName": "方大大",
    "currentFamilyId": "f001",
    "status": "ACTIVE"
  }
}
```

---

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

### C5. api_bookshelf_reorder —— 🚧 脚手架（桩函数）
#### 功能
指定家庭下书架的重新排序（sort_order）。

> **实现状态说明**：仓库中 `api_bookshelf_reorder` 当前仅为桩函数（回显 event 与微信上下文），未实现真实排序逻辑。下方为设计约定。

#### 入参（规划）
```json
{
  "orderedBookshelfIds": ["bs001", "bs002", "bs003"]
}
```
> 参数定义待进一步明确（原文档仅占位）。familyId 由服务端从 `user.currentFamilyId` 解析。

#### 处理规则（规划）
- 校验顺序数组归属当前家庭且覆盖全部 ACTIVE 书架


#### 权限
- 所需权限：`BOOKSHELF_UPDATE`
- 允许角色：ADMIN（系统管理员，拥有全部）、OWNER、MEMBER（GUEST 无此权限）
- 校验方式：服务端经 `checkPermission` 校验；未授权返回 `{ "success": false, "message": "无权限操作" }`

#### 返回（规划）
```json
{ "success": true }
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
> 说明：已统一为 `success` 标志（见 0.4 通用约定、第 4 章错误枚举）。`exists` 仅用于区分"系统已存在 / 不存在"两种**成功**结果（不存在不是错误，是转外部源抓取的正常前置条件），因此仍随 `success: true` 一并返回。原文档的 `{ "exists": false }`（无 `success`）与 D2 的 `{ "success": ... }` 不一致问题已在本次修改中统一——见遗留问题 6。

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
  > 由此修复"重新上架导致'最近上架'列表重排"的历史问题（见"三、遗留问题"第 5 条）：重新上架现在只更新"上架时间 `on_shelf_at`"，`created_at` 不被刷新。


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

### G1. api_task_createBindRfid —— 🚧 脚手架（桩函数）
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

> **实现状态说明**：仓库中 `api_task_createBindRfid` 当前仅为桩函数（回显 event 与微信上下文），未实现真实创建逻辑。下方为设计约定。

#### 入参（规划）
```json
{
  "bookItemId": "bi00001"
}
```
> created_by / operator 由服务端从登录态解析，不接收客户端传入。

#### 处理规则（规划）
（暂无）


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

### G2. api_task_createFindBook —— 🚧 脚手架（桩函数）
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

> **实现状态说明**：仓库中 `api_task_createFindBook` 当前仅为桩函数（回显 event 与微信上下文），未实现真实创建逻辑。下方为设计约定。

#### 入参（规划）
```json
{
  "bookItemId": "bi00001"
}
```
> operator 由服务端从登录态解析，不接收客户端传入。

#### 处理规则（规划）
（暂无）


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

## H. 手机端操作：任务执行

### H1. api_task_unbindRfid —— 🚧 脚手架（桩函数）
#### 功能
主动解绑 RFID。

当前版本虽然业务中未出现入口，但未来（图书详情 → 解绑 RFID）大概率会需要，建议现在预留。

> **实现状态说明**：仓库中 `api_task_unbindRfid` 当前仅为桩函数（回显 event 与微信上下文），未实现真实解绑逻辑。下方为设计约定。
> 注：架构表原用名 `api_rfid_unbind`，已与代码实现名 `api_task_unbindRfid` 对齐。

#### 入参（规划）
```json
{
  "bookItemId": "bi00001"
}
```
> operator 由服务端从登录态解析，不接收客户端传入。原文档入参写作 `{ "bookItemId", "operator"" }`（非法 JSON），已修正。

#### 处理规则（规划）
（暂无）


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

### J1. api_task_accept —— 🚧 脚手架（桩函数）
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

> **实现状态说明**：仓库中 `api_task_accept` 当前仅为桩函数（回显 event 与微信上下文），未实现真实领取逻辑。下方为设计约定。

#### 入参（规划）
```json
{
  "deviceId": "pda001"
}
```

#### 处理规则（规划）
（暂无）


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
    "bookItemId": "bi00001"
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

### J2. api_task_complete —— 🚧 脚手架（桩函数）
#### 功能
提交任务执行结果。适用于：bind_rfid、find_book。

> **实现状态说明**：仓库中 `api_task_complete` 当前仅为桩函数（回显 event 与微信上下文），未实现真实提交逻辑。下方为设计约定。

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

#### 处理规则（规划）
（暂无）


#### 权限
- 无（PDA 专用；提交任务执行结果）

#### 返回（规划）
```json
{ "success": true }
```

---

### J3. api_task_getRfidBindingInfo —— 🚧 脚手架（桩函数）
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

> **实现状态说明**：仓库中 `api_task_getRfidBindingInfo` 当前仅为桩函数（回显 event 与微信上下文），未实现真实查询逻辑。下方为设计约定。
> 注：架构表原用名 `api_rfid_getBindingInfo`，已与代码实现名 `api_task_getRfidBindingInfo` 对齐。

#### 入参（规划）
```json
{
  "tid": "E280699500000001"
}
```

#### 处理规则（规划）
（暂无）


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

### J4. api_task_bindRfid —— 🚧 脚手架（桩函数）
#### 功能
执行 RFID 绑定（核心接口）。

实现场景 A / 场景 B / 场景 C / 场景 D 全部统一处理。内部负责：
- book1 旧标签解绑
- tid 旧书解绑
- book1 绑定 tid
- 写 rfid_bind_log

无需 PDA 自己判断。

> **实现状态说明**：仓库中 `api_task_bindRfid` 当前仅为桩函数（回显 event 与微信上下文），未实现真实绑定逻辑。下方为设计约定。
> 注：架构表原用名 `api_rfid_bind`，已与代码实现名 `api_task_bindRfid` 对齐。

#### 入参（规划）
```json
{
  "bookItemId": "bi00001",
  "tid": "E280699500000001"
}
```
> operator 由服务端从登录态解析，不接收客户端传入。

#### 处理规则（规划）
（暂无）


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


# 3. 遗留问题

1. **实现状态 / 脚手架**：架构表所列 33 个接口中，25 个已有真实实现（含 F2 `api_book_searchRecent`），另有 9 个云函数文件仅为**桩函数**（仅回显 `event` 与微信上下文，未实现业务逻辑）：A3 `api_user_get`、C5 `api_bookshelf_reorder`、G1/G2（任务创建）、H1 `api_task_unbindRfid`、J1–J4（PDA 任务执行/RFID 绑定）。文档已在架构表与各章节标注 ✅/🚧，避免读者误判为已上线。

2. **入参命名不统一（已解决）**：原 `itemId`（camel，如 api_bookitem_get / updateBookshelf）与 `item_id`（snake，如 offstock / restock / delete）跨接口混用；`familyId`/`family_id` 同理。RFID 字段已统一为 `rfidTid`。
已通过映射器（`toUserEntity` / `toBookItemEntity` / `toBookMetaEntity` / `toBookshelfEntity` / `normalizeInput`）将 API 入参 / 返回（前端实体）全链路统一为 camelCase：`itemId`/`familyId`/`bookshelfId`/`bookMetaId`/`coverUrl`/`sortOrder`/`createdAt`/`updatedAt`/`createdBy` 等，DB 内部字段保持 snake_case。剩余 4 个 DB 内部 camelCase 字段（`user.currentFamilyId`、`user_family.userId`/`familyId`、`bookshelf.familyId`）作为独立迁移专项处理。

3. **通用失败返回 / 错误枚举未系统化（已起草到文档）**：权限校验经 `checkPermission` 统一产出 `reason` 错误枚举（见 `_shared/permission.js`），但当前真实云函数仅把 `message` 透传给前端、**未透传 `reason`**（见各接口"返回-失败"示例）。已新增第 4 章《通用错误返回规范（错误枚举）》集中说明推荐结构与枚举表；建议后续统一在失败响应中补充 `reason` 字段，使前端可按错误类型分支。

4. **权限体系未逐接口标注（已修复）**：原仅 family / bookshelf 的增改删与 `api_bookitem_updateBookshelf` 在代码中显式 `checkPermission`；bookitem 的上架/下架/重新上架/删除及检索类接口此前仅做 `getCurrentUser`（登录态）校验。本次已**逐接口补齐并标注**：
   - **文档侧**：每个接口（含桩函数 G1/G2/H1）新增 `#### 权限` 子节，标注「所需权限 / 允许角色 / 校验方式」，角色口径严格对齐需求文档 RBAC——GUEST 仅拥有 `BOOKSHELF_LIST` / `BOOKITEM_SEARCH` / `RECENTBOOK_SEARCH` 三项。
   - **代码侧**：对 8 个真实接口补充 `checkPermission` 细粒度校验 —— `api_bookitem_prepareCreate`、`api_bookitem_create`（→`BOOKITEM_CREATE`）、`api_bookitem_offstock`（→`BOOKITEM_OFFSTOCK`）、`api_bookitem_restock`（→`BOOKITEM_RESTOCK`）、`api_bookitem_delete`（→`BOOKITEM_DELETE`）、`api_bookitem_get`（→`BOOKITEM_SEARCH`，并补 `getCurrentUser`）、`api_book_search`（→`BOOKITEM_SEARCH`）、`api_book_searchRecent`（→`RECENTBOOK_SEARCH`）。校验统一置于「登录态解析 + 家庭解析」之后、业务/事务逻辑之前（与 `api_bookitem_updateBookshelf` 同模式）；未授权返回 `{ "success": false, "message": "无权限操作" }`。
   - **调用侧**：修复 `pages/book/book.js`、`pages/book-search/book-search.js` 中失败分支原误用 `throw result.result.error`（该字段不存在）的缺陷，改为 `throw new Error(result.result.message || '操作失败')`，使「无权限操作」等错误信息可正确透出；并给 `api_book_search` 调用补 `success` 判断，避免权限失败时静默空列表。
   - 说明：受前端 `FRONTEND_PERMISSION_KEYS` 角色门控影响，GUEST 在界面上本就看不到增改删/上下架按钮，服务端 `checkPermission` 为纵深防御；二者口径一致。

5. **api_bookitem_restock 刷新 created_at（隐藏业务影响）—— 已实施并部署**：原代码在重新上架时把 `created_at` 刷新为当前时间，导致"最近上架"列表重排。根因是 `created_at` 被错用于"上架时间"语义。已在 `book_item` 新增独立字段 **`on_shelf_at`（上架时间）**（`created_at` 回归"记录创建时间"语义，仅初次上架写入一次）；重新上架改为**刷新 `on_shelf_at` + `updated_at`，不再动 `created_at`**；`api_book_search` 的"上架期间"筛选、`api_book_searchRecent` 的"最近上架"排序及详情页"上架日"展示均改用 `on_shelf_at`。数据库设计文档（3.6）与本文档 0.4、E2/E3/E4/E5/E6/E7/F1/F2 已同步更新；代码改动与一次性数据回填云函数 `api_bookitem_backfill_onshelf` 已落地（见"五、代码更新确认"）。部署新代码**前**须先运行一次回填云函数。

6. **D1 getByIsbn 与 D2 fetchExternal 成功标志不一致（已修复）**：原 D1 返回 `{ "exists": ... }`（无 `success`）、D2 返回 `{ "success": ... }`，前端需分别处理。已在本次修改中统一：D1 改为统一以 `success` 为顶层标志（`exists` 仅作"系统是否存在该 ISBN"的成功分支标记，随 `success: true` 返回），D2 保持 `success`；云函数代码与小程序调用处（`pages/book/book.js`）已同步修改。

---

# 4. 通用错误返回规范（错误枚举）

## 4.1 统一返回结构

> 与 0.4 通用约定一致：所有接口**成功**统一含 `success: true`；**失败**统一含 `success: false` 与 `message`（人类可读信息）。

**成功：**
```json
{ "success": true, "...": "..." }
```

**失败（通用）：**
```json
{ "success": false, "message": "<人类可读错误描述>" }
```

> 个别老接口异常分支写作 `{ "success": false, "error": "..." }`，属历史写法，建议统一收敛为 `message`（见 4.3）。

## 4.2 失败原因枚举（reason）

登录态与权限校验统一由 `_shared/permission.js` 的 `checkPermission` 完成。该校验对每个失败场景给定一个 `reason` 枚举值（机器可读），便于前端 / 上层按类型分支、埋点、国际化。

> **现状（待系统化，即遗留问题 3）**：当前真实云函数在 `checkPermission` 返回 `allowed: false` 时，仅透传 `perm.message`（`return { success: false, message: perm.message }`），**未将 `reason` 透出到接口响应**。因此 `reason` 目前是"代码内部已实现、接口层面未暴露"的状态。建议后续在失败响应中统一补充 `reason` 字段：
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

## 4.3 其他失败返回约定

- **参数校验失败**：接口在调用 `checkPermission` 前自行校验入参（如必填项为空），直接返回 `{ success: false, message: "<具体字段>不能为空" }`，不进入 `checkPermission`，因此无 `reason`。
- **业务规则拒绝**：如"书架下存在在架图书，无法删除""当前家庭已存在有效书架"等，返回 `{ success: false, message: "<业务提示>" }`；如需细分，可补充业务级 `reason`（建议后续扩展，如 `SHELF_NOT_EMPTY` 等）。
- **系统异常**：`try/catch` 捕获后返回 `{ success: false, message: "<err.message>" }`（老接口写法为 `{ success: false, "error": "..." }`，建议统一为 `message`）。
- **特殊成功分支**：`api_bookmeta_getByIsbn` 的 `{ success: true, exists: false }` 属"调用成功但系统内无此书"的**正常成功**结果（非失败），用于驱动前端转外部源抓取，不应视为错误。

## 4.4 推荐（系统化）目标结构

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

# 5. 代码更新确认（遗留问题 5 实施方案）

> 阶段一（设计）已完成：字段语义、数据库设计（表 3.6）、接口契约（0.4、E2/E3/E4/E5/E6/E7/F1/F2）均按"新增 `on_shelf_at`"方案更新。本章为阶段二（实现）的逐文件改动清单，**已全部落地**（云函数 + 前端 + 一次性回填云函数），待 push、云端部署及运行一次回填。

## 5.1 数据库字段改动
- `book_item` 新增 `on_shelf_at`（datetime，必须）：初次上架与重新上架写入/刷新；下架、更换书架、彻底删除、绑定/解绑 RFID 不改动。
- 既有 `created_at` 语义收敛为"记录创建时间"，仅初次上架写入一次。

## 5.2 云函数改动清单

| 云函数 | 文件 | 改动点 |
| ------ | ---- | ------ |
| E2 `api_bookitem_create` | `index.js` | 创建 `book_item` 时增加 `on_shelf_at: now`；返回实体 `bookItem` 增加 `onShelfAt: now` |
| E4 `api_bookitem_restock` | `index.js` | **核心修复**：把 `created_at: now` 改为 `on_shelf_at: now`（保留 `updated_at: now`）。不再刷新 `created_at` |
| E3 `api_bookitem_offstock` | `index.js` | 无需改动（本就只写 `updated_at`，不动 `on_shelf_at`） |
| E7 `api_bookitem_updateBookshelf` | `index.js` | 无需改动（本就只写 `updated_at`，不动 `on_shelf_at`） |
| E5 `api_bookitem_delete` | `index.js` | 无需改动（本就只写 `updated_at`，不动 `on_shelf_at`） |
| E6 `api_bookitem_get` | `index.js` | `toBookItemEntity` 增加 `onShelfAt: item.on_shelf_at` |
| F1 `api_book_search` | `index.js` | 排序 `sort({ created_at: -1 })` → `sort({ on_shelf_at: -1 })`；"上架期间"筛选 `itemMatch.created_at` → `itemMatch.on_shelf_at`；返回增加 `onShelfAt: item.on_shelf_at` |
| F2 `api_book_searchRecent` | `index.js` | `orderBy('created_at','desc')` → `orderBy('on_shelf_at','desc')`；返回 `inStockDate: item.created_at` → `onShelfAt: item.on_shelf_at` |
| G1/G2/H1/J3/J4（RFID 绑定/解绑，桩函数，待实现） | `index.js` | 实现时仅刷新 `updated_at`，**不**改动 `on_shelf_at` |
| 一次性回填 `api_bookitem_backfill_onshelf`（新增云函数） | `index.js` | 上线前跑一次：`on_shelf_at` 缺失时置为 `created_at`；返回 `migrated` / `remainWithoutOnShelfAt` |

## 5.3 前端（小程序）改动
- `pages/book/book.js`（约第 292 行）：详情页"上架日"映射 `inStockDate: bookItem?.createdAt` → `inStockDate: bookItem?.onShelfAt`（改读新字段）。
- 消费 `api_book_searchRecent` 的搜索/首页页：将 `inStockDate` 字段名切换为 `onShelfAt`（与 F2 返回一致）。

## 5.4 一次性数据回填（上线前必做）
历史 `book_item` 记录只有 `created_at`，无 `on_shelf_at`。由于旧代码在重新上架时已将 `created_at` 刷成"上架时间"，故回填语义为：`on_shelf_at` 为空（或不存在）时，置为 `created_at`。

```js
// 一次性回填云函数（仅跑一次，部署新代码前执行）
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async () => {
  // 1. 取出所有缺少 on_shelf_at 的 book_item
  const res = await db.collection('book_item')
    .where({ on_shelf_at: _.exists(false) })
    .limit(1000)
    .get()

  let count = 0
  for (const item of res.data) {
    // 2. 历史数据中 created_at 实际就是"上架时间"（含曾被重新上架刷新过的值），直接回填
    await db.collection('book_item').doc(item._id).update({
      data: { on_shelf_at: item.created_at }
    })
    count++
  }
  return { success: true, migrated: count }
}
```

> 说明：微信云开发不支持"把 A 字段值原子复制给 B 字段"的更新，故采用逐条 `doc(id).update` 的循环方式（超 1000 条需分页/分批）。若数据量大，建议在低峰期执行并做分页。部署新代码**前**先完成回填，避免新排序/筛选落到空值。

## 5.5 验证要点
- 重新上架后：`created_at` 不变、`on_shelf_at` 刷新为当前时间；`api_book_searchRecent` 把该书按新上架时间正确排序（不再因"记录创建时间"被刷新而异常置顶）。
- 下架 / 更换书架 / 彻底删除：`on_shelf_at` 保持不变。
- `api_book_search` 按"上架期间"筛选、`api_book_searchRecent` 排序均基于 `on_shelf_at`。

---

# 6. 一次性数据迁移工具（script_data_migration）

> **性质：临时工具，非业务接口。** 本云函数**不在**第 1 章「API 整体清单」中，因为它不是面向手机端 / PDA 的业务接口，而是运维期用于调整数据库表结构（改字段名、增减字段、迁移历史数据）的一次性脚本。

## 6.1 用途
将线上历史数据对齐到最新设计文档（`家庭图书管理系统数据库表结构设计.md`），消除「代码 / 设计 / 历史数据」三方字段差异。当前实现对应 `.今后改善事项/DB差异0711.md` 的 **修复1、修复2**：

| 迁移项 | 来源字段（旧） | 目标字段（设计） | 说明 |
| ------ | ------------- | --------------- | ---- |
| 修复1 | `book_item.rfid_tag_id` | `book_item.rfid_tid`（唯一索引） | 把历史 `rfid_tag_id` 的值复制给 `rfid_tid`，并 `_.remove()` 删除旧字段 |
| 修复2 | `book_item.operator` | （删除） | 删除 `book_item` 上残留的 `operator` 字段（上下架操作人统一记录于 `inventory_change_log`） |

> 历史曾用于 `status → inventory_status` 的迁移逻辑已完成其使命，本次已整体替换为本脚本的新版实现。

## 6.2 幂等性与安全性
- **幂等**：仅处理「仍含旧字段」的记录（`_.exists(true)`）；已迁移记录因旧字段被删除而不再命中，可**重复执行**、安全不报错。
- **分批**：每批 `BATCH_SIZE = 100`，按 `while` 循环推进；集合规模变化或超时后可再次执行，断点续跑。
- **仅运维**：不接收任何业务入参，不依赖家庭角色；仅由管理员在云端测试手动触发。

## 6.3 使用方式（部署新代码前必做）
1. 在微信开发者工具中右键部署 `script_data_migration`（上传并部署：云端安装依赖）。
2. 右键 → 云端测试，测试参数输入 `{}`，点击运行测试。
3. 如遇超时，请在云开发控制台把云函数超时时间调到 20 秒以上，再执行一次（幂等，可重复）。
4. 返回 `success: true` 且 `stats.errors` 为空，即迁移完成。

## 6.4 重要提醒
- **部署新代码前必须先执行一次**：新代码（修复1）统一以 `rfid_tid` 读写 `book_item`，若历史数据仍停留在 `rfid_tag_id`，则按 `rfid_tid` 的查询 / 唯一索引会落空。
- 执行后应**及时下架 / 不再调用**本函数；它属于一次性迁移工具，不应保留在常态调用链路中。
- 如后续又有表结构变更，可改写本函数（保留幂等与分批模式）后再次执行。

