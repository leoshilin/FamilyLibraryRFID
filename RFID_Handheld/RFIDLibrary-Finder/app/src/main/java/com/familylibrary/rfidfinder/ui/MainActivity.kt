package com.familylibrary.rfidfinder.ui

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
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
    var taskText by remember { mutableStateOf("尚未领取任务") }
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
                    when (val res = AppContainer.taskCloudService.acceptTask(deviceId)) {
                        is ApiResult.Success -> {
                            val task: DeviceTask? = res.data
                            taskText = if (task == null) {
                                "无待执行任务"
                            } else {
                                buildString {
                                    append("领取到任务：\n")
                                    append("taskId=").append(task.taskId).append("\n")
                                    append("类型=").append(
                                        when (task.taskType) {
                                            TaskType.BIND_RFID -> "绑定RFID"
                                            TaskType.FIND_BOOK -> "寻书"
                                        }
                                    ).append("\n")
                                    if (task.bookItemId.isNotBlank())
                                        append("bookItemId=").append(task.bookItemId).append("\n")
                                    if (task.targetTid.isNotBlank())
                                        append("targetTid=").append(task.targetTid)
                                }
                            }
                        }
                        is ApiResult.Failure -> {
                            taskText = "领取失败：${res.exception.message}"
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
    }
}
