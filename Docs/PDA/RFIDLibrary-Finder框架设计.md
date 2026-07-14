# RFIDLibrary-Finder（Android PDA）框架设计

> 本文档为 AI 生成的设计文档（原按 AI_PROJECT_GUIDE §11 输出至 `.codex/output/`，现归档为正式设计文档于 `Docs/PDA/`）。
> 对应代码目录：`RFID_Handheld/RFIDLibrary-Finder/`
> 上层架构与业务规则以 `Docs/` 为准（Source of Truth）。

---

## 1. 目标与定位

RFIDLibrary-Finder 是家庭图书管理系统的 **Android 手持端（PDA）**，负责：

- 从云端 `device_task` 轮询领取任务（仅在有设备空闲时）
- 绑定 RFID（设计文档 F4.3：把实体图书 ISBN 与标签 TID 绑定，并把 EPC 写为 book_item_id）
- 寻书定位（设计文档 F6.2：「盖革计数器」模式，靠 RSSI + 蜂鸣提示距离）

本阶段交付 **工程框架 + 接口封装**（SDK 封装层、云端客户端、数据模型、最小演示 UI）。
绑定/寻书的完整业务状态机不在此阶段实现。

---

## 2. 总体架构

```
Android PDA (RFIDLibrary-Finder)
      │
      │ 直连 微信云开发 HTTP API（invokecloudfunction + access_token）
      ▼
Cloud Function（J 系列，PDA 专用）
      │
      ▼
Cloud Database（device_task / book_item / rfid_bind_log）
```

约束（见 AI_PROJECT_GUIDE §4、§9）：

- PDA **不允许直接访问数据库**，所有业务一律经 Cloud Function。
- 厂家 RFID SDK 视为第三方代码，**禁止修改**；需要扩展时新增 Wrapper（本框架即 `rfid.RfidManager`）。

---

## 3. 云访问机制（关键决策）

PDA 无微信登录态，调用 J 系列接口仅用 `deviceId` 校验。采用 **直连微信云开发 HTTP API**：

1. 获取 `access_token`
   `GET https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=APPID&secret=APPSECRET`
2. 调用云函数
   `POST https://api.weixin.qq.com/tcb/invokecloudfunction?access_token=TOKEN&env=ENV_ID&name=FUNCTION_NAME`
   请求体 = 云函数入参 `event`（JSON）；返回体 `{ errcode, errmsg, resp_data }`，`resp_data` 为云函数返回值的 JSON 字符串。

**凭证隔离**：`appid / appSecret / envId` 来自 `local.properties`（已被 gitignore，不入库），
经 `app/build.gradle.kts` 注入 `BuildConfig.WECHAT_APP_ID / WECHAT_APP_SECRET / WECHAT_ENV_ID`，运行期由 `cloud.WeChatCloudConfig` 读取。

> 安全提示：`appSecret` 会随 APK 打包发布，仅适用于个人/家庭等可信场景。
> 多租户/商业发布建议改为「经中间代理转发」（计划阶段评估，本期不做）。

---

## 4. 包结构（namespace: com.familylibrary.rfidfinder）

```
app/src/main/java/com/familylibrary/rfidfinder/
├─ RfidFinderApplication.kt        # Application：初始化 AppContainer
├─ di/AppContainer.kt              # 轻量 DI 容器（手动，不引 Hilt）
├─ rfid/                           # 厂家 SDK 封装层（Wrapper）
│  ├─ RfidManager.kt               # UHFRManager 封装：init/inventory/setPower/getPower/writeEpcByTid/findTagByTid
│  ├─ RfidTag.kt                   # 标签内部模型（epc/tid/rssi），与 SDK 解耦
│  ├─ HexUtils.kt                  # 字节<->十六进制（EPC/TID 传输用）
│  ├─ RssiLocator.kt               # 盖革模式功率自动调节 + 距离估算（纯函数，供 F6.2 复用）
│  ├─ BeepPlayer.kt                # PDA 蜂鸣音播放器（ToneGenerator），寻书盖革音效与调试 beep 测试
│  └─ RfidException.kt             # 未初始化/读取失败/写入失败
├─ cloud/                          # 云端客户端与 J 系列封装
│  ├─ WeChatCloudConfig.kt         # 配置（读 BuildConfig）
│  ├─ AccessTokenProvider.kt       # access_token 获取 + 缓存 + 自动刷新
│  ├─ CloudFunctionClient.kt       # invokecloudfunction 通用调用 + resp_data 解析
│  ├─ TaskCloudService.kt          # J1-J4 业务封装，返回 ApiResult<T>
│  ├─ CloudException.kt            # 配置缺失/网络/微信错误/云函数错误/解析错误
│  └─ model/                       # ApiResult / DeviceTask(TaskType,TaskStatus) / BookBindingInfo / 请求响应模型
├─ device/DeviceIdProvider.kt      # 持久化设备 ID（SharedPreferences）
├─ ui/                             # Compose UI 层
│  ├─ MainActivity.kt              # 入口 Activity：导航路由 / 扫码广播 / 按键分发
│  ├─ HomeScreen.kt                # 首页（任务台）
│  ├─ HomeViewModel.kt             # 首页 ViewModel（状态机 + 轮询）
│  ├─ bind/                        # 绑定 RFID 页面
│  ├─ find/                        # 寻书定位页面
│  ├─ keytest/                     # 按键/扫码测试（调试工具）
│  │  ├─ KeyTestScreen.kt          # 按键/扫码事件实时展示
│  │  └─ KeyTestViewModel.kt       # 按键/扫码事件收集
│  ├─ debug/                       # 调试工具集
│  │  ├─ DebugMenuScreen.kt        # 调试菜单页（入口汇总）
│  │  ├─ DebugMenuViewModel.kt     # 调试菜单 ViewModel
│  │  ├─ RfidTestScreen.kt         # RFID 标签读写调试页
│  │  ├─ RfidTestViewModel.kt      # RFID 测试 ViewModel（功率/连续读取/EPC写入）
│  │  ├─ BeepTestScreen.kt         # Beep 蜂鸣测试页（短音/滴滴连续音/急促嘀嘀嘀/等级测试）
│  │  └─ BeepTestViewModel.kt      # Beep 测试 ViewModel
│  └─ theme/                       # Color / Type / Theme（移植自 RFIDTester 并改名）
```

SDK 资源（来自同级 `RFIDTester`）：
- `app/libs/*.jar`：厂家 SDK（UHF67_v3.6.jar 等，含 `com.handheld.uhfr.UHFRManager`、`com.uhf.api.cls.Reader`）
- `app/src/main/jniLibs/{arm64-v8a,armeabi-v7a,armeabi}/*.so`：native 驱动

---

## 5. J 系列接口映射（PDA → TaskCloudService）

| 云函数 | 方法 | 入参 | 返回（解析自 resp_data） | 设计对应 |
|---|---|---|---|---|
| api_task_accept (J1) | acceptTask(deviceId, limit=10) | {deviceId, limit?} | DeviceTask[]?（最多 10 条；无任务为 null/[]） | 批量轮询领取任务清单，置 running |
| api_task_complete (J2) | completeTask(taskId,status,result) | {taskId,status,result} | CompleteResponse | 提交执行结果 |
| api_task_getRfidBindingInfo (J3) | getRfidBindingInfo(tid) | {tid} | BookBindingInfo | 绑定前确认解绑 |
| api_task_bindRfid (J4) | bindRfid(bookItemId,tid,taskId?,deviceId?) | 见上 | BindResponse(action) | 执行绑定 |
| api_task_listRecentCompleted (J5) | listRecentCompleted(deviceId, withinDays=3) | {deviceId, withinDays?} | RecentTask[]（最多 50 条） | 任务台查询最近完成任务 <font color="red">（待实现）</font> |
| api_task_abort (J6) | abortTask(taskId) | {taskId} | {success:true} | 放弃寻书执行，任务回退 pending 状态 |

字段命名：入参/返回全链路 camelCase（deviceId / bookItemId / taskId / targetTid），与云函数一致（见 AI_DEVELOPMENT_HISTORY「命名统一专项」）。

---

## 6. 与业务流（F4.3 / F6.2）的对应

框架为两大业务流预留能力，后续实现时直接复用本层 <font color="red">（待实现）</font>：

- **F4.3 绑定**：`RfidManager.inventory` 读标签 → `getRfidBindingInfo(tid)` 查占用 →
  用户确认 → `bindRfid(bookItemId,tid,taskId,deviceId)` → `RfidManager.writeEpcByTid(tid, bookItemId)` 回写 EPC → `completeTask`。
- **F6.2 寻书**：`acceptTask` 取清单中一条 `targetTid` → `RfidManager.findTagByTid(tid)` 连续扫描 →
  `RssiLocator.nextPower/locate` 估算距离与蜂鸣等级 → `BeepPlayer.beepByLevel(level)` 播放盖革计数器音效 →
  累计目标标签**连续读取次数**（达到阈值判「已找到」，防误判）→ 用户可选择：
  - **「结束寻书」**：若本次会话有连续读取结果则 `completeTask(success, {durationMs, foundRssi, readCount})`；若**从未读到 RFID 结果**则 `completeTask(failed, {reason:'no_rfid_read', durationMs, readCount:0})`（任务作为失败关闭）。
  - **「退出任务」**：若用户无法找到 RFID 信号（距离过远、不在同一房间等），调用 `abortTask(taskId)`（J6）将任务状态从 `running` 回退为 `pending`，清空 `claimed_by_device` / `claimed_at`，任务可被再次领取。此操作**不**标记任务为 `failed`。

`RssiLocator` 把 RFIDTester 的跟踪循环逻辑提取为纯函数（功率 30/20/10 三档自动调节 + 距离文案 + beep 等级）。

---

## 7. 构建与运行前置

- Android Studio（AGP 9.2.1 / Gradle 9.4.1 / Kotlin 2.2.10 / Compose BOM 2026.02.01）
- 真机：**Android RFID 手持 PDA**（minSdk 24），模拟器无法加载 jniLibs 中的 so。
- **配置云凭证（务必追加，勿整体替换）**：`local.properties` 由 Android Studio 首次打开工程时自动生成并含 `sdk.dir=...`（指向本机 Android SDK）。在其**末尾追加**以下三行，**保留原有 `sdk.dir`**，否则会报 `SDK location not found`：
  ```properties
  sdk.dir=D:/Android/Sdk          # 由 Android Studio 维护，请勿删除
  wechat.appId=wxYOUR_APPID
  wechat.appSecret=YOUR_APPSECRET
  wechat.envId=YOUR_ENV_ID
  ```
  （`local.properties.example` 仅为 wechat.* 模板，不要用它整体覆盖自动生成的文件。）
- 云端需部署 J 系列云函数，且 `device_task` / `rfid_bind_log` 集合需创建（见 Docs §4.5 `script_init_collections`）。

> 说明：当前沙箱环境无 Android SDK，无法在本仓库内编译验证；正确性通过对齐 RFIDTester
> 工程与 SDK 真实方法签名（以 `javap` 反编译核对）保证，请在 Android Studio 真机验证。

---

## 8. 本次范围外（后续实现） <font color="red">（待实现）</font>

- F4.3 / F6.2 完整状态机与对应页面
- 任务台**批量轮询清单（J1 返回 ≤10 条）** 与「最近完成任务」列表（J5 `api_task_listRecentCompleted`）的 UI 与接口落地
- ISBN 扫码校验、EPC 回写反馈、任务轮询后台服务
- 寻书会话内「连续读取计数 / 已找到判定」与结束时的 `success` / `failed` 落库逻辑（见 §6 F6.2、需求流程定义书 F6.2）
- 不修改小程序 / 云函数 / `Docs` 既有文档 / 厂家 SDK

> 注：本文档已同步上述设计变更（J1 改为批量返回、新增 J5、F6.2 成功/失败判定），代码实现仍属后续阶段。

---

## 9. 调试功能（面向开发人员）

### 9.1 入口

首页底部版本号上方提供「🔧 调试」入口，点击进入调试菜单页。该入口替代原先单独的「按键测试」入口，统一收敛调试工具集。

### 9.2 调试菜单

调试菜单页列出所有可用的调试工具入口：

| 工具 | 说明 |
|---|---|
| 按键测试 | 实时显示 PDA 上所有 KeyEvent 和扫码广播结果，帮助确认侧键/枪柄按钮 keyCode |
| RFID 标签读写 | 功率调节（5-30 dBm，±1/±5）、连续读取（RSSI/EPC/TID/读取次数）、EPC 写入（多标签选择、成功/失败反馈） |
| Beep 蜂鸣测试 | 短音（单次 ~50ms）、滴滴连续音（4 组双短音）、急促嘀嘀嘀（12 连音）、按 beep 等级（1~4）测试盖革计数器音效 |

### 9.3 RFID 标签读写调试

直接调用 `RfidManager`（object 单例）的底层能力，不经过云函数和任务系统：

- **功率**：通过 `getPower()` 读取当前读写功率，通过 `setPower(read, write)` 实时调节
- **连续读取**：协程循环（~200ms）调用 `inventory(timeoutMs)`，按 TID 去重并保留最新 RSSI
- **EPC 写入**：用户在已发现标签中选择目标 TID，输入 EPC 值（十六进制），调用 `writeEpcByTid(tid, epc)` 执行写入并回读校验

### 9.4 Beep 蜂鸣调试

直接调用 `BeepPlayer`（object 单例），使用 Android `ToneGenerator` 产生系统标准蜂鸣音，无需额外音频资源文件：

- **短音**：单次 ~50ms DTMF 确认音（`ToneGenerator.TONE_PROP_ACK`），模拟寻书扫描中每次读到标签的确认音
- **滴滴连续音**：4 组双短音（滴滴…滴滴…），间隔约 400ms，模拟中距离寻书反馈（beep Lv2）
- **急促嘀嘀嘀**：12 连音，间隔约 60ms，模拟极近距离寻书反馈（beep Lv4）
- **等级测试**：按 beep 等级 1~4 单独播放，对应 RssiLocator 的四种距离（>2m / 1-2m / 0.5-1m / <0.5m）

`BeepPlayer` 同样被寻书模式（F6.2）的 `FindViewModel` 使用：每次扫描读到目标标签时，根据 `RssiLocator.locate()` 返回的 beep 等级调用 `BeepPlayer.beepByLevel(level)` 播放对应急促度的蜂鸣，实现"盖革计数器"音效反馈。

### 9.5 导航路由

```
Home → debug（调试菜单）
       ├── keytest（按键测试，复用现有 KeyTestScreen）
       ├── rfidtest（RFID 标签读写，RfidTestScreen）
       └── beeptest（Beep 蜂鸣测试，BeepTestScreen）
```

路由定义在 `MainActivity.kt` 的 `Routes` 对象中，使用 Jetpack Navigation Compose 管理。
