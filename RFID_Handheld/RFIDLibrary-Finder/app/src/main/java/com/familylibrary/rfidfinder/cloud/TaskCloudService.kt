package com.familylibrary.rfidfinder.cloud

import android.util.Log
import com.familylibrary.rfidfinder.cloud.model.AcceptRequest
import com.familylibrary.rfidfinder.cloud.model.AcceptResponse
import com.familylibrary.rfidfinder.cloud.model.AbortRequest
import com.familylibrary.rfidfinder.cloud.model.AbortResponse
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

private const val TAG = "TaskCloudService"

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
 * - J6 api_task_abort       → [abortTask]
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
     * J1 批量领取待执行任务（最多 [limit] 条，默认 10）。
     * 云端从 pending / 本设备已领取的 running 中按创建时间升序取最多 limit 条，
     * 统一置 running 避免重复执行；返回任务清单由用户选择其中一条执行（不在 PDA 做任务队列）。
     * @param limit 单次领取上限（默认 10，云端夹在 [1,10]）
     * @return 任务清单（可能为空列表，表示无待执行任务）
     */
    suspend fun acceptTask(deviceId: String, limit: Int = 10): ApiResult<List<DeviceTask>> = safeCall {
        val resp: AcceptResponse = client.invoke(
            "api_task_accept",
            json.encodeToString(AcceptRequest(deviceId, limit))
        )
        resp.tasks.mapNotNull { payload ->
            val type = TaskType.from(payload.taskType)
            if (type == null) {
                // 未知类型跳过，不阻塞整批领取
                Log.w(TAG, "acceptTask: 跳过未知任务类型 ${payload.taskType} (taskId=${payload.taskId})")
                return@mapNotNull null
            }
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

    /**
     * J6 放弃寻书任务执行，回退 pending 状态。
     * 适用场景：用户无法找到 RFID 信号（距离过远、不在同一房间等），暂时退出，稍后再试。
     * 与 [completeTask](failed) 不同：不标记任务为 failed，任务可被再次轮询领取。
     * @param taskId 任务 ID
     */
    suspend fun abortTask(taskId: String): ApiResult<AbortResponse> = safeCall {
        client.invoke(
            "api_task_abort",
            json.encodeToString(AbortRequest(taskId))
        )
    }
}
