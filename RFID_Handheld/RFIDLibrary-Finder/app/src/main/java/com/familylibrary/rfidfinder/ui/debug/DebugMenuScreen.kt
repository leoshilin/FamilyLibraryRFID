package com.familylibrary.rfidfinder.ui.debug

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
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

private val StatusGreen = Color(0xFF4CAF50)
private val StatusBlue = Color(0xFF1976D2)
private val StatusOrange = Color(0xFFE65100)
private val SectionBg = Color(0xFFFFFFFF)

/**
 * 调试菜单页面。
 *
 * 汇总所有调试工具入口：
 * - 按键测试：跳转 KeyTestScreen，测试 PDA 侧键/扫码事件
 * - RFID 标签读写：跳转 RfidTestScreen，功率调节/连续读取/EPC 写入
 */
@Composable
fun DebugMenuScreen(
    onNavigateBack: () -> Unit,
    onNavigateToKeyTest: () -> Unit,
    onNavigateToRfidTest: () -> Unit,
    viewModel: DebugMenuViewModel = androidx.lifecycle.viewmodel.compose.viewModel()
) {
    val state by viewModel.uiState.collectAsState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
    ) {
        // 顶部栏
        DebugMenuTopBar(onBack = onNavigateBack)

        HorizontalDivider(thickness = 1.dp, color = Color(0xFFE0E0E0))

        // 菜单内容
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // 按键测试入口
            MenuEntryCard(
                emoji = "🔑",
                title = "按键测试",
                subtitle = "测试 PDA 侧键/扫码事件",
                subtitle2 = "实时显示 KeyEvent 和扫码广播",
                onClick = onNavigateToKeyTest
            )

            // RFID 标签读写入口
            MenuEntryCard(
                emoji = "📡",
                title = "RFID 标签读写",
                subtitle = "功率调节 / 连续读取 / 写入 EPC",
                subtitle2 = if (state.rfidReady) "RFID 已初始化" else "⚠ RFID 未初始化，需先初始化",
                onClick = onNavigateToRfidTest
            )
        }
    }
}

// ───────── 顶部栏 ─────────

@Composable
private fun DebugMenuTopBar(onBack: () -> Unit) {
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
            text = "调试工具",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.weight(1f),
            textAlign = TextAlign.Center
        )

        // 占位，保持标题居中
        Spacer(Modifier.width(64.dp))
    }
}

// ───────── 菜单入口卡片 ─────────

@Composable
private fun MenuEntryCard(
    emoji: String,
    title: String,
    subtitle: String,
    subtitle2: String,
    onClick: () -> Unit
) {
    Card(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = SectionBg),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // 图标
            Text(
                text = emoji,
                fontSize = 40.sp
            )

            Spacer(Modifier.width(16.dp))

            // 文字区域
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = Color(0xFF333333)
                )
                Spacer(Modifier.height(4.dp))
                Text(
                    text = subtitle,
                    style = MaterialTheme.typography.bodyMedium,
                    color = Color.DarkGray
                )
                Spacer(Modifier.height(2.dp))
                Text(
                    text = subtitle2,
                    style = MaterialTheme.typography.bodySmall,
                    color = Color.Gray
                )
            }

            // 箭头
            Text(
                text = "→",
                style = MaterialTheme.typography.titleLarge,
                color = StatusBlue,
                fontWeight = FontWeight.Bold
            )
        }
    }
}
