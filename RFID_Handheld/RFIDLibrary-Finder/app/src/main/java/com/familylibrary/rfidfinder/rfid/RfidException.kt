package com.familylibrary.rfidfinder.rfid

/**
 * RFID 操作相关异常。
 * 业务层捕获后可据此区分「未初始化 / 读取失败 / 写入失败」并给出不同提示。
 */
sealed class RfidException(
    message: String? = null,
    cause: Throwable? = null
) : Exception(message, cause) {

    /** SDK 未初始化（未调用 RfidManager.init 或初始化失败）。 */
    object NotInitialized : RfidException("RFID SDK 未初始化，请先初始化设备")

    /** 读取失败（盘点 / 查询功率等）。 */
    class ReadFailed(cause: Throwable) : RfidException("RFID 读取失败：${cause.message}", cause)

    /** 写入失败（写 EPC / 设置功率等）。 */
    class WriteFailed(cause: Throwable) : RfidException("RFID 写入失败：${cause.message}", cause)
}
