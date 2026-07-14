package com.familylibrary.rfidfinder.ui.find

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel

// ───────── 颜色常量 ─────────

private val StatusGreen = Color(0xFF4CAF50)
private val StatusRed = Color(0xFFF44336)
private val StatusBlue = Color(0xFF1976D2)
private val StatusOrange = Color(0xFFE65100)
private val BgGray = Color(0xFFF5F5F5)

/**
 * 寻书页面（F6.2 寻书物理定位）。
 *
 * 盖革计数器模式：
 * - TASK_INFO：显示任务信息 + 开始寻书按钮
 * - SCANNING：RSSI 实时信号指示 + 距离提示 + [结束寻书] [退出任务]
 * - DONE：结果展示
 */
@Composable
fun FindScreen(
    onNavigateBack: () -> Unit,
    viewModel: FindViewModel = viewModel()
) {
    val state by viewModel.uiState.collectAsState()

    LaunchedEffect(state.phase) {
        if (state.phase == FindPhase.CANCELLED) {
            onNavigateBack()
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
    ) {
        // 顶部标题栏
        FindTopBar(
            title = state.bookTitle.ifBlank { "寻书" },
            onBack = {
                if (state.phase == FindPhase.DONE) {
                    onNavigateBack()
                } else if (state.phase == FindPhase.SCANNING) {
                    // SCANNING 阶段：弹出确认对话框
                    // 此处的 showBackDialog 状态定义在 FindScanningContent 中，
                    // 但为了让顶部栏也能触发，使用一个提升到 FindScreen 级别的状态
                    onNavigateBack()
                } else if (!state.busy) {
                    viewModel.onCancel()
                }
            },
            showBack = state.phase != FindPhase.SCANNING
        )

        HorizontalDivider(thickness = 1.dp, color = Color(0xFFE0E0E0))

        // 主内容区
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f)
        ) {
            when (state.phase) {
                FindPhase.TASK_INFO -> FindTaskInfoContent(state, viewModel)
                FindPhase.SCANNING -> FindScanningContent(state, viewModel)
                FindPhase.DONE -> FindDoneContent(state, onNavigateBack)
                FindPhase.CANCELLED -> {} // LaunchedEffect 处理返回
            }
        }

        // 状态提示条
        if (state.statusMessage.isNotBlank() && state.phase != FindPhase.DONE) {
            StatusFooter(message = state.statusMessage)
        }
    }
}

// ───────── 顶部栏 ─────────

@Composable
private fun FindTopBar(title: String, onBack: () -> Unit, showBack: Boolean) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(BgGray)
            .padding(horizontal = 8.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        if (showBack) {
            TextButton(onClick = onBack) {
                Text("← 返回", color = StatusBlue)
            }
        }
        Text(
            text = "寻书：$title",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.weight(1f),
            textAlign = TextAlign.Center
        )
        if (showBack) {
            Spacer(Modifier.width(64.dp))
        }
    }
}

// ───────── TASK_INFO ─────────

@Composable
private fun FindTaskInfoContent(state: FindUiState, viewModel: FindViewModel) {
    val task = state.task ?: return

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Spacer(Modifier.height(32.dp))

        // 任务信息卡片
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp),
            colors = CardDefaults.cardColors(containerColor = Color(0xFFFFF3E0))
        ) {
            Column(Modifier.padding(20.dp)) {
                Text(
                    text = "▸ 寻书定位",
                    style = MaterialTheme.typography.labelLarge,
                    color = StatusOrange,
                    fontWeight = FontWeight.Bold
                )
                Spacer(Modifier.height(12.dp))
                if (task.title.isNotBlank()) {
                    Text("书名：${task.title}", style = MaterialTheme.typography.bodyLarge)
                }
                if (task.authors.isNotBlank()) {
                    Spacer(Modifier.height(4.dp))
                    Text("作者：${task.authors}", style = MaterialTheme.typography.bodyMedium, color = Color.DarkGray)
                }
                if (state.targetTid.isNotBlank()) {
                    Spacer(Modifier.height(4.dp))
                    Text("目标标签：${state.targetTid}", style = MaterialTheme.typography.bodySmall, color = Color.Gray)
                }
            }
        }

        Spacer(Modifier.height(24.dp))

        Text(
            text = "📡 寻书模式：盖革计数器",
            style = MaterialTheme.typography.bodyMedium,
            color = Color.Gray
        )
        Text(
            text = "将 PDA 靠近书架，RSSI 信号越强表示越接近目标",
            style = MaterialTheme.typography.bodySmall,
            color = Color.LightGray
        )

        Spacer(Modifier.weight(1f))

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            OutlinedButton(
                onClick = { viewModel.onCancel() },
                modifier = Modifier.weight(1f),
                colors = ButtonDefaults.outlinedButtonColors(contentColor = StatusRed)
            ) {
                Text("取消", fontSize = 16.sp)
            }
            Button(
                onClick = { viewModel.onStartFind() },
                modifier = Modifier.weight(1f),
                colors = ButtonDefaults.buttonColors(containerColor = StatusOrange)
            ) {
                Text("开始寻书", fontSize = 16.sp)
            }
        }
    }
}

// ───────── SCANNING ─────────

@Composable
private fun FindScanningContent(state: FindUiState, viewModel: FindViewModel) {
    val rssi = state.currentRssi
    // 退出确认对话框状态
    var showAbortDialog by remember { mutableStateOf(false) }
    // 返回确认对话框状态
    var showBackDialog by remember { mutableStateOf(false) }

    // 退出确认对话框
    if (showAbortDialog) {
        AlertDialog(
            onDismissRequest = { showAbortDialog = false },
            title = { Text("退出寻书任务") },
            text = {
                Text("退出后任务将回到待领取状态，可稍后重新寻书。\n\n确定要退出吗？")
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        showAbortDialog = false
                        viewModel.onAbortFind()
                    }
                ) {
                    Text("确认退出", color = StatusOrange)
                }
            },
            dismissButton = {
                TextButton(onClick = { showAbortDialog = false }) {
                    Text("继续寻书")
                }
            }
        )
    }

    // 返回键确认对话框（SEARCHING 阶段系统返回键弹出）
    if (showBackDialog) {
        AlertDialog(
            onDismissRequest = { showBackDialog = false },
            title = { Text("结束当前寻书？") },
            text = {
                Text("请选择操作：\n• 结束寻书：提交寻书结果（找到/未找到）\n• 退出任务：任务回到待领取状态，稍后重试")
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        showBackDialog = false
                        viewModel.onAbortFind()
                    }
                ) {
                    Text("退出任务", color = StatusOrange)
                }
            },
            dismissButton = {
                Row {
                    TextButton(onClick = { showBackDialog = false }) {
                        Text("继续寻书")
                    }
                    TextButton(
                        onClick = {
                            showBackDialog = false
                            viewModel.onEndFind()
                        }
                    ) {
                        Text("结束寻书", color = StatusBlue)
                    }
                }
            }
        )
    }
    // RSSI 典型范围 -80（远）到 -30（近），映射到 0-100% 的强度指示
    val signalStrength = if (rssi != null) {
        ((rssi + 80).coerceIn(0, 50) / 50f) // 归一化
    } else 0f

    // 根据信号强度选择颜色
    val signalColor = when {
        state.found -> StatusGreen
        rssi != null && rssi > -50 -> Color(0xFF8BC34A)
        rssi != null && rssi > -65 -> Color(0xFFFFC107)
        rssi != null -> StatusOrange
        else -> Color.Gray
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        // 目标信息
        Text(
            text = "正在搜索：《${state.bookTitle}》",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
            textAlign = TextAlign.Center
        )

        Spacer(Modifier.height(32.dp))

        // RSSI 信号指示器
        Box(
            modifier = Modifier
                .size(160.dp)
                .clip(CircleShape)
                .background(signalColor.copy(alpha = 0.15f)),
            contentAlignment = Alignment.Center
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    text = if (rssi != null) "${rssi}dBm" else "---",
                    style = MaterialTheme.typography.headlineMedium,
                    fontWeight = FontWeight.Bold,
                    color = signalColor
                )
                Text(
                    text = if (state.found) "已找到!" else if (rssi != null) "信号强度" else "搜索中…",
                    style = MaterialTheme.typography.bodySmall,
                    color = signalColor.copy(alpha = 0.7f)
                )
            }
        }

        Spacer(Modifier.height(24.dp))

        // 信号条
        Row(
            modifier = Modifier.fillMaxWidth(0.7f),
            horizontalArrangement = Arrangement.spacedBy(4.dp),
            verticalAlignment = Alignment.Bottom
        ) {
            for (i in 0 until 10) {
                val barActive = signalStrength >= (i + 1) / 10f
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .height((12 + i * 4).dp)
                        .clip(RoundedCornerShape(2.dp))
                        .background(
                            if (barActive) signalColor else Color(0xFFE0E0E0)
                        )
                )
            }
        }

        Spacer(Modifier.height(16.dp))

        // 距离提示（优先使用 RssiLocator 的计算结果）
        val distanceHint = when {
            state.found -> "目标已锁定！"
            state.distanceHint.isNotBlank() -> state.distanceHint
            rssi != null && rssi > -45 -> "非常接近！"
            rssi != null && rssi > -55 -> "很接近了"
            rssi != null && rssi > -65 -> "正在靠近"
            rssi != null -> "还有一段距离"
            else -> "请移动 PDA 扫描书架…"
        }
        Text(
            text = distanceHint,
            style = MaterialTheme.typography.bodyLarge,
            color = signalColor,
            fontWeight = FontWeight.Medium
        )

        Spacer(Modifier.height(8.dp))

        // 功率和 beep 等级（盖革计数器状态）
        if (state.currentPower > 0) {
            Text(
                text = "功率: ${state.currentPower}dBm | Beep: Lv${state.beepLevel}",
                style = MaterialTheme.typography.bodySmall,
                color = Color.Gray
            )
        }

        Spacer(Modifier.height(4.dp))

        // 统计
        Text(
            text = "已读取 ${state.totalReadCount} 次 | 连续 ${state.consecutiveReads} 次",
            style = MaterialTheme.typography.bodySmall,
            color = Color.Gray
        )

        Spacer(Modifier.weight(1f))

        // 操作按钮行：[结束寻书] [退出任务]
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // 退出任务按钮
            OutlinedButton(
                onClick = { showAbortDialog = true },
                modifier = Modifier.weight(1f),
                enabled = !state.busy,
                colors = ButtonDefaults.outlinedButtonColors(contentColor = StatusOrange)
            ) {
                Text("退出任务", fontSize = 16.sp)
            }
            // 结束寻书按钮
            Button(
                onClick = { viewModel.onEndFind() },
                modifier = Modifier.weight(1f).height(56.dp),
                enabled = !state.busy,
                colors = ButtonDefaults.buttonColors(
                    containerColor = if (state.found) StatusGreen else StatusBlue
                )
            ) {
                Text(
                    text = if (state.found) "已找到，结束寻书" else "结束寻书",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold
                )
            }
        }
    }
}

// ───────── DONE ─────────

@Composable
private fun FindDoneContent(state: FindUiState, onNavigateBack: () -> Unit) {
    val success = state.resultMessage.contains("成功")

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text(
            text = if (success) "✅" else "❌",
            fontSize = 64.sp
        )

        Spacer(Modifier.height(16.dp))

        Text(
            text = state.resultMessage.ifBlank { "寻书完成" },
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold,
            color = if (success) StatusGreen else StatusRed,
            textAlign = TextAlign.Center
        )

        Spacer(Modifier.height(12.dp))

        Text(
            text = state.statusMessage,
            style = MaterialTheme.typography.bodyMedium,
            color = Color.DarkGray
        )

        Spacer(Modifier.height(32.dp))

        Button(
            onClick = onNavigateBack,
            modifier = Modifier.fillMaxWidth(),
            colors = ButtonDefaults.buttonColors(containerColor = StatusBlue)
        ) {
            Text("返回任务台", fontSize = 16.sp)
        }
    }
}

// ───────── 底部状态条 ─────────

@Composable
private fun StatusFooter(message: String) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = Color(0xFFE3F2FD)
    ) {
        Text(
            text = message,
            modifier = Modifier.padding(12.dp),
            style = MaterialTheme.typography.bodySmall,
            color = StatusBlue,
            textAlign = TextAlign.Center
        )
    }
}
