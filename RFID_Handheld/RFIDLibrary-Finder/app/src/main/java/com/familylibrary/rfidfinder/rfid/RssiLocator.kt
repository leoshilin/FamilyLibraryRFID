package com.familylibrary.rfidfinder.rfid

/**
 * 盖革计数器（寻书定位）模式的信号换算工具。
 *
 * 逻辑提取自 RFIDTester 的跟踪循环：根据当前功率档位与 RSSI 自动在三档功率间切换，
 * 并估算与目标标签的距离区间与提示等级（beep）。
 * 设计为纯函数、无 SDK 依赖，供寻书业务流（设计文档 F6.2）的 UI/ViewModel 直接复用。
 */
object RssiLocator {

    /** 可选功率档位（dBm），由高到低。 */
    val POWER_LEVELS = listOf(30, 20, 10)

    /**
     * 根据当前功率档位与 RSSI，计算下一轮应设置的功率档位。
     * 规则（移植自 RFIDTester）：
     * - 30dBm：rssi > -40 降为 20
     * - 20dBm：rssi > -30 降为 10；rssi < -50 升为 30
     * - 10dBm：rssi < -40 升为 20
     *
     * @param currentPower 当前功率档位（应为 [POWER_LEVELS] 之一）
     * @param rssi 最近一次读到的信号强度（负数）
     * @return 下一轮功率档位
     */
    fun nextPower(currentPower: Int, rssi: Int): Int = when (currentPower) {
        30 -> if (rssi > -40) 20 else 30
        20 -> when {
            rssi > -30 -> 10
            rssi < -50 -> 30
            else -> 20
        }
        10 -> if (rssi < -40) 20 else 10
        else -> currentPower
    }

    /**
     * 根据当前功率档位估算距离区间与提示等级。
     * @return Pair(距离描述, beep 等级 1~4)，等级越高表示越近。
     */
    fun locate(currentPower: Int, rssi: Int): Pair<String, Int> = when (currentPower) {
        30 -> if (rssi < -60) "2米以上" to 1 else "1~2米" to 2
        20 -> "0.5~1米" to 3
        10 -> "0.5米以内" to 4
        else -> "未知" to 0
    }
}
