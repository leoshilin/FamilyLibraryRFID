package com.familylibrary.rfidfinder

import android.app.Application
import com.familylibrary.rfidfinder.di.AppContainer

/**
 * 应用入口。
 * 仅负责初始化依赖容器 [AppContainer]；RFID SDK 的初始化推迟到用户点击「初始化 RFID」时，
 * 因为 UHFRManager.getInstance() 依赖真机 jniLibs，提前调用可能失败。
 */
class RfidFinderApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        AppContainer.init(this)
    }
}
