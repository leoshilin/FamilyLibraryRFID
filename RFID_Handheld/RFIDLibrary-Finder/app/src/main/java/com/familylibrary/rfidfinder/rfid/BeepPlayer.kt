package com.familylibrary.rfidfinder.rfid

import android.media.ToneGenerator
import android.util.Log
import kotlinx.coroutines.delay

/**
 * PDA 蜂鸣音播放器（封装 Android [ToneGenerator]）。
 *
 * 用于寻书模式的盖革计数器音效反馈（beep 等级 1~4，越近越急促），
 * 以及调试页面中测试不同蜂鸣模式。
 *
 * 设计原则：
 * - 使用 Android 系统 [ToneGenerator] 产生标准蜂鸣音，无需额外音频资源文件
 * - 不依赖厂家 SDK 的蜂鸣 API（UHFRManager 不提供内置蜂鸣方法）
 * - 异步方法使用协程 `delay` 替代 `Thread.sleep`，不阻塞调用线程
 *
 * 使用前需调用 [init] 初始化；[release] 释放资源。
 */
object BeepPlayer {

    private const val TAG = "BeepPlayer"

    /** DTMF 音调：约 941Hz + 1336Hz（类似电话拨号音），穿透力强 */
    private const val TONE_TYPE = ToneGenerator.TONE_PROP_ACK

    /** 默认音量（0-100），PDA 喇叭通常较大，设 60% 避免刺耳 */
    private const val DEFAULT_VOLUME = 60

    private var toneGenerator: ToneGenerator? = null
    private var initialized = false

    // ───────── 初始化 ─────────

    /**
     * 初始化蜂鸣器。在 Application 或首次使用时调用一次。
     * @return 是否初始化成功
     */
    fun init(): Boolean {
        if (initialized) return true
        return try {
            // ToneGenerator(streamType, volumePercent: Int) 兼容所有 API 版本
            // 使用 STREAM_MUSIC 确保音量受系统媒体音量控制
            toneGenerator = ToneGenerator(
                android.media.AudioManager.STREAM_MUSIC,
                DEFAULT_VOLUME
            )
            initialized = true
            Log.i(TAG, "BeepPlayer 初始化成功")
            true
        } catch (e: Exception) {
            Log.w(TAG, "BeepPlayer 初始化失败: ${e.message}")
            false
        }
    }

    /** 释放蜂鸣器资源。 */
    fun release() {
        try {
            toneGenerator?.release()
        } catch (_: Exception) { }
        toneGenerator = null
        initialized = false
        Log.i(TAG, "BeepPlayer 已释放")
    }

    // ───────── 基础 beep ─────────

    /**
     * 播放一次短促蜂鸣（~50ms）。
     * 用于寻书扫描中每次读到目标标签时的确认音。
     * 非阻塞：ToneGenerator.startTone 异步播放，立即返回。
     */
    fun shortBeep() {
        ensureInit()
        try {
            toneGenerator?.startTone(TONE_TYPE, 50)
        } catch (e: Exception) {
            Log.w(TAG, "shortBeep 失败: ${e.message}")
        }
    }

    /**
     * 按寻书 beep 等级播放相应频率/急促度的蜂鸣（suspend 版本，用于寻书协程）。
     *
     * 使用协程 `delay` 替代 `Thread.sleep`，避免阻塞扫描线程。
     *
     * | 等级 | 含义       | 效果                        |
     * |------|-----------|----------------------------|
     * | 1    | 远 (>2m)  | 单短音                      |
     * | 2    | 中 (1-2m) | 双短音（滴滴）               |
     * | 3    | 近 (0.5-1m)| 三短音（滴滴滴）            |
     * | 4    | 极近 (<0.5m)| 急促连音（嘀嘀嘀嘀嘀嘀）     |
     *
     * @param level beep 等级 1~4
     */
    suspend fun beepByLevelAsync(level: Int) {
        ensureInit()
        try {
            when (level) {
                1 -> {
                    toneGenerator?.startTone(TONE_TYPE, 40)
                }
                2 -> {
                    toneGenerator?.startTone(TONE_TYPE, 40)
                    delay(60)
                    toneGenerator?.startTone(TONE_TYPE, 40)
                }
                3 -> {
                    repeat(3) {
                        toneGenerator?.startTone(TONE_TYPE, 40)
                        delay(40)
                    }
                }
                4 -> {
                    repeat(6) {
                        toneGenerator?.startTone(TONE_TYPE, 30)
                        delay(25)
                    }
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "beepByLevelAsync($level) 失败: ${e.message}")
        }
    }

    /**
     * 同步版 beepByLevel（用于调试页面，在 viewModelScope 中调用）。
     *
     * 注意：内部使用 Thread.sleep，仅适用于调试按钮等非性能敏感场景。
     * 寻书扫描循环中请使用 [beepByLevelAsync]。
     */
    fun beepByLevel(level: Int) {
        ensureInit()
        try {
            when (level) {
                1 -> toneGenerator?.startTone(TONE_TYPE, 40)
                2 -> {
                    toneGenerator?.startTone(TONE_TYPE, 40)
                    Thread.sleep(60)
                    toneGenerator?.startTone(TONE_TYPE, 40)
                }
                3 -> {
                    repeat(3) {
                        toneGenerator?.startTone(TONE_TYPE, 40)
                        Thread.sleep(40)
                    }
                }
                4 -> {
                    repeat(6) {
                        toneGenerator?.startTone(TONE_TYPE, 30)
                        Thread.sleep(25)
                    }
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "beepByLevel($level) 失败: ${e.message}")
        }
    }

    // ───────── 调试用蜂鸣模式 ─────────

    /** 播放一次短促蜂鸣（调试用）。同 [shortBeep]，显式命名便于调试页面调用。 */
    fun playShortBeep() {
        shortBeep()
    }

    /** 播放滴滴连续音（模拟中等距离寻书反馈）。 */
    fun playDoubleBeeps() {
        ensureInit()
        try {
            repeat(4) {
                // 两声短促的"滴滴"
                toneGenerator?.startTone(TONE_TYPE, 30)
                Thread.sleep(50)
                toneGenerator?.startTone(TONE_TYPE, 30)
                Thread.sleep(400)
            }
        } catch (e: Exception) {
            Log.w(TAG, "playDoubleBeeps 失败: ${e.message}")
        }
    }

    /** 播放急促嘀嘀嘀声音（模拟极近寻书反馈）。 */
    fun playRapidBeeps() {
        ensureInit()
        try {
            repeat(12) {
                toneGenerator?.startTone(TONE_TYPE, 25)
                Thread.sleep(60)
            }
        } catch (e: Exception) {
            Log.w(TAG, "playRapidBeeps 失败: ${e.message}")
        }
    }

    // ───────── 内部方法 ─────────

    private fun ensureInit() {
        if (!initialized || toneGenerator == null) {
            init()
        }
    }
}
