# RFIDLibrary-Finder（Android PDA）UI 设计

> AI 生成的设计文档（按 AI_PROJECT_GUIDE §11 输出至 `.codex/output/`）。
> 对应代码目录：`RFID_Handheld/RFIDLibrary-Finder/`。
> 前置框架设计见同目录 `RFIDLibrary-Finder框架设计.md`；业务流程以 `Docs/` 为准（Source of Truth）。
> 本文仅设计 UI 与交互状态机，**不含实现代码**。

---

## 1. 设计范围与目标

覆盖 PDA 三大核心场景：

1. **领取任务（任务台）** —— 空闲时轮询云端 `device_task`，领取后路由到绑定/寻书。
2. **执行绑定 / 重绑定（F4.3）** —— 校验 ISBN → 读标签 TID → 确认解绑（如需）→ 云端绑定 → 回写 EPC。
3. **寻书定位（F6.2）** —— “盖革计数器”模式连续扫描，RSSI/距离/蜂鸣实时反馈，找到后结束。

## 2. PDA 端 UI 总体原则

- **大触控目标 / 高对比 / 大字号**：手持设备多在走动、户外、戴手套场景，主操作按钮 ≥ 64dp，文字 ≥ 18sp。
- **单手可达**：主操作放在屏幕下半部；次要操作（取消/返回）放右上。
- **状态明确**：任何“进行中 / 成功 / 失败”都要有清晰视觉（颜色 + 文案 + 图标），不让用户猜。
- **不阻塞**：RFID 扫描、网络请求走协程，UI 用 `StateFlow` 驱动；耗时操作显示进度，可取消。
- **沿用现有主题**：基于 `ui/theme/RFIDLibraryFinderTheme`（Material3），不另起视觉体系。

## 3. 信息架构与导航

采用 Jetpack Navigation Compose，路由：`home` → `bind` / `find`（凭领取到的任务进入）。

```
            ┌─────────────┐
            │   home      │  任务台（空闲轮询 / 任务卡片）
            └──────┬──────┘
       accept 返回 bind/find
       ┌──────────┴──────────┐
   ┌───▼────┐            ┌────▼────┐
   │  bind   │            │  find   │   执行中（不在 PDA 做任务队列，一次一个）
   └───┬────┘            └────┬────┘
       └──────────┬──────────┘ complete(success/failed)
                  ▼
                home
```

- 领取到的 `DeviceTask` 以 **JSON 字符串**经 `kotlinx.serialization` 序列化后作为 NavArgument 传递（`DeviceTask` 需加 `@Serializable`）。
- 每个流程一个 `ViewModel`（`HomeViewModel` / `BindViewModel` / `FindViewModel`），用 `StateFlow<UiState>` 表达状态机，Composable 只渲染、发事件。

## 4. ⚠️ 设计冲突 / 待确认（重要）

**现象**：F4.3（文档 343 行）与 F6.2（520 行）均要求「手机创建任务时把 ISBN / 书名 / 作者推到任务表，PDA 获取后直接显示并校验 ISBN」；但 `Docs/...数据库表结构设计.md §3.9 device_task` 当前**只有 `book_item_id` 与 `target_tid`，没有书名/作者/ISBN 字段**。

**影响**：PDA 绑定/寻书界面要显示的书名、作者、ISBN 无数据来源；F4.3 的「扫码 ISBN 与任务 ISBN 校验」也无基准值。

**结论（已与用户确认）：采用方案 A** —— 扩展 `device_task` 携带展示字段。

**字段规格（已同步更新 Docs §3.9 device_task）**：
- `book_title` (varchar(255), 可选)：书名
- `book_author` (varchar(255), 可选)：作者
- `book_isbn` (varchar(32), 可选)：ISBN（绑定流程中 PDA 扫码 ISBN 与之校验）

**落地涉及改动（开发阶段实现）**：
1. 云函数 `api_task_createBindRfid`：创建时由 `book_item → book_meta` 反查填入上述三字段。
2. 云函数 `api_task_createFindBook`：同上（寻书任务同样携带）。
3. 云函数 `api_task_accept`（J1）：返回 `TaskPayload` 一并返回这三字段。
4. PDA 框架：`cloud/model/CloudModels.kt` 的 `TaskPayload` 与 `model/DeviceTask` 增加对应字段；`TaskCloudService.acceptTask` 映射带入。
5. PDA UI：绑定/寻书界面读取展示；绑定流程在 SCAN_ISBN 态与 `book_isbn` 校验。

> 本文 UI 即按方案 A 设计。在云端字段落地前，界面可先用 `book_item_id` 占位，ISBN 校验待字段就绪后启用。

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
[IDLE] ──(定时轮询 acceptTask, 每 5s)──▶ [POLLING]
[POLLING] ──(无任务)──▶ [IDLE]
[POLLING] ──(有任务)──▶ [TASK_CARD]  // 显示任务摘要 + [开始执行][放弃]
[TASK_CARD] ──(开始)──▶ 路由到 bind / find
[TASK_CARD] ──(放弃)──▶ completeTask(failed, {reason:"user_abort"}) → [IDLE]
```
- **轮询策略**（遵守设计文档 §2.3）：仅当当前**无活动任务**时轮询；每次只取一个；`acceptTask` 已将任务置 `running`，避免重复执行。
- 也提供手动「领取任务」按钮（便于调试与无轮询场景）。

### 5.3 任务卡片（TASK_CARD）布局
```
┌──────────────────────────────────┐
│ 类型：绑定 RFID / 寻书              │
│ 书名：<book_title>                 │
│ 作者：<book_author>                │
│ ISBN：<book_isbn>                 │
│ (寻书) 目标TID：<target_tid>       │
│                                    │
│        [ 开始执行 ]   [ 放弃 ]       │
└──────────────────────────────────┘
```

---

## 6. 屏幕二：绑定 / 重绑定（Bind）—— F4.3

**前置**：进入时持有 `DeviceTask`（`book_item_id`、展示字段、`task_id`）。
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
| **SCAN_ISBN** | 调用相机扫书上 ISBN 条码；与任务 `book_isbn` 比对 | 不一致 → 红字提示，允许重试；一致 → 下一步 |
| **SCAN_TAG** | 触发 `RfidManager.inventory()`，列出可见标签（TID+RSSI），用户点选目标标签 | 取到 TID 后调 `getRfidBindingInfo(tid)` |
| **CONFIRM_UNBIND**（条件） | 若 `getRfidBindingInfo` 返回 `bound=true`（标签被他书占用）：弹窗“该标签已被《title》(ISBN) 占用，是否解绑后重绑？”[确认][取消] | 确认→BINDING；取消→回到 SCAN_TAG 或 failed |
| **BINDING** | 进度提示“正在绑定…” | `bindRfid(bookItemId, tid, taskId, deviceId)`；成功(action=bind/rebind)→下一步；失败→重试/取消 |
| **WRITE_EPC** | 进度提示“正在写入 EPC=book_item_id” | `RfidManager.writeEpcByTid(tid, bookItemId)`；成功→DONE；失败→见下 |
| **DONE** | 绿勾“绑定完成（书名 / TID / EPC 已写入）”+ [返回任务台] | 进入 DONE 前调 `completeTask(success, {epcWritten:true})` |

### 6.2 EPC 回写失败的处理（设计权衡）
设计文档 F4.3：「等待成功后再次扫描写入 EPC… 否则更新队列中任务状态为 success（失败则提交云端回退）」。
- 云端 `book_item.rfid_tid` 已在 `bindRfid` 成功时写入（绑定已生效）。
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
   │           └────────────▶ completeTask(success, {durationMs, foundRssi})
   └─(取消)────────────────▶ completeTask(failed, {reason})
```

| 状态 | 界面与行为 |
|---|---|
| **TASK_INFO** | 显示目标书名/作者/ISBN/TID + [开始寻书][取消] |
| **SEARCHING** | “盖革计数器”模式：全屏大号可视化。每 ~300ms 调 `findTagByTid`；用 `RssiLocator.locate()` 得距离文案+beep 等级，`RssiLocator.nextPower()` 得下一档功率并 `setPower`；RSSI 条随信号增强由红→绿，配蜂鸣（越近越急）。底部 [停止寻书] |
| **DONE** | “已结束寻书”+ 本次耗时/最后 RSSI + [返回任务台] |

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
| `TaskCard` | 任务摘要卡（类型徽标 + 书名/作者/ISBN + 主/次按钮） |
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
| 相机 `CAMERA` | 已在 Manifest 声明；用于 ISBN 扫码 |
| 条码识别 | 新增 `com.google.mlkit:barcode-scanning`（或 CameraX + ML Kit） |
| 蜂鸣/音频 | `BeepPlayer`：`ToneGenerator` 或 SDK 蜂鸣 API |
| 振动（可选） | `VIBRATE` 权限 + `Vibrator`，作为寻书近距的额外反馈 |
| 协程/StateFlow | 已有 `kotlinx-coroutines-android`；ViewModel 用 `lifecycle-viewmodel-compose` |

## 10. 与现有框架代码的映射

| UI 行为 | 复用现有封装 |
|---|---|
| 轮询领取 | `TaskCloudService.acceptTask(deviceId)` / `completeTask(...)` |
| 读标签/写 EPC | `RfidManager.inventory` / `writeEpcByTid` / `findTagByTid` / `setPower` |
| 绑定查询/执行 | `TaskCloudService.getRfidBindingInfo` / `bindRfid` |
| 寻书信号换算 | `RssiLocator.nextPower` / `locate` |
| 设备标识 | `DeviceIdProvider.deviceId` |
| 依赖装配 | `di.AppContainer` |

## 11. 后续实现待办（开发阶段）

1. **（需先确认 §4）云端扩展**：`device_task` 增加 `book_title/book_author/book_isbn`；`api_task_createBindRfid`/`createFindBook` 填充；`api_task_accept` 返回携带。
2. 新增 `HomeViewModel` / `BindViewModel` / `FindViewModel` + 三个 Composable 屏 + NavHost。
3. 新增相机 ISBN 扫码（ML Kit）+ `BeepPlayer` + `RssiBar` 等组件。
4. 绑定流程 EPC 回写失败的“完成(绑定已生效)”分支。
5. 端到端联调（手机发起 bind/find 任务 → PDA 领取执行 → 小程序侧状态自愈）。

---

> 本设计为阶段一产出，待 §4 冲突确认后即可进入阶段二实现。
