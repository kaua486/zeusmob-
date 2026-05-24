# ProGuard rules for ZeusMob APK

# Keep application class
-keep class com.zeusmob.app.** { *; }

# Keep accessibility service
-keep class * extends android.accessibilityservice.AccessibilityService { *; }

# Keep activity, service, receiver, provider
-keep public class * extends android.app.Activity
-keep public class * extends android.app.Service
-keep public class * extends android.content.BroadcastReceiver
-keep public class * extends android.content.ContentProvider

# AndroidX
-keep class androidx.** { *; }
-dontwarn androidx.**

# Material
-keep class com.google.android.material.** { *; }

# WorkManager
-keep class androidx.work.** { *; }

# Suppress warnings
-dontwarn java.lang.invoke.*
-dontwarn **$$Lambda$*
