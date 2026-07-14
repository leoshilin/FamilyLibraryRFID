package com.familylibrary.rfidfinder.ui.debug

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.familylibrary.rfidfinder.rfid.RfidTag

// ───────── 颜色常量 ─────────

private val StatusGreen = Color(0xFF4CAF50)
private val StatusRed = Color(0xFFF44336)
private val StatusBlue = Color(0xFF1976D2)
private val StatusOrange = Color(0xFFE65100)
private val PanelBg = Color(0xFFF8F8F8)
private val SectionBg = Color(0xFFFFFFFF)
private val TagBg = Color(0xFFF0F4FF)
private val TagSelectedBg = Color(0xFFE3F2FD)
private val DisabledBg = Color(0xFFE0E0E0)

/**
 * RFID 标签读写调试页面。
 *
 * 提供底层 RFID 调试能力：
 * - 功率面板：显示当前读写功率，支持 ±1/±5 调节（范围 5-30 dBm）
 * - 连续读取面板：开始/停止循环读取，实时显示 RSSI/EPC/TID/读取次数
 * - EPC 写入面板：选择目标标签，输入 EPC 值，执行写入并显示结果
 */
@Composable
fun RfidTestScreen(
    onNavigateBack: () -> Unit,
    viewModel: RfidTestViewModel = androidx.lifecycle.viewmodel.compose.viewModel()
) {
    val state by viewModel.uiState.collectAsState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
    ) {
        // 顶部栏
        RfidTestTopBar(onBack = onNavigateBack)

        HorizontalDivider(thickness = 1.dp, color = Color(0xFFE0E0E0))

        // 可滚动内容区
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(12.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // 功率面板
            item {
                PowerPanel(
                    readPower = state.readPower,
                    writePower = state.writePower,
                    powerLoaded = state.powerLoaded,
                    powerError = state.powerError,
                    isReading = state.isReading,
                    onAdjustRead = viewModel::adjustReadPower,
                    onAdjustWrite = viewModel::adjustWritePower,
                    onReloadPower = viewModel::loadPower
                )
            }

            // 连续读取面板
            item {
                ReadingPanel(
                    isReading = state.isReading,
                    readCount = state.readCount,
                    tags = state.tags,
                    readError = state.readError,
                    onStart = viewModel::startReading,
                    onStop = viewModel::stopReading
                )
            }

            // EPC 写入面板
            item {
                WritePanel(
                    tags = state.tags,
                    selectedTid = state.selectedTid,
                    epcInput = state.epcInput,
                    isWriting = state.isWriting,
                    isReading = state.isReading,
                    writeResult = state.writeResult,
                    onSelectTid = viewModel::selectTid,
                    onEpcInput = viewModel::setEpcInput,
                    onWrite = viewModel::writeEpc
                )
            }

            // 底部间距
            item { Spacer(Modifier.height(16.dp)) }
        }
    }
}

// ───────── 顶部栏 ─────────

@Composable
private fun RfidTestTopBar(onBack: () -> Unit) {
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
            text = "RFID 标签读写",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.weight(1f),
            textAlign = TextAlign.Center
        )

        // 占位，保持标题居中
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

// ───────── 功率面板 ─────────

@Composable
private fun PowerPanel(
    readPower: Int,
    writePower: Int,
    powerLoaded: Boolean,
    powerError: String,
    isReading: Boolean,
    onAdjustRead: (Int) -> Unit,
    onAdjustWrite: (Int) -> Unit,
    onReloadPower: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = SectionBg),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(Modifier.padding(14.dp)) {
            PanelTitle("读写功率")

            if (!powerLoaded) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                    Spacer(Modifier.width(8.dp))
                    Text("加载中…", style = MaterialTheme.typography.bodyMedium, color = Color.Gray)
                }
            } else {
                // 读功率行
                PowerRow(
                    label = "读功率",
                    power = readPower,
                    isReading = isReading,
                    onAdjust = onAdjustRead
                )

                Spacer(Modifier.height(10.dp))

                // 写功率行
                PowerRow(
                    label = "写功率",
                    power = writePower,
                    isReading = isReading,
                    onAdjust = onAdjustWrite
                )

                // 错误提示 + 重新加载
                if (powerError.isNotBlank()) {
                    Spacer(Modifier.height(6.dp))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = powerError,
                            style = MaterialTheme.typography.bodySmall,
                            color = StatusRed,
                            modifier = Modifier.weight(1f)
                        )
                        TextButton(
                            onClick = onReloadPower,
                            contentPadding = PaddingValues(horizontal = 8.dp, vertical = 0.dp)
                        ) {
                            Text("重试", fontSize = 12.sp)
                        }
                    }
                }
            }
        }
    }
}

/** 单行功率调节控件。 */
@Composable
private fun PowerRow(
    label: String,
    power: Int,
    isReading: Boolean,
    onAdjust: (Int) -> Unit
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier.fillMaxWidth()
    ) {
        Text(
            text = "$label:",
            style = MaterialTheme.typography.bodyMedium,
            color = Color.DarkGray,
            modifier = Modifier.width(56.dp)
        )

        Spacer(Modifier.width(4.dp))

        // -5
        PowerButton("-5", enabled = power > MIN_POWER && !isReading, onClick = { onAdjust(-5) })
        Spacer(Modifier.width(4.dp))
        // -1
        PowerButton("-1", enabled = power > MIN_POWER && !isReading, onClick = { onAdjust(-1) })
        Spacer(Modifier.width(8.dp))

        // 当前功率值
        Box(
            modifier = Modifier
                .width(36.dp)
                .background(
                    color = if (isReading) DisabledBg else Color(0xFFE8F5E9),
                    shape = RoundedCornerShape(6.dp)
                )
                .padding(vertical = 4.dp),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = "$power",
                style = MaterialTheme.typography.bodyLarge,
                fontWeight = FontWeight.Bold,
                fontFamily = FontFamily.Monospace
            )
        }

        Spacer(Modifier.width(8.dp))
        // +1
        PowerButton("+1", enabled = power < MAX_POWER && !isReading, onClick = { onAdjust(+1) })
        Spacer(Modifier.width(4.dp))
        // +5
        PowerButton("+5", enabled = power < MAX_POWER && !isReading, onClick = { onAdjust(+5) })

        Spacer(Modifier.width(8.dp))

        Text(
            text = "dBm",
            style = MaterialTheme.typography.bodySmall,
            color = Color.Gray
        )
    }
}

@Composable
private fun PowerButton(label: String, enabled: Boolean, onClick: () -> Unit) {
    Button(
        onClick = onClick,
        enabled = enabled,
        contentPadding = PaddingValues(horizontal = 6.dp, vertical = 2.dp),
        modifier = Modifier.height(30.dp),
        shape = RoundedCornerShape(4.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = if (label.startsWith("-")) Color(0xFFFFCDD2) else Color(0xFFC8E6C9),
            contentColor = if (label.startsWith("-")) StatusRed else StatusGreen,
            disabledContainerColor = DisabledBg,
            disabledContentColor = Color.Gray
        ),
        elevation = ButtonDefaults.buttonElevation(defaultElevation = 0.dp)
    ) {
        Text(text = label, fontSize = 12.sp, fontWeight = FontWeight.Bold)
    }
}

// ───────── 连续读取面板 ─────────

@Composable
private fun ReadingPanel(
    isReading: Boolean,
    readCount: Int,
    tags: List<RfidTag>,
    readError: String,
    onStart: () -> Unit,
    onStop: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = SectionBg),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(Modifier.padding(14.dp)) {
            PanelTitle("连续读取")

            // 状态行
            Row(verticalAlignment = Alignment.CenterVertically) {
                // 状态指示圆点
                Box(
                    modifier = Modifier
                        .size(10.dp)
                        .background(
                            color = if (isReading) StatusGreen else Color.Gray,
                            shape = RoundedCornerShape(50)
                        )
                )
                Spacer(Modifier.width(6.dp))
                Text(
                    text = if (isReading) "读取中…" else "已停止",
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Medium,
                    color = if (isReading) StatusGreen else Color.Gray
                )
                Spacer(Modifier.weight(1f))
                Text(
                    text = "次数: $readCount",
                    style = MaterialTheme.typography.bodyMedium,
                    fontFamily = FontFamily.Monospace,
                    color = Color.DarkGray
                )
            }

            Spacer(Modifier.height(4.dp))

            Text(
                text = "当前标签数: ${tags.size}",
                style = MaterialTheme.typography.bodySmall,
                color = Color.Gray
            )

            // 错误提示
            if (readError.isNotBlank()) {
                Spacer(Modifier.height(4.dp))
                Text(
                    text = "⚠ $readError",
                    style = MaterialTheme.typography.bodySmall,
                    color = StatusOrange
                )
            }

            Spacer(Modifier.height(8.dp))

            // 标签列表
            if (tags.isNotEmpty()) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(PanelBg, RoundedCornerShape(8.dp))
                        .padding(8.dp)
                ) {
                    Text(
                        text = "标签列表:",
                        style = MaterialTheme.typography.labelMedium,
                        color = Color.DarkGray
                    )
                    Spacer(Modifier.height(4.dp))

                    tags.forEach { tag ->
                        TagInfoRow(tag)
                        if (tag != tags.last()) {
                            HorizontalDivider(
                                modifier = Modifier.padding(vertical = 4.dp),
                                thickness = 0.5.dp,
                                color = Color(0xFFE0E0E0)
                            )
                        }
                    }
                }
            } else if (!isReading && readCount > 0) {
                Text(
                    text = "（无标签被发现）",
                    style = MaterialTheme.typography.bodySmall,
                    color = Color.LightGray
                )
            }

            Spacer(Modifier.height(10.dp))

            // 操作按钮
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.Center
            ) {
                Button(
                    onClick = onStart,
                    enabled = !isReading,
                    colors = ButtonDefaults.buttonColors(containerColor = StatusGreen),
                    shape = RoundedCornerShape(8.dp),
                    contentPadding = PaddingValues(horizontal = 24.dp, vertical = 8.dp)
                ) {
                    Text("开始读取", fontWeight = FontWeight.Bold)
                }

                Spacer(Modifier.width(16.dp))

                Button(
                    onClick = onStop,
                    enabled = isReading,
                    colors = ButtonDefaults.buttonColors(containerColor = StatusRed),
                    shape = RoundedCornerShape(8.dp),
                    contentPadding = PaddingValues(horizontal = 24.dp, vertical = 8.dp)
                ) {
                    Text("停止读取", fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

/** 标签信息行（TID + EPC + RSSI）。 */
@Composable
private fun TagInfoRow(tag: RfidTag) {
    Column {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                text = "▸ TID: ${tag.tid}",
                style = MaterialTheme.typography.bodySmall,
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Medium
            )
            Spacer(Modifier.weight(1f))
            // RSSI 强度指示
            val rssiColor = when {
                tag.rssi > -40 -> StatusGreen
                tag.rssi > -60 -> StatusOrange
                else -> StatusRed
            }
            Text(
                text = "RSSI: ${tag.rssi}",
                style = MaterialTheme.typography.bodySmall,
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Bold,
                color = rssiColor
            )
        }
        if (tag.epc.isNotBlank()) {
            Text(
                text = "  EPC: ${tag.epc}",
                style = MaterialTheme.typography.bodySmall,
                fontFamily = FontFamily.Monospace,
                color = Color.DarkGray
            )
        }
    }
}

// ───────── EPC 写入面板 ─────────

@Composable
private fun WritePanel(
    tags: List<RfidTag>,
    selectedTid: String,
    epcInput: String,
    isWriting: Boolean,
    isReading: Boolean,
    writeResult: WriteResult?,
    onSelectTid: (String) -> Unit,
    onEpcInput: (String) -> Unit,
    onWrite: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = SectionBg),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(Modifier.padding(14.dp)) {
            PanelTitle("写入 EPC")

            // EPC 输入框
            OutlinedTextField(
                value = epcInput,
                onValueChange = onEpcInput,
                label = { Text("EPC 写入值（十六进制）") },
                singleLine = true,
                enabled = !isWriting,
                modifier = Modifier.fillMaxWidth(),
                textStyle = MaterialTheme.typography.bodyMedium.copy(
                    fontFamily = FontFamily.Monospace
                ),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Text)
            )

            Spacer(Modifier.height(12.dp))

            // 选择目标标签
            if (tags.isEmpty()) {
                Text(
                    text = "请先开始读取以发现标签",
                    style = MaterialTheme.typography.bodySmall,
                    color = Color.LightGray
                )
            } else {
                Text(
                    text = "选择目标标签:",
                    style = MaterialTheme.typography.labelMedium,
                    color = Color.DarkGray
                )
                Spacer(Modifier.height(4.dp))

                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(PanelBg, RoundedCornerShape(8.dp))
                        .padding(4.dp)
                ) {
                    tags.forEach { tag ->
                        TagSelectionRow(
                            tag = tag,
                            isSelected = selectedTid == tag.tid,
                            enabled = !isWriting && !isReading,
                            onSelect = { onSelectTid(tag.tid) }
                        )
                    }
                }
            }

            Spacer(Modifier.height(12.dp))

            // 写入按钮
            Button(
                onClick = onWrite,
                enabled = !isWriting && selectedTid.isNotBlank() && epcInput.isNotBlank(),
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(containerColor = StatusBlue),
                shape = RoundedCornerShape(8.dp),
                contentPadding = PaddingValues(vertical = 12.dp)
            ) {
                if (isWriting) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(20.dp),
                        color = Color.White,
                        strokeWidth = 2.dp
                    )
                    Spacer(Modifier.width(8.dp))
                    Text("写入中…", fontWeight = FontWeight.Bold)
                } else {
                    Text("写入 RFID", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                }
            }

            // 写入结果
            when (writeResult) {
                is WriteResult.Success -> {
                    Spacer(Modifier.height(8.dp))
                    Surface(
                        modifier = Modifier.fillMaxWidth(),
                        color = Color(0xFFE8F5E9),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Column(Modifier.padding(10.dp)) {
                            Text(
                                text = "✅ 写入成功",
                                style = MaterialTheme.typography.bodyMedium,
                                fontWeight = FontWeight.Bold,
                                color = StatusGreen
                            )
                            Text(
                                text = "TID: ${writeResult.tid}",
                                style = MaterialTheme.typography.bodySmall,
                                fontFamily = FontFamily.Monospace
                            )
                            Text(
                                text = "EPC: ${writeResult.epc}",
                                style = MaterialTheme.typography.bodySmall,
                                fontFamily = FontFamily.Monospace
                            )
                        }
                    }
                }
                is WriteResult.Failure -> {
                    Spacer(Modifier.height(8.dp))
                    Surface(
                        modifier = Modifier.fillMaxWidth(),
                        color = Color(0xFFFFEBEE),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Row(
                            modifier = Modifier.padding(10.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "❌ ",
                                style = MaterialTheme.typography.bodyMedium
                            )
                            Text(
                                text = "写入失败: ${writeResult.reason}",
                                style = MaterialTheme.typography.bodySmall,
                                color = StatusRed,
                                fontWeight = FontWeight.Medium
                            )
                        }
                    }
                }
                null -> { /* 无结果，不显示 */ }
            }
        }
    }
}

/** 标签选择行（RadioButton 风格）。 */
@Composable
private fun TagSelectionRow(
    tag: RfidTag,
    isSelected: Boolean,
    enabled: Boolean,
    onSelect: () -> Unit
) {
    val bgColor = if (isSelected) TagSelectedBg else Color.Transparent
    val borderColor = if (isSelected) StatusBlue else Color.Transparent

    Surface(
        onClick = { if (enabled) onSelect() },
        enabled = enabled,
        modifier = Modifier
            .fillMaxWidth()
            .padding(2.dp),
        shape = RoundedCornerShape(6.dp),
        color = bgColor,
        border = androidx.compose.foundation.BorderStroke(
            width = if (isSelected) 1.5.dp else 0.dp,
            color = borderColor
        )
    ) {
        Row(
            modifier = Modifier.padding(8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            RadioButton(
                selected = isSelected,
                onClick = { if (enabled) onSelect() },
                modifier = Modifier.size(20.dp),
                enabled = enabled,
                colors = RadioButtonDefaults.colors(
                    selectedColor = StatusBlue
                )
            )
            Spacer(Modifier.width(6.dp))
            Column {
                Text(
                    text = "TID: ${tag.tid}",
                    style = MaterialTheme.typography.bodySmall,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal
                )
                Text(
                    text = "RSSI: ${tag.rssi}  EPC: ${tag.epc.ifBlank { "(空)" }}",
                    style = MaterialTheme.typography.labelSmall,
                    fontFamily = FontFamily.Monospace,
                    color = Color.DarkGray
                )
            }
        }
    }
}
