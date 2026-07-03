# AI Project Guide
> AI 项目快速导览（供 Codex / ChatGPT / Claude 等 AI 编程助手阅读）

---

# 1. 项目简介

## 项目名称

FamilyLibraryRFID

## 项目目标

本项目用于家庭场景下的实体图书管理。

主要目标包括：

- 家庭成员共享图书信息
- RFID 图书管理
- PDA 快速盘点
- 微信小程序日常管理
- 基于微信云开发实现后端能力

本项目长期维护，设计优先于快速实现。

---

# 2. 项目目录

```
FamilyLibraryRFID/

Docs/
项目设计文档

MiniP-LibraryMngt/
微信小程序

RFID_Handheld/
Android RFID PDA
```

---

# 3. Source of Truth（最高优先级）

所有设计均以 Docs 下文档为准。

如出现：

代码
≠
设计文档

不得直接修改代码进行适配。

应首先指出冲突。

---

# 4. 总体架构

```
微信小程序
      │
      ▼
Service 层
      │
      ▼
Cloud Function API
      │
      ▼
Cloud Database


Android PDA
      │
      ▼
Cloud Function API
      │
      ▼
Cloud Database
```

RFID PDA 不允许直接访问数据库。

所有业务统一通过 Cloud Function。

---

# 5. 技术栈

前端：

- 微信小程序
- JavaScript
- WXML
- WXSS

后端：

- 微信云开发
- Cloud Function
- Cloud Database

PDA：

- Android
- Kotlin
- 厂家 RFID SDK

---

# 6. 当前设计原则

## Service 层

页面不得直接调用：

wx.cloud.callFunction()

统一调用：

services/

中的 API。

---

## API

统一命名：

api_xxx

例如：

api_book_search

api_book_bind_rfid

---

## 数据库

数据库设计已经固定。

AI 不应：

- 修改字段名称
- 修改字段含义
- 修改主键设计

除非明确要求。

---

## 注释

代码注释统一中文。

---

## 命名

保持已有命名风格。

不得自行创造另一套命名规范。

---

# 7. RFID

book_item.rfid_tid 为可选字段。


RFID 是整个项目的重要能力。

图书可以：

未绑定 RFID：

字段不存在。

绑定 RFID 后：

新增 rfid_tid 字段。绑定后的 rfid_tid 必须保持唯一。

解绑 RFID：

删除 rfid_tid 字段。

---

# 8. 权限

采用 RBAC Lite。

权限基于：

家庭

而不是整个系统。

角色定义于：

user_family

---

# 9. PDA

厂家 SDK 视为第三方代码。

AI：

不要修改 SDK。

如需扩展：

新增 Wrapper。

---

# 10. 开发要求

AI 修改代码前应：

① 阅读相关设计文档

② 阅读涉及目录代码

③ 给出修改计划

④ 再开始修改

不要一次完成多个独立功能。

---

# 11. 输出要求

优先：

小步提交。

保持最小修改。

避免无关重构。

保持代码风格一致。
