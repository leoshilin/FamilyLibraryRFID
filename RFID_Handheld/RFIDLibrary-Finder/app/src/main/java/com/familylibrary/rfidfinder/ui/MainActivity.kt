package com.familylibrary.rfidfinder.ui

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import com.familylibrary.rfidfinder.ui.theme.RFIDLibraryFinderTheme

/**
 * 首页 Activity（任务台）。
 *
 * 使用 HomeViewModel 驱动状态机：
 * - 进入页面即触发任务轮询（onResume）
 * - 离开页面取消轮询定时器与进行中请求（onPause）
 * - 5s 自动轮询 IDLE 态
 *
 * 后续：通过 Jetpack Navigation Compose 集成路由至 bind / find / recent 页面。
 */
class MainActivity : ComponentActivity() {

    private val homeViewModel: HomeViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            RFIDLibraryFinderTheme {
                HomeScreen(viewModel = homeViewModel)
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
