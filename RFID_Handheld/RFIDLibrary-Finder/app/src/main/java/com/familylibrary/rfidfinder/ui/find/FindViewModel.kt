package com.familylibrary.rfidfinder.ui.find

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.familylibrary.rfidfinder.cloud.model.DeviceTask
import com.familylibrary.rfidfinder.di.AppContainer
import com.familylibrary.rfidfinder.rfid.BeepPlayer
import com.familylibrary.rfidfinder.rfid.RfidManager
import com.familylibrary.rfidfinder.rfid.RssiLocator
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

private const val TAG = "FindViewModel"

/** 寻书扫描间隔（ms）。 */
private const val SCAN_INTERVAL_MS = 200L

/** 单次盘点超时（ms）。 */
private const val INVENTORY_TIMEOUT_MS = 150

/** 连续确认次数：连续 N 次读到目标标签认为"已找到"。 */
private const val FOUND_CONFIRM_COUNT = 3

/** 连续读取失败次数阈值：超过后认为"未找到"。 */
private const val LOST_THRESHOLD = 5

/**
 * 寻书流程 UI 状态机。
 *
 * TASK_INFO → SCANNING → [用户点击结束] → DONE
 */
enum class FindPhase {
    /** 显示任务信息，等待用户确认开始 */
    TASK_INFO,
    /** 正在扫描（盖革计数器模式） */
    SCANNING,
    /** 寻书完成 */
    DONE,
    /** 已取消/失败 */
    CANCELLED
}

data class FindUiState(
    val phase: FindPhase = FindPhase.TASK_INFO,
    val task: DeviceTask? = null,
    val deviceId: String = "",

    // 目标标签信息
    val targetTid: String = "",
    val bookTitle: String = "",

    // 扫描状态
    val scanning: Boolean = false,
    /** 最近一次读到的 RSSI（-100~0，越大越近） */
    val currentRssi: Int? = null,
    /** 连续读到目标标签的次数 */
    val consecutiveReads: Int = 0,
    /** 连续未读到目标标签的次数 */
    val consecutiveMisses: Int = 0,
    /** 是否已确认找到（连续 N 次读到） */
    val found: Boolean = false,
    /** 本次寻书会话已读到的总次数 */
    val totalReadCount: Int = 0,
    /** 寻书开始时间（用于计算耗时） */
    val startTimeMs: Long = 0L,

    // 寻书信号状态（来自 RssiLocator）
    /** 当前功率档位（dBm），由 RssiLocator 自动调节 */
    val currentPower: Int = RssiLocator.POWER_LEVELS.first(),
    /** 距离文案（来自 RssiLocator.locate） */
    val distanceHint: String = "",
    /** 当前 beep 等级 1~4（来自 RssiLocator.locate），0 表示无信号 */
    val beepLevel: Int = 0,

    // 状态消息
    val statusMessage: String = "",
    val busy: Boolean = false,
    val resultMessage: String = ""
)

/**
 * 寻书 ViewModel（F6.2 寻书物理定位）。
 *
 * 盖革计数器模式：持续扫描目标 TID，根据 RSSI 变化提示用户靠近/远离。
 * 连续 N 次稳定读到目标标签 → 判定为"已找到"。
 * 用户点击"结束寻书"时提交任务结果。
 *
 * 蜂鸣控制（来自设计文档 F6.2）：
 * - 每次扫描读到目标标签时，根据 [RssiLocator.locate] 返回的 beep 等级
 *   调用 [BeepPlayer.beepByLevel] 播放对应急促度的蜂鸣。
 * - beep 等级越高（越近）蜂鸣越急促，实现"盖革计数器"音效反馈。
 */
class FindViewModel : ViewModel() {

    private val _uiState = MutableStateFlow(FindUiState())
    val uiState: StateFlow<FindUiState> = _uiState.asStateFlow()

    private var scanJob: Job? = null

    /** 上次 beep 等级，用于在功率档位切换时播放等级音效 */
    private var lastBeepLevel: Int = 0

    /** beep 等级防抖计数器：同等级连续 N 次后才再次播放，避免过于频繁 */
    private var beepDebounceCount: Int = 0

    // ───────── 初始化 ─────────

    fun init(task: DeviceTask) {
        _uiState.update {
            it.copy(
                task = task,
                deviceId = AppContainer.deviceIdProvider.deviceId,
                targetTid = task.targetTid ?: "",
                bookTitle = task.title
            )
        }
    }

    override fun onCleared() {
        super.onCleared()
        cancelScan()
    }

    // ───────── TASK_INFO → SCANNING ─────────

    /** 用户点击「开始寻书」。 */
    fun onStartFind() {
        val state = _uiState.value
        if (state.targetTid.isBlank()) {
            _uiState.update {
                it.copy(statusMessage = "目标标签 TID 为空，无法寻书")
            }
            return
        }

        // 确保 RFID 已初始化（兜底：Application 启动时已自动初始化，此处二次确认）
        if (!RfidManager.isReady()) {
            Log.w(TAG, "RFID 未初始化，尝试自动初始化…")
            val ok = RfidManager.init()
            if (!ok) {
                _uiState.update {
                    it.copy(statusMessage = "RFID 初始化失败，请检查设备后重试")
                }
                return
            }
        }

        // 初始化 BeepPlayer（如果尚未初始化）
        BeepPlayer.init()

        // 寻书开始功率设为最高档（30dBm），扩大初始搜索范围
        val startPower = RssiLocator.POWER_LEVELS.first()
        try {
            RfidManager.setPower(startPower, RfidManager.MIN_WRITE_POWER)
        } catch (e: Exception) {
            Log.w(TAG, "设置初始功率失败: ${e.message}")
            _uiState.update {
                it.copy(statusMessage = "RFID 设置功率失败: ${e.message}")
            }
            return
        }

        _uiState.update {
            it.copy(
                phase = FindPhase.SCANNING,
                scanning = true,
                found = false,
                currentRssi = null,
                consecutiveReads = 0,
                consecutiveMisses = 0,
                totalReadCount = 0,
                currentPower = startPower,
                distanceHint = "",
                beepLevel = 0,
                startTimeMs = System.currentTimeMillis(),
                statusMessage = "正在搜索目标标签…请将 PDA 靠近书架"
            )
        }

        lastBeepLevel = 0
        beepDebounceCount = 0
        startScanLoop()
    }

    // ───────── SCANNING ─────────

    private fun startScanLoop() {
        cancelScan()
        val targetTid = _uiState.value.targetTid

        scanJob = viewModelScope.launch {
            var consecutiveErrors = 0
            while (isActive) {
                try {
                    val tag = RfidManager.findTagByTid(targetTid, INVENTORY_TIMEOUT_MS)
                    val current = _uiState.value

                    if (tag != null) {
                        consecutiveErrors = 0
                        val newConsecutiveReads = current.consecutiveReads + 1
                        val newTotalReads = current.totalReadCount + 1
                        val found = newConsecutiveReads >= FOUND_CONFIRM_COUNT

                        // 使用 RssiLocator 计算下一档功率和距离/beep 等级
                        val nextPower = RssiLocator.nextPower(current.currentPower, tag.rssi)
                        val (distance, beepLevel) = RssiLocator.locate(current.currentPower, tag.rssi)

                        Log.i(TAG, "读到目标标签 TID=$targetTid RSSI=${tag.rssi} " +
                                "功率=${current.currentPower}→$nextPower " +
                                "距离=$distance beep=$beepLevel " +
                                "连续=$newConsecutiveReads found=$found")

                        // 调节功率（盖革计数器自动功率切换）
                        if (nextPower != current.currentPower) {
                            try {
                                RfidManager.setPower(nextPower, RfidManager.MIN_WRITE_POWER)
                                Log.d(TAG, "功率已切换: ${current.currentPower}→$nextPower dBm")
                            } catch (e: Exception) {
                                Log.w(TAG, "功率切换失败: ${e.message}")
                            }
                        }

                        // ───────── 蜂鸣反馈 ─────────
                        // 策略：
                        // 1. 每次读到目标标签 → 播放短确认音（shortBeep），建立"滴-滴-滴"的实时反馈
                        // 2. 功率档位切换时 → 播放等级音效（beepByLevelAsync），强化"靠近了"的感知
                        // 3. 防抖：同等级连续 8 次后才允许再次播放等级音效
                        BeepPlayer.shortBeep()

                        if (beepLevel > 0 && beepLevel != lastBeepLevel) {
                            // 功率档位变化 → 立即播放新等级音效
                            BeepPlayer.beepByLevelAsync(beepLevel)
                            lastBeepLevel = beepLevel
                            beepDebounceCount = 0
                        } else if (beepLevel > 0) {
                            // 同等级持续中 → 防抖后周期性播放
                            beepDebounceCount++
                            if (beepDebounceCount >= 8) {
                                BeepPlayer.beepByLevelAsync(beepLevel)
                                beepDebounceCount = 0
                            }
                        }

                        _uiState.update {
                            it.copy(
                                currentRssi = tag.rssi,
                                consecutiveReads = newConsecutiveReads,
                                consecutiveMisses = 0,
                                totalReadCount = newTotalReads,
                                found = found,
                                currentPower = nextPower,
                                distanceHint = distance,
                                beepLevel = beepLevel,
                                statusMessage = if (found) {
                                    "已找到目标图书！RSSI=${tag.rssi}"
                                } else {
                                    "检测到目标信号 RSSI=${tag.rssi}（$newConsecutiveReads/$FOUND_CONFIRM_COUNT）"
                                }
                            )
                        }
                    } else {
                        // 未读到目标标签 → 重置 beep 状态
                        lastBeepLevel = 0
                        val newMisses = current.consecutiveMisses + 1
                        // 之前连续读到过但中断了 → 重置连续读数
                        if (current.consecutiveReads > 0 && !current.found) {
                            _uiState.update {
                                it.copy(
                                    consecutiveReads = 0,
                                    consecutiveMisses = newMisses,
                                    currentRssi = null,
                                    beepLevel = 0,
                                    statusMessage = "信号丢失，继续搜索中…"
                                )
                            }
                        } else if (current.consecutiveReads == 0) {
                            _uiState.update {
                                it.copy(
                                    consecutiveMisses = newMisses,
                                    currentRssi = null,
                                    beepLevel = 0,
                                    statusMessage = "未检测到目标标签，请移动 PDA…"
                                )
                            }
                        }
                    }
                } catch (e: Exception) {
                    consecutiveErrors++
                    Log.w(TAG, "寻书扫描异常（第${consecutiveErrors}次）：${e.message}", e)
                    if (consecutiveErrors >= 5) {
                        _uiState.update {
                            it.copy(
                                scanning = false,
                                statusMessage = "RFID 扫描异常：${e.message}。请检查设备后重试"
                            )
                        }
                        cancelScan()
                    }
                }
                delay(SCAN_INTERVAL_MS)
            }
        }
    }

    private fun cancelScan() {
        scanJob?.cancel()
        scanJob = null
    }

    // ───────── 结束寻书 ─────────

    /**
     * 用户点击「结束寻书」，提交任务结果。
     *
     * 判定规则（来自 F6.2 设计文档）：
     * - 已取得连续读取结果（found=true）→ success
     * - 未读到任何 RFID 结果（totalReadCount==0）→ failed（reason=no_rfid_read）
     * - 读到过但未稳定确认 → failed（reason=unstable_read）
     */
    fun onEndFind() {
        cancelScan()
        val state = _uiState.value
        val task = state.task ?: return
        val durationMs = if (state.startTimeMs > 0) {
            System.currentTimeMillis() - state.startTimeMs
        } else 0L

        _uiState.update { it.copy(busy = true, scanning = false) }

        viewModelScope.launch {
            try {
                val (success, result) = if (state.found) {
                    true to mapOf(
                        "found" to "true",
                        "durationMs" to durationMs.toString(),
                        "foundRssi" to (state.currentRssi?.toString() ?: ""),
                        "readCount" to state.totalReadCount.toString()
                    )
                } else if (state.totalReadCount == 0) {
                    false to mapOf(
                        "found" to "false",
                        "reason" to "no_rfid_read",
                        "durationMs" to durationMs.toString()
                    )
                } else {
                    false to mapOf(
                        "found" to "false",
                        "reason" to "unstable_read",
                        "readCount" to state.totalReadCount.toString(),
                        "durationMs" to durationMs.toString()
                    )
                }

                AppContainer.taskCloudService.completeTask(
                    taskId = task.taskId,
                    status = if (success) "success" else "failed",
                    result = result
                )

                _uiState.update {
                    it.copy(
                        phase = FindPhase.DONE,
                        busy = false,
                        resultMessage = if (success) {
                            "寻书成功！耗时 ${durationMs / 1000} 秒"
                        } else {
                            val reason = result["reason"] ?: ""
                            when (reason) {
                                "no_rfid_read" -> "未检测到 RFID 信号，寻书失败"
                                else -> "信号不稳定，寻书失败"
                            }
                        },
                        statusMessage = if (success) {
                            "已找到目标图书"
                        } else {
                            "寻书任务已结束"
                        }
                    )
                }
            } catch (e: Exception) {
                Log.e(TAG, "提交寻书结果失败：${e.message}", e)
                _uiState.update {
                    it.copy(
                        phase = FindPhase.DONE,
                        busy = false,
                        resultMessage = "结果提交失败：${e.message}",
                        statusMessage = "请检查网络连接"
                    )
                }
            }
        }
    }

    // ───────── 取消 ─────────

    /** 用户放弃寻书任务。 */
    fun onCancel() {
        cancelScan()
        val task = _uiState.value.task ?: return

        viewModelScope.launch {
            try {
                AppContainer.taskCloudService.completeTask(
                    taskId = task.taskId,
                    status = "failed",
                    result = mapOf("reason" to "user_abort")
                )
            } catch (e: Exception) {
                Log.w(TAG, "取消任务失败：${e.message}")
            }
        }

        _uiState.update {
            it.copy(
                phase = FindPhase.CANCELLED,
                busy = false,
                statusMessage = "已取消"
            )
        }
    }
}
