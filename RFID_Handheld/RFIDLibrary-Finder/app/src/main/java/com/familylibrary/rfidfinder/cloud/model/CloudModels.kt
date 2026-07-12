package com.familylibrary.rfidfinder.cloud.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * 云端交互的数据模型。
 * 字段命名严格遵循 Docs（入参/返回全链路 camelCase），与云函数返回体一致。
 */

// ───────────── 微信 HTTP API 返回包络 ─────────────

/** GET cgi-bin/token 返回体。 */
@Serializable
data class WxTokenResponse(
    @SerialName("access_token") val accessToken: String? = null,
    @SerialName("expires_in") val expiresIn: Long? = null,
    @SerialName("errcode") val errcode: Int? = null,
    @SerialName("errmsg") val errmsg: String? = null
)

/** POST tcb/invokecloudfunction 返回体。respData 为云函数返回值的 JSON 字符串。 */
@Serializable
data class WxInvokeResponse(
    @SerialName("errcode") val errcode: Int? = null,
    @SerialName("errmsg") val errmsg: String? = null,
    @SerialName("resp_data") val respData: String? = null
)

// ───────────── J 系列（PDA）请求/响应 ─────────────

/** J1 api_task_accept 入参。 */
@Serializable
data class AcceptRequest(
    val deviceId: String
)

/** J1 返回中的任务负载。 */
@Serializable
data class TaskPayload(
    val taskId: String = "",
    val taskType: String = "",
    val bookItemId: String = "",
    val targetTid: String = ""
)

/** J1 api_task_accept 返回：{ success, task }，无任务时 task 为 null。 */
@Serializable
data class AcceptResponse(
    val success: Boolean = true,
    val task: TaskPayload? = null
)

/** J2 api_task_complete 入参。result 为执行结果（JSON 对象，可空）。 */
@Serializable
data class CompleteRequest(
    val taskId: String,
    val status: String, // success / failed
    val result: Map<String, String> = emptyMap()
)

/** J2 返回。 */
@Serializable
data class CompleteResponse(
    val success: Boolean = true
)

/** J3 api_task_getRfidBindingInfo 入参。 */
@Serializable
data class BindingInfoRequest(
    val tid: String
)

/** J3 返回中占用该标签的图书信息。 */
@Serializable
data class BookPayload(
    val bookItemId: String = "",
    val title: String = "",
    val isbn: String = ""
)

/** J3 api_task_getRfidBindingInfo 返回。 */
@Serializable
data class BindingInfoResponse(
    val success: Boolean = true,
    val bound: Boolean = false,
    val book: BookPayload? = null
)

/** J4 api_task_bindRfid 入参。taskId/deviceId 可选。 */
@Serializable
data class BindRequest(
    val bookItemId: String,
    val tid: String,
    val taskId: String? = null,
    val deviceId: String? = null
)

/** J4 api_task_bindRfid 返回：{ success, action: bind/rebind }。 */
@Serializable
data class BindResponse(
    val success: Boolean = false,
    val action: String? = null,
    val message: String? = null
)
