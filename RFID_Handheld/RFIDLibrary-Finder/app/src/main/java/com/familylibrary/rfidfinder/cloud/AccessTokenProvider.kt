package com.familylibrary.rfidfinder.cloud

import com.familylibrary.rfidfinder.cloud.model.WxTokenResponse
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.json.Json
import okhttp3.OkHttpClient
import okhttp3.Request
import java.util.concurrent.TimeUnit

/**
 * 微信 access_token 获取与缓存。
 *
 * 通过 appid+appsecret 调用 cgi-bin/token 换取，默认有效期 7200s。
 * 缓存并在临近过期（提前 5 分钟）时自动刷新；并发调用由 Mutex 串行化，避免重复换取。
 */
class AccessTokenProvider(
    private val config: WeChatCloudConfig,
    private val client: OkHttpClient = defaultClient(),
    private val json: Json = Json { ignoreUnknownKeys = true }
) {
    @Volatile
    private var cachedToken: String? = null

    @Volatile
    private var expiredAt: Long = 0L

    private val mutex = Mutex()

    /**
     * 获取可用的 access_token（必要时刷新）。
     * @throws CloudException.ConfigMissing 配置缺失
     * @throws CloudException.HttpError 网络错误
     * @throws CloudException.WxError 微信返回错误
     */
    suspend fun getToken(): String = mutex.withLock {
        val now = System.currentTimeMillis()
        if (cachedToken != null && now < expiredAt) {
            return@withLock cachedToken!!
        }
        if (!config.isConfigured) {
            throw CloudException.ConfigMissing
        }

        val url = buildString {
            append("https://api.weixin.qq.com/cgi-bin/token")
            append("?grant_type=client_credential")
            append("&appid=").append(config.appId)
            append("&secret=").append(config.appSecret)
        }

        val resp = client.newCall(Request.Builder().url(url).get().build()).execute()
        if (!resp.isSuccessful) {
            throw CloudException.HttpError("获取 access_token 失败：HTTP ${resp.code}")
        }
        val token = json.decodeFromString<WxTokenResponse>(resp.body?.string().orEmpty())
        if (!token.accessToken.isNullOrEmpty()) {
            cachedToken = token.accessToken
            // 提前 5 分钟过期，规避临界失效
            val ttlMs = ((token.expiresIn ?: 7200L) - 300) * 1000
            expiredAt = now + ttlMs
            cachedToken!!
        } else {
            throw CloudException.WxError(
                token.errcode ?: -1,
                token.errmsg ?: "获取 access_token 失败"
            )
        }
    }

    /** 使缓存失效，下次调用将重新换取。 */
    fun invalidate() {
        cachedToken = null
        expiredAt = 0L
    }

    companion object {
        private fun defaultClient(): OkHttpClient = OkHttpClient.Builder()
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(15, TimeUnit.SECONDS)
            .build()
    }
}
