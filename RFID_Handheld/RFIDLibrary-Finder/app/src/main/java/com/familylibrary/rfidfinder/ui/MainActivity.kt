package com.familylibrary.rfidfinder.ui

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Bundle
import android.util.Log
import android.view.KeyEvent
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.familylibrary.rfidfinder.cloud.model.DeviceTask
import com.familylibrary.rfidfinder.ui.bind.BindScreen
import com.familylibrary.rfidfinder.ui.bind.BindViewModel
import com.familylibrary.rfidfinder.ui.keytest.KeyTestScreen
import com.familylibrary.rfidfinder.ui.keytest.KeyTestViewModel
import com.familylibrary.rfidfinder.ui.theme.RFIDLibraryFinderTheme
import kotlinx.serialization.json.Json

private const val TAG = "MainActivity"

/**
 * 首页 Activity（任务台）。
 *
 * 使用 Jetpack Navigation Compose 管理路由：
 * - home：任务台首页（HomeScreen）
 * - bind：绑定 RFID 页面（BindScreen）
 * - keytest：按键/扫码测试页面（KeyTestScreen）
 *
 * DeviceTask 通过 kotlinx.serialization JSON 序列化后作为 NavArgument 传递。
 */
class MainActivity : ComponentActivity() {

    private val homeViewModel: HomeViewModel by viewModels()

    /** 按键测试 ViewModel（Activity 级别，跨页面保持）。 */
    private val keyTestViewModel: KeyTestViewModel by viewModels()

    /** 扫码广播接收器（PDA 扫码通常通过广播发送结果）。 */
    private var scanReceiver: BroadcastReceiver? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // 注册常见的扫码广播接收器
        registerScanReceivers()

        setContent {
            RFIDLibraryFinderTheme {
                FinderNavHost(
                    homeViewModel = homeViewModel,
                    keyTestViewModel = keyTestViewModel
                )
            }
        }
    }

    override fun onResume() {
        super.onResume()
        homeViewModel.onEnter()
    }

    override fun onPause() {
        super.onPause()
        homeViewModel.onLeave()
    }

    override fun onDestroy() {
        super.onDestroy()
        unregisterScanReceivers()
    }

    /**
     * 拦截所有 KeyEvent，在 keytest 页面时转发给 KeyTestViewModel。
     * 其他页面正常处理。
     */
    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        // 始终转发给测试 ViewModel（无论在哪个页面）
        keyTestViewModel.recordKeyEvent(event)
        // 不消费事件，继续正常传递
        return super.dispatchKeyEvent(event)
    }

    // ───────── 扫码广播 ─────────

    /**
     * 注册 PDA 常见的扫码广播接收器。
     *
     * 不同 PDA 厂家使用不同的 action，这里列出常见的几种。
     * 如果扫码数据仍无法获取，请在 keytest 页面查看实际广播 action。
     */
    private fun registerScanReceivers() {
        val receiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context?, intent: Intent?) {
                if (intent == null) return
                val data = intent.getStringExtra("data")
                    ?: intent.getStringExtra("SCAN_BARCODE1")
                    ?: intent.getStringExtra("barcode")
                    ?: intent.getStringExtra("value")
                    ?: intent.getStringExtra("scanData")
                    ?: intent.getByteArrayExtra("barocode")?.let { String(it) }
                    ?: return

                val codec = intent.getStringExtra("codec")
                    ?: intent.getStringExtra("codetype")
                    ?: ""

                Log.i(TAG, "扫码广播: action=${intent.action} data=$data codec=$codec extras=${intent.extras?.keySet()}")
                keyTestViewModel.recordScanResult(data, codec)
            }
        }

        // 常见 PDA 扫码广播 action
        val actions = arrayOf(
            "android.intent.action.SCANRESULT",           // 通用
            "com.android.server.scannerservice.broadcast", // 部分设备
            "com.hsm.barcode.BarcodeData",                // Honeywell
            "com.symbol.datawedge.api.RESULT_ACTION",     // Zebra DataWedge
            "com.dwexample.ACTION",                       // Zebra
            "scan.rcv",                                    // 通用
            "com.android.scanservice.scancontext",         // 部分国产 PDA
            "com.broadcast.barcode",                       // 通用
            "nlscan.action.SCANNER_RESULT",               // 新大陆
            "com.android.decodewedge.decode_action",       // 通用解码
            "com.hdhe.scantest"                            // 项目 SDK 扫描测试
        )

        val filter = IntentFilter()
        actions.forEach { filter.addAction(it) }
        // 也尝试用通配 Data Schema 注册
        try {
            filter.addDataType("*/*")
        } catch (_: Exception) { }

        scanReceiver = receiver
        try {
            registerReceiver(receiver, filter)
            Log.i(TAG, "扫码广播接收器已注册，监听 ${actions.size} 个 action")
        } catch (e: Exception) {
            Log.w(TAG, "注册扫码广播接收器失败: ${e.message}")
        }
    }

    private fun unregisterScanReceivers() {
        scanReceiver?.let {
            try { unregisterReceiver(it) } catch (_: Exception) { }
            scanReceiver = null
        }
    }
}

/** 路由常量。 */
private object Routes {
    const val HOME = "home"
    const val BIND = "bind/{taskJson}"
    const val KEY_TEST = "keytest"

    fun bindRoute(taskJson: String) = "bind/$taskJson"
}

/**
 * 应用导航宿主。
 *
 * 路由：
 * - home：任务台首页
 * - bind/{taskJson}：绑定 RFID 页面
 * - keytest：按键/扫码测试页面
 */
@Composable
private fun FinderNavHost(
    homeViewModel: HomeViewModel,
    keyTestViewModel: KeyTestViewModel
) {
    val navController = rememberNavController()
    val json = remember { Json { ignoreUnknownKeys = true } }

    // 监听导航变化：离开首页时取消轮询，回到首页时重新轮询
    val backStackEntry by navController.currentBackStackEntryAsState()
    DisposableEffect(backStackEntry) {
        val currentRoute = backStackEntry?.destination?.route
        if (currentRoute == Routes.HOME) {
            homeViewModel.onEnter()
        } else {
            homeViewModel.onLeave()
        }
        onDispose { }
    }

    NavHost(
        navController = navController,
        startDestination = Routes.HOME
    ) {
        // 首页（任务台）
        composable(Routes.HOME) {
            HomeScreen(
                viewModel = homeViewModel,
                onExecuteTask = { task ->
                    val taskJson = json.encodeToString(DeviceTask.serializer(), task)
                    navController.navigate(Routes.bindRoute(taskJson))
                },
                onNavigateToKeyTest = {
                    navController.navigate(Routes.KEY_TEST)
                }
            )
        }

        // 绑定 RFID 页面
        composable(
            route = Routes.BIND,
            arguments = listOf(
                navArgument("taskJson") { type = NavType.StringType }
            )
        ) { backStackEntry ->
            val taskJson = backStackEntry.arguments?.getString("taskJson") ?: ""
            val task = remember(taskJson) {
                try {
                    json.decodeFromString(DeviceTask.serializer(), taskJson)
                } catch (e: Exception) {
                    null
                }
            }

            if (task != null) {
                val bindViewModel: BindViewModel = viewModel()
                LaunchedEffectWithKey(task.taskId) {
                    bindViewModel.init(task)
                }
                BindScreen(
                    viewModel = bindViewModel,
                    onNavigateBack = {
                        navController.popBackStack(Routes.HOME, inclusive = false)
                    }
                )
            }
        }

        // 按键/扫码测试页面
        composable(Routes.KEY_TEST) {
            KeyTestScreen(
                viewModel = keyTestViewModel,
                onKeyEvent = { /* dispatchKeyEvent 已全局转发 */ },
                onNavigateBack = {
                    navController.popBackStack(Routes.HOME, inclusive = false)
                }
            )
        }
    }
}

/**
 * 仅在 key 变化时执行一次的 LaunchedEffect。
 */
@Composable
private fun LaunchedEffectWithKey(
    key: Any,
    block: suspend () -> Unit
) {
    androidx.compose.runtime.LaunchedEffect(key) {
        block()
    }
}
