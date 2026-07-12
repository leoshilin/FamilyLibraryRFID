# Bug 分析：图书详情页 / 检索页看不到 RFID 绑定按钮

> 分析范围：`MiniP-LibraryMngt` 小程序前端 + 相关云函数
> 现象版本：main 分支当前代码（pull 于分析当日）

---

## 一、现象复述

1. **路径 A（首页 → 图书列表 → 详情页）**：进入首页后点击任意一本图书跳转到图书详情页，`console` 无任何报错，但页面上**只有「下架」按钮**，没有 RFID 绑定区域的任何按钮。
2. **路径 B（首页 → 查看全部 → 检索页 → 点图书）**：点击图书后展开动态按钮，只出现「详情」和「下架」两个按钮，**同样没有 RFID 绑定/解绑/重新绑定按钮**。
3. 已知数据：所有 `book_item` 的 `rfid_tid` 都是 `null`（未绑定）；云平台上手动建了 `device_task`、`rfid_bind_log` 两个空集合（无任何任务数据）。

---

## 二、结论（根因）

> **根因不是数据、也不是 RFID 任务状态，而是前端权限集 `globalData.permissions` 未被加载，导致 `canBind` / `canUnbind` 始终为 `false`，所有 RFID 按钮被静默隐藏。**

`app.login()` 是**唯一**会把权限写进 `globalData.permissions` 的入口，但它**只在「我的（mine）」页面的 `onShow` 中被调用**。而小程序启动默认落在「首页（index）」tab，**首页 / 图书详情 / 检索页这几个页面从不主动触发登录**。

只要用户**没有先打开过「我的」页**，就直接进入图书详情或检索页，此时 `globalData.permissions` 仍是 `app.js` 里的初始值 `{}`，于是：

- `book.js` 第 84 行：`canBind = !!perms.canCreateBindRfidTask` → `!!undefined` → **`false`**
- `book.js` 第 85 行：`canUnbind = !!perms.canUnbindRfid` → **`false`**

而「下架」按钮在 WXML 里**不依赖任何权限门控**，所以照常显示——这与「只有下架、没有 RFID 按钮」的现象完全吻合，且因为是数据绑定为 `false` 导致节点不渲染，**不会抛任何异常，console 自然无报错**。

---

## 三、证据链（逐条对应代码）

### 1. 权限来源：`globalData.permissions` 初始为空，且只在 mine 页填充

`miniprogram/app.js`
```js
globalData: {
  // 当前家庭下的用户权限集（由 api_user_login 返回）
  permissions: {}          // ← 初始就是空对象
},
async onLaunch() {
  // 仅初始化云环境，【没有】调用 login()，应用启动时不加载权限
  wx.cloud.init({ ... })
},
async login() {
  const result = await userServices.login()
  if (result.success && result.registered) {
    this.globalData.permissions = result.permissions || {}   // ← 唯一写入点
  }
}
```

全仓搜索 `app.login()` 调用：**仅出现在 `pages/mine/mine.js`**（第 52 行 `await app.login()` 在 `onShow` 中），其它页面（index / book / book-search）均未调用。

`app.json` 的 `tabBar` 顺序：`pages/index/index`（首页）在前，`pages/mine/mine`（我的）在后 → 应用启动默认停在「首页」，**启动流程不会经过 mine 页**，权限因此未被加载。

### 2. 权限键确实存在，生成逻辑本身正确（排除权限模块 bug）

`cloudfunctions/_shared/permission.js` 中 `FRONTEND_PERMISSION_KEYS` 明确包含：
```js
canCreateBindRfidTask: PERMISSIONS.RFID_TASK_CREATE_BIND,   // 第 97 行
canUnbindRfid:         PERMISSIONS.RFID_UNBIND,             // 第 98 行
```
且 `buildFamilyPermissions()` 对 OWNER / MEMBER 会返回这两个键为 `true`。
**结论**：只要 `app.login()` 被调用且用户属于 OWNER/MEMBER，权限集就会包含这两个键。问题不在权限模块，而在**它没被调用**。

### 3. 两条路径都因 `canBind/canUnbind=false` 而隐藏 RFID 区

**路径 A — 图书详情页** `pages/book/book.js` 第 81-86 行 + `book.wxml` 第 176-215 行：
- 下架按钮：`wx:elif="{{book.status === 'in_stock'}}"` 下直接渲染，**无权限门控** → 显示。
- RFID 区：外层 `wx:if="{{showRfid}}"`，内层按钮 `wx:if="{{canBind && !isBound}}"`（绑定）、`wx:if="{{canUnbind}}"`（解绑）、`wx:if="{{canBind}}"`（重新绑定）。
- 由于 `canBind=false`、`canUnbind=false`，**整个 RFID 区没有任何按钮可渲染**。

> 关于 `showRfid`：详情页在收到 `bookData` 时会把 `book.status` 由 `inventoryStatus/inStockStatus` 补成 `'in_stock'`（book.js 第 67-69 行），且 `itemId` 来自 `api_book_searchRecent` 返回的 `itemId: item._id`（该云函数确实返回 `itemId` 与 `inventoryStatus`），所以 `showRfid = true`、`isBound = !!null = false` 都是符合预期的——**唯一卡住的就是 `canBind`/`canUnbind`**。

**路径 B — 检索页展开区** `pages/book-search/book-search.wxml` 第 261-307 行：
```xml
<view class="actions" wx:if="{{currentExpandedId === item.itemId}}">
  <block wx:if="{{item.inventoryStatus === 'in_stock'}}">
    <view ... >详情</view>
    <view ... >下架</view>

    <!-- RFID 区域：整块被 canBind || canUnbind 门控 -->
    <block wx:if="{{canBind || canUnbind}}">     <!-- ← 两个都为 false 时整块不渲染 -->
      <view wx:if="{{canBind && !item.rfidTid}}">绑定RFID</view>
      <block wx:if="{{item.rfidTid}}">
        <view wx:if="{{canUnbind}}">解绑</view>
        <view wx:if="{{canBind}}">重新绑定</view>
      </block>
    </block>
  </block>
</view>
```
当 `canBind` 和 `canUnbind` 都为 `false` 时，**第 275 行整块 RFID 区域被隐藏**，只剩「详情」「下架」——这与用户描述的「只有详情和下架两个按钮」**逐字吻合**。

### 4. 用户手动建的空集合与本次 bug 无关

`device_task` / `rfid_bind_log` 为空 → 没有任何进行中任务 → `bindInProgress = false`（本来就是默认值）。这只会保证「绑定中…」提示不出现，**不影响按钮是否渲染**。RFID 按钮的可见性只取决于 `showRfid`（状态/ itemId）和 `canBind/canUnbind`（权限），与这两个集合是否为空无关。因此空集合不是根因，属于干扰项。

---

## 四、为什么「console 无报错」是合理的

这是一次**数据绑定层面的静默隐藏**（`wx:if` 条件为 `false` → 节点不创建），并非 JS 运行时异常或云函数调用失败，所以不会在 console 输出任何 error / warning。这也正是它比「报错型 bug」更隐蔽的原因。

---

## 五、复现条件

1. 全新进入小程序（或清掉 `globalData` 缓存后）；
2. **未打开过「我的」页**；
3. 直接从「首页」点书 → 详情页（路径 A），或从「首页 → 查看全部 → 检索页」点书（路径 B）；
4. 此时即可稳定复现：只有「下架」，没有 RFID 按钮。
反之，若先打开过「我的」页（触发了 `app.login()`），再进入详情/检索页，RFID 按钮会正常出现——这也解释了为什么「有时有、有时没有」。

---

## 六、修复建议

### 方案 1（主修复，推荐）：应用启动即加载权限
在 `app.js` 的 `onLaunch` 中调用登录，使 `globalData.permissions` 在用户进入任何业务页面前就绪：

```js
async onLaunch() {
  if (!wx.cloud) { console.error('...'); return }
  wx.cloud.init({ env: this.globalData.env, traceUser: true })
  // 启动即拉取权限，避免首页/详情/检索页因 permissions 为空而隐藏 RFID 按钮
  this.login()
}
```
> 说明：`onLaunch` 不 `await` 异步结果，但 `globalData` 会在 Promise resolve 后填充；页面跳转发生在启动之后，读取时通常已就绪。

### 方案 2（消除竞态，更稳健）：把 `login()` 改造成幂等的 `ensureLogin()`
带 Promise 缓存，业务页面用 `await` 后再读权限，彻底避免「启动瞬间点击图书」的竞态：
```js
ensureLogin() {
  if (!this._loginPromise) this._loginPromise = this.login()
  return this._loginPromise
}
```
`pages/book/book.js`、`pages/book-search/book-search.js` 在 `onShow`（或 `onLoad` 读取权限处）改为 `await getApp().ensureLogin()` 后再 setData `canBind/canUnbind`。

### 方案 3（防御性兜底，低成本）：页面 `onShow` 重新读取权限
- `book.js` 当前 `onShow` 只调了 `refreshBookFromServer()`，可在其中一并基于 `getApp().globalData.permissions` 重新 setData `canBind/canUnbind`，实现「从 mine 页登录后再回来」的自愈。
- `book-search.js` 同理在 `onShow` 补一次权限刷新。

> 建议 **方案 1 + 方案 2 组合**：既能覆盖绝大多数场景，又从根上消除竞态；方案 3 作为可选兜底。

---

## 七、附带发现的次要问题（与本次现象无关，但建议一并修）

1. `api_book_search` 返回结构里**没有 `setIndex` 字段**（只有 `setTotalCount`），详情页 `book.setIndex` 在路径 B 下会是 `undefined`。若套装书需要在检索→详情链路展示「当前第几本」，需在云函数返回中补上 `setIndex: item.set_index`。
2. `book.js` 的 `refreshRfidState()` 依赖 `book.status`，而数据来源（`api_book_search` / `api_book_searchRecent`）返回的是 `inventoryStatus`/`inStockStatus` 而非 `status`。当前靠 eventChannel 回调里的补字段逻辑兜底（book.js 第 67-69 行），**建议统一约定一个字段名**，避免后续新增页面再次踩坑。

---

*分析完成。根因单一且确定：权限未在小程序启动/业务页进入前加载，导致 RFID 按钮门控 `canBind/canUnbind` 恒为 `false`。*
