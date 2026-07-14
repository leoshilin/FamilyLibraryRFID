package com.familylibrary.rfidfinder.ui.bind

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.familylibrary.rfidfinder.cloud.model.ApiResult
import com.familylibrary.rfidfinder.cloud.model.BookBindingInfo
import com.familylibrary.rfidfinder.cloud.model.DeviceTask
import com.familylibrary.rfidfinder.di.AppContainer
import com.familylibrary.rfidfinder.rfid.RfidManager
import com.familylibrary.rfidfinder.rfid.RfidTag
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

private const val TAG = "BindViewModel"

/** 单次盘点超时（ms）。 */
private const val INVENTORY_TIMEOUT_MS = 100

/**
 * 绑定流程 UI 状态机（设计文档 UI §6.1）：
 *
 * TASK_INFO → SCAN_ISBN → SCAN_TAG → [CONFIRM_UNBIND?] → BINDING → WRITE_EPC → DONE
 */
enum class BindPhase {
    /** 显示任务信息，等待用户确认开始 */
    TASK_INFO,
    /** ISBN 扫码校验（相机扫码后与任务 ISBN 比对） */
    SCAN_ISBN,
    /** 扫描 RFID 标签，列出可见标签供用户选择 */
    SCAN_TAG,
    /** 标签已被占用，确认是否解绑重绑 */
    CONFIRM_UNBIND,
    /** 云端绑定进行中 */
    BINDING,
    /** 写入 EPC 区 */
    WRITE_EPC,
    /** 绑定完成 */
    DONE,
    /** 已取消/失败 */
    CANCELLED
}

/**
 * 绑定流程 UI 状态。
 */
data class BindUiState(
    val phase: BindPhase = BindPhase.TASK_INFO,
    /** 当前持有的任务 */
    val task: DeviceTask? = null,
    /** 设备 ID */
    val deviceId: String = "",
    /** ISBN 扫码结果（用于与任务 ISBN 比对） */
    val scannedIsbn: String = "",
    /** ISBN 比对是否通过 */
    val isbnMatched: Boolean = false,
    /** ISBN 比对错误提示 */
    val isbnError: String = "",
    /** 当前扫描到的标签列表 */
    val scannedTags: List<RfidTag> = emptyList(),
    /** 用户选中的目标标签 */
    val selectedTag: RfidTag? = null,
    /** 标签绑定信息（用于解绑确认） */
    val bindingInfo: BookBindingInfo? = null,
    /** 当前操作状态提示 */
    val statusMessage: String = "",
    /** 是否忙碌（异步操作进行中） */
    val busy: Boolean = false,
    /** 绑定结果消息 */
    val resultMessage: String = "",
    /** EPC 写入是否成功 */
    val epcWritten: Boolean = false,
    /** 是否正在盘点扫描 */
    val scanning: Boolean = false
)

/**
 * 绑定流程 ViewModel（F4.3）。
 *
 * 完整调用链路：RfidManager.inventory → getRfidBindingInfo(tid) → bindRfid(...) → RfidManager.writeEpcByTid → completeTask。
 */
class BindViewModel : ViewModel() {

    private val _uiState = MutableStateFlow(BindUiState())
    val uiState: StateFlow<BindUiState> = _uiState.asStateFlow()

    /** 盘点循环协程 */
    private var inventoryJob: Job? = null

    // ───────── 初始化 ─────────

    /** 由 BindScreen 在初始化时调用，传入任务和设备 ID。 */
    fun init(task: DeviceTask) {
        _uiState.update {
            it.copy(
                task = task,
                deviceId = AppContainer.deviceIdProvider.deviceId
            )
        }
    }

    // ───────── 生命周期 ─────────

    override fun onCleared() {
        super.onCleared()
        cancelInventory()
    }

    // ───────── TASK_INFO → SCAN_ISBN ─────────

    /** 用户点击「开始绑定」。 */
    fun onStartBinding() {
        _uiState.update {
            it.copy(
                phase = BindPhase.SCAN_ISBN,
                scannedIsbn = "",
                isbnMatched = false,
                isbnError = "",
                statusMessage = "请扫描图书 ISBN 条码"
            )
        }
    }

    // ───────── SCAN_ISBN ─────────

    /**
     * 处理扫码结果（由相机扫码回调触发）。
     *
     * 与任务返回的 ISBN 比对，不一致则红字提示允许重试；
     * 一致则进入 SCAN_TAG 阶段。
     */
    fun onIsbnScanned(isbn: String) {
        val task = _uiState.value.task ?: return
        val normalized = isbn.replace("-", "").replace(" ", "").trim()
        val expected = task.isbn.replace("-", "").replace(" ", "").trim()

        if (normalized.equals(expected, ignoreCase = true)) {
            _uiState.update {
                it.copy(
                    scannedIsbn = isbn,
                    isbnMatched = true,
                    isbnError = "",
                    phase = BindPhase.SCAN_TAG,
                    statusMessage = "ISBN 校验通过，请扫描 RFID 标签"
                )
            }
            startInventory()
        } else {
            _uiState.update {
                it.copy(
                    scannedIsbn = isbn,
                    isbnMatched = false,
                    isbnError = "ISBN 不匹配：期望 ${task.isbn}，实际扫描 $isbn",
                    statusMessage = "ISBN 不一致，请重新扫描"
                )
            }
        }
    }

    // ───────── SCAN_TAG ─────────

    /** 开始循环盘点扫描标签。 */
    fun startInventory() {
        cancelInventory()

        _uiState.update { it.copy(scanning = true, scannedTags = emptyList(), statusMessage = "正在扫描 RFID 标签…") }

        inventoryJob = viewModelScope.launch {
            while (isActive) {
                try {
                    val tags = RfidManager.inventory(INVENTORY_TIMEOUT_MS)
                    if (tags.isNotEmpty()) {
                        _uiState.update { it.copy(scannedTags = tags) }
                    }
                } catch (e: Exception) {
                    Log.w(TAG, "盘点扫描异常：${e.message}")
                }
                delay(300) // 每 300ms 扫描一次
            }
        }
    }

    /** 停止盘点扫描。 */
    fun stopInventory() {
        cancelInventory()
        _uiState.update { it.copy(scanning = false) }
    }

    /** 重新扫描标签（清空列表重新盘点）。 */
    fun rescanTags() {
        _uiState.update { it.copy(scannedTags = emptyList(), selectedTag = null) }
        startInventory()
    }

    /**
     * 用户选中某个标签。
     *
     * 停止盘点，查询该标签绑定状态：
     * - 未被占用 → 直接进入 BINDING
     * - 已被占用 → 进入 CONFIRM_UNBIND
     */
    fun onTagSelected(tag: RfidTag) {
        stopInventory()
        _uiState.update { it.copy(selectedTag = tag, busy = true, statusMessage = "查询标签绑定状态…") }

        viewModelScope.launch {
            try {
                when (val res = AppContainer.taskCloudService.getRfidBindingInfo(tag.tid)) {
                    is ApiResult.Success -> {
                        val info = res.data
                        if (info.bound) {
                            _uiState.update {
                                it.copy(
                                    phase = BindPhase.CONFIRM_UNBIND,
                                    bindingInfo = info,
                                    busy = false,
                                    statusMessage = "该标签已被占用，请确认是否解绑后重绑"
                                )
                            }
                        } else {
                            // 标签空闲，直接进入绑定
                            _uiState.update { it.copy(phase = BindPhase.BINDING, busy = true, statusMessage = "正在绑定…") }
                            startCloudBinding()
                        }
                    }
                    is ApiResult.Failure -> {
                        Log.w(TAG, "查询绑定状态失败：${res.exception.message}")
                        _uiState.update {
                            it.copy(
                                busy = false,
                                statusMessage = "查询标签状态失败：${res.exception.message}，请重新选择"
                            )
                        }
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "查询绑定异常：${e.message}", e)
                _uiState.update {
                    it.copy(
                        busy = false,
                        statusMessage = "查询标签状态异常，请重试"
                    )
                }
            }
        }
    }

    // ───────── CONFIRM_UNBIND ─────────

    /** 用户确认解绑后重绑。 */
    fun onConfirmUnbind() {
        _uiState.update { it.copy(phase = BindPhase.BINDING, busy = true, statusMessage = "正在绑定…") }
        startCloudBinding()
    }

    /** 用户取消解绑，回到标签扫描。 */
    fun onCancelUnbind() {
        _uiState.update {
            it.copy(
                phase = BindPhase.SCAN_TAG,
                selectedTag = null,
                bindingInfo = null,
                scannedTags = emptyList(),
                statusMessage = "请重新选择标签"
            )
        }
        startInventory()
    }

    // ───────── BINDING ─────────

    /** 执行云端绑定（调用前调用方已设置 phase=BINDING, busy=true）。 */
    private fun startCloudBinding() {
        val state = _uiState.value
        val task = state.task ?: return
        val tag = state.selectedTag ?: return

        viewModelScope.launch {
            try {
                when (val res = AppContainer.taskCloudService.bindRfid(
                    bookItemId = task.bookItemId,
                    tid = tag.tid,
                    taskId = task.taskId,
                    deviceId = state.deviceId
                )) {
                    is ApiResult.Success -> {
                        Log.i(TAG, "云端绑定成功，action=${res.data.action}")
                        // 进入 EPC 回写阶段
                        startWriteEpc()
                    }
                    is ApiResult.Failure -> {
                        Log.e(TAG, "云端绑定失败：${res.exception.message}")
                        _uiState.update {
                            it.copy(
                                busy = false,
                                statusMessage = "绑定失败：${res.exception.message}，请重试或取消"
                            )
                        }
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "绑定异常：${e.message}", e)
                _uiState.update {
                    it.copy(
                        busy = false,
                        statusMessage = "绑定异常，请重试或取消"
                    )
                }
            }
        }
    }

    // ───────── WRITE_EPC ─────────

    /** 将 bookItemId 写入标签 EPC 区。 */
    private fun startWriteEpc() {
        val task = _uiState.value.task ?: return
        val tag = _uiState.value.selectedTag ?: return

        _uiState.update { it.copy(phase = BindPhase.WRITE_EPC, busy = true, statusMessage = "正在写入 EPC=${task.bookItemId}…") }

        viewModelScope.launch {
            try {
                val success = RfidManager.writeEpcByTid(
                    tid = tag.tid,
                    newEpc = task.bookItemId
                )

                if (success) {
                    Log.i(TAG, "EPC 写入成功")
                    // 绑定+EPC 均成功，完成任务
                    completeTask(success = true, epcWritten = true)
                    _uiState.update {
                        it.copy(
                            phase = BindPhase.DONE,
                            busy = false,
                            epcWritten = true,
                            resultMessage = "绑定完成",
                            statusMessage = "书名：${task.title} / TID：${tag.tid} / EPC 已写入"
                        )
                    }
                } else {
                    Log.w(TAG, "EPC 写入失败")
                    _uiState.update {
                        it.copy(
                            phase = BindPhase.WRITE_EPC,
                            busy = false,
                            epcWritten = false,
                            statusMessage = "EPC 写入失败，请选择重试写入或完成（绑定已生效）"
                        )
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "EPC 写入异常：${e.message}", e)
                _uiState.update {
                    it.copy(
                        phase = BindPhase.WRITE_EPC,
                        busy = false,
                        epcWritten = false,
                        statusMessage = "EPC 写入异常：${e.message}，请选择重试或完成"
                    )
                }
            }
        }
    }

    /** 重试 EPC 写入。 */
    fun onRetryWriteEpc() {
        startWriteEpc()
    }

    /** 跳过 EPC 写入，以"绑定已生效"完成。 */
    fun onSkipWriteEpc() {
        viewModelScope.launch {
            completeTask(success = true, epcWritten = false)
        }
        val task = _uiState.value.task ?: return
        val tag = _uiState.value.selectedTag ?: return
        _uiState.update {
            it.copy(
                phase = BindPhase.DONE,
                busy = false,
                epcWritten = false,
                resultMessage = "绑定完成（EPC 未写入，可日后重补）",
                statusMessage = "书名：${task.title} / TID：${tag.tid} / EPC 未写入"
            )
        }
    }

    // ───────── 取消 / 放弃 ─────────

    /** 取消绑定流程。 */
    fun onCancel() {
        cancelInventory()
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
                phase = BindPhase.CANCELLED,
                busy = false,
                statusMessage = "已取消"
            )
        }
    }

    // ───────── 辅助 ─────────

    /** 提交任务完成结果到云端。 */
    private suspend fun completeTask(success: Boolean, epcWritten: Boolean) {
        val task = _uiState.value.task ?: return
        try {
            AppContainer.taskCloudService.completeTask(
                taskId = task.taskId,
                status = if (success) "success" else "failed",
                result = mapOf(
                    "epcWritten" to epcWritten.toString()
                )
            )
        } catch (e: Exception) {
            Log.w(TAG, "提交任务结果失败：${e.message}")
        }
    }

    private fun cancelInventory() {
        inventoryJob?.cancel()
        inventoryJob = null
    }
}
