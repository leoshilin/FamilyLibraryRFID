# 0. 当前待处理问题
本章记载的是已知的，当前存在的问题或待改善事项。
由于功能开发为优先，因此以下事项当前暂时不修改，仅做记录。在功能开发稳定后再考虑统一修改。
因此，文档中相关设计和本章节记载的内容可能会有冲突。

## 0.1 API全部直接传familyId
目前API几乎都是：familyId作为入参。
今后在用户登录和家庭功能上线之后，登录用户信息中可获取当前操作家庭

```
user
↓
currentFamilyId
↓
默认家庭
```

因此，API中不传familyId，而是统一在后台：
```
openid
↓
user
↓
currentFamilyId

```
因此，相关API将会在未来实现用户登录和家庭功能后统一修改。

---

## 0.2 operator 不应该由客户端传
当前版本是在用户登录功能设计之前完成的，因此operator 大量用了hard coding 传递了"admin-user"。包括部分函数的created_by入参。
在功能稳定后下一阶段再统一修改。

## 0.3 命名不统一
当前版本中item_id、itemId、bookItemId，familyId 与 family_id，tid与rfidTid等存在大量不统一的命名。
在功能稳定后下一阶段再统一修改。
未来的原则：
 - API 全部 camelCase
 - 数据库内部 snake_case



# 1. 整体架构

| 编号 | API名称                      | 领域       |
|------ | -------------------------- | -------- |
|A2| api_bookitem_create        | BookItem |
|A1| api_bookitem_prepareCreate | BookItem |
|A3| api_bookitem_offstock      | BookItem |
|A4| api_bookitem_restock       | BookItem |
|A5| api_bookitem_delete        | BookItem |
|A6| api_bookitem_get           | BookItem |
|A21| api_bookitem_updateBookshelf           | BookItem |
|A7| api_book_search            | Search   |
|A8| api_recentbook_search            | Search   |
|A9| api_bookmeta_getByIsbn     | BookMeta |
|A10| api_bookmeta_fetchExternal | BookMeta |
|A11| api_family_getCurrent | family |
|A12| api_family_create | family |
|A13| api_family_update | family |
|A14| api_family_delete | family |
|A22| api_family_list | family |
|A15| api_bookshelf_create | bookshelf |
|A16| api_bookshelf_update | bookshelf |
|A17| api_bookshelf_delete | bookshelf |
|A18| api_bookshelf_list | bookshelf |
|A19| api_bookshelf_reorder | bookshelf |
|A20| api_family_switchCurrent | family |
|B1| api_task_createBindRfid | task |
|B2| api_task_createFindBook | task |
|C1| api_task_claim | task |
|C2| api_task_complete | task |
|C3| api_rfid_getBindingInfo | task |
|C4| api_rfid_bind | task |
|C5| api_rfid_unbind | task |
|C6| api_bookitem_verifyIsbn | task |
|C7| api_bookitem_getRfid | task |
|D1| api_user_login | user |
|D2| api_user_register | user |
|D3| api_user_get | user |
|D4| api_user_update | user |




| 未来函数                |
| ------------------- |
| api_rfid_bind       |
| api_rfid_find       |
| api_rfid_getBinding |
| api_rfid_unbind     |

| 未来函数              |
| ----------------- |
| api_task_poll     |
| api_task_accept   |
| api_task_complete |
| api_task_fail     |

---

# A. 手机端书本管理
## A1. api_bookitem_prepareCreate
（原 prepareInStock）

### 功能

上架前预检查：

book_meta是否存在
当前家庭是否已存在同书
套装序号是否冲突

用于：

扫码ISBN
↓
调用prepareCreate
↓
决定是否需要用户确认
↓
进入确认页

### 入参
{
  "isbn":"9787111122334",
  "familyId":"fm00001",
  "book":{
      "isbn":"9787111122334",
      "setIndex":1
  }
}

### 处理规则


### 返回
{
  "success":true,
  "metaExists":true,
  "bookMetaId":"xxx",
  "isSet":true,
  "existingItemCount":3,
  "needUserConfirm":true,
  "duplicateType":"set_conflict"
}

---

## A2. api_bookitem_create

（原 commitInStock）

### 功能

正式执行上架。

包含：

自动创建book_meta（不存在时）
创建book_item
写库存日志

### 入参
{
  "isbn":"9787111122334",
  "familyId":"fm00001",
  "operator":"admin-user",
  "bookshelfId":"bs001",
  "editionType":"original",
  "book":{
      ...
  }
}

### 处理规则

###  返回
{
    success:true,

    bookItem:{
       ...
    }
}

 * 返回bookitem对象，而非仅仅bookItemId
---

## A3. api_bookitem_offstock

（原 offBookItem）

### 功能

执行下架。

包含：

状态校验
更新book_item.status
写库存日志

### 入参
{
  "item_id":"xxx",
  "family_id":"fm00001",
  "operator":"admin-user",
  "reason":"捐赠"
}

### 处理规则

### 返回
{
  "success":true
}

---

## A4. api_bookitem_restock

（原 onBookItem）

### 功能

重新上架已下架书籍。

包含：

状态校验
恢复 in_stock
写库存日志

### 入参
{
  "item_id":"xxx",
  "family_id":"fm00001",
  "operator":"admin-user"
}

### 处理规则

### 返回
{
  "success":true
}

---

## A5. api_bookitem_delete

（原 deleteBookItem）

### 功能

逻辑删除。

执行：

fg_delete=false
↓
fg_delete=true

前提：

status=off_stock

### 入参
{
  "item_id":"xxx",
  "family_id":"fm00001",
  "operator":"admin-user"
}

### 处理规则

### 返回
{
  "success":true
}

---

## A6. api_bookitem_get

（原 getBookItem）
需研究：该函数被 async loadFromId(itemId)  调用，但loadFromId没有被任何地方调用。接口已实现但当前无调用方，待确认是否保留或接入页面。

### 功能

* 根据 book_item_id 获取实体书详情。

* 自动关联：

```
  book_item
  +
  book_meta
```

返回完整展示对象。

### 入参
{
  "itemId":"xxx"
}

### 处理规则

### 返回
{
    success:true,

    bookItem:{...},

    bookMeta:{...},

    bookshelf:{...}
}


---
## A21. api_bookitem_updateBookshelf

### 功能
* 修改指定实体书所在书架（移动图书）.

### 入参
{ 
  itemId, 
  familyId, 
  bookshelfId, 
  operator 
}

### 处理规则

- **权限**：`BOOKITEM_UPDATE`（经 `checkPermission` 校验）

### 返回
- 成功返回：
{ 
  success: true, 
  bookshelf_name 
}

- 失败返回：
{ 
  success:false, 
  message 
}，
  
  含：
  - `itemId不能为空` / `familyId不能为空` / `bookshelfId不能为空`
  - `目标书架不存在或已失效` / `目标书架不属于当前家庭`
  - `书籍不存在或已删除` / `书架未变更`（幂等）

---

## A7. api_book_search

（原 searchBooks）

### 功能

* 图书检索。

* 支持：

  - ISBN 精确筛选 （与Keyword取交集（`_.and`））
  - Keyword 模糊筛选
    - 标题模糊
    - 作者模糊
  - bookshelfId: 书架筛选
  - 状态筛选： 上架，下架
  - 时间筛选： 上架期间
  - 分页

### 入参
{
  "familyId":"fm00001",
  "keyword":"三体",
  "status":"in_stock",
  "startDate":"2026-01-01",
  "endDate":"2026-06-30",
  "page":1,
  "pageSize":20
}

### 处理规则
- 默认 `in_stock`、默认 `pageSize=10`、按 `created_at` 倒序

### 返回
{
  "success":true,
  "data":[...],
  "total":56
}

---

## A8. api_recentbook_search

（原 getRecentBooks）

### 功能

  - 首页最近上架书籍。

  - 规则：

    - status=in_stock
    - fg_delete=false
    - 按created_at倒序
    - 最多5条

### 入参
{
  "familyId":"fm00001"
}

### 处理规则

### 返回
{
  "success":true,
  "list":[...]
}

---

## A9. api_bookmeta_getByIsbn

（原 getBookMeta）

### 功能

按 ISBN 查询系统级主数据。

用于：

扫码
↓
先查本系统
↓
存在直接使用

### 入参
{
  "isbn":"9787111122334"
}

### 处理规则

###  返回
{
  "exists":true,
  "book":{
      ...
  }
}

---

## A10. api_bookmeta_fetchExternal

（原 getBookFromDouban_v2）

### 功能

从外部数据源抓取书籍信息。

当前：

豆瓣HTML解析

未来：

豆瓣
OpenLibrary
Google Books
国家图书馆

都可以统一挂到这里。

### 入参
{
  "isbn":"9787111122334"
}

### 处理规则

### 返回
{
  "success":true,
  "book":{
      ...
  }
}
---

## A11. api_family_getCurrent


### 功能
获取当前登录用户访问中的家庭（不一定是用户创建的家庭，也可能是用户加入的家庭）

### 入参
{}

### 处理规则

### 返回
- 成功返回：
{
  "success": true,
  "family": {
    "_id": "familyId",
    "name": "我的家庭",
    "status": "ACTIVE",
    "created_by": "userId",
    "created_at": "datetime"
  },
  "role": "OWNER",
  "bookshelfCount": 1
}

- 无家庭返回:
{
  "success": true,
  "family": null,
  "role": null,
  "bookshelfCount": 0
}

---

## A12. api_family_create
### 功能
登录用户创建家庭

### 入参
{
  "name": "我的家庭"
}

说明：
name 可选。为空时默认“我的家庭”。

### 处理规则
- 创建家庭是特殊权限，只要注册用户即可创建，不依赖 user_family。
- 校验用户是否已作为 `OWNER` 创建过家庭（一个用户只可创建一个家庭的限制，失败返回"当前用户已创建家庭"）
- 创建默认书架"我的书架" 
- 在 `user_family` 建立 `OWNER` 关系 
- 更新 `user.currentFamilyId`。

### 返回
- 成功返回：
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

- 失败返回示例：
  {
    "success": false,
    "message": "用户未注册"
  }

  {
    "success": false,
    "message": "当前用户已创建家庭"
  }

---

## A13. api_family_update
### 功能
更新指定家庭的名称信息

### 入参
{
  "familyId": "familyId",
  "name": "新的家庭名称"
}

### 处理规则

### 返回
- 成功返回：
{
  "success": true,
  "family": {
    "_id": "familyId",
    "name": "新的家庭名称",
    "status": "ACTIVE",
    "updated_at": "datetime"
  }
}

- 失败返回示例：
  {
    "success": false,
    "message": "家庭名称不能为空"
  }

  {
    "success": false,
    "message": "无权限修改家庭"
  }

---

## A14. api_family_delete

### 功能
删除指定家庭，逻辑删除，不做物理删除。

### 入参
{
  "familyId": "familyId"
}

### 处理规则
获取当前登录用户：openid -> user
校验用户已注册且 status = ACTIVE
校验 familyId 必填
查询目标 family
若家庭不存在或已 DISABLED，返回失败
权限：role-permission 校验

删除前检查该家庭下是否存在 status = ACTIVE 的书架
若存在 ACTIVE 书架，拒绝删除
若允许删除：更新 family.status = DISABLED
写入 updated_by
写入 updated_at

如果当前用户的 currentFamilyId === familyId：删除 user.currentFamilyId 字段，不能写 null

### 返回
- 成功返回：
  {
    "success": true
  }

- 失败返回示例：
  {
    "success": false,
    "message": "familyId不能为空"
  }

  {
    "success": false,
    "message": "家庭不存在"
  }

  {
    "success": false,
    "message": "无权限删除家庭"
  }

  {
    "success": false,
    "message": "当前家庭下存在有效书架，请先删除书架"
  }

---

## A22. api_family_list
### 功能
 * 获取当前用户所属的全部家庭（自建 + 受邀加入）。

### 入参
 无（openid 后端解析）

### 返回
{ 
  success: true, 
  list: [ { familyId, name, role, status, isCurrent } ] 
}

无家庭返回 
{ 
  success:true, 
  list:[] 
}

### 处理规则
* 该接口**不做 RBAC 校验**（仅 `getCurrentUser`）

---

## A15. api_bookshelf_create
### 功能
在指定家庭下创建书架

### 入参
{
  "familyId": "familyId",
  "name": "书架名称"
}

### 处理规则
familyId 必填
name 必填，trim 后不能为空
当前用户必须已注册且 status = ACTIVE
目标家庭必须存在且 status = ACTIVE
权限：role-permission 校验

同一家庭下 ACTIVE 书架数量不能超过 99
sort_order 由后端计算：当前 ACTIVE 书架最大 sort_order + 1
创建时写入：familyId
name
sort_order
status = ACTIVE
created_by
created_at

### 返回
- 成功返回：
{
  "success": true,
  "bookshelfId": "bookshelfId",
  "bookshelf": {
    "_id": "bookshelfId",
    "familyId": "familyId",
    "name": "书架名称",
    "sort_order": 2,
    "status": "ACTIVE"
  }
}

---

## A16. api_bookshelf_update

### 功能
修改指定书架名称

### 入参
{
  "bookshelfId": "bookshelfId",
  "name": "新的书架名称"
}

### 处理规则
bookshelfId 必填
name 必填
查询书架，取得 familyId
书架必须存在且 status = ACTIVE
权限：role-permission 校验

只修改名称，不修改 familyId、sort_order
写入 updated_by、updated_at

### 返回
- 成功返回：
  {
    "success": true,
    "bookshelf": {
      "_id": "bookshelfId",
      "familyId": "familyId",
      "name": "新的书架名称",
      "sort_order",
      "status": "ACTIVE",
      "updated_at": "datetime"
    }
  }

---

## A17. api_bookshelf_delete
### 功能
逻辑删除指定书架。

### 入参
{
  "bookshelfId": "bookshelfId"
}

### 处理规则
bookshelfId 必填
查询书架，取得 familyId
书架必须存在且 status = ACTIVE
权限：role-permission 校验

删除前检查该书架下是否存在有效在架图书：book_item.bookshelf_id = bookshelfId
inventory_status = in_stock
fg_delete 不为 true

若存在，拒绝删除
若允许删除：更新 bookshelf.status = DISABLED
写入 updated_by
写入 updated_at

删除后重排同家庭下剩余 ACTIVE 书架的 sort_order

### 返回
- 成功返回：
{
  "success": true
}

- 失败返回示例：
{
  "success": false,
  "message": "该书架下存在在架图书，无法删除"
}

---

## A18. api_bookshelf_list
### 功能
查询指定家庭下 ACTIVE 书架列表

### 入参
{
  "familyId": "familyId"
}

### 处理规则
familyId 必填
当前用户必须属于该家庭，或为 ADMIN
按 sort_order 升序返回
默认只返回 status = ACTIVE

### 返回
{
  "success": true,
  "list": [
    {
      "_id": "bookshelfId",
      "familyId": "familyId",
      "name": "我的书架",
      "sort_order": 1,
      "status": "ACTIVE"
      "bookCount": 100 //在架图书数
    }
  ]
}


---

## A19. api_bookshelf_reorder
### 功能
指定家庭下 书架的重新排序（sort_order）

### 入参
{
  
}
* 需进一步明确参数定义

### 处理规则

### 返回


---

## A20. api_family_switchCurrent
### 功能
切换当前登录用户的默认访问家庭（user.currentFamilyId）。

说明：
- 仅校验"登录用户是否属于目标家庭"（user_family 存在对应记录），不做 OWNER / MEMBER 角色级权限校验；任何已激活家庭成员均可切换。
- 切换后影响后续依赖 currentFamilyId 默认值的接口。

### 入参
{
  "familyId": "familyId"
}

### 处理规则
获取当前登录用户：openid → user（getCurrentUser）
校验 familyId 必填
校验用户已注册且 status = ACTIVE
查询 user_family 校验用户属于该家庭（userId + familyId 存在记录）
查询目标 family，必须存在且 status = ACTIVE
更新 user.currentFamilyId = familyId
（不写 updated_at / updated_by；不做角色权限校验）

### 返回
- 成功返回：
{
  "success": true
}

- 失败返回示例：
  {
    "success": false,
    "message": "familyId不能为空"
  }

  {
    "success": false,
    "message": "用户未注册"
  }

  {
    "success": false,
    "message": "用户状态不可用"
  }

  {
    "success": false,
    "message": "用户不属于该家庭"
  }

  {
    "success": false,
    "message": "家庭不存在或已失效"
  }

- 异常：
  {
    "success": false,
    "message": "<err.message>"
  }
---

# B. 手机端创建任务
## B1. api_task_createBindRfid
### 功能

创建 RFID 绑定任务。

用于：

图书检索页
↓
点击【绑定RFID】
↓
创建 bind_rfid 任务
↓
PDA 后续轮询获取

### 入参
{
  "bookItemId":"bi00001",
  "created_by":"admin-user"
}

### 处理规则

### 返回
  {
    "success":true,

    task:{
    ...
    }
  }

  * 返回task对象，而非仅仅taskId。

## B2. api_task_createFindBook
### 功能

创建寻书任务。

用于：

图书详情页
↓
点击【寻找图书】
↓
创建 find_book 任务
↓
PDA 后续执行

### 入参
{
  "bookItemId":"bi00001",
  "operator":"admin-user"
}

### 处理规则

### 返回
{
  "success":true,
  "taskId":"task00002"
}

# C. PDA端操作
## C1. api_task_claim
### 功能

PDA领取待执行任务。

规则：

仅 PDA 调用
从 pending / running 中按创建时间排序
返回一个任务
返回后立即更新状态为 running

对应设计文档：

PDA无任务
↓
api_task_claim
↓
获得任务
↓
running

### 入参
{
  "deviceId":"pda001"
}

### 处理规则

### 返回
{
  "success":true,
  "task":{
    "taskId":"task00001",
    "taskType":"bind_rfid",
    "bookItemId":"bi00001"
  }
}

无任务：

{
  "success":true,
  "task":null
}

## C2. api_task_complete
### 功能

提交任务执行结果。

适用于：

bind_rfid
find_book

### 入参
{
  "taskId":"task00001",
  "status":"success",
  "result":{
    "message":"completed"
  }
}

### 处理规则

### 返回
{
  "success":true
}

## C3. api_rfid_getBindingInfo
### 功能
这是绑定流程真正执行业务逻辑的部分。
根据 RFID TID 查询当前绑定状态。

用于 PDA 扫描标签后确认。

流程：

扫描TID
↓
查询当前是否已绑定
↓
显示旧书信息
↓
用户确认是否解绑

### 入参
{
  "tid":"E280699500000001"
}

### 处理规则

### 返回（未绑定）
{
  "success":true,
  "bound":false
}

### 返回（已绑定）
{
  "success":true,
  "bound":true,
  "book":{
    "bookItemId":"bi00002",
    "title":"三体",
    "isbn":"9787536692930"
  }
}

## C4. api_rfid_bind
### 功能

执行 RFID 绑定。

核心接口。

实现：

场景A
场景B
场景C
场景D

全部统一处理。

内部负责：

book1旧标签解绑
+
tid旧书解绑
+
book1绑定tid
+
写rfid_bind_log

无需 PDA 自己判断。

### 入参
{
  "bookItemId":"bi00001",
  "tid":"E280699500000001",
  "operator":"admin-user"
}

### 处理规则

### 返回
{
  "success":true,
  "action":"rebind"
}

action：

bind
rebind

## C5. api_rfid_unbind
### 功能

主动解绑 RFID。

当前版本虽然业务中未出现入口。

但未来：

图书详情
↓
解绑RFID

大概率会需要。

建议现在预留。

### 入参
{
  "bookItemId":"bi00001",
  "operator":"admin-user"
}

### 处理规则

### 返回
{
  "success":true
}


## C6. api_bookitem_verifyIsbn
### 功能

PDA执行绑定时的图书校验

设计文档中有一个关键步骤：

PDA领取任务
↓
显示书名
↓
用户扫描ISBN
↓
校验是否正确

建议增加专门接口。

校验当前任务对应图书。

避免用户拿错书。

### 入参
{
  "bookItemId":"bi00001",
  "isbn":"9787536692930"
}

### 处理规则

### 返回
{
  "success":true,
  "matched":true
}

或

{
  "success":true,
  "matched":false
}


## C7. api_bookitem_getRfid
### 功能

实际上寻书几乎不需要新增业务接口
因为 PDA 拿到任务后只需要获得：

bookItemId
↓
查询rfid_tid
↓
启动扫描

因此增加一个详情接口即可。
（PDA获取任务中应该包含Rfid的信息，不需要查询）

获取图书绑定 RFID 信息。

### 入参
{
  "bookItemId":"bi00001"
}

### 处理规则

### 返回
{
  "success":true,
  "rfidTid":"E280699500000001"
}


# D. 手机端登录初始化相关API
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

## D1. api_user_login
### 功能

根据当前微信账号查询系统用户。
只查询。绝不创建。

### 入参
{}

### 处理
```
获取openid

查询user
```
### 返回1：已注册
```
{
  "success": true,
  "registered": true,

  "user": {
    "_id": "u001",
    "nickName": "方大大",
    "currentFamilyId": "f001"
  }
}
```
### 返回2：未注册
```
{
  "success": true,
  "registered": false
}
```

## D2. api_user_register
### 功能
```
注册系统用户
```

调用入口
```
我的
↓
未注册用户
↓
注册
```


### 入参
```
{
  "nickName": "方大大"
}
```
openid

从：

cloud.getWXContext()

获取。

### 处理
```
获取openid

检查user是否存在

存在
    返回失败

不存在
    创建user
```

### 返回
```
{
  "success": true,
  "userId": "u001"
}
```

## D3. api_user_get
### 功能
```
获取用户信息。
```

### 入参
```
{
  "userId": "u001"
}
```
或
```
{}
```
根据openid获取。


### 处理
```
```

### 返回
```
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

## D4. api_user_update
### 功能
```
更新当前登录用户的昵称。
```

### 入参
`{ 
nickName 
}`

### 处理
- **前置**：用户须已注册且 `status=ACTIVE`，
否则返回 
`{ 
success:false, 
message:'用户不存在'/'用户状态不可用' 
}`


### 返回
* 成功返回：
`{ 
  success: true, 
  user: { ...更新后user, nickName, updated_at } 
}`

* 失败返回：
`{ 
  success:false, 
  message:'用户名不能为空' 
  }` 
  
* 或异常 
  `{ 
    success:false, 
    error 
  }`


---

# 3. 从架构层面的调整建议

你现在实际上已经出现一个现象：

prepareInStock
commitInStock

两个函数共同完成一次上架

而：

offBookItem
onBookItem
deleteBookItem

又是三个独立函数

从DDD（领域设计）角度看其实不完全对称。

我会建议最终形成：

api.bookitem.create
api.bookitem.updateStatus
api_bookitem_delete
api_bookitem_get

api_book_search
api.book.recent

api_bookmeta_getByIsbn
api_bookmeta_fetchExternal

其中：

updateStatus

统一处理：

{
  "action":"off_stock"
}
{
  "action":"restock"
}

以后：

{
  "action":"bind_rfid"
}
{
  "action":"lost"
}

都能扩展。

不过这是第二阶段优化。

对于你现在的开发进度，我建议：

先不要合并。

保持：

offBookItem
onBookItem
deleteBookItem

三条独立API。

这样逻辑最清晰，也最容易调试和排查问题。

等 RFID、Task、Inventory 全部完成后，再考虑 API 收敛与统一。这样风险最低。