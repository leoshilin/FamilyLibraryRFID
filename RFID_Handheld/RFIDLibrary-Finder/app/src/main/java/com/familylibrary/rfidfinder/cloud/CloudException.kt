package com.familylibrary.rfidfinder.cloud

/**
 * 云端调用相关异常。
 * 由 CloudFunctionClient / AccessTokenProvider 抛出，经 safeCall 转为 ApiResult.Failure 供 UI 处理。
 */
sealed class CloudException(message: String) : Exception(message) {

    /** local.properties 未配置微信云开发凭证。 */
    object ConfigMissing : CloudException(
        "微信云开发配置缺失（请在 local.properties 配置 wechat.appId / wechat.appSecret / wechat.envId）"
    )

    /** 网络层错误（HTTP 非 2xx 等）。 */
    class HttpError(message: String) : CloudException(message)

    /** 微信接口返回业务错误（token 获取失败等，含 errcode）。 */
    class WxError(val code: Int, message: String) : CloudException("微信错误[$code]：$message")

    /** 云函数返回业务错误（invokecloudfunction 的 errcode != 0）。 */
    class FunctionError(val code: Int, message: String) : CloudException("云函数错误[$code]：$message")

    /** 返回体/resp_data 解析失败。 */
    class ParseError(message: String, cause: Throwable? = null) : CloudException(message)
}
