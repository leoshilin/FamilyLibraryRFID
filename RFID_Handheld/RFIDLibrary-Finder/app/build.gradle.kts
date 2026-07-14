import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
}

// 读取 local.properties（gitignore，不入库）中的微信云开发配置。
// 缺失时回退为空串，保证工程可编译；运行时无配置则云调用失败（预期由使用者补充）。
val localProperties = Properties().apply {
    val localFile = rootProject.file("local.properties")
    if (localFile.exists()) {
        localFile.inputStream().use { load(it) }
    }
}

// 取配置，缺省为空串
fun prop(key: String): String = localProperties.getProperty(key, "")

android {
    namespace = "com.familylibrary.rfidfinder"
    compileSdk {
        version = release(36) {
            minorApiLevel = 1
        }
    }

    defaultConfig {
        applicationId = "com.familylibrary.rfidfinder"
        minSdk = 24
        targetSdk = 36
        // 版本号：开发者可在此处修改，编译后自动更新到 App 中
        // versionCode = 整数，用于 Google Play 发布判断
        // versionName = 可读版本号，显示在首页底部方便 debug
        versionCode = 1
        versionName = "1.0.0"

        // 将版本号注入 BuildConfig，供 UI 层读取显示
        buildConfigField("String", "APP_VERSION_NAME", "\"${versionName}\"")

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"

        // 微信云开发配置（来源：local.properties，不入库）
        buildConfigField("String", "WECHAT_APP_ID", "\"${prop("wechat.appId")}\"")
        buildConfigField("String", "WECHAT_APP_SECRET", "\"${prop("wechat.appSecret")}\"")
        buildConfigField("String", "WECHAT_ENV_ID", "\"${prop("wechat.envId")}\"")
    }

    buildTypes {
        release {
            // 厂家 RFID SDK 含反射/动态加载，发布包也先关闭优化，避免误裁。
            // 后续如需混淆，再开启并在 proguard-rules.pro 中保留 SDK 类。
            optimization {
                enable = false
            }
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
    buildFeatures {
        compose = true
        buildConfig = true
    }
}

dependencies {
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.graphics)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    testImplementation(libs.junit)
    androidTestImplementation(platform(libs.androidx.compose.bom))
    androidTestImplementation(libs.androidx.compose.ui.test.junit4)
    androidTestImplementation(libs.androidx.espresso.core)
    androidTestImplementation(libs.androidx.junit)
    debugImplementation(libs.androidx.compose.ui.test.manifest)
    debugImplementation(libs.androidx.compose.ui.tooling)

    // 厂家 RFID SDK（jar 由 app/libs 引入，so 由 jniLibs 引入）
    implementation(fileTree("libs") {
        include("*.jar")
    })

    // 网络：直连微信云开发 HTTP API
    implementation(libs.okhttp)
    // 协程：suspend 风格的云端/RFID 客户端
    implementation(libs.kotlinx.coroutines.android)
    // JSON 解析：云函数返回体
    implementation(libs.kotlinx.serialization.json)
    // 导航：Jetpack Navigation Compose（页面路由）
    implementation(libs.androidx.navigation.compose)
}
