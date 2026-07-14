package com.familylibrary.rfidfinder.ui.debug

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.familylibrary.rfidfinder.rfid.BeepPlayer
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

/**
 * Beep 调试 UI 状态。
 */
data class BeepTestUiState(
    /** BeepPlayer 是否已初始化。 */
    val beepReady: Boolean = false,
    /** 是否正在播放连续音（用于禁用按钮防重复点击）。 */
    val isPlaying: Boolean = false,
    /** 当前播放的蜂鸣模式描述。 */
    val playingMode: String = "",
    /** 状态消息。 */
    val statusMessage: String = ""
)

/**
 * Beep 调试 ViewModel。
 *
 * 提供三种蜂鸣测试模式：
 * - 短音（单次 ~50ms）
 * - 滴滴连续音（4 组双短音，模拟中距离寻书反馈）
 * - 急促嘀嘀嘀（12 连音，模拟极近寻书反馈）
 *
 * 直接调用 [BeepPlayer]（object 单例），无需 RFID 初始化。
 */
class BeepTestViewModel : ViewModel() {

    private val _uiState = MutableStateFlow(BeepTestUiState())
    val uiState: StateFlow<BeepTestUiState> = _uiState.asStateFlow()

    private var playJob: Job? = null

    init {
        // 检查并初始化 BeepPlayer
        val ready = BeepPlayer.init()
        _uiState.update { it.copy(beepReady = ready) }
    }

    /** 播放短音（单次 ~50ms）。 */
    fun playShortBeep() {
        if (_uiState.value.isPlaying) return
        _uiState.update {
            it.copy(statusMessage = "播放短音…")
        }

        viewModelScope.launch {
            try {
                BeepPlayer.playShortBeep()
                delay(100) // 短暂延迟让用户感知
                _uiState.update {
                    it.copy(statusMessage = "✅ 短音已播放")
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(statusMessage = "❌ 播放失败: ${e.message}")
                }
            }
        }
    }

    /** 播放滴滴连续音（4 组双短音）。 */
    fun playDoubleBeeps() {
        if (_uiState.value.isPlaying) return
        _uiState.update {
            it.copy(isPlaying = true, playingMode = "滴滴连续音", statusMessage = "播放滴滴连续音中…")
        }

        playJob = viewModelScope.launch {
            try {
                BeepPlayer.playDoubleBeeps()
                _uiState.update {
                    it.copy(
                        isPlaying = false,
                        playingMode = "",
                        statusMessage = "✅ 滴滴连续音播放完成"
                    )
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isPlaying = false,
                        playingMode = "",
                        statusMessage = "❌ 播放失败: ${e.message}"
                    )
                }
            }
        }
    }

    /** 播放急促嘀嘀嘀声音（12 连音）。 */
    fun playRapidBeeps() {
        if (_uiState.value.isPlaying) return
        _uiState.update {
            it.copy(isPlaying = true, playingMode = "急促嘀嘀嘀", statusMessage = "播放急促嘀嘀嘀中…")
        }

        playJob = viewModelScope.launch {
            try {
                BeepPlayer.playRapidBeeps()
                _uiState.update {
                    it.copy(
                        isPlaying = false,
                        playingMode = "",
                        statusMessage = "✅ 急促嘀嘀嘀播放完成"
                    )
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isPlaying = false,
                        playingMode = "",
                        statusMessage = "❌ 播放失败: ${e.message}"
                    )
                }
            }
        }
    }

    /** 按 beep 等级播放（1~4），模拟寻书盖革计数器音效。 */
    fun playByLevel(level: Int) {
        if (_uiState.value.isPlaying) return
        val desc = when (level) {
            1 -> "远距离(>2m)"
            2 -> "中距离(1-2m)"
            3 -> "近距离(0.5-1m)"
            4 -> "极近(<0.5m)"
            else -> "等级$level"
        }
        _uiState.update {
            it.copy(statusMessage = "播放 Lv$level $desc…")
        }

        viewModelScope.launch {
            try {
                BeepPlayer.beepByLevel(level)
                delay(200)
                _uiState.update {
                    it.copy(statusMessage = "✅ Lv$level $desc 已播放")
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(statusMessage = "❌ 播放失败: ${e.message}")
                }
            }
        }
    }

    /** 停止正在进行的连续播放。 */
    fun stopPlaying() {
        playJob?.cancel()
        playJob = null
        _uiState.update {
            it.copy(isPlaying = false, playingMode = "", statusMessage = "已停止")
        }
    }

    override fun onCleared() {
        super.onCleared()
        playJob?.cancel()
    }
}
