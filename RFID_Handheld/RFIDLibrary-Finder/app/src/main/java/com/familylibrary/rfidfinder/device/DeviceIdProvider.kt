package com.familylibrary.rfidfinder.device

import android.content.Context
import android.content.SharedPreferences
import java.util.UUID

/**
 * 设备唯一 ID 提供器。
 *
 * PDA 以 deviceId 在云端标识自身：
 * - api_task_accept 的 claimed_by_device（记录处理设备）
 * - api_task_bindRfid 的 operator（PDA 无微信登录态，用设备 ID 作为操作人）
 *
 * ID 首次生成后持久化于 SharedPreferences，保证应用重启后一致。
 */
class DeviceIdProvider(context: Context) {

    private val prefs: SharedPreferences =
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    /** 获取设备 ID（首次调用时生成并持久化，形如 "pda-xxxxxxxxxxxx"）。 */
    val deviceId: String
        get() {
            val existing = prefs.getString(KEY_DEVICE_ID, null)
            if (existing != null) return existing
            val generated = "pda-" + UUID.randomUUID().toString().replace("-", "").take(12)
            prefs.edit().putString(KEY_DEVICE_ID, generated).apply()
            return generated
        }

    /** 覆盖设备 ID（如由配置/扫码显式指定）。 */
    fun setDeviceId(id: String) {
        prefs.edit().putString(KEY_DEVICE_ID, id).apply()
    }

    companion object {
        private const val PREFS_NAME = "rfid_finder_prefs"
        private const val KEY_DEVICE_ID = "device_id"
    }
}
