package com.familylibrary.rfidfinder.ui.keytest

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

// ───────── 颜色常量 ─────────

private val StatusGreen = Color(0xFF4CAF50)
private val StatusRed = Color(0xFFF44336)
private val StatusBlue = Color(0xFF1976D2)
private val StatusOrange = Color(0xFFE65100)
private val KeyBg = Color(0xFFF5F5F5)
private val ScanBg = Color(0xFFFFF3E0)

/**
 * 按键/扫码测试页面。
 *
 * 实时显示 PDA 上所有 KeyEvent 和扫码广播结果，
 * 帮助开发者确认侧键/枪柄按钮对应的 keyCode。
 */
@Composable
fun KeyTestScreen(
    onKeyEvent: (android.view.KeyEvent) -> Unit,
    onNavigateBack: () -> Unit,
    viewModel: KeyTestViewModel = androidx.lifecycle.viewmodel.compose.viewModel()
) {
    val state by viewModel.uiState.collectAsState()
    val listState = rememberLazyListState()

    // 自动滚动到最新事件
    LaunchedEffect(state.events.size) {
        if (state.events.isNotEmpty()) {
            listState.animateScrollToItem(0)
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
    ) {
        // 顶部栏
        KeyTestTopBar(
            onBack = onNavigateBack,
            onClear = viewModel::clearEvents
        )

        HorizontalDivider(thickness = 1.dp, color = Color(0xFFE0E0E0))

        // 实时扫码数据区
        if (state.lastScanData.isNotBlank()) {
            ScanDataBanner(data = state.lastScanData)
        }

        // 状态提示
        Surface(
            modifier = Modifier.fillMaxWidth(),
            color = Color(0xFFE3F2FD)
        ) {
            Text(
                text = state.statusMessage,
                modifier = Modifier.padding(12.dp),
                style = MaterialTheme.typography.bodyMedium,
                color = StatusBlue,
                fontWeight = FontWeight.Medium
            )
        }

        HorizontalDivider(thickness = 1.dp, color = Color(0xFFE0E0E0))

        // 事件列表
        if (state.events.isEmpty()) {
            // 空态
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                Text("🔍", fontSize = 48.sp)
                Spacer(Modifier.height(12.dp))
                Text(
                    text = "等待按键或扫码事件…",
                    style = MaterialTheme.typography.bodyLarge,
                    color = Color.Gray
                )
                Spacer(Modifier.height(8.dp))
                Text(
                    text = "请按下 PDA 侧键、枪柄按钮或触发扫码",
                    style = MaterialTheme.typography.bodySmall,
                    color = Color.LightGray
                )
            }
        } else {
            LazyColumn(
                state = listState,
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(8.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                items(state.events, key = { it.id }) { entry ->
                    EventEntryCard(entry)
                }
            }
        }
    }
}

// ───────── 顶部栏 ─────────

@Composable
private fun KeyTestTopBar(onBack: () -> Unit, onClear: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color(0xFFF5F5F5))
            .padding(horizontal = 8.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        TextButton(onClick = onBack) {
            Text("← 返回", color = StatusBlue)
        }

        Text(
            text = "按键/扫码测试",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.weight(1f),
            textAlign = TextAlign.Center
        )

        TextButton(onClick = onClear) {
            Text("清空", color = StatusRed)
        }
    }
}

// ───────── 扫码数据横幅 ─────────

@Composable
private fun ScanDataBanner(data: String) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = ScanBg
    ) {
        Column(Modifier.padding(12.dp)) {
            Text(
                text = "📷 最新扫码结果",
                style = MaterialTheme.typography.labelMedium,
                color = StatusOrange,
                fontWeight = FontWeight.Bold
            )
            Spacer(Modifier.height(4.dp))
            Text(
                text = data,
                style = MaterialTheme.typography.bodyLarge,
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Medium
            )
        }
    }
}

// ───────── 事件卡片 ─────────

@Composable
private fun EventEntryCard(entry: KeyEventEntry) {
    val isKey = entry.type == "按键"
    val bgColor = if (isKey) KeyBg else ScanBg
    val badgeColor = if (isKey) StatusBlue else StatusOrange

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(6.dp),
        colors = CardDefaults.cardColors(containerColor = bgColor)
    ) {
        Column(Modifier.padding(10.dp)) {
            // 头部：时间 + 类型徽标
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = entry.timestamp,
                    style = MaterialTheme.typography.labelSmall,
                    fontFamily = FontFamily.Monospace,
                    color = Color.Gray
                )
                Spacer(Modifier.width(8.dp))
                Box(
                    modifier = Modifier
                        .background(
                            color = badgeColor.copy(alpha = 0.15f),
                            shape = RoundedCornerShape(4.dp)
                        )
                        .padding(horizontal = 6.dp, vertical = 1.dp)
                ) {
                    Text(
                        text = entry.type,
                        style = MaterialTheme.typography.labelSmall,
                        color = badgeColor,
                        fontWeight = FontWeight.Bold
                    )
                }
                if (isKey) {
                    Spacer(Modifier.width(6.dp))
                    Text(
                        text = entry.action,
                        style = MaterialTheme.typography.labelSmall,
                        color = if (entry.action == "DOWN") StatusGreen else Color.Gray,
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            Spacer(Modifier.height(4.dp))

            if (isKey) {
                // 按键详情
                Text(
                    text = "keyCode = ${entry.keyCode}  (${entry.keyName})",
                    style = MaterialTheme.typography.bodyMedium,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Medium
                )
                if (entry.metaState != "无") {
                    Text(
                        text = "修饰键: ${entry.metaState}",
                        style = MaterialTheme.typography.bodySmall,
                        color = Color.DarkGray
                    )
                }
            } else {
                // 扫码详情
                Text(
                    text = "扫码数据: ${entry.scanData}",
                    style = MaterialTheme.typography.bodyMedium,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Medium
                )
                if (entry.scanCodec.isNotBlank()) {
                    Text(
                        text = "编码: ${entry.scanCodec}",
                        style = MaterialTheme.typography.bodySmall,
                        color = Color.DarkGray
                    )
                }
            }
        }
    }
}
