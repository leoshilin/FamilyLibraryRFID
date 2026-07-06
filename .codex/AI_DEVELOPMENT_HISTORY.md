# AI Development History

> 记录影响未来开发的重要设计决策。
>
> 不记录普通开发日志。

---

# 2026

---
### 云函数的Shared Module的处理方式
在cloudfunctions下，Shared Module的处理方式规定如下：

  * _shared/ 是公共源码目录，下面配置共通代码模块（比如： permission.js），共通代码模块的修改只允许通过此目录进行。api_xxx/common/ 是自动生成目录，禁止手工修改。
  * 所有公共模块统一通过 require('./common/...') 引用。
  * 修改 _shared 后，必须执行 npm run sync-common，再上传相关云函数。

```
    修改 _shared
            ↓
    npm run sync-common
            ↓
    所有云函数同步
            ↓
    上传云函数
```
---

## 权限取消Action层的模型简化
项目最初的权限设计同时使用了 Action 和 Permission 两个概念，例如：

ACTIONS.FAMILY_UPDATE
ROLE_PERMISSION
checkPermission({ action })

经过评审后认为，当前项目Action 与 Permission 实际上是一一对应的，没有独立存在的价值。
这里的 FAMILY_UPDATE 同时表示：

 - API 所需权限
 - Role 所拥有的权限
 - checkPermission() 的检查对象

因此，决定取消 Action 概念。

整个权限模型统一采用 Permission 作为唯一权限标识。

统一命名如下：

    ACTIONS → PERMISSIONS
    action 参数 → permission
    isActionAllowedForRole() → hasPermission()
    FAMILY_CREATE_ACTIONS → PUBLIC_PERMISSIONS

权限检查统一为：

    Role -> Permission -> API

而不是：

    Role -> Permission -> Action -> API

### 设计原则

以后所有云函数调用统一采用：

    await checkPermission({
    db,
    openid,
    permission: PERMISSIONS.BOOKITEM_DELETE,
    familyId
    })

Role 与 Permission 的关系由 ROLE_PERMISSION 定义：

    ROLE_PERMISSION = {
    OWNER: new Set([
        PERMISSIONS.BOOKITEM_DELETE,
        ...
    ])
    }

权限判断统一通过：

hasPermission(permission, familyRole)

实现。

---

## 数据库采用 book_meta + book_item 两层设计

原因：

book_meta

表示逻辑图书。

book_item

表示实体图书。

一本书可以对应多个实体副本。

未来 RFID 绑定发生在：

book_item。

---

## RFID 字段采用 Optional Field 设计

book_item.rfid_tid 不保存 null。

设计原则：

- 未绑定 RFID：字段不存在
- 已绑定 RFID：保存 RFID TID
- 解绑 RFID：删除字段（unset）

原因：

1. 更符合 MongoDB 文档数据库设计理念。
2. 避免唯一索引对 null 的不同实现带来的兼容性问题。
3. 查询已绑定/未绑定状态更加直观。
4. 与微信云数据库的字段删除机制保持一致。

## RFID 唯一约束

绑定 RFID 后：

rfid_tid

必须唯一。

解绑 RFID 时：

删除 rfid_tid。

因此：

数据库允许存在多个 null。

唯一索引不会产生冲突。

---

## API 全部采用 Cloud Function

无论：

微信

还是 PDA

统一访问：

Cloud Function。

禁止客户端直接访问数据库。

---

## Service 层统一封装

页面：

↓

Service

↓

Cloud Function

页面不得直接调用：

wx.cloud.callFunction()

---

## API 命名统一

统一采用：

api_xxx

例如：

api_book_search

避免：

searchBook()

bookSearch()

等混合风格。

---

## RBAC Lite

权限控制采用：

RBAC Lite。

角色绑定于：

user_family。

权限作用于：

某一个家庭。

不是整个系统。

---

## 家庭是核心业务对象

用户可以加入多个家庭。

每个家庭拥有：

自己的图书。

自己的成员。

自己的权限。

所有业务默认基于：

family_id。

---

## Docs 是 Source of Truth

设计文档优先于代码。

如发现：

代码

与

文档

冲突。

AI 应：

指出冲突。

不要自行修改。

---

## 厂家 SDK

RFID PDA 使用厂家 SDK。

SDK 视为第三方代码。

AI 不应：

修改 SDK。

需要扩展时：

新增 Wrapper。

---

## 长期开发原则

优先：

设计一致性。

其次：

代码一致性。

最后：

开发速度。

任何自动生成代码：

必须遵守已有设计。

避免：

为了实现功能而破坏架构。
