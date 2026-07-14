package com.familylibrary.rfidfinder.ui

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.familylibrary.rfidfinder.cloud.model.ApiResult
import com.familylibrary.rfidfinder.cloud.model.DeviceTask
import com.familylibrary.rfidfinder.cloud.model.TaskType
import com.familylibrary.rfidfinder.di.AppContainer
import com.familylibrary.rfidfinder.rfid.RfidManager
import com.familylibrary.rfidfinder.ui.theme.RFIDLibraryFinderTheme
import kotlinx.coroutines.launch

/**
 * 框架演示首页（最小可用骨架，验证 SDK 封装层与云端客户端已打通）。
 *
 * 说明：本页仅用于验证集成，不实现完整业务流（绑定 F4.3 / 寻书 F6.2 的状态机后续实现）。
 * 实际首页应在「当前无任务时」轮询领取任务，并按 taskType 路由到绑定/寻书界面。
 */
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            RFIDLibraryFinderTheme {
                FinderHomeScreen()
            }
        }
    }
}

@Composable
fun FinderHomeScreen() {
    val scope = rememberCoroutineScope()

    // 设备 ID（持久化，重启一致）
    val deviceId = remember { AppContainer.deviceIdProvider.deviceId }

    // 云配置是否完整
    val configured = remember { AppContainer.cloudConfig.isConfigured }

    var rfidStatus by remember { mutableStateOf("未初始化") }
    var taskText by remember { mutableStateOf("尚未领取任务（一次最多领取 10 条）") }
    var tasks by remember { mutableStateOf<List<DeviceTask>>(emptyList()) }
    var busy by remember { mutableStateOf(false) }

    val scrollState = rememberScrollState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(scrollState)
            .padding(16.dp)
    ) {
        Text("RFIDLibrary-Finder", style = MaterialTheme.typography.titleLarge)
        Spacer(Modifier.height(8.dp))
        Text("设备 ID：$deviceId")
        Text(
            "云配置：${if (configured) "已配置" else "缺失（请在 local.properties 配置 wechat.*）"}"
        )

        Spacer(Modifier.height(16.dp))

        // 初始化 RFID（需真机，依赖 jniLibs）
        Button(
            onClick = {
                rfidStatus = if (RfidManager.init()) "初始化成功" else "初始化失败（需 PDA 真机）"
            },
            enabled = !RfidManager.isReady()
        ) {
            Text("初始化 RFID")
        }
        Spacer(Modifier.height(8.dp))
        Text("RFID 状态：$rfidStatus")

        Spacer(Modifier.height(16.dp))

        // 领取任务（J1）
        Button(
            onClick = {
                busy = true
                taskText = "领取中…"
                scope.launch {
                    when (val res = AppContainer.taskCloudService.acceptTask(deviceId, 10)) {
                        is ApiResult.Success -> {
                            tasks = res.data
                            taskText = if (tasks.isEmpty()) {
                                "无待执行任务"
                            } else {
                                "领取到 ${tasks.size} 个任务"
                            }
                        }
                        is ApiResult.Failure -> {
                            tasks = emptyList()
                            val e = res.exception
                            // 异常 message 可能为 null（如 NetworkOnMainThreadException），
                            // 用异常类型兜底，确保总能看到可读信息。
                            val detail = e.message
                                ?: (e.cause?.message?.let { "${e.javaClass.simpleName}（${it}）" }
                                    ?: e.javaClass.simpleName)
                            taskText = "领取失败：$detail"
                        }
                    }
                    busy = false
                }
            },
            enabled = !busy && configured
        ) {
            Text(if (busy) "领取中…" else "领取任务")
        }

        Spacer(Modifier.height(16.dp))
        Text(taskText)

        if (tasks.isNotEmpty()) {
            Spacer(Modifier.height(8.dp))
            LazyColumn(
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(max = 360.dp)
            ) {
                items(tasks) { task ->
                    TaskItemCard(task)
                    Spacer(Modifier.height(8.dp))
                }
            }
        }
    }
}

/** 单个任务卡片（演示用：展示任务类型与关联字段，供用户选择执行）。 */
@Composable
private fun TaskItemCard(task: DeviceTask) {
    val typeLabel = when (task.taskType) {
        TaskType.BIND_RFID -> "绑定RFID"
        TaskType.FIND_BOOK -> "寻书"
    }
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(12.dp)) {
            Text(typeLabel, style = MaterialTheme.typography.titleMedium)
            if (task.title.isNotBlank()) Text("书名：${task.title}")
            if (task.authors.isNotBlank()) Text("作者：${task.authors}")
            if (task.isbn.isNotBlank()) Text("ISBN：${task.isbn}")
            if (task.bookItemId.isNotBlank()) Text("bookItemId：${task.bookItemId}")
            if (task.targetTid.isNotBlank()) Text("targetTid：${task.targetTid}")
        }
    }
}
