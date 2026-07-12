# 厂家 RFID SDK 视为第三方代码，禁止混淆/裁剪其类与 native 方法。
# 发布包当前未开启 minify（见 app/build.gradle.kts），此处保留以备后续启用。

# 保留 SDK 公共 API 与其 native 方法
-keep class com.handheld.** { *; }
-keep class com.uhf.** { *; }
-keep class com.example.** { *; }
-keep class com.reader.** { *; }
-keep class **.UHFRManager { *; }

# 保留 JNI 桥接类（含 native 方法）
-keepclasseswithmembernames class * {
    native <methods>;
}

# 保留 kotlinx.serialization 生成的序列化器
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.**
