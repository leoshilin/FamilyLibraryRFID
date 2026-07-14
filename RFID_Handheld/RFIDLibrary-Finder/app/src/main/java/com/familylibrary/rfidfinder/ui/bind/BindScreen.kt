package com.familylibrary.rfidfinder.ui.bind

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.familylibrary.rfidfinder.rfid.RfidTag

// ───────── 颜色常量 ─────────

private val StatusGreen = Color(0xFF4CAF50)
private val StatusRed = Color(0xFFF44336)
private val StatusBlue = Color(0xFF1976D2)
private val StatusOrange = Color(0xFFE65100)
private val BgGray = Color(0xFFF5F5F5)
private val TagCardBg = Color(0xFFE8F5E9)

// ───────── 主 Composable ─────────

/**
 * 绑定页面（F4.3 绑定 RFID）。
 *
 * 根据 BindViewModel 的状态机渲染对应 UI：
 * - TASK_INFO：任务信息 + 开始绑定
 * - SCAN_ISBN：ISBN 扫码提示 + 输入框
 * - SCAN_TAG：标签扫描列表 + 选择
 * - CONFIRM_UNBIND：解绑确认弹窗
 * - BINDING：绑定进度
 * - WRITE_EPC：EPC 写入 + 失败处理
 * - DONE：完成结果
 */
@Composable
fun BindScreen(
    onNavigateBack: () -> Unit,
    viewModel: BindViewModel = viewModel()
) {
    val state by viewModel.uiState.collectAsState()

    // 监听 CANCELLED 和 DONE 后返回
    LaunchedEffect(state.phase) {
        if (state.phase == BindPhase.CANCELLED) {
            onNavigateBack()
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
    ) {
        // 顶部标题栏
        BindTopBar(
            title = state.task?.title ?: "绑定 RFID",
            onBack = {
                if (state.phase == BindPhase.DONE) {
                    onNavigateBack()
                } else if (!state.busy) {
                    viewModel.onCancel()
                }
            },
            showBack = state.phase != BindPhase.BINDING && state.phase != BindPhase.WRITE_EPC
        )

        HorizontalDivider(thickness = 1.dp, color = Color(0xFFE0E0E0))

        // 主内容区
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f)
        ) {
            when (state.phase) {
                BindPhase.TASK_INFO -> TaskInfoContent(state, viewModel)
                BindPhase.SCAN_ISBN -> ScanIsbnContent(state, viewModel)
                BindPhase.SCAN_TAG -> ScanTagContent(state, viewModel)
                BindPhase.CONFIRM_UNBIND -> ConfirmUnbindContent(state, viewModel)
                BindPhase.BINDING -> ProgressContent(state, "正在绑定…")
                BindPhase.WRITE_EPC -> WriteEpcContent(state, viewModel)
                BindPhase.DONE -> DoneContent(state, onNavigateBack)
                BindPhase.CANCELLED -> {} // LaunchedEffect 处理返回
            }
        }

        // 状态提示条
        if (state.statusMessage.isNotBlank() && state.phase != BindPhase.DONE) {
            StatusFooter(message = state.statusMessage, isError = state.phase == BindPhase.SCAN_ISBN && state.isbnError.isNotBlank())
        }
    }
}

// ───────── 顶部栏 ─────────

@Composable
private fun BindTopBar(title: String, onBack: () -> Unit, showBack: Boolean) {
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
            text = "绑定：$title",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.weight(1f),
            textAlign = TextAlign.Center
        )
        // 平衡布局
        if (showBack) {
            Spacer(Modifier.width(64.dp))
        }
    }
}

// ───────── TASK_INFO ─────────

@Composable
private fun TaskInfoContent(state: BindUiState, viewModel: BindViewModel) {
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
            colors = CardDefaults.cardColors(containerColor = Color(0xFFE3F2FD))
        ) {
            Column(Modifier.padding(20.dp)) {
                Text(
                    text = "▸ 绑定 RFID",
                    style = MaterialTheme.typography.labelLarge,
                    color = StatusBlue,
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
                if (task.isbn.isNotBlank()) {
                    Spacer(Modifier.height(4.dp))
                    Text("ISBN：${task.isbn}", style = MaterialTheme.typography.bodyMedium, color = Color.DarkGray)
                }
            }
        }

        Spacer(Modifier.height(32.dp))

        Text(
            text = "请确认以上信息无误后开始绑定",
            style = MaterialTheme.typography.bodyMedium,
            color = Color.Gray
        )

        Spacer(Modifier.weight(1f))

        // 操作按钮
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
                onClick = { viewModel.onStartBinding() },
                modifier = Modifier.weight(1f),
                colors = ButtonDefaults.buttonColors(containerColor = StatusBlue)
            ) {
                Text("开始绑定", fontSize = 16.sp)
            }
        }
    }
}

// ───────── SCAN_ISBN ─────────

@Composable
private fun ScanIsbnContent(state: BindUiState, viewModel: BindViewModel) {
    var isbnInput by remember { mutableStateOf("") }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Spacer(Modifier.height(32.dp))

        Text(
            text = "📷 扫描图书 ISBN 条码",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold
        )

        Spacer(Modifier.height(8.dp))

        Text(
            text = "期望 ISBN：${state.task?.isbn ?: ""}",
            style = MaterialTheme.typography.bodyMedium,
            color = Color.Gray
        )

        Spacer(Modifier.height(24.dp))

        // ISBN 手动输入（真机扫码由相机实现，此处提供手动输入入口方便调试）
        OutlinedTextField(
            value = isbnInput,
            onValueChange = { isbnInput = it },
            label = { Text("ISBN") },
            placeholder = { Text("扫描或手动输入 ISBN") },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            isError = state.isbnError.isNotBlank(),
            supportingText = if (state.isbnError.isNotBlank()) {
                { Text(state.isbnError, color = StatusRed) }
            } else null
        )

        Spacer(Modifier.height(12.dp))

        // 校验按钮
        Button(
            onClick = { viewModel.onIsbnScanned(isbnInput.trim()) },
            enabled = isbnInput.isNotBlank() && !state.busy,
            modifier = Modifier.fillMaxWidth(),
            colors = ButtonDefaults.buttonColors(containerColor = StatusBlue)
        ) {
            Text("校验 ISBN", fontSize = 16.sp)
        }

        Spacer(Modifier.height(8.dp))

        Text(
            text = "提示：真机通过相机扫码，此处可手动输入 ISBN 用于调试",
            style = MaterialTheme.typography.bodySmall,
            color = Color.LightGray,
            textAlign = TextAlign.Center
        )

        Spacer(Modifier.weight(1f))

        OutlinedButton(
            onClick = { viewModel.onCancel() },
            modifier = Modifier.fillMaxWidth(),
            colors = ButtonDefaults.outlinedButtonColors(contentColor = StatusRed)
        ) {
            Text("取消", fontSize = 16.sp)
        }
    }
}

// ───────── SCAN_TAG ─────────

@Composable
private fun ScanTagContent(state: BindUiState, viewModel: BindViewModel) {
    Column(
        modifier = Modifier.fillMaxSize()
    ) {
        // 状态摘要
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(Color(0xFFE8F5E9))
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text("✅ ISBN 校验通过：${state.task?.isbn ?: ""}", color = StatusGreen, fontSize = 14.sp)
        }

        // 标签列表
        if (state.scannedTags.isEmpty() && !state.scanning) {
            // 空态
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                Text("📡", fontSize = 48.sp)
                Spacer(Modifier.height(12.dp))
                Text("未扫描到标签", style = MaterialTheme.typography.bodyLarge, color = Color.Gray)
                Spacer(Modifier.height(4.dp))
                Text("请将 PDA 靠近 RFID 标签", style = MaterialTheme.typography.bodySmall, color = Color.LightGray)
            }
        } else {
            // 扫描到的标签列表
            Text(
                text = "扫描到的标签：",
                style = MaterialTheme.typography.labelLarge,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
            )

            LazyColumn(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f),
                contentPadding = PaddingValues(horizontal = 16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(state.scannedTags, key = { it.tid }) { tag ->
                    TagItemCard(
                        tag = tag,
                        selected = state.selectedTag?.tid == tag.tid,
                        enabled = !state.busy,
                        onSelect = { viewModel.onTagSelected(tag) }
                    )
                }

                // 底部留白
                item { Spacer(Modifier.height(8.dp)) }
            }
        }

        // 底部操作栏
        Surface(
            modifier = Modifier.fillMaxWidth(),
            shadowElevation = 4.dp,
            color = MaterialTheme.colorScheme.surface
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                OutlinedButton(
                    onClick = { viewModel.onCancel() },
                    modifier = Modifier.weight(1f),
                    enabled = !state.busy,
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = StatusRed)
                ) {
                    Text("取消", fontSize = 16.sp)
                }
                Button(
                    onClick = { viewModel.rescanTags() },
                    modifier = Modifier.weight(1f),
                    enabled = !state.busy,
                    colors = ButtonDefaults.buttonColors(containerColor = StatusOrange)
                ) {
                    Text("重新扫描", fontSize = 16.sp)
                }
            }
        }
    }
}

/** 单个标签卡片。 */
@Composable
private fun TagItemCard(
    tag: RfidTag,
    selected: Boolean,
    enabled: Boolean,
    onSelect: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(8.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (selected) Color(0xFFE8F5E9) else TagCardBg
        ),
        border = if (selected) CardDefaults.outlinedCardBorder() else null
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = "TID: ${tag.tid}",
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Medium
                )
                Text(
                    text = "RSSI: ${tag.rssi}",
                    style = MaterialTheme.typography.bodySmall,
                    color = Color.Gray
                )
            }

            Button(
                onClick = onSelect,
                enabled = enabled,
                contentPadding = PaddingValues(horizontal = 20.dp, vertical = 8.dp),
                colors = ButtonDefaults.buttonColors(containerColor = StatusBlue)
            ) {
                Text("选择", fontSize = 14.sp)
            }
        }
    }
}

// ───────── CONFIRM_UNBIND ─────────

@Composable
private fun ConfirmUnbindContent(state: BindUiState, viewModel: BindViewModel) {
    val info = state.bindingInfo ?: return

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Spacer(Modifier.height(32.dp))

        // 警告图标
        Text("⚠️", fontSize = 48.sp)

        Spacer(Modifier.height(16.dp))

        Text(
            text = "标签已被占用",
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold,
            color = StatusOrange
        )

        Spacer(Modifier.height(16.dp))

        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp),
            colors = CardDefaults.cardColors(containerColor = Color(0xFFFFF3E0))
        ) {
            Column(Modifier.padding(16.dp)) {
                Text(
                    text = "该标签已被《${info.title}》占用",
                    style = MaterialTheme.typography.bodyLarge
                )
                if (info.isbn.isNotBlank()) {
                    Spacer(Modifier.height(4.dp))
                    Text("ISBN：${info.isbn}", style = MaterialTheme.typography.bodyMedium, color = Color.DarkGray)
                }
            }
        }

        Spacer(Modifier.height(24.dp))

        Text(
            text = "是否解绑后重新绑定到当前图书？",
            style = MaterialTheme.typography.bodyLarge,
            textAlign = TextAlign.Center
        )

        Spacer(Modifier.weight(1f))

        // 操作按钮
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            OutlinedButton(
                onClick = { viewModel.onCancelUnbind() },
                modifier = Modifier.weight(1f),
                colors = ButtonDefaults.outlinedButtonColors(contentColor = Color.Gray)
            ) {
                Text("取消", fontSize = 16.sp)
            }
            Button(
                onClick = { viewModel.onConfirmUnbind() },
                modifier = Modifier.weight(1f),
                colors = ButtonDefaults.buttonColors(containerColor = StatusOrange)
            ) {
                Text("确认解绑并重绑", fontSize = 16.sp)
            }
        }
    }
}

// ───────── 进度态（BINDING / WRITE_EPC 共用） ─────────

@Composable
private fun ProgressContent(state: BindUiState, message: String) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        CircularProgressIndicator(
            modifier = Modifier.size(64.dp),
            color = StatusBlue,
            strokeWidth = 6.dp
        )

        Spacer(Modifier.height(24.dp))

        Text(
            text = message,
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold
        )

        Spacer(Modifier.height(8.dp))

        Text(
            text = "请稍候，请勿离开页面…",
            style = MaterialTheme.typography.bodyMedium,
            color = Color.Gray
        )
    }
}

// ───────── WRITE_EPC（含失败处理） ─────────

@Composable
private fun WriteEpcContent(state: BindUiState, viewModel: BindViewModel) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        if (state.busy) {
            CircularProgressIndicator(
                modifier = Modifier.size(64.dp),
                color = StatusBlue,
                strokeWidth = 6.dp
            )
            Spacer(Modifier.height(24.dp))
            Text("正在写入 EPC…", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
        } else if (!state.epcWritten) {
            // EPC 写入失败
            Text("⚠️", fontSize = 48.sp)
            Spacer(Modifier.height(16.dp))
            Text(
                text = "EPC 写入失败",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
                color = StatusOrange
            )
            Spacer(Modifier.height(12.dp))
            Text(
                text = "云端绑定已生效，但标签 EPC 区写入未成功。\n这会影响后续寻书定位功能。",
                style = MaterialTheme.typography.bodyMedium,
                color = Color.DarkGray,
                textAlign = TextAlign.Center
            )
            Spacer(Modifier.height(24.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                OutlinedButton(
                    onClick = { viewModel.onSkipWriteEpc() },
                    modifier = Modifier.weight(1f)
                ) {
                    Text("完成（绑定已生效）", fontSize = 14.sp)
                }
                Button(
                    onClick = { viewModel.onRetryWriteEpc() },
                    modifier = Modifier.weight(1f),
                    colors = ButtonDefaults.buttonColors(containerColor = StatusBlue)
                ) {
                    Text("重试写入", fontSize = 14.sp)
                }
            }
        }
    }
}

// ───────── DONE ─────────

@Composable
private fun DoneContent(state: BindUiState, onNavigateBack: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text("✅", fontSize = 64.sp)

        Spacer(Modifier.height(16.dp))

        Text(
            text = state.resultMessage.ifBlank { "绑定完成" },
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold,
            color = StatusGreen
        )

        Spacer(Modifier.height(12.dp))

        Text(
            text = state.statusMessage,
            style = MaterialTheme.typography.bodyMedium,
            color = Color.DarkGray,
            textAlign = TextAlign.Center
        )

        if (!state.epcWritten) {
            Spacer(Modifier.height(8.dp))
            Text(
                text = "⚠ EPC 未写入，寻书功能将受影响",
                style = MaterialTheme.typography.bodySmall,
                color = StatusOrange
            )
        }

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
private fun StatusFooter(message: String, isError: Boolean) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = if (isError) Color(0xFFFFEBEE) else Color(0xFFE3F2FD)
    ) {
        Text(
            text = message,
            modifier = Modifier.padding(12.dp),
            style = MaterialTheme.typography.bodySmall,
            color = if (isError) StatusRed else StatusBlue,
            textAlign = TextAlign.Center
        )
    }
}
