# 0. 当前待处理问题
## 0.1 API全部直接传familyId
目前API几乎都是：familyId
实际上以后登录以后：

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
---


# 1. 整体架构

| API名称                      | 领域       |
| -------------------------- | -------- |
| api_bookitem_create        | BookItem |
| api_bookitem_prepareCreate | BookItem |
| api_bookitem_offstock      | BookItem |
| api_bookitem_restock       | BookItem |
| api_bookitem_delete        | BookItem |
| api_bookitem_get           | BookItem |
| api_book_search            | Search   |
| api_recentbook_search            | Search   |
| api_bookmeta_getByIsbn     | BookMeta |
| api_bookmeta_fetchExternal | BookMeta |
| api_family_getCurrent | family |
| api_family_create | family |
| api_family_update | family |
| api_family_delete | family |
| api_bookshelf_create | bookshelf |
| api_bookshelf_update | bookshelf |
| api_bookshelf_delete | bookshelf |
| api_bookshelf_list | bookshelf |


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
  "success":true,
  "bookItemId":"xxxx"
}

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
需研究：该函数被 async loadFromId(itemId)  调用，但loadFromId好像没有被任何地方调用。需确认逻辑

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
  "success":true,
  "data":{
      ...
  }
}

---

## A7. api_book_search

（原 searchBooks）

### 功能

* 图书检索。

* 支持：

  - 标题模糊
  - 作者模糊
  - 状态筛选
  - 时间筛选
  - 分页

### 入参
{
  "familyId":"fm00001",
  "keyword":"三体",
  "statusIndex":0,
  "startDate":"2026-01-01",
  "endDate":"2026-06-30",
  "page":1,
  "pageSize":20
}

### 处理规则

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
创建家庭是特殊权限，只要注册用户即可创建，不依赖 user_family。

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
    }
  ]
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
  "cretaed_by":"admin-user"
}

### 处理规则

### 返回
{
  "success":true,
  "taskId":"task00001"
}

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
## D4. 
### 功能
```
```



### 入参
```
```

### 处理
```
```

### 返回
```
```


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