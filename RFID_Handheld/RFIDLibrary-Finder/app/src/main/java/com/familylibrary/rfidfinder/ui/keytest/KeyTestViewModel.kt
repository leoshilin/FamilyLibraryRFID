package com.familylibrary.rfidfinder.ui.keytest

import android.util.Log
import android.view.KeyEvent
import androidx.lifecycle.ViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update

private const val TAG = "KeyTestVM"
/** 最多保留的事件条数。 */
private const val MAX_EVENTS = 200

/**
 * 按键/扫码事件条目。
 */
data class KeyEventEntry(
    val id: Long,
    val timestamp: String,
    val type: String,           // "按键" / "扫码"
    val keyCode: Int = 0,
    val keyName: String = "",
    val action: String = "",    // DOWN / UP / MULTIPLE
    val metaState: String = "", // 修饰键
    val scanData: String = "",  // 扫码结果
    val scanCodec: String = ""  // 扫码编码
)

/**
 * 测试页 UI 状态。
 */
data class KeyTestUiState(
    val events: List<KeyEventEntry> = emptyList(),
    val lastScanData: String = "",
    val statusMessage: String = "等待按键或扫码…"
)

/**
 * 按键/扫码测试 ViewModel。
 *
 * 收集并展示 PDA 上所有 KeyEvent 和扫码广播结果，
 * 帮助开发者确认 PDA 侧键/枪柄按钮对应的 keyCode 和扫码数据格式。
 */
class KeyTestViewModel : ViewModel() {

    private val _uiState = MutableStateFlow(KeyTestUiState())
    val uiState: StateFlow<KeyTestUiState> = _uiState.asStateFlow()

    private var nextId = 0L

    /** 记录一个 KeyEvent。 */
    fun recordKeyEvent(event: KeyEvent) {
        val entry = KeyEventEntry(
            id = nextId++,
            timestamp = formatTimestamp(event.eventTime),
            type = "按键",
            keyCode = event.keyCode,
            keyName = KeyCodeNames.nameOf(event.keyCode),
            action = actionName(event.action),
            metaState = metaDescription(event.metaState)
        )
        Log.i(TAG, "按键: keyCode=${event.keyCode}(${entry.keyName}) action=${entry.action} metaState=${entry.metaState}")
        appendEvent(entry)
    }

    /** 记录扫码结果（由 BroadcastReceiver 回调）。 */
    fun recordScanResult(data: String, codec: String = "") {
        val entry = KeyEventEntry(
            id = nextId++,
            timestamp = formatTimestamp(System.currentTimeMillis()),
            type = "扫码",
            scanData = data,
            scanCodec = codec
        )
        Log.i(TAG, "扫码: data=$data codec=$codec")
        _uiState.update { it.copy(lastScanData = data) }
        appendEvent(entry)
    }

    /** 清空事件列表。 */
    fun clearEvents() {
        _uiState.update { it.copy(events = emptyList(), lastScanData = "", statusMessage = "已清空") }
    }

    private fun appendEvent(entry: KeyEventEntry) {
        _uiState.update { current ->
            val newEvents = (listOf(entry) + current.events).take(MAX_EVENTS)
            current.copy(
                events = newEvents,
                statusMessage = "[${entry.timestamp}] ${entry.type}: ${
                    if (entry.type == "按键") "keyCode=${entry.keyCode}(${entry.keyName}) ${entry.action}"
                    else "data=${entry.scanData}"
                }"
            )
        }
    }

    private fun actionName(action: Int): String = when (action) {
        KeyEvent.ACTION_DOWN -> "DOWN"
        KeyEvent.ACTION_UP -> "UP"
        KeyEvent.ACTION_MULTIPLE -> "MULTIPLE"
        else -> "UNKNOWN($action)"
    }

    private fun metaDescription(meta: Int): String {
        if (meta == 0) return "无"
        val parts = mutableListOf<String>()
        if (meta and KeyEvent.META_SHIFT_ON != 0) parts.add("SHIFT")
        if (meta and KeyEvent.META_ALT_ON != 0) parts.add("ALT")
        if (meta and KeyEvent.META_CTRL_ON != 0) parts.add("CTRL")
        if (meta and KeyEvent.META_FUNCTION_ON != 0) parts.add("FN")
        if (meta and KeyEvent.META_SYM_ON != 0) parts.add("SYM")
        return parts.joinToString(",")
    }

    private fun formatTimestamp(ms: Long): String {
        val sec = ms / 1000
        val millis = ms % 1000
        val hh = (sec / 3600) % 24
        val mm = (sec / 60) % 60
        val ss = sec % 60
        return "%02d:%02d:%02d.%03d".format(hh, mm, ss, millis)
    }
}

/**
 * 常用 keyCode → 名称映射（补充 KeyEvent.keyCodeToString 可能不覆盖的键）。
 */
object KeyCodeNames {
    private val map = mapOf(
        // 标准键
        KeyEvent.KEYCODE_HOME to "HOME",
        KeyEvent.KEYCODE_BACK to "BACK",
        KeyEvent.KEYCODE_VOLUME_UP to "VOLUME_UP",
        KeyEvent.KEYCODE_VOLUME_DOWN to "VOLUME_DOWN",
        KeyEvent.KEYCODE_CAMERA to "CAMERA",
        KeyEvent.KEYCODE_FOCUS to "FOCUS",
        KeyEvent.KEYCODE_SEARCH to "SEARCH",
        KeyEvent.KEYCODE_ENTER to "ENTER",
        KeyEvent.KEYCODE_DPAD_UP to "DPAD_UP",
        KeyEvent.KEYCODE_DPAD_DOWN to "DPAD_DOWN",
        KeyEvent.KEYCODE_DPAD_LEFT to "DPAD_LEFT",
        KeyEvent.KEYCODE_DPAD_RIGHT to "DPAD_RIGHT",
        KeyEvent.KEYCODE_DPAD_CENTER to "DPAD_CENTER",
        KeyEvent.KEYCODE_MENU to "MENU",
        KeyEvent.KEYCODE_POWER to "POWER",
        KeyEvent.KEYCODE_NOTIFICATION to "NOTIFICATION",

        // 功能键 F1-F12
        131 to "F1", 132 to "F2", 133 to "F3", 134 to "F4",
        135 to "F5", 136 to "F6", 137 to "F7", 138 to "F8",
        139 to "F9", 140 to "F10", 141 to "F11", 142 to "F12",

        // PDA 常见自定义键
        139 to "SCAN_LEFT",     // 常见左侧扫码键
        140 to "SCAN_RIGHT",    // 常见右侧扫码键
        141 to "SCAN_TRIGGER",  // 常见枪柄按键
        142 to "SCAN_SIDE",
        280 to "BUTTON_1",
        281 to "BUTTON_2",
        282 to "BUTTON_3",
        283 to "BUTTON_4",
        284 to "BUTTON_5",
        285 to "BUTTON_6",
        286 to "BUTTON_7",
        287 to "BUTTON_8",
        288 to "BUTTON_9",
        289 to "BUTTON_10",
        290 to "BUTTON_11",
        291 to "BUTTON_12",
        292 to "BUTTON_13",
        293 to "BUTTON_14",
        294 to "BUTTON_15",
        295 to "BUTTON_16",
        520 to "PDA_SCAN",
        521 to "PDA_F1",
        522 to "PDA_F2",
        523 to "PDA_PTT",
    )

    fun nameOf(keyCode: Int): String {
        map[keyCode]?.let { return "$keyCode ($it)" }
        // 尝试 Android 内置命名
        val builtin = try {
            android.view.KeyEvent.keyCodeToString(keyCode)
        } catch (_: Exception) { null }
        if (builtin != null && builtin != "KEYCODE_UNKNOWN" && !builtin.startsWith("KEYCODE_UNKNOWN")) {
            return "$keyCode ($builtin)"
        }
        return "$keyCode (UNKNOWN)"
    }
}
