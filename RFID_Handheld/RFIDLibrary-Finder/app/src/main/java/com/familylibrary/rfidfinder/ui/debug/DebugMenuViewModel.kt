package com.familylibrary.rfidfinder.ui.debug

import androidx.lifecycle.ViewModel
import com.familylibrary.rfidfinder.rfid.RfidManager
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update

/**
 * 调试菜单 UI 状态。
 */
data class DebugMenuUiState(
    /** RFID 是否已初始化（影响 RFID 测试入口可用性提示）。 */
    val rfidReady: Boolean = false
)

/**
 * 调试菜单 ViewModel。
 *
 * 轻量级，仅管理 RFID 状态显示。
 */
class DebugMenuViewModel : ViewModel() {

    private val _uiState = MutableStateFlow(DebugMenuUiState())
    val uiState: StateFlow<DebugMenuUiState> = _uiState.asStateFlow()

    init {
        refreshRfidStatus()
    }

    /** 刷新 RFID 状态。 */
    fun refreshRfidStatus() {
        _uiState.update { it.copy(rfidReady = RfidManager.isReady()) }
    }
}
