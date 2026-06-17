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
import kotlinx.coroutines.delay

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

    var foundTags by remember {
        mutableStateOf<List<Pair<String,String>>>(emptyList())
    }
    // Pair<TID,EPC>

    var selectedTid by remember {
        mutableStateOf("")
    }

    var tracking by remember {
        mutableStateOf(false)
    }

    var trackingRssi by remember {
        mutableStateOf("")
    }

    var trackingPower by remember {
        mutableStateOf(30)
    }

    var trackingDistance by remember {
        mutableStateOf("")
    }

    var beepLevel by remember {
        mutableStateOf(0)
    }

    val scrollState = rememberScrollState()

    LaunchedEffect(tracking) {

        while (tracking) {

            try {

                val manager =
                    UHFRManager.getInstance()

                //
                // 当前功率
                //
                manager.setPower(
                    trackingPower,
                    30
                )

                //
                // 根据TID过滤读取
                //
                val data =
                    manager.getTagDataByFilter(
                        1,
                        2,
                        6,
                        hexToBytes("00000000"),
                        100.toShort(),
                        hexToBytes(selectedTid),
                        2,
                        0,
                        true
                    )

                if (
                    data != null &&
                    data.isNotEmpty()
                ) {

                    //
                    // 获取RSSI
                    //
                    val list =
                        manager.tagEpcTidInventoryByTimer(
                            50.toShort()
                        )

                    val target =
                        list?.firstOrNull {

                            bytesToHex(
                                it.EmbededData
                            ) == selectedTid
                        }

                    if (target != null) {

                        val rssi =
                            target.RSSI

                        trackingRssi =
                            rssi.toString()

                        //--------------------------------
                        // 自动切换功率
                        //--------------------------------

                        if ( trackingPower == 30) {

                            if (rssi > -40) {
                                trackingPower = 20
                            }

                        } else if (trackingPower == 20) {

                            if (rssi>-30) {

                                trackingPower = 10

                            } else if (rssi < -50){

                                trackingPower = 30

                            }

                        } else { //trackingPower == 10

                            if (rssi < -40) {
                                trackingPower = 20
                            }

                        }

                        //--------------------------------
                        // 距离判断
                        //--------------------------------

                        when (trackingPower) {

                            30 -> {

                                if (rssi < -60) {

                                    trackingDistance =
                                        "2米以上"

                                    beepLevel = 1

                                } else {

                                    trackingDistance =
                                        "1~2米"

                                    beepLevel = 2
                                }
                            }

                            20 -> {

                                trackingDistance =
                                    "0.5~1米"

                                beepLevel = 3
                            }

                            10 -> {

                                trackingDistance =
                                    "0.5米以内"

                                beepLevel = 4
                            }
                        }

                    }
                }

            } catch (e: Exception) {

                status =
                    e.toString()
            }

            delay(300)
        }
    }

    //--------------------------------
    // UI
    //--------------------------------


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
        Spacer(modifier = Modifier.height(20.dp))

        //--------------------------------
        // 搜索标签
        //--------------------------------

        Button(
            onClick = {

                try {

                    val manager =
                        UHFRManager.getInstance()

                    val list =
                        manager.tagEpcTidInventoryByTimer(
                            100.toShort()
                        )

                    if (
                        list == null ||
                        list.isEmpty()
                    ) {

                        status = "未发现标签"

                    } else {

                        foundTags =
                            list.take(3).map {

                                Pair(
                                    bytesToHex(
                                        it.EmbededData
                                    ),
                                    bytesToHex(
                                        it.EpcId
                                    )
                                )
                            }
                    }

                } catch (e: Exception) {

                    status = e.toString()
                }
            }
        ) {
            Text("搜索标签")
        }

        Spacer(modifier = Modifier.height(20.dp))

        foundTags.forEachIndexed { index, pair ->

            Button(
                onClick = {

                    selectedTid =
                        pair.first

                    status =
                        "已选择标签${index + 1}"
                }
            ) {

                Text(
                    "标签${index + 1}\n" +
                            pair.second.take(12)
                )
            }

            Spacer(
                modifier =
                    Modifier.height(8.dp)
            )
        }

        Button(
            onClick = {

                if (
                    selectedTid.isBlank()
                ) {

                    status =
                        "请先选择标签"

                } else {

                    trackingPower = 30

                    tracking = true
                }

            }
        ) {

            Text("开始跟踪")
        }

        Button(
            onClick = {

                tracking = false

            }
        ) {

            Text("停止跟踪")
        }

        Spacer(
            modifier =
                Modifier.height(20.dp)
        )

        Text(
            """
            跟踪TID:
            $selectedTid
        
            Power:
            $trackingPower
        
            RSSI:
            $trackingRssi
        
            距离:
            $trackingDistance
        
            Beep:
            $beepLevel
            """.trimIndent()
        )



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

