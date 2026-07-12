package com.familylibrary.rfidfinder.cloud

import com.familylibrary.rfidfinder.cloud.model.AcceptRequest
import com.familylibrary.rfidfinder.cloud.model.AcceptResponse
import com.familylibrary.rfidfinder.cloud.model.ApiResult
import com.familylibrary.rfidfinder.cloud.model.BindRequest
import com.familylibrary.rfidfinder.cloud.model.BindResponse
import com.familylibrary.rfidfinder.cloud.model.BindingInfoRequest
import com.familylibrary.rfidfinder.cloud.model.BindingInfoResponse
import com.familylibrary.rfidfinder.cloud.model.BookBindingInfo
import com.familylibrary.rfidfinder.cloud.model.CompleteRequest
import com.familylibrary.rfidfinder.cloud.model.CompleteResponse
import com.familylibrary.rfidfinder.cloud.model.DeviceTask
import com.familylibrary.rfidfinder.cloud.model.TaskType
import com.familylibrary.rfidfinder.cloud.model.safeCall
import kotlinx.serialization.json.Json

/**
 * PDA 云端任务服务：封装 J 系列（PDA 专用）云函数调用。
 *
 * 仅负责与云端交互，不含本地业务状态机（绑定 F4.3 / 寻书 F6.2 的状态机后续实现）。
 * 所有方法返回 [ApiResult]，由调用方（UI/ViewModel）决定如何处理失败，无需 try/catch。
 *
 * 接口映射（见 Docs/api-service-接口说明.md §J）：
 * - J1 api_task_accept      → [acceptTask]
 * - J2 api_task_complete    → [completeTask]
 * - J3 api_task_getRfidBindingInfo → [getRfidBindingInfo]
 * - J4 api_task_bindRfid    → [bindRfid]
 */
class TaskCloudService(
    private val config: WeChatCloudConfig,
    private val client: CloudFunctionClient,
    private val json: Json = Json { ignoreUnknownKeys = true }
) {
    /** 配置是否完整（运行前可校验）。 */
    val isConfigured: Boolean
        get() = config.isConfigured

    /**
     * J1 领取一个待执行任务。
     * 云端从 pending/running 取创建时间最早的一条，置为 running 避免重复执行。
     * @return 任务对象；无任务时返回 ApiResult.Success(null)。
     */
    suspend fun acceptTask(deviceId: String): ApiResult<DeviceTask?> = safeCall {
        val resp: AcceptResponse = client.invoke(
            "api_task_accept",
            json.encodeToString(AcceptRequest(deviceId))
        )
        resp.task?.let { payload ->
            val type = TaskType.from(payload.taskType)
                ?: throw IllegalArgumentException("未知任务类型：${payload.taskType}")
            DeviceTask(
                taskId = payload.taskId,
                taskType = type,
                bookItemId = payload.bookItemId,
                targetTid = payload.targetTid,
                isbn = payload.isbn,
                title = payload.title,
                authors = payload.authors
            )
        }
    }

    /**
     * J2 提交任务执行结果。
     * @param status "success" 或 "failed"
     * @param result 执行结果（可选，如寻书耗时/备注等）
     */
    suspend fun completeTask(
        taskId: String,
        status: String,
        result: Map<String, String> = emptyMap()
    ): ApiResult<CompleteResponse> = safeCall {
        client.invoke(
            "api_task_complete",
            json.encodeToString(CompleteRequest(taskId, status, result))
        )
    }

    /**
     * J3 按 TID 查询该标签当前绑定状态（绑定流程中供用户确认是否解绑旧书）。
     * @return [BookBindingInfo]，bound=false 表示标签未被占用。
     */
    suspend fun getRfidBindingInfo(tid: String): ApiResult<BookBindingInfo> = safeCall {
        val resp: BindingInfoResponse = client.invoke(
            "api_task_getRfidBindingInfo",
            json.encodeToString(BindingInfoRequest(tid))
        )
        BookBindingInfo(
            bound = resp.bound,
            bookItemId = resp.book?.bookItemId ?: "",
            title = resp.book?.title ?: "",
            isbn = resp.book?.isbn ?: ""
        )
    }

    /**
     * J4 执行 RFID 绑定（核心接口）。
     * 云端统一处理 4 种绑定场景（设计文档 F4.3：直接绑定 / 解绑旧书再绑定 / 改绑 / 旧标签复用）。
     * @param bookItemId 目标书籍 ID（book_item._id）
     * @param tid 扫描到的标签 TID
     * @param taskId 关联任务 ID（可选，用于 rfid_bind_log.task_id）
     * @param deviceId 设备 ID（可选，作为绑定操作人 operator）
     * @return [BindResponse]，action 为 bind/rebind。
     */
    suspend fun bindRfid(
        bookItemId: String,
        tid: String,
        taskId: String? = null,
        deviceId: String? = null
    ): ApiResult<BindResponse> = safeCall {
        client.invoke(
            "api_task_bindRfid",
            json.encodeToString(BindRequest(bookItemId, tid, taskId, deviceId))
        )
    }
}
