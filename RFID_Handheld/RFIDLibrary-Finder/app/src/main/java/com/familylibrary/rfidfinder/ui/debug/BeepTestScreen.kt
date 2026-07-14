package com.familylibrary.rfidfinder.ui.debug

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
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

// ───────── 颜色常量 ─────────

private val StatusGreen = Color(0xFF4CAF50)
private val StatusRed = Color(0xFFF44336)
private val StatusBlue = Color(0xFF1976D2)
private val StatusOrange = Color(0xFFE65100)
private val SectionBg = Color(0xFFFFFFFF)
private val PanelBg = Color(0xFFF8F8F8)
private val DisabledBg = Color(0xFFE0E0E0)

/**
 * Beep 蜂鸣音调试页面。
 *
 * 提供三种蜂鸣测试模式：
 * - 短音：单次 ~50ms 蜂鸣，模拟寻书扫描中每次读到标签的确认音
 * - 滴滴连续音：4 组双短音（滴滴…滴滴…），模拟中距离寻书反馈
 * - 急促嘀嘀嘀：12 连音（嘀嘀嘀…），模拟极近距离寻书反馈
 *
 * 以及按 beep 等级（1~4）单独测试，模拟盖革计数器不同距离的蜂鸣反馈。
 */
@Composable
fun BeepTestScreen(
    onNavigateBack: () -> Unit,
    viewModel: BeepTestViewModel = androidx.lifecycle.viewmodel.compose.viewModel()
) {
    val state by viewModel.uiState.collectAsState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
    ) {
        // 顶部栏
        BeepTestTopBar(onBack = onNavigateBack)

        HorizontalDivider(thickness = 1.dp, color = Color(0xFFE0E0E0))

        // 内容区
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // 设备状态
            StatusCard(beepReady = state.beepReady)

            // 基础蜂鸣测试
            BasicBeepCard(
                isPlaying = state.isPlaying,
                playingMode = state.playingMode,
                beepReady = state.beepReady,
                onShortBeep = viewModel::playShortBeep,
                onDoubleBeeps = viewModel::playDoubleBeeps,
                onRapidBeeps = viewModel::playRapidBeeps,
                onStop = viewModel::stopPlaying
            )

            // Beep 等级测试（盖革计数器模拟）
            BeepLevelCard(
                isPlaying = state.isPlaying,
                beepReady = state.beepReady,
                onPlayLevel = viewModel::playByLevel
            )

            // 状态消息
            if (state.statusMessage.isNotBlank()) {
                StatusFooter(message = state.statusMessage)
            }
        }
    }
}

// ───────── 顶部栏 ─────────

@Composable
private fun BeepTestTopBar(onBack: () -> Unit) {
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
            text = "Beep 蜂鸣测试",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.weight(1f),
            textAlign = TextAlign.Center
        )
        Spacer(Modifier.width(64.dp))
    }
}

// ───────── 面板标题 ─────────

@Composable
private fun PanelTitle(title: String) {
    Text(
        text = "■ $title",
        style = MaterialTheme.typography.titleSmall,
        fontWeight = FontWeight.Bold,
        color = Color(0xFF333333),
        modifier = Modifier.padding(bottom = 6.dp)
    )
}

// ───────── 状态卡片 ─────────

@Composable
private fun StatusCard(beepReady: Boolean) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (beepReady) Color(0xFFE8F5E9) else Color(0xFFFFF3E0)
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Row(
            modifier = Modifier.padding(14.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = if (beepReady) "🔊" else "⚠",
                fontSize = 24.sp
            )
            Spacer(Modifier.width(12.dp))
            Column {
                Text(
                    text = if (beepReady) "BeepPlayer 已就绪" else "BeepPlayer 未就绪",
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.Bold,
                    color = if (beepReady) StatusGreen else StatusOrange
                )
                Text(
                    text = if (beepReady) {
                        "使用 Android ToneGenerator 产生系统蜂鸣音，无需额外音频资源"
                    } else {
                        "蜂鸣器初始化失败，可能设备不支持 ToneGenerator"
                    },
                    style = MaterialTheme.typography.bodySmall,
                    color = Color.DarkGray
                )
            }
        }
    }
}

// ───────── 基础蜂鸣测试卡片 ─────────

@Composable
private fun BasicBeepCard(
    isPlaying: Boolean,
    playingMode: String,
    beepReady: Boolean,
    onShortBeep: () -> Unit,
    onDoubleBeeps: () -> Unit,
    onRapidBeeps: () -> Unit,
    onStop: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = SectionBg),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(Modifier.padding(14.dp)) {
            PanelTitle("基础蜂鸣测试")

            if (isPlaying) {
                // 播放中状态
                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    color = Color(0xFFE3F2FD),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(20.dp),
                            color = StatusBlue,
                            strokeWidth = 2.dp
                        )
                        Spacer(Modifier.width(12.dp))
                        Text(
                            text = "播放中: $playingMode",
                            style = MaterialTheme.typography.bodyMedium,
                            fontWeight = FontWeight.Medium,
                            color = StatusBlue,
                            modifier = Modifier.weight(1f)
                        )
                        TextButton(
                            onClick = onStop,
                            colors = ButtonDefaults.textButtonColors(contentColor = StatusRed)
                        ) {
                            Text("停止", fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }

            Spacer(Modifier.height(12.dp))

            // 按钮行 1：短音
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Button(
                    onClick = onShortBeep,
                    enabled = beepReady && !isPlaying,
                    modifier = Modifier.weight(1f).height(56.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = StatusGreen),
                    shape = RoundedCornerShape(10.dp)
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("🔊 短音", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                        Text("~50ms", style = MaterialTheme.typography.labelSmall)
                    }
                }
            }

            Spacer(Modifier.height(10.dp))

            // 按钮行 2：滴滴连续音 + 急促嘀嘀嘀
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Button(
                    onClick = onDoubleBeeps,
                    enabled = beepReady && !isPlaying,
                    modifier = Modifier.weight(1f).height(56.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = StatusOrange),
                    shape = RoundedCornerShape(10.dp)
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("🔊🔊 滴滴连续音", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                        Text("4组双短音", style = MaterialTheme.typography.labelSmall)
                    }
                }

                Button(
                    onClick = onRapidBeeps,
                    enabled = beepReady && !isPlaying,
                    modifier = Modifier.weight(1f).height(56.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = StatusRed),
                    shape = RoundedCornerShape(10.dp)
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("🔊🔊🔊 急促嘀嘀嘀", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                        Text("12连音", style = MaterialTheme.typography.labelSmall)
                    }
                }
            }

            Spacer(Modifier.height(8.dp))

            Text(
                text = "提示：短音模拟单次标签读取确认；滴滴连续音模拟中距离寻书反馈；急促嘀嘀嘀模拟极近距离反馈。",
                style = MaterialTheme.typography.bodySmall,
                color = Color.Gray
            )
        }
    }
}

// ───────── Beep 等级测试卡片 ─────────

@Composable
private fun BeepLevelCard(
    isPlaying: Boolean,
    beepReady: Boolean,
    onPlayLevel: (Int) -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = SectionBg),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(Modifier.padding(14.dp)) {
            PanelTitle("Beep 等级测试（盖革计数器模拟）")

            Text(
                text = "模拟寻书模式中不同距离的蜂鸣反馈：",
                style = MaterialTheme.typography.bodySmall,
                color = Color.DarkGray
            )

            Spacer(Modifier.height(8.dp))

            // Lv1: 远距离
            LevelButton(
                level = 1,
                label = "远距离 (>2m)",
                description = "单短音，间隔约800ms",
                color = Color(0xFF9E9E9E),
                enabled = beepReady && !isPlaying,
                onClick = { onPlayLevel(1) }
            )

            Spacer(Modifier.height(6.dp))

            // Lv2: 中距离
            LevelButton(
                level = 2,
                label = "中距离 (1-2m)",
                description = "双短音「滴滴」，间隔约500ms",
                color = StatusOrange,
                enabled = beepReady && !isPlaying,
                onClick = { onPlayLevel(2) }
            )

            Spacer(Modifier.height(6.dp))

            // Lv3: 近距离
            LevelButton(
                level = 3,
                label = "近距离 (0.5-1m)",
                description = "三短音「滴滴滴」，间隔约300ms",
                color = Color(0xFF8BC34A),
                enabled = beepReady && !isPlaying,
                onClick = { onPlayLevel(3) }
            )

            Spacer(Modifier.height(6.dp))

            // Lv4: 极近
            LevelButton(
                level = 4,
                label = "极近 (<0.5m)",
                description = "急促连音「嘀嘀嘀嘀」，间隔约120ms",
                color = StatusGreen,
                enabled = beepReady && !isPlaying,
                onClick = { onPlayLevel(4) }
            )
        }
    }
}

@Composable
private fun LevelButton(
    level: Int,
    label: String,
    description: String,
    color: Color,
    enabled: Boolean,
    onClick: () -> Unit
) {
    Button(
        onClick = onClick,
        enabled = enabled,
        modifier = Modifier.fillMaxWidth().height(48.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = color.copy(alpha = 0.15f),
            contentColor = color,
            disabledContainerColor = DisabledBg,
            disabledContentColor = Color.Gray
        ),
        shape = RoundedCornerShape(8.dp),
        elevation = ButtonDefaults.buttonElevation(defaultElevation = 0.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "Lv$level",
                fontWeight = FontWeight.Bold,
                fontSize = 16.sp,
                modifier = Modifier.width(40.dp)
            )
            Text(
                text = label,
                fontWeight = FontWeight.Medium,
                modifier = Modifier.weight(1f)
            )
            Text(
                text = description,
                style = MaterialTheme.typography.bodySmall,
                color = Color.DarkGray
            )
        }
    }
}

// ───────── 底部状态条 ─────────

@Composable
private fun StatusFooter(message: String) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = if (message.startsWith("✅")) Color(0xFFE8F5E9)
                else if (message.startsWith("❌")) Color(0xFFFFEBEE)
                else Color(0xFFE3F2FD),
        shape = RoundedCornerShape(8.dp)
    ) {
        Text(
            text = message,
            modifier = Modifier.padding(12.dp),
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = FontWeight.Medium,
            textAlign = TextAlign.Center
        )
    }
}
