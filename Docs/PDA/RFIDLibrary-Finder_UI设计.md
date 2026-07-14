# RFIDLibrary-Finder（Android PDA）UI 设计

> 前置框架设计见同目录 `RFIDLibrary-Finder框架设计.md`；业务流程以 `Docs/` 为准（Source of Truth）。
> 本文仅设计 UI 与交互状态机，**不含实现代码**。

---

## 1. 设计范围与目标

覆盖 PDA 三大核心场景：

1. **领取任务（任务台）** —— 空闲时轮询云端 `device_task`，**一次返回最多 10 条任务清单**供用户选择；同时提供「最近完成任务」入口查询近 3 天完成结果。选择清单中一条后路由到绑定/寻书。
2. **执行绑定 / 重绑定（F4.3）** —— 校验 ISBN → 读标签 TID → 确认解绑（如需）→ 云端绑定 → 回写 EPC。
3. **寻书定位（F6.2）** —— “盖革计数器”模式连续扫描，RSSI/距离/蜂鸣实时反馈；**以目标标签连续读取结果防误判**，用户结束时按是否读到 RFID 结果落 `success` / `failed`。

## 2. PDA 端 UI 总体原则

- **大触控目标 / 高对比 / 大字号**：手持设备多在走动、户外、戴手套场景，主操作按钮 ≥ 64dp，文字 ≥ 18sp。
- **单手可达**：主操作放在屏幕下半部；次要操作（取消/返回）放右上。
- **状态明确**：任何“进行中 / 成功 / 失败”都要有清晰视觉（颜色 + 文案 + 图标），不让用户猜。
- **不阻塞**：RFID 扫描、网络请求走协程，UI 用 `StateFlow` 驱动；耗时操作显示进度，可取消。
- **沿用现有主题**：基于 `ui/theme/RFIDLibraryFinderTheme`（Material3），不另起视觉体系。

## 3. 信息架构与导航

采用 Jetpack Navigation Compose，路由：`home` → `bind` / `find`（凭选中的任务进入）；`home` 另提供 `recent` 入口查看最近完成任务。

```
            ┌─────────────┐
            │   home      │  任务台（轮询清单≤10 / 最近完成任务入口）
            └──┬──────┬───┘
       select  │      │ 点击「最近完成任务」
               ▼      ▼
          ┌──────┐  ┌─────────┐
          │bind/ │  │ recent  │  最近完成任务列表（近3天，结果/理由/时间）
          │ find │  └────┬────┘
          └──┬───┘       │ back
     complete│           │
        (success/failed) │
             ▼           │
           home ◀────────┘  (返回即再次轮询刷新清单)
```

- 选中的 `DeviceTask` 以 **JSON 字符串**经 `kotlinx.serialization` 序列化后作为 NavArgument 传递（`DeviceTask` 需加 `@Serializable`）。
- 每个流程一个 `ViewModel`（`HomeViewModel` / `BindViewModel` / `FindViewModel` / `RecentViewModel`），用 `StateFlow<UiState>` 表达状态机，Composable 只渲染、发事件。
- `home` 进入（onStart / onResume）即触发 `acceptTask` 轮询并刷新清单；从 `bind` / `find` / `recent` 返回 `home` 时同样再次轮询刷新。

## 4. 设计冲突与结论

**现象**：F4.3（343 行）与 F6.2（520 行）要求 PDA 显示书名/作者/ISBN 并与任务 ISBN 校验；但 `device_task`（Docs §3.9）只存 `book_item_id` 与 `target_tid`，无书本主体字段。

**结论**：`device_task` 作为任务队列**保持精简，不冗余存储书本主体数据**；展示字段由 **`api_task_accept`（J1）在业务逻辑中联表 `book_item → book_meta` 反查**，随任务一并返回。既不破坏任务表职责单一，又满足 PDA 显示与 ISBN 校验需求。`device_task` 表本身未新增字段。

**API 返回字段（camelCase，与 `api_task_accept` 实际返回一致）**：
- `task.title`：书名（来自 `book_meta.title`）
- `task.authors`：作者（来自 `book_meta.authors`）
- `task.isbn`：ISBN（来自 `book_meta.isbn`；绑定流程 PDA 扫码 ISBN 与之校验）

**落地涉及改动**：
1. 云函数 `api_task_accept`（J1）：领取后置 running，再按 `book_item_id` 联表 `book_item→book_meta` 取 `title`/`authors`/`isbn` 返回。
2. `api-service-接口说明.md` §J1：返回示例与处理规则覆盖 `isbn` / `title` / `authors`。
3. PDA 框架：`cloud/model/CloudModels.kt` 的 `TaskPayload` 与 `model/DeviceTask` 增加 `isbn` / `title` / `authors`；`TaskCloudService.acceptTask` 映射带入。
4. PDA UI：绑定/寻书界面读取展示；绑定流程在 SCAN_ISBN 态与任务返回的 `isbn` 校验 <font color="red">（待实现）</font>。

> 注意：`device_task` 表不新增字段；展示数据仅在 API 返回时生成，不入任务表。

---

## 5. 屏幕一：任务台（Home）

**职责**：空闲轮询、展示设备/云状态、领取任务并路由。

### 5.1 顶部状态条
| 项 | 内容 |
|---|---|
| 设备 ID | `DeviceIdProvider.deviceId` |
| 云配置 | 已配置 / 缺失（缺失时禁用领取并提示去配 local.properties） |
| RFID | 已初始化 / 未初始化（未初始化时给出「初始化」入口） |

### 5.2 状态机
```
[IDLE] ──(onStart/onResume/从 RECENT·bind·find 返回)──▶ [POLLING]   // 进入即轮询
[IDLE] ──(定时, 每 5s)──▶ [POLLING]                                // 无任务时的自动轮询
[POLLING] ──(有任务)──▶ [TASK_LIST]   // 最多 10 条；每条 [执行][放弃]；底部 [最近完成任务]
[POLLING] ──(无任务)──▶ [IDLE]        // 回到等待态，5s 定时器重新轮询
[TASK_LIST] ──(执行 某条)──▶ 路由到 bind / find   // 导航前取消轮询定时器/进行中轮询
[TASK_LIST] ──(放弃 某条)──▶ completeTask(failed,{reason:"user_abort"}) → 该条移出清单
[TASK_LIST] ──(点击「最近完成任务」)──▶ [RECENT]   // 导航前取消轮询定时器/进行中轮询
[RECENT] ──(返回)──▶ [POLLING]        // 返回即重新轮询
bind / find 完成 ──(返回 home)──▶ [POLLING]
```
- **轮询策略**（遵守设计文档 §2.3）：仅在**未进入 bind / find / recent** 时轮询；`acceptTask(deviceId, limit=10)` 一次返回最多 10 条，云端将其置 `running` 并写入 `claimed_by_device` / `claimed_at`，避免被其它 PDA 重复领取；用户从清单选择一条串行执行，其余候选在返回任务台再次轮询时随新任务一并刷新。
- **IDLE 是「等待 / 无任务」态（合并原 EMPTY）**：既是进入首页的瞬时入口，也是轮询无任务后的停留态，统一持有 **5s 自动轮询定时器**并展示「暂无任务」。不再单独设 EMPTY 态，避免冗余（轮询无任务即回到 IDLE，由定时器再次触发 POLLING）。
- **POLLING 期间 UI 控制（防并发）**：显示「刷新中…」并**禁用** `[执行]` / `[放弃]` / `[最近完成任务]`；离开首页（进入 bind / find / recent）或页面销毁时，**取消轮询定时器与进行中的轮询协程**，避免返回后旧结果覆盖新状态（详见 §12）。
- **「最近完成任务」/「执行」导航前先取消轮询**：点击这两类按钮进入其它页前，先取消首页轮询定时器与进行中轮询协程再导航——防止旧轮询在子页完成并回写首页状态（见 §5.4、§12）。**无需为「点击最近完成任务」本身额外设置禁用态**：该按钮在 `POLLING` 期间已被禁用（无法点）；在 `IDLE`/`TASK_LIST` 点击仅做页面导航，不修改任务状态，无并发写冲突；进入 `RECENT` 后首页操作不可达，自然无并发。
- **无手动「刷新」按钮**：任务台不提供手动刷新。`IDLE` 由 5s 自动轮询定时器发现新任务并自动推进到 `TASK_LIST`；`TASK_LIST` 为瞬态页面（执行即跳转、返回即重轮询），新任务发现同样依赖 `IDLE` 自动轮询与“返回首页重轮询”，无需原地刷新（详见 §12）。
- 「最近完成任务」为**任务台常驻入口**，在 `IDLE` 与 `TASK_LIST` 均可点击进入 `RECENT`；`RECENT` 返回或 `bind`/`find` 完成后均回到 `POLLING` 重新轮询刷新。

### 5.3 任务清单（TASK_LIST）布局
```
┌──────────────────────────────────┐
│  任务台（共 N 条）                  │
│──────────────────────────────────│
│ ▸ 绑定 RFID                       │
│   书名：<title>  作者：<authors>   │
│   ISBN：<isbn>                    │
│            [ 执行 ]   [ 放弃 ]      │
│──────────────────────────────────│
│ ▸ 寻书                             │
│   书名：<title>  TID：<target_tid> │
│            [ 执行 ]   [ 放弃 ]      │
│   ……（最多 10 条，可滚动）……        │
├──────────────────────────────────┤
│     [ 最近完成任务 ]  →             │
└──────────────────────────────────┘
```

> 清单项复用公共组件 `TaskCard`（类型徽标 + 书名/作者/ISBN + 主/次按钮）；点击「执行」携带该 `DeviceTask` 进入 `bind` / `find`，点击「放弃」仅将该条置 `failed`（`reason:"user_abort"`），不阻塞其它候选。

### 5.3.1 无任务布局（IDLE）
```
┌──────────────────────────────────┐
│  任务台（暂无任务）                  │
│──────────────────────────────────│
│     （轻提示「暂无待执行任务」）      │
├──────────────────────────────────┤
│     [ 最近完成任务 ]  →             │
└──────────────────────────────────┘
```
> `IDLE`（无任务）与 `TASK_LIST` 共享底部「最近完成任务」常驻入口；`IDLE` 由 5s 定时器自动回到 `POLLING` 拉取任务（无手动刷新，靠自动轮询与返回重轮询发现任务）；`POLLING` 期间展示「刷新中…」。

### 5.4 最近完成任务入口（RECENT）
任务台底部提供「最近完成任务」入口，点击进入 `recent` 页，调用 `listRecentCompleted(deviceId, withinDays=3)` 拉取**近 3 天**内 `status ∈ [success, failed]` 的任务，展示：

| 字段 | 来源 |
|---|---|
| 类型（绑定 RFID / 寻书） | `taskType` |
| 书名 / 作者 / ISBN | 云端经 `book_item → book_meta` 关联返回 |
| 结果 | `status`（成功 / 失败） |
| 失败理由 | `result.reason`（仅失败显示） |
| 执行时间 | `completed_at` |

```
┌──────────────────────────────────┐
│  最近完成任务（近 3 天）    [ 返回 ] │
│──────────────────────────────────│
│ ✅ 寻书  《三体》  07-14 10:21     │
│ ❌ 寻书  《活着》  未读到RFID 07-13 │
│ ❌ 绑定  《xxx》  用户放弃  07-12   │
│   …（按 completed_at 倒序）……      │
└──────────────────────────────────┘
```

> **进入与加载控制**：进入 `recent` 前已在首页取消轮询定时器与进行中轮询协程（见 §5.2）；`listRecentCompleted` 拉取近 3 天任务期间显示加载进度，**`[返回]` 保持可点**（返回即回到 home 触发 POLLING，无任务状态写冲突）。列表加载完成前不展示空态，避免与加载态混淆。

---

## 6. 屏幕二：绑定 / 重绑定（Bind）—— F4.3

**前置**：进入时持有 `DeviceTask`（`book_item_id`、展示字段 `title`/`authors`/`isbn`、`taskId`）。
**调用链路**：`RfidManager.inventory` → `getRfidBindingInfo(tid)` → `bindRfid(...)` → `RfidManager.writeEpcByTid(tid, book_item_id)` → `completeTask`。

### 6.1 状态机
```
TASK_INFO → SCAN_ISBN → SCAN_TAG → [CONFIRM_UNBIND?] → BINDING → WRITE_EPC → DONE
   │           │           │              │                │            │
   └────(取消)─┴───────────┴──────────────┴────────────────┴────────────┴─▶ completeTask(failed)
```

| 状态 | 界面与行为 | 关键调用 / 校验 |
|---|---|---|
| **TASK_INFO** | 显示任务书名/作者/ISBN + [开始绑定][取消] | — |
| **SCAN_ISBN** | 调用相机扫书上 ISBN 条码；与任务返回的 `isbn` 比对 | 不一致 → 红字提示，允许重试；一致 → 下一步 |
| **SCAN_TAG** | 触发 `RfidManager.inventory()`，列出可见标签（TID+RSSI），用户点选目标标签 | 取到 TID 后调 `getRfidBindingInfo(tid)` |
| **CONFIRM_UNBIND**（条件） | 若 `getRfidBindingInfo` 返回 `bound=true`（标签被他书占用）：弹窗“该标签已被《title》(ISBN) 占用，是否解绑后重绑？”[确认][取消] | 确认→BINDING；取消→回到 SCAN_TAG 或 failed |
| **BINDING** | 进度提示“正在绑定…” | `bindRfid(bookItemId, tid, taskId, deviceId)`；成功(action=bind/rebind)→下一步；失败→重试/取消 |
| **WRITE_EPC** | 进度提示“正在写入 EPC=book_item_id” | `RfidManager.writeEpcByTid(tid, bookItemId)`；成功→DONE；失败→见下 |
| **DONE** | 绿勾“绑定完成（书名 / TID / EPC 已写入）”+ [返回任务台] | 进入 DONE 前调 `completeTask(success, {epcWritten:true})` |

> **操作禁用（防并发 / 防误触）**：绑定流程含多个异步 / 阻塞环节，按状态控制按钮可用性：
> - **TASK_INFO**：`[开始绑定]` `[取消]` 均可点；`[取消]` → `completeTask(failed,{reason:"user_abort"})` 返回任务台。
> - **SCAN_ISBN**（相机扫码中）：仅 `[取消]` 可点；ISBN 比对不一致仅作红字提示与重试，不进入下一步。
> - **SCAN_TAG**（inventory 进行中）：`[选择]` 在取到 TID 前禁用；`[重新扫描]` 可点（重启盘点）；`[取消]` 可点（中断盘点并 abort）。
> - **CONFIRM_UNBIND**（弹窗）：模态 `ConfirmDialog` 阻塞底层 UI，期间不可点其它按钮；`[确认]`→BINDING，`[取消]`→回 SCAN_TAG 或 abort。
> - **BINDING / WRITE_EPC**（云绑定 / EPC 回写异步）：显示 `LoadingOverlay`，**禁用** 除显式弹窗按钮外的导航/返回；EPC 回写失败按 §6.2 弹 `[重试写入]` `[完成(绑定已生效)]`，二者均激活。
> - **DONE**：仅 `[返回任务台]` 可点 → 返回 home 触发 POLLING。

### 6.2 EPC 回写失败的处理（设计权衡）
设计文档 F4.3：「等待成功后再次扫描写入 EPC… 否则更新队列中任务状态为 success（失败则提交云端回退）」。
- 云端 `book_item.rfid_tid` 在 `bindRfid` 成功时写入（绑定已生效）。
- EPC 区写入失败属“标签物理写入”问题，不影响云端绑定，但会影响后续寻书（寻书靠读 EPC/TID 定位）。
- **建议 UI**：WRITE_EPC 失败时弹窗 `[重试写入] [完成(绑定已生效)]`。选“完成”则仍 `completeTask(success)`（绑定有效，EPC 可日后重补）；选“重试”再试。若坚持严格一致，可在重试 N 次后仍失败则 `completeTask(failed)` 触发云端回退——但会撤销已生效绑定，需谨慎。**默认采用“完成(绑定已生效)”**。

### 6.3 绑定界面草图（SCAN_TAG 态）
```
┌──────────────────────────────────┐
│ 绑定：<书名>                       │
│ ISBN 校验：✅ <isbn>               │
│                                    │
│ 扫描到的标签：                      │
│  ▸ TID:E200...  RSSI:-42  [选择]  │
│   TID:E280...  RSSI:-61  [选择]   │
│                                    │
│        [ 重新扫描 ]   [ 取消 ]      │
└──────────────────────────────────┘
```

---

## 7. 屏幕三：寻书（Find）—— F6.2

**前置**：进入时持有 `DeviceTask`（`target_tid`、展示字段）。
**调用链路**：`RfidManager.findTagByTid(targetTid)` 循环 → `RssiLocator.nextPower/locate` → `RfidManager.setPower` → 蜂鸣 → `completeTask`。
**约束**：寻书**不修改** `book_item`/库存（设计文档 F6.2）。

### 7.1 状态机
```
TASK_INFO → SEARCHING → DONE
   │           │  ├─(「结束寻书」：本次会话已读到目标标签连续结果)─▶ completeTask(success, {durationMs, foundRssi, readCount})
   │           │  ├─(「结束寻书」：从未读到任何RFID结果)─────────▶ completeTask(failed, {reason:'no_rfid_read', durationMs, readCount:0})
   │           │  └─(「退出任务」：无法找到RFID信号，暂时退出)──▶ abortTask() → 任务回退 pending
   │           │
   └─(取消)────────────────▶ completeTask(failed, {reason:'user_abort'})
```

| 状态 | 界面与行为 |
|---|---|
| **TASK_INFO** | 显示目标书名/作者/ISBN/TID + [开始寻书][取消] |
| **SEARCHING** | "盖革计数器"模式：全屏大号可视化。每 ~300ms 调 `findTagByTid`；用 `RssiLocator.locate()` 得距离文案+beep 等级，`RssiLocator.nextPower()` 得下一档功率并 `setPower`；RSSI 条随信号增强由红→绿，配蜂鸣（越近越急）。底部 **[结束寻书] [退出任务]**。界面持续累计目标标签**连续读取次数**（`readCount`），达到阈值（默认 3）时亮起「已定位✅」指示（防误判）。 |
| **DONE** | "已结束寻书"+ 结果：成功（本次耗时 / 最后 RSSI / 连续读取次数）或失败（理由：`no_rfid_read` / `user_abort`）+ [返回任务台] |

> **操作禁用（防并发 / 防误触）**：寻书为连续 RFID 扫描循环，需严格控制：
> - **TASK_INFO**：`[开始寻书]` `[取消]` 可点；`[取消]` → `completeTask(failed,{reason:"user_abort"})`。
> - **SEARCHING**（RFID 循环进行中）：**仅 `[结束寻书]` 和 `[退出任务]` 可点**，禁用 `[开始寻书]` 及一切导航/返回。系统返回键弹出确认对话框，由用户选择「结束寻书」「退出任务」或「继续寻书」。
> - **DONE**：`completeTask` 已在进入 DONE 前调用；仅 `[返回任务台]` 可点 → 返回 home 触发 POLLING。

> **结束判定（防误判）**：用户点击「结束寻书」时，若本次会话已取得目标标签**连续稳定读取结果**（`readCount ≥ 阈值`）→ `completeTask(success, …)`；若**从未读到任何 RFID 结果**（`readCount = 0`）→ `completeTask(failed, {reason:'no_rfid_read', …})`，任务作为失败关闭。判定规则见需求流程定义书 F6.2。

> **退出任务（新增）**：用户点击「退出任务」时，弹出确认对话框提示"退出后任务将回到待领取状态，可稍后重新寻书"，用户确认后调用 `api_task_abort`（J6）将任务从 `running` 回退为 `pending` 并清空设备占用信息。此操作**不**标记任务为 `failed`，不写入 `result`。适用场景：RFID 读取失败、距离过远、不在同一房间等暂时无法定位的情况。

### 7.2 寻书可视化（SEARCHING 态）
- **中心指示**：大圆形/进度环，半径或颜色随 RSSI 强度变化（近=绿大，远=红小）。
- **文字**：距离文案（“2米以上 / 1~2米 / 0.5~1米 / 0.5米以内”）。
- **RSSI 数值**：实时刷新。
- **蜂鸣**：`beep` 等级 1~4 → 频率/音量递增（距越近越快）。建议新增 `BeepPlayer`（Android `ToneGenerator` 或 SDK 蜂鸣 API）。
- **功率档位**：小字显示当前功率（30/20/10dBm），由 `RssiLocator` 自动切换。
- **蜂鸣**：`BeepPlayer.beepByLevel(level)` 根据 beep 等级（1~4）播放对应急促度蜂鸣，等级越高（越近）越急促。

```
┌──────────────────────────────────┐
│        寻书：<书名>                │
│                                    │
│            ( ●●● 近 )              │
│         距离：0.5米以内             │
│         RSSI：-28   功率：10dBm    │
│         Beep: Lv4                 │
│                                    │
│     [   结束寻书   ] [ 退出任务 ]   │
└──────────────────────────────────┘
```

---

## 8. 公共组件与主题

| 组件 | 说明 |
|---|---|
| `TaskCard` | 任务摘要卡（类型徽标 + 书名/作者/ISBN + 主/次按钮），清单中复用 |
| `RecentList` | 最近完成任务列表（类型 + 书名 + 结果徽标 + 失败理由 + 完成时间），`recent` 页复用 |
| `StateBanner` | 进行中/成功/失败 横幅（颜色+图标+文案） |
| `RssiBar` | RSSI 强度条（红→绿渐变，绑定/寻书复用） |
| `ConfirmDialog` | 解绑确认、取消确认等 |
| `LargeButton` | 主操作大按钮（≥64dp，强调色） |
| `ScanOverlay` | 相机 ISBN 扫码取景框（绑定流程） |
| `LoadingOverlay` | 耗时操作遮罩，可取消 |

主题沿用 `RFIDLibraryFinderTheme`；PDA 场景可适当提高对比度与最小点击尺寸。

## 9. 权限与依赖（需补充）

| 项 | 说明 |
|---|---|
| 相机 `CAMERA` | 在 Manifest 声明；用于 ISBN 扫码 |
| 条码识别 | 新增 `com.google.mlkit:barcode-scanning`（或 CameraX + ML Kit） |
| 蜂鸣/音频 | `BeepPlayer`：`ToneGenerator` 或 SDK 蜂鸣 API |
| 振动（可选） | `VIBRATE` 权限 + `Vibrator`，作为寻书近距的额外反馈 |
| 协程/StateFlow | 含 `kotlinx-coroutines-android`；ViewModel 用 `lifecycle-viewmodel-compose` |

## 10. 与现有框架代码的映射

| UI 行为 | 复用现有封装 |
|---|---|
| 轮询领取 | `TaskCloudService.acceptTask(deviceId, limit=10)` / `completeTask(...)` |
| 最近完成查询 | `TaskCloudService.listRecentCompleted(deviceId, withinDays=3)` |
| 读标签/写 EPC | `RfidManager.inventory` / `writeEpcByTid` / `findTagByTid` / `setPower` |
| 绑定查询/执行 | `TaskCloudService.getRfidBindingInfo` / `bindRfid` |
| 寻书信号换算 | `RssiLocator.nextPower` / `locate` |
| 设备标识 | `DeviceIdProvider.deviceId` |
| 依赖装配 | `di.AppContainer` |

## 11. 后续实现待办（开发阶段） <font color="red">（待实现）</font>

1. **（§4：任务表保持精简）**：展示字段不入 `device_task`；`api_task_accept` 领取时联表 `book_item → book_meta` 返回 `isbn`/`title`/`authors`，`api_task_createBindRfid`/`createFindBook` 不填充展示字段。
2. 新增 `HomeViewModel` / `BindViewModel` / `FindViewModel` / `RecentViewModel` + 四个 Composable 屏（含 `recent`）+ NavHost；`home` 进入与返回均触发 `acceptTask(limit=10)` 轮询刷新。
3. 新增相机 ISBN 扫码（ML Kit）+ `BeepPlayer` + `RssiBar` 等组件。
4. 绑定流程 EPC 回写失败的"完成(绑定已生效)"分支。
5. 寻书会话内 `readCount` 连续读取计数与「已定位✅」指示；结束时按是否读到 RFID 结果落 `success` / `failed`（`no_rfid_read` / `user_abort`）。
6. 任务台「最近完成任务」列表（`listRecentCompleted`，近 3 天，结果/失败理由/完成时间）+ `RecentList` 组件。
7. 端到端联调（手机发起 bind/find 任务 → PDA 领取执行 → 小程序侧状态自愈）。

---

## 12. 调试功能（面向开发人员）

### 12.1 入口

首页底部版本号上方提供「🔧 调试」入口，替代原先单独的「按键测试」入口，点击进入调试菜单页。

### 12.2 调试菜单（Debug Menu）

```
┌──────────────────────────────────┐
│  ← 返回         调试工具          │
│──────────────────────────────────│
│                                  │
│  ┌──────────────────────────┐   │
│  │ 🔑 按键测试               │   │
│  │ 测试 PDA 侧键/扫码事件    │ → │
│  └──────────────────────────┘   │
│                                  │
│  ┌──────────────────────────┐   │
│  │ 📡 RFID 标签读写          │   │
│  │ 功率调节/连续读取/写入EPC │ → │
│  └──────────────────────────┘   │
│                                  │
│  ┌──────────────────────────┐   │
│  │ 🔊 Beep 蜂鸣测试         │   │
│  │ 短音/滴滴连续音/急促嘀嘀嘀│ → │
│  └──────────────────────────┘   │
└──────────────────────────────────┘
```

菜单项：
- **按键测试**：复用现有 `KeyTestScreen`，实时显示 PDA 所有 KeyEvent 和扫码广播结果
- **RFID 标签读写**：跳转至 `RfidTestScreen`，提供底�� RFID 调试能力
- **Beep 蜂鸣测试**：跳转至 `BeepTestScreen`，测试 PDA 蜂鸣器的短音/滴滴连续音/急促嘀嘀嘀及 beep 等级（1~4）

### 12.3 RFID 标签读写测试（RFID Test）

#### 状态机

```
IDLE → READING（连续读取中） → IDLE（停止）
  │         │
  └── WRITING（写入中）──→ IDLE（写入完成）
```

#### 界面布局

```
┌──────────────────────────────────┐
│  ← 返回      RFID 标签读写        │
│──────────────────────────────────│
│  ■ 读写功率                       │
│  ┌──────────────────────────┐   │
│  │ 读功率: 26 dBm            │   │
│  │ [-5] [-1]  [26] [+1] [+5]│   │
│  │                           │   │
│  │ 写功率: 26 dBm            │   │
│  │ [-5] [-1]  [26] [+1] [+5]│   │
│  └──────────────────────────┘   │
│                                  │
│  ■ 连续读取                       │
│  ┌──────────────────────────┐   │
│  │ 状态: 读取中… / 已停止    │   │
│  │ 读取次数: 128             │   │
│  │ 当前标签数: 2             │   │
│  │                           │   │
│  │ 标签列表:                 │   │
│  │ ▸ TID:E200… RSSI:-42     │   │
│  │   EPC:ABCD1234…          │   │
│  │ ▸ TID:E280… RSSI:-61     │   │
│  │   EPC:EFEF5678…          │   │
│  │                           │   │
│  │ [ 开始读取 ] [ 停止读取 ] │   │
│  └──────────────────────────┘   │
│                                  │
│  ■ 写入 EPC                      │
│  ┌──────────────────────────┐   │
│  │ EPC 写入值: [___________] │   │
│  │                           │   │
│  │ 选择目标标签:              │   │
│  │ ◉ TID:E200… RSSI:-42    │   │
│  │ ○ TID:E280… RSSI:-61    │   │
│  │                           │   │
│  │ [ 写入 RFID ]             │   │
│  │                           │   │
│  │ 结果: ✅ 写入成功 / ❌ … │   │
│  └──────────────────────────┘   │
└──────────────────────────────────┘
```

#### 交互规则

| 区域 | 功能 | 说明 |
|---|---|---|
| 读写功率 | 显示当前读/写功率 | 进入页面时从 `RfidManager.getPower()` 加载 |
| 功率调节 | +/-1 或 +/-5 | 范围 5-30 dBm，超出边界时对应按钮禁用；立即调用 `setPower()` 生效 |
| 连续读取 | 开始/停止 | 启动协程循环（~200ms 间隔）调用 `inventory()`，按 TID 去重保留最新 RSSI |
| 写入 EPC | 选择标签 + 输入 EPC → 写入 | 从已发现标签中选择目标 TID（RadioButton，单标签自动选中），输入 EPC 十六进制值，调用 `writeEpcByTid()` |

#### 操作禁用

| 状态 | 禁用 | 允许 |
|---|---|---|
| IDLE | 停止读取（未在读取）、写入（无标签时） | 开始读取、功率调节、EPC 输入、返回 |
| READING | 开始读取、写入 RFID | 停止读取、功率调节、EPC 输入、选择标签 |
| WRITING | 开始/停止读取、功率调节 | 无（写入完成后自动回到 IDLE） |

### 12.4 Beep 蜂鸣测试（Beep Test）

#### 状态机

```
IDLE → PLAYING（播放中） → IDLE（播放完成/停止）
```

#### 界面布局

```
┌──────────────────────────────────┐
│  ← 返回      Beep 蜂鸣测试        │
│──────────────────────────────────│
│  ■ 设备状态                       │
│  ┌──────────────────────────┐   │
│  │ 🔊 BeepPlayer 已就绪      │   │
│  │ 使用 Android ToneGenerator │   │
│  │ 产生系统蜂鸣音             │   │
│  └──────────────────────────┘   │
│                                  │
│  ■ 基础蜂鸣测试                   │
│  ┌──────────────────────────┐   │
│  │                           │   │
│  │  [ 🔊 短音 (~50ms) ]      │   │
│  │                           │   │
│  │  [ 🔊🔊 滴滴连续音 ]      │   │
│  │  4组双短音                │   │
│  │                           │   │
│  │  [ 🔊🔊🔊 急促嘀嘀嘀 ]    │   │
│  │  12连音                   │   │
│  │                           │   │
│  │  提示：短音模拟单次标签读取│   │
│  │  确认；滴滴连续音模拟中距离│   │
│  │  寻书；急促嘀嘀嘀模拟极近 │   │
│  └──────────────────────────┘   │
│                                  │
│  ■ Beep 等级测试                  │
│  │  （盖革计数器模拟）             │
│  ┌──────────────────────────┐   │
│  │ Lv1 远距离(>2m) 单短音   │   │
│  │ Lv2 中距离(1-2m) 双短音  │   │
│  │ Lv3 近距离(0.5-1m) 三短音│   │
│  │ Lv4 极近(<0.5m) 急促连音 │   │
│  └──────────────────────────┘   │
│                                  │
│  ┌──────────────────────────┐   │
│  │ ✅ 短音已播放              │   │
│  └──────────────────────────┘   │
└──────────────────────────────────┘
```

#### 交互规则

| 区域 | 功能 | 说明 |
|---|---|---|
| 设备状态 | 显示 BeepPlayer 初始化状态 | 使用 Android `ToneGenerator`（`TONE_PROP_ACK`），无需额外音频资源文件 |
| 短音 | 播放单次 ~50ms 蜂鸣 | 模拟寻书扫描中每次读到目标标签时的确认音 |
| 滴滴连续音 | 播放 4 组双短音 | 模拟中距离（1-2m，beep Lv2）寻书反馈 |
| 急促嘀嘀嘀 | 播放 12 连音 | 模拟极近距离（<0.5m，beep Lv4）寻书反馈 |
| 等级测试 Lv1~4 | 按 beep 等级单独播放 | Lv1=远距单音 / Lv2=双短音 / Lv3=三短音 / Lv4=急促多连音，对应 RssiLocator 距离估算 |

#### 操作禁用

| 状态 | 禁用 | 允许 |
|---|---|---|
| IDLE | 无 | 短音、滴滴连续音、急促嘀嘀嘀、Lv1~4、返回 |
| PLAYING（连续音播放中） | 短音、滴滴连续音、急促嘀嘀嘀、Lv1~4 | 停止、返回 |

---

## 13. 各页面操作禁用总览

> 汇总全文档状态机中“哪些期间需禁用哪些操作”，便于实现时统一落地。原则：**异步 / 阻塞环节禁用除显式允许外的操作；导航前先取消首页轮询；模态弹窗阻塞底层 UI**（与 §5.2 一致）。

| 页面 | 状态 / 期间 | 禁用操作 | 允许操作 | 说明 |
|---|---|---|---|---|
| 任务台 Home | POLLING（轮询中） | `[执行]` `[放弃]` `[最近完成任务]` | 无（展示“刷新中…”） | 防并发写；离开页面取消定时器与协程 |
| 任务台 Home | IDLE（无任务等待） | 无 | `[最近完成任务]` | 5s 定时器自动 POLLING（无手动刷新） |
| 任务台 Home | TASK_LIST | 无 | `[执行]` `[放弃]` `[最近完成任务]` | 各候选独立，放弃单条不阻塞其它；瞬态页，执行即跳转、返回即重轮询 |
| 任务台 Home | 导航至 bind / find / recent 前 | — | — | 先取消首页轮询定时器与进行中协程再导航 |
| Bind | TASK_INFO | 无 | `[开始绑定]` `[取消]` | 取消 → abort |
| Bind | SCAN_ISBN（相机扫码） | 其它导航 | `[取消]` | 不一致仅红字提示 + 重试 |
| Bind | SCAN_TAG（inventory 中） | `[选择]`（未取到 TID 前） | `[重新扫描]` `[取消]` | 重扫重启盘点 |
| Bind | CONFIRM_UNBIND（弹窗） | 底层所有按钮（模态） | `[确认]` `[取消]` | 确认 → BINDING，取消 → 回扫 / abort |
| Bind | BINDING / WRITE_EPC（异步） | 导航 / 返回 | 失败弹窗 `[重试写入]` `[完成(绑定已生效)]` | `LoadingOverlay` |
| Bind | DONE | 无 | `[返回任务台]` | 返回 home 触发 POLLING |
| Find | TASK_INFO | 无 | `[开始寻书]` `[取消]` | 取消 → abort |
| Find | SEARCHING（RFID 循环） | `[开始寻书]`、导航 / 返回 | `[结束寻书]` `[退出任务]` | 系统返回键弹出确认对话框（结束/退出/继续）；`[退出任务]` 需二次确认 |
| Find | DONE | 无 | `[返回任务台]` | `completeTask` 已前置调用 |
| RECENT | 列表加载中 | 无（空态不展示） | `[返回]` | 进入前已取消首页轮询；返回 → POLLING 无冲突 |
| Debug Menu | — | 无 | `[按键测试]` `[RFID标签读写]` `[Beep蜂鸣测试]` `[返回]` | 纯导航页，无异步操作 |
| RFID Test | IDLE | `[停止读取]`（未在读取）、`[写入RFID]`（无标签时） | `[开始读取]`、功率调节、EPC 输入、`[返回]` | 无标签时写入按钮禁用并提示 |
| RFID Test | READING | `[开始读取]`、`[写入RFID]` | `[停止读取]`、功率调节、EPC 输入、选择标签 | 读取与写入互斥 |
| RFID Test | WRITING | `[开始/停止读取]`、功率调节、`[返回]` | 无 | 写入完成后自动回到 IDLE |
| Beep Test | 播放中（连续音） | `[短音]` `[滴滴连续音]` `[急促嘀嘀嘀]` `[Lv1~4]` | `[停止]` `[返回]` | 防并发播放，停止后可重试 |
| Beep Test | IDLE | 无 | `[短音]` `[滴滴连续音]` `[急促嘀嘀嘀]` `[Lv1~4]` `[返回]` | 各模式独立，点击即播放 |

---

> 本设计为阶段一产出，§4 冲突结论明确，可进入阶段二实现。
