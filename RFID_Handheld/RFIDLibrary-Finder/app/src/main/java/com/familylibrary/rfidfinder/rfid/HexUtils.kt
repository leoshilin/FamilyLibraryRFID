package com.familylibrary.rfidfinder.rfid

/**
 * 字节数组与十六进制串互转工具。
 * 移植并补充空安全自 RFIDTester（原 MainActivity.bytesToHex / hexToBytes）。
 * RFID 的 EPC/TID 在 UI 与云函数间均以十六进制串传递，统一在此转换。
 */
object HexUtils {

    /** 字节数组转十六进制大写串；null 或空返回空串。 */
    fun bytesToHex(bytes: ByteArray?): String {
        if (bytes == null) return ""
        return bytes.joinToString("") { "%02X".format(it) }
    }

    /** 十六进制串转字节数组；自动去除空格，长度非偶数时返回空数组。 */
    fun hexToBytes(hex: String): ByteArray {
        val clean = hex.replace(" ", "")
        if (clean.length % 2 != 0) return ByteArray(0)
        return ByteArray(clean.length / 2) {
            clean.substring(it * 2, it * 2 + 2).toInt(16).toByte()
        }
    }
}
