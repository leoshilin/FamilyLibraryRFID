# 1. 整体架构

| 当前名称                 | 建议新名称                      | 领域       |
| -------------------- | -------------------------- | -------- |
| commitInStock        | api_bookitem_create        | BookItem |
| prepareInStock       | api_bookitem_prepareCreate | BookItem |
| offBookItem          | api.bookitem.offstock      | BookItem |
| onBookItem           | api.bookitem.restock       | BookItem |
| deleteBookItem       | api.bookitem.delete        | BookItem |
| getBookItem          | api_bookitem_get           | BookItem |
| searchBooks          | api_book_search            | Search   |
| getRecentBooks       | api_recentbook_search            | Search   |
| getBookMeta          | api_bookmeta_getByIsbn     | BookMeta |
| getBookFromDouban_v2 | api_bookmeta_fetchExternal | BookMeta |

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


# 2. 接口说明
1 api_bookitem_prepareCreate

（原 prepareInStock）

功能

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
入参
{
  "isbn":"9787111122334",
  "familyId":"fm00001",
  "book":{
      "isbn":"9787111122334",
      "setIndex":1
  }
}
返回
{
  "success":true,
  "metaExists":true,
  "bookMetaId":"xxx",
  "isSet":true,
  "existingItemCount":3,
  "needUserConfirm":true,
  "duplicateType":"set_conflict"
}
2 api.bookitem.create

（原 commitInStock）

功能

正式执行上架。

包含：

自动创建book_meta（不存在时）
创建book_item
写库存日志
入参
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
返回
{
  "success":true,
  "bookItemId":"xxxx"
}
3 api.bookitem.offstock

（原 offBookItem）

功能

执行下架。

包含：

状态校验
更新book_item.status
写库存日志
入参
{
  "item_id":"xxx",
  "family_id":"fm00001",
  "operator":"admin-user",
  "reason":"捐赠"
}
返回
{
  "success":true
}
4 api.bookitem.restock

（原 onBookItem）

功能

重新上架已下架书籍。

包含：

状态校验
恢复 in_stock
写库存日志
入参
{
  "item_id":"xxx",
  "family_id":"fm00001",
  "operator":"admin-user"
}
返回
{
  "success":true
}

## 5. api.bookitem.delete

（原 deleteBookItem）

功能

逻辑删除。

执行：

fg_delete=false
↓
fg_delete=true

前提：

status=off_stock
入参
{
  "item_id":"xxx",
  "family_id":"fm00001",
  "operator":"admin-user"
}
返回
{
  "success":true
}

## 6. api_bookitem_get

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

### 返回
{
  "success":true,
  "data":{
      ...
  }
}
## 7. api_book_search

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

### 返回
{
  "success":true,
  "data":[...],
  "total":56
}

## 8. api_recentbook_search

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

### 返回
{
  "success":true,
  "list":[...]
}

## 9. api_bookmeta_getByIsbn

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

###  返回
{
  "exists":true,
  "book":{
      ...
  }
}

## 10. api_bookmeta_fetchExternal

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

### 返回
{
  "success":true,
  "book":{
      ...
  }
}

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
api.bookitem.delete
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