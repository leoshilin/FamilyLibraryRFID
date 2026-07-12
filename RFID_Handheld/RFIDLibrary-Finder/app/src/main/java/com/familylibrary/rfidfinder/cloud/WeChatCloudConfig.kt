package com.familylibrary.rfidfinder.cloud

import com.familylibrary.rfidfinder.BuildConfig

/**
 * 微信云开发配置。
 *
 * 取值来源：app/build.gradle.kts 注入的 BuildConfig 字段
 * （其值来自 local.properties，已被 .gitignore 忽略，不会入库）。
 *
 * 安全提示：appSecret 会随 APK 打包发布，仅适用于个人/家庭等可信场景；
 * 多租户或商业发布建议改为经中间代理（见设计文档）。
 */
data class WeChatCloudConfig(
    val appId: String = BuildConfig.WECHAT_APP_ID,
    val appSecret: String = BuildConfig.WECHAT_APP_SECRET,
    val envId: String = BuildConfig.WECHAT_ENV_ID
) {
    /** 三项配置是否均非空（可用于运行前校验）。 */
    val isConfigured: Boolean
        get() = appId.isNotBlank() && appSecret.isNotBlank() && envId.isNotBlank()
}
