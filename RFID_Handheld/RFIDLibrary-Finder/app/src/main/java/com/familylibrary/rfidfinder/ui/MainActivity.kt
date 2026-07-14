package com.familylibrary.rfidfinder.ui

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
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
import com.familylibrary.rfidfinder.ui.theme.RFIDLibraryFinderTheme
import kotlinx.serialization.json.Json

/**
 * 首页 Activity（任务台）。
 *
 * 使用 Jetpack Navigation Compose 管理路由：
 * - home：任务台首页（HomeScreen）
 * - bind：绑定 RFID 页面（BindScreen）
 *
 * DeviceTask 通过 kotlinx.serialization JSON 序列化后作为 NavArgument 传递。
 */
class MainActivity : ComponentActivity() {

    private val homeViewModel: HomeViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            RFIDLibraryFinderTheme {
                FinderNavHost(homeViewModel = homeViewModel)
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
}

/** 路由常量。 */
private object Routes {
    const val HOME = "home"
    const val BIND = "bind/{taskJson}"

    fun bindRoute(taskJson: String) = "bind/$taskJson"
}

/**
 * 应用导航宿主。
 *
 * 路由：
 * - home：任务台首页
 * - bind/{taskJson}：绑定 RFID 页面（taskJson 为 DeviceTask 的 JSON 序列化字符串）
 */
@Composable
private fun FinderNavHost(homeViewModel: HomeViewModel) {
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
                    // 将 DeviceTask 序列化为 JSON 传递到 bind 页面
                    val taskJson = json.encodeToString(DeviceTask.serializer(), task)
                    navController.navigate(Routes.bindRoute(taskJson))
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
                // 初始化 BindViewModel（仅在首次创建时）
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
    }
}

/**
 * 仅在 key 变化时执行一次的 LaunchedEffect。
 * 用于 BindViewModel 初始化，避免重复调用。
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
