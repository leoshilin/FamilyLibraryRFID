# RFIDLibrary-Finder（Android PDA）框架设计

> 本文档为 AI 生成的设计文档（按 AI_PROJECT_GUIDE §11 输出至 `.codex/output/`）。
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
> 多租户/商业发布建议改为「经中间代理转发」（计划阶段已评估，本期不做）。

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
│  └─ RfidException.kt             # 未初始化/读取失败/写入失败
├─ cloud/                          # 云端客户端与 J 系列封装
│  ├─ WeChatCloudConfig.kt         # 配置（读 BuildConfig）
│  ├─ AccessTokenProvider.kt       # access_token 获取 + 缓存 + 自动刷新
│  ├─ CloudFunctionClient.kt       # invokecloudfunction 通用调用 + resp_data 解析
│  ├─ TaskCloudService.kt          # J1-J4 业务封装，返回 ApiResult<T>
│  ├─ CloudException.kt            # 配置缺失/网络/微信错误/云函数错误/解析错误
│  └─ model/                       # ApiResult / DeviceTask(TaskType,TaskStatus) / BookBindingInfo / 请求响应模型
├─ device/DeviceIdProvider.kt      # 持久化设备 ID（SharedPreferences）
└─ ui/                             # 最小演示（验证集成，非业务流）
   ├─ MainActivity.kt              # 初始化RFID / 显示设备ID / 领取任务 演示
   └─ theme/                       # Color / Type / Theme（移植自 RFIDTester 并改名）
```

SDK 资源（来自同级 `RFIDTester`）：
- `app/libs/*.jar`：厂家 SDK（UHF67_v3.6.jar 等，含 `com.handheld.uhfr.UHFRManager`、`com.uhf.api.cls.Reader`）
- `app/src/main/jniLibs/{arm64-v8a,armeabi-v7a,armeabi}/*.so`：native 驱动

---

## 5. J 系列接口映射（PDA → TaskCloudService）

| 云函数 | 方法 | 入参 | 返回（解析自 resp_data） | 设计对应 |
|---|---|---|---|---|
| api_task_accept (J1) | acceptTask(deviceId) | {deviceId} | DeviceTask?（无任务为 null） | 领取任务，置 running |
| api_task_complete (J2) | completeTask(taskId,status,result) | {taskId,status,result} | CompleteResponse | 提交执行结果 |
| api_task_getRfidBindingInfo (J3) | getRfidBindingInfo(tid) | {tid} | BookBindingInfo | 绑定前确认解绑 |
| api_task_bindRfid (J4) | bindRfid(bookItemId,tid,taskId?,deviceId?) | 见上 | BindResponse(action) | 执行绑定 |

字段命名：入参/返回全链路 camelCase（deviceId / bookItemId / taskId / targetTid），与云函数一致（见 AI_DEVELOPMENT_HISTORY「命名统一专项」）。

---

## 6. 与业务流（F4.3 / F6.2）的对应

框架已为两大业务流预留能力，后续实现时直接复用本层：

- **F4.3 绑定**：`RfidManager.inventory` 读标签 → `getRfidBindingInfo(tid)` 查占用 →
  用户确认 → `bindRfid(bookItemId,tid,taskId,deviceId)` → `RfidManager.writeEpcByTid(tid, bookItemId)` 回写 EPC → `completeTask`。
- **F6.2 寻书**：`acceptTask` 取 `targetTid` → `RfidManager.findTagByTid(tid)` 连续扫描 →
  `RssiLocator.nextPower/locate` 估算距离与蜂鸣等级 → 用户结束 → `completeTask`。

`RssiLocator` 已把 RFIDTester 的跟踪循环逻辑提取为纯函数（功率 30/20/10 三档自动调节 + 距离文案 + beep 等级）。

---

## 7. 构建与运行前置

- Android Studio（AGP 9.2.1 / Gradle 9.4.1 / Kotlin 2.2.10 / Compose BOM 2026.02.01）
- 真机：**Android RFID 手持 PDA**（minSdk 24），模拟器无法加载 jniLibs 中的 so。
- 复制 `local.properties.example` 为 `local.properties`，填入 `wechat.appId / appSecret / envId`。
- 云端需已部署 J 系列云函数，且 `device_task` / `rfid_bind_log` 集合已建（见 Docs §4.5 `script_init_collections`）。

> 说明：当前沙箱环境无 Android SDK，无法在本仓库内编译验证；正确性通过对齐 RFIDTester
> 工程与 SDK 真实方法签名（已用 `javap` 反编译确认）保证，请在 Android Studio 真机验证。

---

## 8. 本次范围外（后续实现）

- F4.3 / F6.2 完整状态机与对应页面
- ISBN 扫码校验、EPC 回写反馈、任务轮询后台服务
- 不修改小程序 / 云函数 / `.codex` 既有文档 / 厂家 SDK
