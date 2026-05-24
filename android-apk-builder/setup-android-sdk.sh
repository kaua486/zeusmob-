#!/usr/bin/env bash
# ╔══════════════════════════════════════════════════╗
# ║     ZEUS MOB — Android SDK Setup Script          ║
# ║  Instala OpenJDK 17 + Android SDK automatico     ║
# ╚══════════════════════════════════════════════════╝

set -e

CYAN='\033[0;36m'
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

SDK_DIR="$HOME/android-sdk"
CMDTOOLS_VERSION="11076708"
CMDTOOLS_URL="https://dl.google.com/android/repository/commandlinetools-linux-${CMDTOOLS_VERSION}_latest.zip"
BUILD_TOOLS_VERSION="34.0.0"
PLATFORM_VERSION="android-34"

echo -e "${CYAN}=== ZEUS MOB — Android SDK Setup ===${NC}"
echo ""

# ── 1. Verificar/instalar Java 17 ─────────────────
echo -e "${CYAN}[1/5] Verificando Java...${NC}"
if command -v java &>/dev/null; then
  JVER=$(java -version 2>&1 | awk -F '"' '/version/ {print $2}' | cut -d'.' -f1)
  echo -e "${GREEN}✓ Java $JVER encontrado${NC}"
else
  echo "Instalando OpenJDK 17..."
  # Ubuntu/Debian
  if command -v apt-get &>/dev/null; then
    sudo apt-get update -qq && sudo apt-get install -y openjdk-17-jdk
  # macOS via Homebrew
  elif command -v brew &>/dev/null; then
    brew install openjdk@17
    sudo ln -sfn "$(brew --prefix)/opt/openjdk@17/libexec/openjdk.jdk" \
      "/Library/Java/JavaVirtualMachines/openjdk-17.jdk"
  else
    echo -e "${RED}Por favor instale manualmente: https://adoptium.net/${NC}"
    exit 1
  fi
fi

# ── 2. Baixar Android command-line tools ──────────
echo -e "${CYAN}[2/5] Baixando Android SDK command-line tools...${NC}"
mkdir -p "$SDK_DIR/cmdline-tools"
TMPZIP="/tmp/cmdtools.zip"

curl -fsSL "$CMDTOOLS_URL" -o "$TMPZIP"
unzip -qo "$TMPZIP" -d "$SDK_DIR/cmdline-tools/"
mv "$SDK_DIR/cmdline-tools/cmdline-tools" "$SDK_DIR/cmdline-tools/latest" 2>/dev/null || true
rm -f "$TMPZIP"
echo -e "${GREEN}✓ Command-line tools instalados${NC}"

# ── 3. Configurar variáveis de ambiente ───────────
echo -e "${CYAN}[3/5] Configurando ANDROID_HOME...${NC}"
export ANDROID_HOME="$SDK_DIR"
export PATH="$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools"

SHELL_RC="$HOME/.bashrc"
[ -f "$HOME/.zshrc" ] && SHELL_RC="$HOME/.zshrc"

grep -qxF "export ANDROID_HOME=$SDK_DIR" "$SHELL_RC" || {
  echo "" >> "$SHELL_RC"
  echo "# Android SDK — ZEUS MOB" >> "$SHELL_RC"
  echo "export ANDROID_HOME=$SDK_DIR" >> "$SHELL_RC"
  echo 'export PATH="$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools"' >> "$SHELL_RC"
}
echo -e "${GREEN}✓ ANDROID_HOME=$SDK_DIR${NC}"

# ── 4. Aceitar licenças e instalar SDK ────────────
echo -e "${CYAN}[4/5] Instalando plataforma Android 34 + Build Tools...${NC}"
yes | sdkmanager --licenses > /dev/null 2>&1 || true
sdkmanager \
  "platform-tools" \
  "platforms;$PLATFORM_VERSION" \
  "build-tools;$BUILD_TOOLS_VERSION" \
  "ndk;25.2.9519653"
echo -e "${GREEN}✓ SDK instalado${NC}"

# ── 5. Criar debug keystore se necessário ─────────
echo -e "${CYAN}[5/5] Verificando keystore de debug...${NC}"
mkdir -p "$HOME/.android"
if [ ! -f "$HOME/.android/debug.keystore" ]; then
  keytool -genkey -v \
    -keystore "$HOME/.android/debug.keystore" \
    -alias androiddebugkey \
    -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass android -keypass android \
    -dname "CN=Android Debug,O=Android,C=US" \
    -storetype pkcs12
  echo -e "${GREEN}✓ Debug keystore criado${NC}"
else
  echo -e "${GREEN}✓ Debug keystore já existe${NC}"
fi

echo ""
echo -e "${GREEN}╔══════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  Setup concluído! Para buildar:      ║${NC}"
echo -e "${GREEN}║  chmod +x build-apk.sh               ║${NC}"
echo -e "${GREEN}║  ./build-apk.sh                      ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════╝${NC}"
