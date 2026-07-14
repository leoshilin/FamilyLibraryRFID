package com.familylibrary.rfidfinder.ui.debug

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.familylibrary.rfidfinder.rfid.RfidException
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

private const val TAG = "RfidTestVM"

/** 连续读取间隔（毫秒）。 */
private const val READ_INTERVAL_MS = 200L

/** 功率调节范围。 */
const val MIN_POWER = 5
const val MAX_POWER = 30

/**
 * EPC 写入结果。
 */
sealed class WriteResult {
    /** 写入并校验成功。 */
    data class Success(val epc: String, val tid: String) : WriteResult()
    /** 写入失败。 */
    data class Failure(val reason: String) : WriteResult()
}

/**
 * RFID 测试 UI 状态。
 */
data class RfidTestUiState(
    /** 当前读功率（dBm）。 */
    val readPower: Int = 26,
    /** 当前写功率（dBm）。 */
    val writePower: Int = 26,
    /** 功率是否加载完成。 */
    val powerLoaded: Boolean = false,
    /** 功率加载/设置错误信息。 */
    val powerError: String = "",

    /** 是否正在连续读取。 */
    val isReading: Boolean = false,
    /** 累计读取次数。 */
    val readCount: Int = 0,
    /** 当前发现的标签列表（按 TID 去重，保留最新 RSSI）。 */
    val tags: List<RfidTag> = emptyList(),
    /** 读取错误信息。 */
    val readError: String = "",

    /** 是否正在写入。 */
    val isWriting: Boolean = false,
    /** 写入结果（null = 未执行或已清除）。 */
    val writeResult: WriteResult? = null,
    /** 用户选择的 TID（用于写入目标）。 */
    val selectedTid: String = "",
    /** 用户输入的 EPC 值。 */
    val epcInput: String = ""
)

/**
 * RFID 标签读写调试 ViewModel。
 *
 * 提供底层 RFID 调试能力：
 * - 功率查询与调节（5-30 dBm，±1/±5）
 * - 连续读取（协程循环 ~200ms，显示 RSSI/EPC/TID/读取次数）
 * - EPC 写入（多标签选择 + 成功/失败反馈）
 *
 * 直接调用 [RfidManager]（object 单例），不经过云函数和任务系统。
 */
class RfidTestViewModel : ViewModel() {

    private val _uiState = MutableStateFlow(RfidTestUiState())
    val uiState: StateFlow<RfidTestUiState> = _uiState.asStateFlow()

    /** 连续读取协程 Job。 */
    private var readJob: Job? = null

    init {
        loadPower()
    }

    // ───────── 功率 ─────────

    /** 从设备加载当前功率。 */
    fun loadPower() {
        viewModelScope.launch {
            try {
                val (read, write) = RfidManager.getPower()
                    ?: throw RfidException.ReadFailed(Exception("getPower 返回 null"))
                _uiState.update {
                    it.copy(
                        readPower = read,
                        writePower = write,
                        powerLoaded = true,
                        powerError = ""
                    )
                }
                Log.i(TAG, "功率已加载: read=$read dBm, write=$write dBm")
            } catch (e: Exception) {
                val msg = e.message ?: "未知错误"
                Log.w(TAG, "加载功率失败: $msg")
                _uiState.update { it.copy(powerLoaded = true, powerError = "加载功率失败: $msg") }
            }
        }
    }

    /**
     * 调节读功率。
     * @param delta 变化量（+1/+5/-1/-5）
     */
    fun adjustReadPower(delta: Int) {
        val current = _uiState.value.readPower
        val newPower = (current + delta).coerceIn(MIN_POWER, MAX_POWER)
        if (newPower == current) return
        applyPower(newPower, _uiState.value.writePower) { read, write ->
            _uiState.update { it.copy(readPower = read, writePower = write, powerError = "") }
        }
    }

    /**
     * 调节写功率。
     * @param delta 变化量（+1/+5/-1/-5）
     */
    fun adjustWritePower(delta: Int) {
        val current = _uiState.value.writePower
        val newPower = (current + delta).coerceIn(MIN_POWER, MAX_POWER)
        if (newPower == current) return
        applyPower(_uiState.value.readPower, newPower) { read, write ->
            _uiState.update { it.copy(readPower = read, writePower = write, powerError = "") }
        }
    }

    /** 实际调用 SDK 设置功率并更新状态。 */
    private fun applyPower(
        readPower: Int,
        writePower: Int,
        onSuccess: (Int, Int) -> Unit
    ) {
        viewModelScope.launch {
            try {
                RfidManager.setPower(readPower, writePower)
                onSuccess(readPower, writePower)
                Log.i(TAG, "功率已设置: read=$readPower dBm, write=$writePower dBm")
            } catch (e: Exception) {
                val msg = e.message ?: "未知错误"
                Log.w(TAG, "设置功率失败: $msg")
                _uiState.update { it.copy(powerError = "设置功率失败: $msg") }
            }
        }
    }

    // ───────── 连续读取 ─────────

    /** 开始连续读取。 */
    fun startReading() {
        if (_uiState.value.isReading) return
        _uiState.update { it.copy(isReading = true, readCount = 0, tags = emptyList(), readError = "", writeResult = null) }

        readJob = viewModelScope.launch {
            while (isActive && _uiState.value.isReading) {
                try {
                    val newTags = RfidManager.inventory(timeoutMs = 50)
                    if (newTags.isNotEmpty()) {
                        mergeTags(newTags)
                    }
                    _uiState.update { it.copy(readCount = it.readCount + 1, readError = "") }
                } catch (e: Exception) {
                    val msg = e.message ?: "读取异常"
                    Log.w(TAG, "连续读取异常: $msg")
                    _uiState.update {
                        it.copy(readCount = it.readCount + 1, readError = msg)
                    }
                }
                delay(READ_INTERVAL_MS)
            }
        }
    }

    /** 停止连续读取。 */
    fun stopReading() {
        readJob?.cancel()
        readJob = null
        _uiState.update { it.copy(isReading = false) }
        Log.i(TAG, "连续读取已停止，共读取 ${_uiState.value.readCount} 次")
    }

    /**
     * 合并新读到的标签列表：按 TID 去重，保留最新 RSSI。
     * 同时保留之前的 EPC（如果新标签 EPC 为空则沿用旧值）。
     */
    private fun mergeTags(newTags: List<RfidTag>) {
        _uiState.update { current ->
            val merged = LinkedHashMap<String, RfidTag>()
            // 先放入已有标签
            current.tags.forEach { merged[it.tid] = it }
            // 用新标签覆盖（保留最新的 RSSI 和 EPC）
            newTags.forEach { newTag ->
                if (newTag.tid.isNotBlank()) {
                    val existing = merged[newTag.tid]
                    merged[newTag.tid] = if (existing != null && newTag.epc.isBlank()) {
                        newTag.copy(epc = existing.epc)
                    } else {
                        newTag
                    }
                }
            }
            current.copy(tags = merged.values.toList())
        }
    }

    // ───────── 写入 EPC ─────────

    /** 选择写入目标 TID。 */
    fun selectTid(tid: String) {
        _uiState.update { it.copy(selectedTid = tid, writeResult = null) }
    }

    /** 设置 EPC 输入值。 */
    fun setEpcInput(epc: String) {
        _uiState.update { it.copy(epcInput = epc, writeResult = null) }
    }

    /** 执行 EPC 写入。 */
    fun writeEpc() {
        val state = _uiState.value
        val tid = state.selectedTid
        val epc = state.epcInput.trim()

        // 校验
        if (tid.isBlank()) {
            _uiState.update { it.copy(writeResult = WriteResult.Failure("请先选择目标标签")) }
            return
        }
        if (epc.isBlank()) {
            _uiState.update { it.copy(writeResult = WriteResult.Failure("请输入 EPC 写入值")) }
            return
        }
        if (epc.length % 2 != 0) {
            _uiState.update { it.copy(writeResult = WriteResult.Failure("EPC 值必须为偶数长度十六进制串")) }
            return
        }

        // 写入前自动停止读取
        if (state.isReading) {
            stopReading()
        }

        _uiState.update { it.copy(isWriting = true, writeResult = null) }

        viewModelScope.launch {
            try {
                val success = RfidManager.writeEpcByTid(tid, epc)
                if (success) {
                    _uiState.update {
                        it.copy(
                            isWriting = false,
                            writeResult = WriteResult.Success(epc, tid)
                        )
                    }
                    Log.i(TAG, "EPC 写入成功: tid=$tid epc=$epc")
                } else {
                    _uiState.update {
                        it.copy(
                            isWriting = false,
                            writeResult = WriteResult.Failure("写入校验失败（回读 EPC 不匹配）")
                        )
                    }
                }
            } catch (e: RfidException) {
                val msg = e.message ?: "写入异常"
                Log.w(TAG, "EPC 写入失败: $msg")
                _uiState.update {
                    it.copy(isWriting = false, writeResult = WriteResult.Failure(msg))
                }
            } catch (e: Exception) {
                val msg = e.message ?: "未知异常"
                Log.w(TAG, "EPC 写入失败: $msg")
                _uiState.update {
                    it.copy(isWriting = false, writeResult = WriteResult.Failure(msg))
                }
            }
        }
    }

    override fun onCleared() {
        super.onCleared()
        readJob?.cancel()
    }
}
