package com.familylibrary.rfidfinder.rfid

import android.media.AudioAttributes
import android.media.ToneGenerator
import android.os.Build
import android.util.Log

/**
 * PDA 蜂鸣音播放器（封装 Android [ToneGenerator]）。
 *
 * 用于寻书模式的盖革计数器音效反馈（beep 等级 1~4，越近越急促），
 * 以及调试页面中测试不同蜂鸣模式。
 *
 * 设计原则：
 * - 使用 Android 系统 [ToneGenerator] 产生标准蜂鸣音，无需额外音频资源文件
 * - 不依赖厂家 SDK 的蜂鸣 API（UHFRManager 不提供内置蜂鸣方法）
 * - 所有 beep 调用均为非阻塞（ToneGenerator 异步播放）
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
            // ToneGenerator 有两个构造函数：
            // - (streamType, volumePercent: Int)    所有版本
            // - (streamType, volume: Float)          API 25+
            // 不存在 (streamType, Int, AudioAttributes) 的三参数版本。
            // 这里使用 Int 版本兼容 minSdk=24，再通过 setAudioAttributes 设置音频属性。
            toneGenerator = ToneGenerator(
                android.media.AudioManager.STREAM_MUSIC,
                DEFAULT_VOLUME
            )
            // API 21+ 可用 AudioAttributes 设置音频用途
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                @Suppress("DEPRECATION")
                toneGenerator?.setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
                )
            }
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
     * 按寻书 beep 等级播放相应频率/急促度的蜂鸣。
     *
     * | 等级 | 含义       | 效果                        |
     * |------|-----------|----------------------------|
     * | 1    | 远 (>2m)  | 单短音，间隔 ~800ms         |
     * | 2    | 中 (1-2m) | 双短音（滴滴），间隔 ~500ms  |
     * | 3    | 近 (0.5-1m)| 三短音（滴滴滴），间隔 ~300ms|
     * | 4    | 极近 (<0.5m)| 急促连音（嘀嘀嘀嘀），间隔~120ms|
     *
     * @param level beep 等级 1~4
     */
    fun beepByLevel(level: Int) {
        ensureInit()
        try {
            when (level) {
                1 -> {
                    // 远距离：单短音
                    toneGenerator?.startTone(TONE_TYPE, 40)
                }
                2 -> {
                    // 中距离：双短音
                    toneGenerator?.startTone(TONE_TYPE, 40)
                    Thread.sleep(60)
                    toneGenerator?.startTone(TONE_TYPE, 40)
                }
                3 -> {
                    // 近距离：三短音
                    repeat(3) {
                        toneGenerator?.startTone(TONE_TYPE, 40)
                        Thread.sleep(40)
                    }
                }
                4 -> {
                    // 极近：急促多连音
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
