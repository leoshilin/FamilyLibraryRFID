package com.familylibrary.rfidfinder.cloud.model

/**
 * 统一结果包装，便于 UI 层以非异常方式处理成功/失败，免去重复 try/catch。
 */
sealed class ApiResult<out T> {
    data class Success<T>(val data: T) : ApiResult<T>()
    data class Failure(val exception: Throwable) : ApiResult<Nothing>()
}

/** 将挂起调用包装为 [ApiResult]，异常不会上抛。 */
suspend inline fun <T> safeCall(crossinline block: suspend () -> T): ApiResult<T> = try {
    ApiResult.Success(block())
} catch (e: Throwable) {
    ApiResult.Failure(e)
}

/**
 * 标签绑定信息（J3 api_task_getRfidBindingInfo 的领域化表达）。
 * @param bound 该 TID 是否已被某本书占用
 * @param bookItemId 占用该标签的书籍 ID（bound=true 时有效）
 * @param title 书名（bound=true 时有效）
 * @param isbn ISBN（bound=true 时有效）
 */
data class BookBindingInfo(
    val bound: Boolean,
    val bookItemId: String = "",
    val title: String = "",
    val isbn: String = ""
)
