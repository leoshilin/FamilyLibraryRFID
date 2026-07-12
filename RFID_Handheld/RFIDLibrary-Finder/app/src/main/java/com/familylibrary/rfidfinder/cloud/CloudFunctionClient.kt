package com.familylibrary.rfidfinder.cloud

import android.util.Log
import com.familylibrary.rfidfinder.cloud.model.WxInvokeResponse
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.KSerializer
import kotlinx.serialization.json.Json
import kotlinx.serialization.serializer
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

/**
 * 微信云函数 HTTP 调用客户端（直连 invokecloudfunction）。
 *
 * 调用方式（微信云开发文档）：
 * POST https://api.weixin.qq.com/tcb/invokecloudfunction?access_token=ACCESS_TOKEN&env=ENV_ID&name=FUNCTION_NAME
 * 请求体 = 云函数入参 event（JSON 字符串）。
 * 返回体 = { errcode, errmsg, resp_data }，其中 resp_data 为云函数返回值的 JSON 字符串。
 *
 * 本类只负责「取 token → 发请求 → 解析 resp_data」，不含任何业务语义；
 * 业务语义封装在 [TaskCloudService]。
 */
class CloudFunctionClient(
    private val config: WeChatCloudConfig,
    private val tokenProvider: AccessTokenProvider,
    private val client: OkHttpClient = defaultClient(),
    private val json: Json = Json { ignoreUnknownKeys = true }
) {
    private val mediaType = "application/json; charset=utf-8".toMediaType()

    /**
     * 调用云函数并解析 resp_data 为指定类型。
     * @param name 云函数名（如 "api_task_accept"）
     * @param eventJson 入参 event 的 JSON 字符串（由调用方用 json.encodeToString 生成）
     * @param serializer 目标类型的序列化器
     */
    suspend fun <T> invoke(
        name: String,
        eventJson: String,
        serializer: KSerializer<T>
    ): T {
        val token = tokenProvider.getToken()
        val url = buildString {
            append("https://api.weixin.qq.com/tcb/invokecloudfunction")
            append("?access_token=").append(token)
            append("&env=").append(config.envId)
            append("&name=").append(name)
        }

        val body = eventJson.toRequestBody(mediaType)
        val resp = withContext(Dispatchers.IO) {
            client.newCall(Request.Builder().url(url).post(body).build()).execute()
        }
        if (!resp.isSuccessful) {
            Log.e(TAG, "invoke $name HTTP ${resp.code}")
            throw CloudException.HttpError("调用 $name 失败：HTTP ${resp.code}")
        }

        val raw = resp.body?.string().orEmpty()
        val envelope = try {
            json.decodeFromString<WxInvokeResponse>(raw)
        } catch (e: Exception) {
            Log.e(TAG, "invoke $name 返回体解析失败：\n$raw")
            throw CloudException.ParseError("返回体解析失败", e)
        }
        if (envelope.errcode != 0) {
            // 已到达微信云：envId 错/函数未部署等会以 errcode 体现
            Log.e(TAG, "invoke $name 微信返回 errcode=${envelope.errcode} errmsg=${envelope.errmsg}")
            throw CloudException.FunctionError(
                envelope.errcode ?: -1,
                envelope.errmsg ?: "调用 $name 失败"
            )
        }

        val data = envelope.respData ?: throw CloudException.ParseError("resp_data 为空")
        Log.d(TAG, "invoke $name 成功，resp_data=$data")
        return try {
            json.decodeFromString(serializer, data)
        } catch (e: Exception) {
            Log.e(TAG, "invoke $name resp_data 解析失败：\n$data")
            throw CloudException.ParseError("resp_data 解析失败：$data", e)
        }
    }

    /** 便捷重化版本：直接指定返回类型 T。 */
    suspend inline fun <reified T> invoke(name: String, eventJson: String): T {
        return invoke(name, eventJson, serializer<T>())
    }

    companion object {
        private const val TAG = "RFIDCloud"

        private fun defaultClient(): OkHttpClient = OkHttpClient.Builder()
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(15, TimeUnit.SECONDS)
            .build()
    }
}
