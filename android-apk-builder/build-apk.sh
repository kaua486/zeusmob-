#!/usr/bin/env bash
# ╔══════════════════════════════════════════════════╗
# ║         ZEUS MOB — Build APK Script              ║
# ║   Gera APK Release + Debug para Android 10+      ║
# ╚══════════════════════════════════════════════════╝

set -e

RED='\033[0;31m'
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${CYAN}"
echo "  ╔══════════════════════════════════════╗"
echo "  ║        ZEUS MOB — APK Builder        ║"
echo "  ║   minSdk 24 | targetSdk 34 | ARM64   ║"
echo "  ╚══════════════════════════════════════╝"
echo -e "${NC}"

# ── Verificar dependências ─────────────────────────
check_dependency() {
  if ! command -v "$1" &>/dev/null; then
    echo -e "${RED}ERRO: '$1' não encontrado.${NC}"
    echo -e "Instale com: $2"
    exit 1
  fi
}

check_dependency java  "https://adoptium.net/ (OpenJDK 17)"
check_dependency curl  "apt install curl / brew install curl"

JAVA_VERSION=$(java -version 2>&1 | awk -F '"' '/version/ {print $2}' | cut -d'.' -f1)
if [ "$JAVA_VERSION" -lt 17 ] 2>/dev/null; then
  echo -e "${YELLOW}AVISO: Java ${JAVA_VERSION} detectado. Recomendado: Java 17+${NC}"
fi

# ── Verificar ANDROID_HOME ─────────────────────────
if [ -z "$ANDROID_HOME" ]; then
  # Tentar locais comuns
  for candidate in \
      "$HOME/Library/Android/sdk" \
      "$HOME/Android/Sdk" \
      "/usr/local/android-sdk" \
      "/opt/android-sdk"; do
    if [ -d "$candidate" ]; then
      export ANDROID_HOME="$candidate"
      break
    fi
  done
fi

if [ -z "$ANDROID_HOME" ]; then
  echo -e "${RED}ERRO: ANDROID_HOME não definido.${NC}"
  echo ""
  echo "Instale o Android SDK:"
  echo "  1. Android Studio: https://developer.android.com/studio"
  echo "  2. Ou command-line tools: https://developer.android.com/studio#command-tools"
  echo ""
  echo "Depois defina:"
  echo "  export ANDROID_HOME=\$HOME/Android/Sdk"
  echo "  export PATH=\$PATH:\$ANDROID_HOME/cmdline-tools/latest/bin:\$ANDROID_HOME/platform-tools"
  exit 1
fi

echo -e "${GREEN}✓ ANDROID_HOME: $ANDROID_HOME${NC}"
echo -e "${GREEN}✓ Java: $(java -version 2>&1 | head -1)${NC}"
echo ""

# ── Dar permissão ao gradlew ───────────────────────
chmod +x ./gradlew

# ── Limpar builds anteriores ───────────────────────
echo -e "${CYAN}[1/4] Limpando builds anteriores...${NC}"
./gradlew clean --quiet

# ── Build DEBUG ────────────────────────────────────
echo -e "${CYAN}[2/4] Gerando APK Debug...${NC}"
./gradlew assembleDebug \
  --stacktrace \
  --no-daemon \
  -Pandroid.injected.testOnly=false

DEBUG_APK=$(find app/build/outputs/apk/debug -name "*.apk" | head -1)
echo -e "${GREEN}✓ Debug APK: $DEBUG_APK${NC}"

# ── Build RELEASE ──────────────────────────────────
echo -e "${CYAN}[3/4] Gerando APK Release...${NC}"
./gradlew assembleRelease \
  --stacktrace \
  --no-daemon

RELEASE_APK=$(find app/build/outputs/apk/release -name "*.apk" | head -1)
echo -e "${GREEN}✓ Release APK: $RELEASE_APK${NC}"

# ── Resultado ──────────────────────────────────────
echo ""
echo -e "${CYAN}[4/4] APKs gerados com sucesso!${NC}"
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  APKs prontos para instalar:                     ║${NC}"
echo -e "${GREEN}╠══════════════════════════════════════════════════╣${NC}"

if [ -f "$RELEASE_APK" ]; then
  SIZE=$(du -sh "$RELEASE_APK" | cut -f1)
  echo -e "${GREEN}║  RELEASE: $(basename "$RELEASE_APK") ($SIZE)${NC}"
fi
if [ -f "$DEBUG_APK" ]; then
  SIZE=$(du -sh "$DEBUG_APK" | cut -f1)
  echo -e "${GREEN}║  DEBUG:   $(basename "$DEBUG_APK") ($SIZE)${NC}"
fi

echo -e "${GREEN}╠══════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║  Localização: app/build/outputs/apk/             ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${CYAN}Para instalar no dispositivo:${NC}"
echo "  adb install -r $RELEASE_APK"
