package com.familylibrary.rfidfinder

import android.app.Application
import android.util.Log
import com.familylibrary.rfidfinder.di.AppContainer
import com.familylibrary.rfidfinder.rfid.RfidManager

private const val TAG = "RfidFinderApp"

/**
 * 应用入口。
 *
 * 初始化顺序：
 * 1. 依赖容器 [AppContainer]（云端配置、设备 ID 等）
 * 2. RFID SDK 自动初始化（无需用户手动操作；模拟器上会静默失败）
 *
 * RFID 初始化在此处自动执行而非等待用户点击按钮：
 * - PDA 是专用设备，开机即应就绪
 * - 避免用户进入寻书/绑定页面后才发现 RFID 未初始化
 * - 初始化失败（如模拟器）不影响应用正常启动
 */
class RfidFinderApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        AppContainer.init(this)

        // 自动初始化 RFID SDK
        try {
            val ok = RfidManager.init()
            if (ok) {
                Log.i(TAG, "RFID SDK 自动初始化成功")
            } else {
                Log.w(TAG, "RFID SDK 自动初始化失败（可能非 PDA 真机）")
            }
        } catch (e: Exception) {
            Log.w(TAG, "RFID SDK 自动初始化异常: ${e.message}")
        }
    }
}
