# 1. 三个目录的关系

实际上是三个完全不同的模块。

```java
PDA3109
├── 目录1 UHFG_SDK_V3.6
│     超高频RFID(UHF)
│
├── 目录2 HHWUHF_uni-app_SDK
│     超高频RFID(UHF)
│
└── 目录3 扫描_软解_v1.5
条码扫码器(Barcode)
```

## 目录1：原生Android SDK

这是最重要的目录。

```java
UHFG_SDK_V3.6
```

适用：

```java
Android Studio
Java
Kotlin
```

开发。

核心类：

```java
UHFRManager
```

例如：

```java
UHFRManager manager = UHFRManager.getInstance();
```

然后：

```ja
manager.setRegion(...)
manager.setPower(...)
manager.tagInventoryRealTime(...)
```

这是：

```java
RFID模组
↓
Java SDK
↓
你的APP
```

直接通讯。

### 优势

功能最完整。

未来你想做：

- RSSI定位
- EPC过滤
- 数据库同步
- FastAPI接口
- MQTT

都没问题。

## 目录2：uni-app SDK

这是目录1的封装版。

```java
uni-app
↓
原生插件
↓
UHFRManager
```

本质上：

```java
JS
↓
插件
↓
Java SDK
↓
RFID模组
```

适用：

```java
Vue
uni-app
HBuilderX
```

开发。

如果未来想：

```Android
Android
+
iOS
+
一个代码库
```

那么它有价值。

对你来说

我不建议。

原因：

你本来就在做：

- FastAPI
- Python
- 数据分析

路线。

而且 RFID 这种硬件控制：

```
Java/Kotlin
```

开发体验远好于：

```
uni-app
```

## 目录3：扫描SDK

完全不是RFID。

这是：

```
激光扫码头
或者
二维码扫描头
```

控制接口。

例如：

```
ACTION_SCAN_CMD
```

触发扫码。

返回：

```
9787111123456
```

这种ISBN条码。

和RFID没有关系。
