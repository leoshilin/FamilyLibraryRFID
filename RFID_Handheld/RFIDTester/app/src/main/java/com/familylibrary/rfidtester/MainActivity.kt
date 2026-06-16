package com.familylibrary.rfidtester


import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll

import androidx.compose.material3.Text
import androidx.compose.material3.Button
import androidx.compose.material3.OutlinedTextField

import androidx.compose.runtime.*

import androidx.compose.ui.unit.dp
import androidx.compose.ui.Modifier

import android.os.Bundle

import com.familylibrary.rfidtester.ui.theme.RFIDTesterTheme
import com.handheld.uhfr.UHFRManager


class MainActivity : ComponentActivity() {

    //private var manager: UHFRManager? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        //manager = UHFRManager.getInstance()

        //enableEdgeToEdge()
        setContent {
            RFIDTesterTheme {
                RFIDTestScreen()
            }
        }
    }
}

@Composable
fun RFIDTestScreen() {
    //--------------------------------
    // 状态变量
    //--------------------------------
    var status by remember {
        mutableStateOf("未初始化")
    }

    var currentTid by remember {
        mutableStateOf("")
    }

    var currentEpc by remember {
        mutableStateOf("")
    }

    var currentRssi by remember {
        mutableStateOf("")
    }

    var powerValue by remember {
        mutableStateOf("30")
    }

    var epcToWrite by remember {
        mutableStateOf("")
    }

    //RFID读取时的filter：tid
    var tidFilter by remember {
        mutableStateOf("")
    }

    var verifyEpc by remember {
        mutableStateOf("")
    }

    //--------------------------------
    // UI
    //--------------------------------
    val scrollState = rememberScrollState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(scrollState)
            .padding(16.dp)
    ) {

        //--------------------------------
        // 初始化
        //--------------------------------
        Button(
            onClick = {

                try {

                    val manager =
                        UHFRManager.getInstance()

                    status =
                        if (manager != null)
                            "初始化成功"
                        else
                            "初始化失败"

                } catch (e: Exception) {

                    status =
                        "异常: ${e.message}"
                }
            }
        ) {

            Text("初始化RFID")
        }

        Spacer(modifier = Modifier.height(20.dp))

        // 读取标签按钮
        Button(
            onClick = {

                try {

                    val manager =
                        UHFRManager.getInstance()

                    val list =
                        manager.tagEpcTidInventoryByTimer(
                            50.toShort()
                        )

                    if (
                        list == null ||
                        list.isEmpty()
                    ) {

                        status =
                            "未发现标签"

                    } else {
                        //赋值给状态变量
                        val tag =
                            list[0]

                        currentEpc =
                            bytesToHex(tag.EpcId)

                        currentTid =
                            bytesToHex(tag.EmbededData)

                        currentRssi =
                            tag.RSSI.toString()

                        tidFilter =
                            currentTid

                        status =
                            "读取成功"
                    }

                } catch (e: Throwable) {

                    status =
                        e.toString()
                }
            }
        ) {
            Text("读取标签")
        }

        Spacer(modifier = Modifier.height(20.dp))

        Text(
            text =
                """
                EPC:
                $currentEpc

                TID:
                $currentTid

                RSSI:
                $currentRssi
                """.trimIndent()
        )

        Spacer(modifier = Modifier.height(20.dp))


        //--------------------------------
        // 功率输入
        //--------------------------------

        OutlinedTextField(
            value = powerValue,
            onValueChange = {
                powerValue = it
            },
            label = {
                Text("Power（5~30）")
            }
        )

        Spacer(modifier = Modifier.height(10.dp))

        //--------------------------------
        // 设置功率
        //--------------------------------

        Button(
            onClick = {

                try {

                    val manager =
                        UHFRManager.getInstance()

                    val power =
                        powerValue.toInt()

                    val result =
                        manager.setPower(
                            power,
                            power
                        )

                    status =
                        "SetPower: $result"

                } catch (e: Exception) {

                    status =
                        e.toString()
                }
            }
        ) {
            Text("设置功率")
        }

        Spacer(modifier = Modifier.height(10.dp))

        //--------------------------------
        // 获取功率
        //--------------------------------

        Button(
            onClick = {

                try {

                    val manager =
                        UHFRManager.getInstance()

                    val power =
                        manager.getPower()

                    status =
                        """
                        Read:
                        ${power?.get(0)}

                        Write:
                        ${power?.get(1)}
                        """.trimIndent()

                } catch (e: Exception) {

                    status =
                        e.toString()
                }
            }
        ) {
            Text("读取功率")
        }

        Spacer(modifier = Modifier.height(10.dp))

        //--------------------------------
        // EPC输入
        //--------------------------------
        OutlinedTextField(
            value = tidFilter,
            onValueChange = {
                tidFilter = it
            },
            label = {
                Text("TID Filter")
            }
        )

        OutlinedTextField(
            value = epcToWrite,
            onValueChange = {
                epcToWrite = it
            },
            label = {
                Text("New EPC")
            }
        )

        Spacer(modifier = Modifier.height(10.dp))

        //--------------------------------
        // 写EPC
        //--------------------------------

        Button(
            onClick = {

                try {

                    val manager =
                        UHFRManager.getInstance()

                    val result =
                        manager.writeTagEPCByFilter(
                            hexToBytes(epcToWrite),
                            hexToBytes("00000000"),
                            1000.toShort(),
                            hexToBytes(
                                tidFilter
                            ),
                            2,
                            0,
                            true
                        )

                    manager.setInventoryFilter(
                        hexToBytes(tidFilter),
                        2,
                        0,
                        true
                    )

                    val verify =
                        manager.tagInventoryByTimer(
                            50.toShort()
                        )

                    manager.setCancleInventoryFilter()

                    verifyEpc =
                        if (
                            verify != null &&
                            verify.isNotEmpty()
                        ) {
                            bytesToHex(
                                verify[0].EpcId
                            )
                        } else {
                            "验证失败"
                        }

                    status =
                        """
                        Write Result:
                        $result

                        Verify EPC:
                        $verifyEpc
                        """.trimIndent()

                } catch (e: Exception) {

                    status =
                        e.toString()
                }
            }
        ) {

            Text("写入EPC")
        }
        Spacer(modifier = Modifier.height(20.dp))

        //--------------------------------
        // 状态
        //--------------------------------

        Text("状态：$status")
    }
}

fun bytesToHex(
    bytes: ByteArray?
): String {

    if (bytes == null)
        return ""

    return bytes.joinToString("") {
        "%02X".format(it)
    }
}

fun hexToBytes(
    hex: String
): ByteArray {

    val clean =
        hex.replace(" ", "")

    return ByteArray(
        clean.length / 2
    ) {

        clean.substring(
            it * 2,
            it * 2 + 2
        ).toInt(16).toByte()
    }
}