# RFIDLibrary-Finder（Android PDA）UI 设计

> AI 生成的设计文档（按 AI_PROJECT_GUIDE §11 输出至 `.codex/output/`）。
> 对应代码目录：`RFID_Handheld/RFIDLibrary-Finder/`。
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
[IDLE] ──(进入页/返回页 轮询 acceptTask(limit=10))──▶ [POLLING]
[POLLING] ──(无任务)──▶ [EMPTY]      // 显示「暂无任务」+ [手动刷新]
[POLLING] ──(有任务)──▶ [TASK_LIST]  // 最多 10 条；每条 [执行][放弃]
[TASK_LIST] ──(执行 某条)──▶ 路由到 bind / find
[TASK_LIST] ──(放弃 某条)──▶ completeTask(failed, {reason:"user_abort"}) → 该条移出清单
[TASK_LIST] ──(点击「最近完成任务」)──▶ [RECENT]  // 近 3 天完成结果
[RECENT] ──(返回)──▶ 再次轮询 → [TASK_LIST]
bind / find 完成 ──(返回 home)──▶ 再次轮询 → [TASK_LIST]（刷新）
```
- **轮询策略**（遵守设计文档 §2.3）：仅在**未进入 bind / find / recent** 时轮询；`acceptTask(deviceId, limit=10)` 一次返回最多 10 条，云端将其置 `running` 并写入 `claimed_by_device` / `claimed_at`，避免被其它 PDA 重复领取；用户从清单选择一条串行执行，其余候选在返回任务台再次轮询时随新任务一并刷新。
- 进入 `home`（onStart / onResume）及从 `bind` / `find` / `recent` 返回 `home` 时，**均再次轮询并刷新**清单。
- 也提供手动「刷新」按钮（便于无自动轮询场景 / 调试）。

### 5.3 任务清单（TASK_LIST）布局
```
┌──────────────────────────────────┐
│  任务台（共 N 条）        [ 刷新 ]   │
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
   │           │  (停止)
   │           ├─(本次会话已读到目标标签连续结果)─▶ completeTask(success, {durationMs, foundRssi, readCount})
   │           └─(停止时从未读到任何RFID结果)────▶ completeTask(failed, {reason:'no_rfid_read', durationMs, readCount:0})
   └─(取消)────────────────▶ completeTask(failed, {reason:'user_abort'})
```

| 状态 | 界面与行为 |
|---|---|
| **TASK_INFO** | 显示目标书名/作者/ISBN/TID + [开始寻书][取消] |
| **SEARCHING** | “盖革计数器”模式：全屏大号可视化。每 ~300ms 调 `findTagByTid`；用 `RssiLocator.locate()` 得距离文案+beep 等级，`RssiLocator.nextPower()` 得下一档功率并 `setPower`；RSSI 条随信号增强由红→绿，配蜂鸣（越近越急）。底部 [停止寻书]。界面持续累计目标标签**连续读取次数**（`readCount`），达到阈值（默认 3）时亮起「已定位✅」指示（防误判）。 |
| **DONE** | “已结束寻书”+ 结果：成功（本次耗时 / 最后 RSSI / 连续读取次数）或失败（理由：`no_rfid_read` / `user_abort`）+ [返回任务台] |

> **结束判定（防误判）**：用户点击「停止寻书」时，若本次会话已取得目标标签**连续稳定读取结果**（`readCount ≥ 阈值`）→ `completeTask(success, …)`；若**从未读到任何 RFID 结果**（`readCount = 0`）→ `completeTask(failed, {reason:'no_rfid_read', …})`，任务作为失败关闭。判定规则见需求流程定义书 F6.2。

### 7.2 寻书可视化（SEARCHING 态）
- **中心指示**：大圆形/进度环，半径或颜色随 RSSI 强度变化（近=绿大，远=红小）。
- **文字**：距离文案（“2米以上 / 1~2米 / 0.5~1米 / 0.5米以内”）。
- **RSSI 数值**：实时刷新。
- **蜂鸣**：`beep` 等级 1~4 → 频率/音量递增（距越近越快）。建议新增 `BeepPlayer`（Android `ToneGenerator` 或 SDK 蜂鸣 API）。
- **功率档位**：小字显示当前功率（30/20/10dBm），由 `RssiLocator` 自动切换。

```
┌──────────────────────────────────┐
│        寻书：<书名>                │
│                                    │
│            ( ●●● 近 )              │
│         距离：0.5米以内             │
│         RSSI：-28   功率：10dBm    │
│                                    │
│        [   停止寻书   ]             │
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
4. 绑定流程 EPC 回写失败的“完成(绑定已生效)”分支。
5. 寻书会话内 `readCount` 连续读取计数与「已定位✅」指示；结束时按是否读到 RFID 结果落 `success` / `failed`（`no_rfid_read` / `user_abort`）。
6. 任务台「最近完成任务」列表（`listRecentCompleted`，近 3 天，结果/失败理由/完成时间）+ `RecentList` 组件。
7. 端到端联调（手机发起 bind/find 任务 → PDA 领取执行 → 小程序侧状态自愈）。

---

> 本设计为阶段一产出，§4 冲突结论明确，可进入阶段二实现。
