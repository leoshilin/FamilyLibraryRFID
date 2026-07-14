package com.familylibrary.rfidfinder.ui

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.familylibrary.rfidfinder.cloud.model.ApiResult
import com.familylibrary.rfidfinder.cloud.model.DeviceTask
import com.familylibrary.rfidfinder.di.AppContainer
import com.familylibrary.rfidfinder.rfid.RfidManager
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

private const val TAG = "HomeViewModel"

/** 自动轮询间隔（毫秒），IDLE 状态下每隔此时间重新轮询任务。 */
private const val POLL_INTERVAL_MS = 5_000L

/**
 * 首页 UI 状态（设计文档 UI §5.2 状态机）。
 *
 * - IDLE：空闲/无任务等待态，持有 5s 自动轮询定时器。
 * - POLLING：轮询中，显示「刷新中…」，禁用操作按钮。
 * - TASK_LIST：有任务清单（最多 10 条），用户可选择执行或放弃。
 */
enum class HomeUiPhase {
    IDLE,
    POLLING,
    TASK_LIST
}

/**
 * 首页 UI 状态数据类。
 * @param phase 当前状态机阶段
 * @param deviceId 设备 ID
 * @param configured 云配置是否完整
 * @param rfidReady RFID 是否已初始化
 * @param tasks 当前任务清单（仅在 TASK_LIST 阶段有意义）
 * @param statusMessage 状态提示文字
 * @param busy 是否有进行中操作（POLLING 时为 true）
 */
data class HomeUiState(
    val phase: HomeUiPhase = HomeUiPhase.IDLE,
    val deviceId: String = "",
    val configured: Boolean = false,
    val rfidReady: Boolean = false,
    val tasks: List<DeviceTask> = emptyList(),
    val statusMessage: String = "暂无待执行任务",
    val busy: Boolean = false
)

/**
 * 首页 ViewModel。
 *
 * 职责：管理首页状态机（IDLE → POLLING → TASK_LIST），
 * 实现 idle 时自动轮询任务（5s 定时器），并提供任务放弃操作。
 */
class HomeViewModel : ViewModel() {

    private val _uiState = MutableStateFlow(HomeUiState())
    val uiState: StateFlow<HomeUiState> = _uiState.asStateFlow()

    /** 自动轮询协程 Job，用于取消定时器。 */
    private var pollJob: Job? = null

    /** 当前进行中轮询协程 Job，用于取消进行中的网络请求。 */
    private var fetchingJob: Job? = null

    init {
        _uiState.update { current ->
            current.copy(
                deviceId = AppContainer.deviceIdProvider.deviceId,
                configured = AppContainer.cloudConfig.isConfigured,
                rfidReady = RfidManager.isReady()
            )
        }
    }

    // ───────── 生命周期 ─────────

    /**
     * 页面进入（onStart / onResume）时调用，触发首次轮询。
     * 从 bind/find/recent 返回时也应调用此方法。
     */
    fun onEnter() {
        // 刷新 RFID 状态（可能在其他页面初始化过）
        _uiState.update { it.copy(rfidReady = RfidManager.isReady()) }
        // 进入即触发轮询
        startPolling()
    }

    /**
     * 页面离开（onStop / onPause）时调用，取消定时器和进行中轮询。
     * 防止旧轮询结果覆盖新状态（UI 设计 §5.2 防并发）。
     */
    fun onLeave() {
        cancelPolling()
    }

    // ───────── 轮询逻辑 ─────────

    /** 开始自动轮询（IDLE 态 5s 定时器 + 立即执行一次 POLLING）。 */
    private fun startPolling() {
        cancelPolling() // 先取消旧的，避免重复

        pollJob = viewModelScope.launch {
            while (isActive) {
                // 立即执行一次轮询
                fetchTasks()

                // 等待 5s 后再轮询
                delay(POLL_INTERVAL_MS)

                // 仅 IDLE 阶段继续轮询（TASK_LIST 或其它阶段不再自动触发）
                if (_uiState.value.phase != HomeUiPhase.IDLE) {
                    break
                }
            }
        }
    }

    /** 取消所有轮询相关协程（定时器 + 进行中网络请求）。 */
    private fun cancelPolling() {
        pollJob?.cancel()
        pollJob = null
        fetchingJob?.cancel()
        fetchingJob = null
    }

    /** 执行一次任务领取请求。 */
    private fun fetchTasks() {
        val deviceId = _uiState.value.deviceId
        if (!_uiState.value.configured) {
            _uiState.update {
                it.copy(
                    phase = HomeUiPhase.IDLE,
                    statusMessage = "云配置缺失，无法领取任务",
                    busy = false
                )
            }
            return
        }

        _uiState.update { it.copy(phase = HomeUiPhase.POLLING, busy = true, statusMessage = "刷新中…") }

        fetchingJob = viewModelScope.launch {
            try {
                when (val res = AppContainer.taskCloudService.acceptTask(deviceId, 10)) {
                    is ApiResult.Success -> {
                        val tasks = res.data
                        if (tasks.isEmpty()) {
                            _uiState.update {
                                it.copy(
                                    phase = HomeUiPhase.IDLE,
                                    tasks = emptyList(),
                                    statusMessage = "暂无待执行任务",
                                    busy = false
                                )
                            }
                        } else {
                            _uiState.update {
                                it.copy(
                                    phase = HomeUiPhase.TASK_LIST,
                                    tasks = tasks,
                                    statusMessage = "共 ${tasks.size} 条待执行任务",
                                    busy = false
                                )
                            }
                        }
                    }
                    is ApiResult.Failure -> {
                        val detail = res.exception.message
                            ?: res.exception.javaClass.simpleName
                        Log.w(TAG, "任务领取失败：$detail")
                        _uiState.update {
                            it.copy(
                                phase = HomeUiPhase.IDLE,
                                tasks = emptyList(),
                                statusMessage = "领取失败：$detail",
                                busy = false
                            )
                        }
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "轮询异常：${e.message}", e)
                _uiState.update {
                    it.copy(
                        phase = HomeUiPhase.IDLE,
                        statusMessage = "轮询异常：${e.message}",
                        busy = false
                    )
                }
            }
        }
    }

    // ───────── 用户操作 ─────────

    /** 初始化 RFID（用户点击按钮触发）。 */
    fun initRfid() {
        val success = RfidManager.init()
        _uiState.update {
            it.copy(
                rfidReady = success,
                statusMessage = if (success) "RFID 初始化成功" else "RFID 初始化失败（需 PDA 真机）"
            )
        }
    }

    /**
     * 放弃某条任务。
     * 调用云端 J2 将任务置为 failed(reason: user_abort)，然后从本地清单移除。
     */
    fun abandonTask(task: DeviceTask) {
        viewModelScope.launch {
            try {
                AppContainer.taskCloudService.completeTask(
                    taskId = task.taskId,
                    status = "failed",
                    result = mapOf("reason" to "user_abort")
                )
            } catch (e: Exception) {
                Log.w(TAG, "放弃任务失败：${e.message}")
            }

            // 从本地清单中移除该条
            val remaining = _uiState.value.tasks.filter { it.taskId != task.taskId }
            if (remaining.isEmpty()) {
                _uiState.update {
                    it.copy(
                        phase = HomeUiPhase.IDLE,
                        tasks = emptyList(),
                        statusMessage = "暂无待执行任务"
                    )
                }
                // 回到 IDLE，启动自动轮询
                startPolling()
            } else {
                _uiState.update {
                    it.copy(
                        tasks = remaining,
                        statusMessage = "共 ${remaining.size} 条待执行任务"
                    )
                }
            }
        }
    }
}
