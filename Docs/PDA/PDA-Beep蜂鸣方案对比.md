# PDA Beep 蜂鸣方案对比文档

> 本文档记录 PDA 端两种蜂鸣实现方案的详细对比，供后续选型参考。
> 当前采用方案 B（ToneGenerator），方案 A（SoundPool）为备选升级方案。

---

## 1. 背景

PDA 寻书模式（F6.2）需要"盖革计数器"音效反馈：距离目标标签越近，蜂鸣越急促。需要一种可靠的蜂鸣控制方式。

经过对官方 SDK Demo（`RFID_Handheld/SDK/PDA-E710/UHFG_SDK_V3.6/demo`）的代码分析，官方使用 `SoundPool` + 预置音频文件。我们的项目目前使用 `ToneGenerator` 方案。

---

## 2. 方案 A：SoundPool（官方 Demo 方案）

### 2.1 来源

官方 SDK Demo 路径：
```
RFID_Handheld/SDK/PDA-E710/UHFG_SDK_V3.6/demo/UHF-G_V3.6_20230821/
```

核心实现类：
```
app/src/main/java/com/pda/uhf_g/util/UtilSound.java
```

### 2.2 核心代码分析

```java
// UtilSound.java — 官方 Demo 的蜂鸣工具类
public class UtilSound {

    public static SoundPool sp;
    public static Map<Integer, Integer> suondMap;
    public static Context context;

    // 初始化：加载音频资源到 SoundPool
    public static void initSoundPool(Context context) {
        UtilSound.context = context;
        sp = new SoundPool(1, AudioManager.STREAM_MUSIC, 100);
        suondMap = new HashMap<Integer, Integer>();
        suondMap.put(1, sp.load(context, R.raw.barcodebeep, 1));  // 扫码提示音
        suondMap.put(2, sp.load(context, R.raw.beep, 1));          // 单次蜂鸣
        suondMap.put(3, sp.load(context, R.raw.beeps, 1));         // 连续蜂鸣
    }

    // 播放：30ms 防抖，始终播放 sound ID=3 的 beeps.ogg，2x 速率
    public static void play(int sound, int number) {
        if (System.currentTimeMillis() - time > 30) {
            AudioManager am = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
            float audioMaxVolume = am.getStreamMaxVolume(AudioManager.STREAM_MUSIC);
            float audioCurrentVolume = am.getStreamVolume(AudioManager.STREAM_MUSIC);
            float volumnRatio = audioCurrentVolume / audioMaxVolume;

            sp.play(3, 1, 1, 0, 0, 2f);  // soundID=3, 左右声道=1, 优先级=0, 循环=0, 速率=2x
            time = System.currentTimeMillis();
        }
    }
}
```

### 2.3 音频资源文件

位于 `app/src/main/res/raw/`：

| 文件 | 大小 | 格式 | 用途 |
|---|---|---|---|
| `barcodebeep.ogg` | 5,438 bytes | OGG Vorbis | 扫码成功提示音（sound ID=1） |
| `beep.wav` | 11,968 bytes | WAV PCM | 单次蜂鸣（sound ID=2） |
| `beeps.ogg` | 5,438 bytes | OGG Vorbis | 连续蜂鸣（sound ID=3，demo 默认使用） |

> 注意：`barcodebeep.ogg` 和 `beeps.ogg` 实际上是同一个文件（大小完全一致），`beep.wav` 是独立音频。

### 2.4 Demo 中的调用场景

| 场景 | 文件 | 调用方式 |
|---|---|---|
| **盘点读到标签** | `InventoryFragment.java:255` | `UtilSound.play(1, 0)` — 发现标签时播放确认音 |
| **LED盘点读到标签** | `InventoryLedFragment.java:191` | `UtilSound.play(1, 0)` — 同上 |
| **温度标签读取** | `TemperatureTagFragment.java:144` | `UtilSound.voiceTips(...)` — 按标签数量播放多次 |
| **寻书跟踪音效** | `InventoryFragment.java:617` (`soundTask()`) | **被注释掉**（`// soundTask()`），未启用 |

### 2.5 初始化位置

Demo 在 Fragment 的 `onCreateView` 中初始化：

```java
// InventoryFragment.java:542
UtilSound.initSoundPool(mainActivity);
```

需要传入 `Activity` 作为 `Context`。

### 2.6 SoundPool API 说明

```java
// 构造函数（API 1+，所有版本可用）
SoundPool(int maxStreams, int streamType, int srcQuality)

// 加载音频（返回 sound ID）
int load(Context context, int resId, int priority)

// 播放
int play(int soundID, float leftVolume, float rightVolume,
         int priority, int loop, float rate)
// loop: 0=不循环, -1=无限循环
// rate: 0.5~2.0 播放速率
```

---

## 3. 方案 B：ToneGenerator（当前方案）

### 3.1 核心代码

```kotlin
// BeepPlayer.kt — 当前实现
object BeepPlayer {
    private const val TONE_TYPE = ToneGenerator.TONE_PROP_ACK  // DTMF 确认音
    private const val DEFAULT_VOLUME = 60

    private var toneGenerator: ToneGenerator? = null

    fun init(): Boolean {
        toneGenerator = ToneGenerator(
            AudioManager.STREAM_MUSIC,
            DEFAULT_VOLUME
        )
        // ...
    }

    fun shortBeep() {
        toneGenerator?.startTone(TONE_TYPE, 50)  // 播放 50ms
    }

    fun beepByLevel(level: Int) {
        when (level) {
            1 -> toneGenerator?.startTone(TONE_TYPE, 40)        // 远距：单短音
            2 -> { /* 双短音 */ }                               // 中距：滴滴
            3 -> { repeat(3) { /* 三短音 */ } }                 // 近距：滴滴滴
            4 -> { repeat(6) { /* 急促六连音 */ } }             // 极近：嘀嘀嘀嘀嘀嘀
        }
    }
}
```

### 3.2 特点

- **无需资源文件**：`ToneGenerator` 合成标准 DTMF 音调
- **无需 Context**：构造函数只需 `streamType` 和 `volumePercent`
- **兼容性好**：`ToneGenerator(Int, Int)` 构造函数 API 1+ 可用
- **音调固定**：只能播放系统预定义的 DTMF 音调，无法自定义音频

---

## 4. 方案对比总览

| 维度 | 方案 A：SoundPool | 方案 B：ToneGenerator（当前） |
|---|---|---|
| **API** | `SoundPool` (API 1+) | `ToneGenerator` (API 1+) |
| **音质** | 好 — 可播放真实音频文件 | 一般 — 系统合成的 DTMF 音 |
| **自定义音效** | 支持 — 替换 `res/raw/` 下文件即可 | 有限 — 只能选系统预定义音调 |
| **资源依赖** | 需要 .ogg/.wav 文件 | 无需任何资源文件 |
| **Context 依赖** | 需要（`initSoundPool(context)`） | 不需要 |
| **初始化时机** | `Activity/Fragment.onCreate` | 首次使用时懒初始化 |
| **APK 体积** | + ~23KB（3 个音频文件） | 无增加 |
| **与官方一致性** | **完全一致** | 不一致 |
| **API 复杂度** | 较高（加载→播放两步） | 较低（直接播放） |
| **音量控制** | 手动读取 `AudioManager` 音量 | 自动跟随 `STREAM_MUSIC` |

---

## 5. 升级到方案 A 的步骤

如果后续决定切换到官方一致的 SoundPool 方案，需要以下改动：

### 5.1 复制音频资源文件

```bash
# 源路径
RFID_Handheld/SDK/PDA-E710/UHFG_SDK_V3.6/demo/UHF-G_V3.6_20230821/app/src/main/res/raw/
  ├── barcodebeep.ogg
  ├── beep.wav
  └── beeps.ogg

# 目标路径
RFID_Handheld/RFIDLibrary-Finder/app/src/main/res/raw/
  ├── barcodebeep.ogg
  ├── beep.wav
  └── beeps.ogg
```

### 5.2 修改 BeepPlayer.kt

核心改动点：

```kotlin
object BeepPlayer {

    // 替换 ToneGenerator 为 SoundPool
    private var soundPool: SoundPool? = null
    private var soundIdBarcodeBeep: Int = 0   // sound ID=1
    private var soundIdBeep: Int = 0           // sound ID=2
    private var soundIdBeeps: Int = 0          // sound ID=3
    private var appContext: Context? = null

    // init 需要传入 Context
    fun init(context: Context): Boolean {
        if (initialized) return true
        appContext = context.applicationContext
        soundPool = SoundPool(1, AudioManager.STREAM_MUSIC, 100)
        soundIdBarcodeBeep = soundPool!!.load(context, R.raw.barcodebeep, 1)
        soundIdBeep = soundPool!!.load(context, R.raw.beep, 1)
        soundIdBeeps = soundPool!!.load(context, R.raw.beeps, 1)
        initialized = true
        return true
    }

    // 短音 → 播放 beeps.ogg（与 demo 一致）
    fun shortBeep() {
        soundPool?.play(soundIdBeeps, 1f, 1f, 0, 0, 2f)
    }

    // beepByLevel 保持接口不变，内部改用 SoundPool
    // ...
}
```

### 5.3 修改调用方

```kotlin
// FindViewModel.kt / BeepTestViewModel.kt
// init 调用改为传入 Context：
BeepPlayer.init(context)  // 替代原来的 BeepPlayer.init()
```

### 5.4 改动范围评估

| 文件 | 改动量 |
|---|---|
| `BeepPlayer.kt` | 核心重写（~30 行 → ~50 行） |
| `FindViewModel.kt` | 1 行（`init()` → `init(context)`） |
| `BeepTestViewModel.kt` | 1 行（同上） |
| `res/raw/` 目录 | 新增 3 个音频文件 |

> 外部接口 `shortBeep()` / `beepByLevel()` / `playShortBeep()` / `playDoubleBeeps()` / `playRapidBeeps()` 签名不变，仅内部实现切换。

---

## 6. 建议

- **当前阶段**：保持方案 B（ToneGenerator）。理由：
  - 功能满足寻书盖革计数器需求
  - 零依赖、零资源文件、代码简洁
  - 无需 Context 传递，降低耦合
  
- **后续升级**：以下情况考虑切换到方案 A（SoundPool）：
  - 需要更自然的蜂鸣音效（非 DTMF 合成音）
  - 需要自定义/替换提示音
  - 用户反馈 ToneGenerator 音质不佳
  - 追求与官方 Demo 完全一致的体验

- **切换成本**：低。`BeepPlayer` 已做好封装，外部接口不变，切换仅需修改内部实现和传入 Context。

---

> 文档版本：v1.0 | 创建日期：2025-07-14 | 基于官方 SDK V3.6 Demo 分析
