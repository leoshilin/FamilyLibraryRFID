# 云函数接口说明

> 项目路径：`E:\Projects\01. FamilyLibraryRFID\MiniP-LibraryMngt\cloudfunctions`
---

## 1. commitInStock

**输入参数**

| 参数名 | 类型 | 说明 |
|---|---|---|
| isbn | String | ISBN 号 |
| familyId | String | 家庭 ID |
| operator | String | 操作人 |
| bookshelfId | String | 书架 ID |
| editionType | String | 版本类型 |
| book | Object | 见下表 |

`book` 对象字段：

| 字段名 | 类型 |
|---|---|
| title | String |
| authors | String |
| publisher | String |
| publishYear | String |
| price | String |
| binding | String |
| cover_url | String |
| isSet | Boolean |
| setTotalCount | Number \| null |
| setIndex | Number \| null |
| source | String |

**输出参数**

| 场景 | 字段 | 类型 |
|---|---|---|
| 成功 | success | Boolean（true） |
| 成功 | bookItemId | String |

---

## 2. deleteBookItem

**输入参数**

| 参数名 | 类型 |
|---|---|
| item_id | String |
| family_id | String |
| operator | String |

**输出参数**

| 场景 | 字段 | 类型 |
|---|---|---|
| 成功 | success | Boolean（true） |
| 失败 | success | Boolean（false） |
| 失败 | message | String |

---

## 3. getBookFromDouban_v2

**输入参数**

| 参数名 | 类型 | 说明 |
|---|---|---|
| isbn | String | ISBN 号（必填） |

**输出参数**

| 场景 | 字段 | 类型 |
|---|---|---|
| 成功 | success | Boolean（true） |
| 成功 | book | Object，见下表 |
| 失败（缺 ISBN） | success | Boolean（false） |
| 失败（缺 ISBN） | msg | String |
| 失败（网络/解析异常） | success | Boolean（false） |
| 失败（网络/解析异常） | error | String |

`book` 对象字段：

| 字段名 | 类型 |
|---|---|
| _version | String（固定值 `'v2'`） |
| isbn | String |
| title | String |
| authors | String |
| publisher | String |
| publishYear | String |
| price | String |
| binding | String |
| cover_url | String（固定为空字符串） |
| isSet | null |
| setTotalCount | null |
| setIndex | null |
| source | String（固定值 `'douban'`） |

---

## 4. getBookItem

**输入参数**

| 参数名 | 类型 | 说明 |
|---|---|---|
| itemId | String | book_item 的 _id（必填） |

**输出参数**

| 场景 | 字段 | 类型 |
|---|---|---|
| 成功 | success | Boolean（true） |
| 成功 | data | Object，见下表 |
| 失败 | success | Boolean（false） |
| 失败 | message | String |

`data` 对象字段：

| 字段名 | 类型 |
|---|---|
| title | String |
| authors | String |
| cover_url | String |
| publisher | String |
| publishYear | String |
| price | String |
| binding | String |
| isbn | String |
| isSet | Boolean |
| setTotalCount | Number |
| setIndex | any（来自 book_item.set_index） |
| rfid | any（来自 book_item.rfid_tag_id） |
| inStockDate | Date |

---

## 5. getBookMeta

**输入参数**

| 参数名 | 类型 | 说明 |
|---|---|---|
| isbn | String | ISBN 号（必填） |

**输出参数**

| 场景 | 字段 | 类型 |
|---|---|---|
| 记录存在 | exists | Boolean（true） |
| 记录存在 | book | Object，见下表 |
| 记录不存在 | exists | Boolean（false） |

`book` 对象字段：

| 字段名 | 类型 |
|---|---|
| isbn | String |
| title | String |
| authors | String |
| publisher | String |
| publishYear | String |
| price | String |
| binding | String |
| cover_url | String |
| isSet | Boolean |
| setTotalCount | String \| Number |
| setIndex | null（始终为 null） |
| source | String |

---

## 6. getRecentBooks

**输入参数**

| 参数名 | 类型 |
|---|---|
| familyId | String |

**输出参数**

| 场景 | 字段 | 类型 |
|---|---|---|
| 成功 | success | Boolean（true） |
| 成功 | list | Array\<Object\>，见下表 |
| 失败 | success | Boolean（false） |
| 失败 | error | any |

`list` 数组元素字段：

| 字段名 | 类型 |
|---|---|
| item_id | String |
| family_id | String |
| book_meta_id | String |
| title | String |
| authors | String |
| cover_url | String |
| publisher | String |
| publishYear | String |
| price | String |
| binding | String |
| isbn | String |
| isSet | Boolean |
| setTotalCount | Number |
| setIndex | any |
| status | String |
| rfid | any |
| inStockDate | Date |
| inStockStatus | String |

---

## 7. offBookItem

**输入参数**

| 参数名 | 类型 |
|---|---|
| item_id | String |
| family_id | String |
| operator | String |
| reason | String |

**输出参数**

| 场景 | 字段 | 类型 |
|---|---|---|
| 成功 | success | Boolean（true） |
| 失败 | success | Boolean（false） |
| 失败 | message | String |

---

## 8. onBookItem

**输入参数**

| 参数名 | 类型 |
|---|---|
| item_id | String |
| family_id | String |
| operator | String |

**输出参数**

| 场景 | 字段 | 类型 |
|---|---|---|
| 成功 | success | Boolean（true） |
| 失败 | success | Boolean（false） |
| 失败 | message | String |

---

## 9. prepareInStock

**输入参数**

| 参数名 | 类型 | 说明 |
|---|---|---|
| isbn | String | ISBN 号 |
| familyId | String | 家庭 ID |
| book | Object | 见下表 |

`book` 对象字段（仅用到）：

| 字段名 | 类型 |
|---|---|
| setIndex | Number \| null |

**输出参数**

| 场景 | 字段 | 类型 | 说明 |
|---|---|---|---|
| 成功（meta 不存在） | success | Boolean（true） | |
| 成功（meta 不存在） | metaExists | Boolean（false） | |
| 成功（meta 不存在） | bookMetaId | null | |
| 成功（meta 不存在） | existingItemCount | Number（0） | |
| 成功（meta 不存在） | needUserConfirm | Boolean（false） | |
| 成功（meta 存在） | success | Boolean（true） | |
| 成功（meta 存在） | metaExists | Boolean（true） | |
| 成功（meta 存在） | bookMetaId | String | |
| 成功（meta 存在） | isSet | Boolean | |
| 成功（meta 存在） | existingItemCount | Number | |
| 成功（meta 存在） | needUserConfirm | Boolean | |
| 成功（meta 存在） | duplicateType | String \| null | `'normal'` 或 `'set_conflict'` 或 null |
| 失败 | success | Boolean（false） | |
| 失败 | message | String | |

---

## 10. quickstartFunctions

通过 `event.type` 进行路由分发，不同 type 对应不同的输入输出。

### 公共输入参数

| 参数名 | 类型 | 说明 |
|---|---|---|
| type | String | 操作类型，见下表 |

### 各 type 的输入/输出

#### type = `'getOpenId'`

输入：无附加参数

输出：

| 字段 | 类型 |
|---|---|
| openid | String |
| appid | String |
| unionid | String |

---

#### type = `'getMiniProgramCode'`

输入：无附加参数

输出：`String`（云存储 fileID）

---

#### type = `'createCollection'`

输入：无附加参数

输出：

| 字段 | 类型 |
|---|---|
| success | Boolean |
| data | String（可选） |

---

#### type = `'selectRecord'`

输入：无附加参数

输出：数据库查询结果对象（原始格式）

---

#### type = `'updateRecord'`

输入附加参数：

| 参数名 | 类型 |
|---|---|
| data | Array\<{ _id: String, sales: Number }\> |

输出：

| 字段 | 类型 |
|---|---|
| success | Boolean |
| data | Array |

---

#### type = `'insertRecord'`

输入附加参数：

| 参数名 | 类型 |
|---|---|
| data | Object：{ region: String, city: String, sales: Number } |

输出：

| 字段 | 类型 |
|---|---|
| success | Boolean |
| data | Object |

---

#### type = `'deleteRecord'`

输入附加参数：

| 参数名 | 类型 |
|---|---|
| data | Object：{ _id: String } |

输出：

| 字段 | 类型 |
|---|---|
| success | Boolean |

---

## 11. searchBooks

**输入参数**

| 参数名 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| familyId | String | — | 必填 |
| keyword | String | `''` | 按书名/作者模糊匹配 |
| statusIndex | Number | `0` | 0=仅上架，1=全部，2=仅下架 |
| startDate | String | — | 上架时间起始（可选） |
| endDate | String | — | 上架时间截止（可选） |
| page | Number | `1` | 页码 |
| pageSize | Number | `10` | 每页条数 |

**输出参数**

| 场景 | 字段 | 类型 |
|---|---|---|
| 成功 | success | Boolean（true） |
| 成功 | data | Array\<Object\>，见下表 |
| 成功 | total | Number |
| 失败 | success | Boolean（false） |
| 失败 | message | String |

`data` 数组元素字段：

| 字段名 | 类型 |
|---|---|
| item_id | String |
| family_id | String |
| status | String |
| created_at | Date |
| rfid_tag_id | String \| null |
| title | String |
| authors | String |
| cover_url | String |
| isbn | String |
| price | String |
| publisher | String |
| publish_year | String |
| binding | String |
| is_set | Boolean |
| set_total_count | Number |



# 图书馆管理系统微信小程序端 - 云函数接口说明

图书主数据（BookMeta）
1. getBookMeta
功能

根据ISBN查询系统主数据book_meta

输入
{
  "isbn": "9787111128069"
}
返回
{
  "exists": true,
  "book": {
    "isbn": "",
    "title": "",
    "authors": "",
    "publisher": ""
  }
}
用途

新书上架流程第一步

2. getBookFromDouban_v2
功能

当book_meta不存在时，从豆瓣抓取书籍信息

输入
{
  "isbn": "9787111128069"
}
返回
{
  "success": true,
  "book": {
    "isbn": "",
    "title": "",
    "authors": "",
    "publisher": "",
    "publishYear": "",
    "price": ""
  }
}
用途

book_meta补全

图书上架
3. prepareInStock
功能

上架预检查

负责判断：

book_meta是否存在

是否重复上架

是否套装

是否需要用户确认
输入
{
  "isbn": "",
  "familyId": "",
  "book": {}
}
返回
{
  "success": true,
  "metaExists": true,
  "existingItemCount": 1,
  "needUserConfirm": true
}
用途

上架前检查

4. commitInStock
功能

正式上架

负责：

创建book_meta（如不存在）

创建book_item
输入
{
  "isbn": "",
  "familyId": "",
  "operator": "",
  "bookshelfId": "",
  "book": {}
}
返回
{
  "success": true,
  "bookItemId": ""
}
用途

确认上架

图书实体
5. getBookItem
功能

查询单本实体书详情

输入
{
  "itemId": ""
}
返回
{
  "success": true,
  "bookItem": {},
  "bookMeta": {}
}
用途

详情页

6. getRecentBooks
功能

首页最近上架5本

输入
{
  "familyId": "fm00001"
}
返回
{
  "success": true,
  "list": []
}
用途

首页

7. searchBooks
功能

图书检索

支持：

书名
作者
状态
时间范围
分页
输入
{
  "familyId": "",
  "keyword": "",
  "statusIndex": 0,
  "startDate": "",
  "endDate": "",
  "page": 1,
  "pageSize": 10
}
返回
{
  "success": true,
  "list": [],
  "total": 100
}
用途

书库列表页

生命周期管理
8. offBookItem
功能

下架

输入
{
  "item_id": "",
  "family_id": "",
  "operator": "",
  "reason": ""
}
返回
{
  "success": true
}
副作用

更新：

book_item

inventory_change_log
9. onBookItem
功能

重新上架

输入
{
  "item_id": "",
  "family_id": "",
  "operator": ""
}
返回
{
  "success": true
}
副作用

更新：

book_item

inventory_change_log
10. deleteBookItem
功能

彻底删除（逻辑删除）

输入
{
  "item_id": "",
  "family_id": "",
  "operator": ""
}
返回
{
  "success": true
}
副作用

更新：

fg_delete=true

inventory_change_log


# 2. 整体架构

BookMeta
├─ getBookMeta
├─ getBookFromDouban

BookItem
├─ createBookItem
├─ getBookItem
├─ searchBookItems

BookLifecycle
├─ offBookItem
├─ onBookItem
├─ deleteBookItem

RFID
├─ createBindTask
├─ createFindTask
├─ claimDeviceTask
├─ reportBindResult
├─ reportFindResult
├─ getTidBindingInfo
