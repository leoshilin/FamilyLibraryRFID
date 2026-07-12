package com.familylibrary.rfidfinder.di

import android.content.Context
import com.familylibrary.rfidfinder.cloud.AccessTokenProvider
import com.familylibrary.rfidfinder.cloud.CloudFunctionClient
import com.familylibrary.rfidfinder.cloud.TaskCloudService
import com.familylibrary.rfidfinder.cloud.WeChatCloudConfig
import com.familylibrary.rfidfinder.device.DeviceIdProvider

/**
 * 轻量依赖容器（手动 DI，不引入 Hilt 以降低框架复杂度）。
 *
 * 在 [com.familylibrary.rfidfinder.RfidFinderApplication] 中初始化，提供全局单例。
 * RFID 能力由 object 单例 [com.familylibrary.rfidfinder.rfid.RfidManager] 提供，不在此持有。
 */
object AppContainer {

    /** 微信云开发配置（来自 BuildConfig / local.properties）。 */
    lateinit var cloudConfig: WeChatCloudConfig

    /** access_token 获取与缓存。 */
    lateinit var accessTokenProvider: AccessTokenProvider

    /** 云函数 HTTP 调用客户端。 */
    lateinit var cloudFunctionClient: CloudFunctionClient

    /** PDA 任务云端服务（J 系列封装）。 */
    lateinit var taskCloudService: TaskCloudService

    /** 设备 ID 提供器。 */
    lateinit var deviceIdProvider: DeviceIdProvider

    /** 初始化容器，必须在 Application.onCreate 中调用一次。 */
    fun init(context: Context) {
        cloudConfig = WeChatCloudConfig()
        accessTokenProvider = AccessTokenProvider(cloudConfig)
        cloudFunctionClient = CloudFunctionClient(cloudConfig, accessTokenProvider)
        taskCloudService = TaskCloudService(cloudConfig, cloudFunctionClient)
        deviceIdProvider = DeviceIdProvider(context.applicationContext)
    }
}
