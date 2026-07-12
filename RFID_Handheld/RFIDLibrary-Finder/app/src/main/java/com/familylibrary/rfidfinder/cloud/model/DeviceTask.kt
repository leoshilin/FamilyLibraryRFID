package com.familylibrary.rfidfinder.cloud.model

/**
 * device_task 设备任务队列的领域模型（镜像 Docs/家庭图书管理系统数据库表结构设计.md §3.9）。
 * PDA 不直接访问数据库，此处仅用于业务层在本地的任务表达与状态判断。
 */
enum class TaskType {
    /** 绑定 RFID（F4.3） */
    BIND_RFID,

    /** 寻书定位（F6.2） */
    FIND_BOOK;

    companion object {
        fun from(value: String?): TaskType? = when (value) {
            "bind_rfid" -> BIND_RFID
            "find_book" -> FIND_BOOK
            else -> null
        }
    }
}

/** 任务状态机（设计文档 F4.3 §任务的状态机变化）。 */
enum class TaskStatus {
    PENDING,    // 待执行（手机创建）
    RUNNING,    // 执行中（PDA 领取后置位）
    SUCCESS,    // 成功
    FAILED,     // 失败
    CANCEL;     // 取消

    companion object {
        fun from(value: String?): TaskStatus? = when (value) {
            "pending" -> PENDING
            "running" -> RUNNING
            "success" -> SUCCESS
            "failed" -> FAILED
            "cancel" -> CANCEL
            else -> null
        }
    }
}

/**
 * 本地任务表达。
 * @param taskId 任务 ID（_id）
 * @param taskType 任务类型
 * @param bookItemId 目标书籍（绑定任务 / 寻书任务），用于关联 book_item
 * @param targetTid 目标 TID（寻书任务）
 * @param isbn 展示字段（ISBN）：由 api_task_accept 关联返回，绑定流程中用于扫码校验
 * @param title 展示字段（书名）：由 api_task_accept 关联返回，PDA 直接显示
 * @param authors 展示字段（作者）：由 api_task_accept 关联返回，PDA 直接显示
 */
data class DeviceTask(
    val taskId: String,
    val taskType: TaskType,
    val bookItemId: String = "",
    val targetTid: String = "",
    val isbn: String = "",
    val title: String = "",
    val authors: String = ""
)
