package com.familylibrary.rfidfinder.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.familylibrary.rfidfinder.BuildConfig
import com.familylibrary.rfidfinder.cloud.model.DeviceTask
import com.familylibrary.rfidfinder.cloud.model.TaskType

// ───────── 颜色常量 ─────────

/** 成功/就绪绿色 */
private val StatusGreen = Color(0xFF4CAF50)
/** 警告黄色 */
private val StatusYellow = Color(0xFFFFC107)
/** 错误红色 */
private val StatusRed = Color(0xFFF44336)
/** 状态条背景 */
private val StatusBarBg = Color(0xFFF5F5F5)
/** 任务卡片主色 */
private val TaskCardBind = Color(0xFFE3F2FD) // 绑定任务淡蓝
private val TaskCardFind = Color(0xFFFFF3E0) // 寻书任务淡橙

// ───────── 首页主 Composable ─────────

/**
 * 首页（任务台）。
 *
 * 根据 UI 设计文档 §5 实现：
 * - 顶部状态条：设备 ID / 云配置 / RFID 状态
 * - 任务清单：最多 10 条，可滚动，每条含「执行」「放弃」按钮
 * - IDLE 无任务布局：显示「暂无待执行任务」
 * - 底部常驻：「最近完成任务」入口 + 版本号
 *
 * 本阶段不实现「执行」导航至 bind/find 和「最近完成任务」导航至 recent。
 * 点击这两个按钮仅以 Toast 提示（占位）。
 */
@Composable
fun HomeScreen(
    viewModel: HomeViewModel = viewModel()
) {
    val state by viewModel.uiState.collectAsState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
    ) {
        // 顶部状态条
        StatusBar(
            deviceId = state.deviceId,
            configured = state.configured,
            rfidReady = state.rfidReady,
            onInitRfid = viewModel::initRfid
        )

        HorizontalDivider(thickness = 1.dp, color = Color(0xFFE0E0E0))

        // 主内容区：根据 phase 显示不同内容，fillMaxHeight + weight 占满剩余空间
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f)
        ) {
            when (state.phase) {
                HomeUiPhase.IDLE -> IdleContent(
                    statusMessage = state.statusMessage,
                    onRecentClick = { /* 待实现：导航至 recent */ }
                )
                HomeUiPhase.POLLING -> PollingContent()
                HomeUiPhase.TASK_LIST -> TaskListContent(
                    tasks = state.tasks,
                    statusMessage = state.statusMessage,
                    busy = state.busy,
                    onExecute = { /* 待实现：导航至 bind/find */ },
                    onAbandon = viewModel::abandonTask,
                    onRecentClick = { /* 待实现：导航至 recent */ }
                )
            }
        }

        // 版本号（底部固定，方便 debug）
        VersionFooter()
    }
}

// ───────── 顶部状态条 ─────────

/**
 * 顶部状态条（UI 设计 §5.1）。
 *
 * 显示设备 ID、云配置状态、RFID 状态。
 * RFID 未初始化时提供「初始化」入口。
 */
@Composable
private fun StatusBar(
    deviceId: String,
    configured: Boolean,
    rfidReady: Boolean,
    onInitRfid: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(StatusBarBg)
            .padding(horizontal = 16.dp, vertical = 12.dp)
    ) {
        // 标题行
        Text(
            text = "RFIDLibrary-Finder",
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold
        )

        Spacer(Modifier.height(8.dp))

        // 设备 ID
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                text = "设备：",
                style = MaterialTheme.typography.bodyMedium,
                color = Color.Gray
            )
            Text(
                text = deviceId,
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.Medium
            )
        }

        Spacer(Modifier.height(4.dp))

        // 云配置状态
        StatusRow(
            label = "云配置：",
            ok = configured,
            okText = "已配置",
            failText = "缺失"
        )

        Spacer(Modifier.height(4.dp))

        // RFID 状态 + 初始化按钮
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.fillMaxWidth()
        ) {
            StatusRow(
                label = "RFID：",
                ok = rfidReady,
                okText = "已初始化",
                failText = "未初始化"
            )

            Spacer(Modifier.weight(1f))

            if (!rfidReady) {
                Button(
                    onClick = onInitRfid,
                    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp),
                    modifier = Modifier.height(32.dp)
                ) {
                    Text("初始化 RFID", fontSize = 12.sp)
                }
            }
        }
    }
}

/**
 * 状态行（绿色/红色圆点 + 文案）。
 */
@Composable
private fun StatusRow(
    label: String,
    ok: Boolean,
    okText: String,
    failText: String
) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodyMedium,
            color = Color.Gray
        )
        // 状态圆点
        Box(
            modifier = Modifier
                .size(8.dp)
                .background(
                    color = if (ok) StatusGreen else StatusRed,
                    shape = RoundedCornerShape(50)
                )
        )
        Spacer(Modifier.width(4.dp))
        Text(
            text = if (ok) okText else failText,
            style = MaterialTheme.typography.bodyMedium,
            color = if (ok) StatusGreen else StatusRed,
            fontWeight = FontWeight.Medium
        )
    }
}

// ───────── IDLE 态：无任务等待 ─────────

/**
 * IDLE 布局（UI 设计 §5.3.1）。
 *
 * 显示「暂无待执行任务」，底部保留「最近完成任务」入口。
 * 自动轮询由 HomeViewModel 管理，无需手动刷新按钮。
 */
@Composable
private fun IdleContent(
    statusMessage: String,
    onRecentClick: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Spacer(Modifier.height(40.dp))

        // 空态图标
        Text(
            text = "📭",
            fontSize = 48.sp
        )

        Spacer(Modifier.height(16.dp))

        Text(
            text = "任务台（暂无任务）",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold
        )

        Spacer(Modifier.height(8.dp))

        Text(
            text = statusMessage,
            style = MaterialTheme.typography.bodyMedium,
            color = Color.Gray
        )

        Spacer(Modifier.height(8.dp))

        Text(
            text = "每 5 秒自动刷新，无需手动操作",
            style = MaterialTheme.typography.bodySmall,
            color = Color.LightGray
        )

        Spacer(Modifier.height(32.dp))

        // 最近完成任务入口
        RecentTaskEntry(onClick = onRecentClick)
    }
}

// ───────── POLLING 态：刷新中 ─────────

/**
 * POLLING 布局（UI 设计 §5.2）。
 *
 * 显示「刷新中…」，禁用所有操作按钮。
 */
@Composable
private fun PollingContent() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Spacer(Modifier.height(60.dp))

        CircularProgressIndicator(
            modifier = Modifier.size(48.dp),
            color = MaterialTheme.colorScheme.primary
        )

        Spacer(Modifier.height(16.dp))

        Text(
            text = "刷新中…",
            style = MaterialTheme.typography.titleMedium,
            color = Color.Gray
        )
    }
}

// ───────── TASK_LIST 态：任务清单 ─────────

/**
 * 任务清单布局（UI 设计 §5.3）。
 *
 * 最多 10 条任务卡片，可滚动。
 * 每条卡片含类型徽标、书名/作者/ISBN、执行/放弃按钮。
 * 底部常驻「最近完成任务」入口。
 */
@Composable
private fun TaskListContent(
    tasks: List<DeviceTask>,
    statusMessage: String,
    busy: Boolean,
    onExecute: (DeviceTask) -> Unit,
    onAbandon: (DeviceTask) -> Unit,
    onRecentClick: () -> Unit
) {
    Column(modifier = Modifier.fillMaxSize()) {
        // 标题栏
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "任务台（共 ${tasks.size} 条）",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )
            Spacer(Modifier.weight(1f))
            Text(
                text = statusMessage,
                style = MaterialTheme.typography.bodySmall,
                color = Color.Gray
            )
        }

        HorizontalDivider(thickness = 1.dp, color = Color(0xFFE0E0E0))

        // 任务列表（可滚动，fillMaxSize 占满可用空间）
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            items(tasks, key = { it.taskId }) { task ->
                TaskCard(
                    task = task,
                    busy = busy,
                    onExecute = { onExecute(task) },
                    onAbandon = { onAbandon(task) }
                )
            }

            // 底部「最近完成任务」入口
            item {
                Spacer(Modifier.height(8.dp))
                RecentTaskEntry(onClick = onRecentClick)
            }
        }
    }
}

// ───────── 任务卡片 ─────────

/**
 * 单个任务卡片（UI 设计 §5.3）。
 *
 * 根据 taskType 显示不同配色和内容：
 * - BIND_RFID：书名 / 作者 / ISBN
 * - FIND_BOOK：书名 / TID
 */
@Composable
private fun TaskCard(
    task: DeviceTask,
    busy: Boolean,
    onExecute: () -> Unit,
    onAbandon: () -> Unit
) {
    val isBind = task.taskType == TaskType.BIND_RFID
    val cardColor = if (isBind) TaskCardBind else TaskCardFind
    val typeLabel = if (isBind) "绑定 RFID" else "寻书"
    val typeColor = if (isBind) Color(0xFF1565C0) else Color(0xFFE65100)

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = cardColor),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(
            modifier = Modifier.padding(16.dp)
        ) {
            // 类型徽标 + 标题行
            Row(verticalAlignment = Alignment.CenterVertically) {
                // 类型徽标
                Box(
                    modifier = Modifier
                        .background(
                            color = typeColor.copy(alpha = 0.15f),
                            shape = RoundedCornerShape(4.dp)
                        )
                        .padding(horizontal = 8.dp, vertical = 2.dp)
                ) {
                    Text(
                        text = "▸ $typeLabel",
                        style = MaterialTheme.typography.labelMedium,
                        color = typeColor,
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            Spacer(Modifier.height(8.dp))

            // 书名
            if (task.title.isNotBlank()) {
                Text(
                    text = "书名：${task.title}",
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.Medium
                )
            }

            // 作者
            if (task.authors.isNotBlank()) {
                Spacer(Modifier.height(2.dp))
                Text(
                    text = "作者：${task.authors}",
                    style = MaterialTheme.typography.bodyMedium,
                    color = Color.DarkGray
                )
            }

            // ISBN（仅绑定任务）
            if (isBind && task.isbn.isNotBlank()) {
                Spacer(Modifier.height(2.dp))
                Text(
                    text = "ISBN：${task.isbn}",
                    style = MaterialTheme.typography.bodyMedium,
                    color = Color.DarkGray
                )
            }

            // TID（仅寻书任务）
            if (!isBind && task.targetTid.isNotBlank()) {
                Spacer(Modifier.height(2.dp))
                Text(
                    text = "TID：${task.targetTid}",
                    style = MaterialTheme.typography.bodyMedium,
                    color = Color.DarkGray
                )
            }

            Spacer(Modifier.height(12.dp))

            // 操作按钮
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.End,
                verticalAlignment = Alignment.CenterVertically
            ) {
                // 放弃按钮
                OutlinedButton(
                    onClick = onAbandon,
                    enabled = !busy,
                    contentPadding = PaddingValues(horizontal = 16.dp, vertical = 6.dp),
                    colors = ButtonDefaults.outlinedButtonColors(
                        contentColor = StatusRed
                    )
                ) {
                    Text("放弃", fontSize = 14.sp)
                }

                Spacer(Modifier.width(12.dp))

                // 执行按钮
                Button(
                    onClick = onExecute,
                    enabled = !busy,
                    contentPadding = PaddingValues(horizontal = 24.dp, vertical = 6.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = typeColor
                    )
                ) {
                    Text("执行", fontSize = 14.sp)
                }
            }
        }
    }
}

// ───────── 最近完成任务入口 ─────────

/**
 * 底部「最近完成任务」入口（UI 设计 §5.3 / §5.4）。
 *
 * 常驻于 IDLE 和 TASK_LIST 底部，点击导航至 recent 页。
 * 本阶段占位，点击不路由（仅预留 onClick 回调）。
 */
@Composable
private fun RecentTaskEntry(onClick: () -> Unit) {
    OutlinedCard(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(8.dp),
        colors = CardDefaults.outlinedCardColors(
            containerColor = Color.White
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "最近完成任务",
                style = MaterialTheme.typography.bodyLarge,
                fontWeight = FontWeight.Medium,
                color = Color(0xFF1976D2)
            )
            Text(
                text = "→",
                style = MaterialTheme.typography.titleMedium,
                color = Color(0xFF1976D2)
            )
        }
    }
}

// ───────── 版本号页脚 ─────────

/**
 * 版本号页脚。
 *
 * 固定在首页底部，方便开发者调试时确认当前运行版本。
 * 版本号来自 build.gradle.kts 的 versionName，通过 BuildConfig 注入。
 * 开发者修改 versionName 后重新编译即可在 App 中看到更新。
 */
@Composable
private fun VersionFooter() {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color(0xFFF5F5F5))
            .padding(8.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            text = "v${BuildConfig.APP_VERSION_NAME}",
            style = MaterialTheme.typography.labelSmall,
            color = Color.LightGray,
            textAlign = TextAlign.Center
        )
    }
}
