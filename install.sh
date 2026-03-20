#!/usr/bin/env bash
# DockLite Installer
# Usage: sudo bash install.sh
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_DIR"

# ── colours ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

step()  { echo -e "\n${BOLD}── $* ──${NC}"; }
ok()    { echo -e "  ${GREEN}✓${NC} $*"; }
warn()  { echo -e "  ${YELLOW}⚠${NC}  $*"; }
die()   { echo -e "  ${RED}✗${NC}  $*" >&2; exit 1; }

SUDO=""
[[ "${EUID}" -ne 0 ]] && SUDO="sudo"

DOCKLITE_USER="docklite"
AGENT_ENV_FILE="/etc/docklite/docklite-agent.env"
WEB_ENV_FILE="/etc/docklite/docklite-web.env"
INSTALL_DIR="/opt/docklite"
SITE_BASE="/var/www/sites"

# ── helpers ────────────────────────────────────────────────────────────────────
ask() {
  local var="$1" prompt="$2" default="$3"
  local input
  echo -en "${BLUE}${prompt}${NC} ${YELLOW}[${default}]${NC}: "
  read -r input
  printf -v "$var" '%s' "${input:-$default}"
}

ask_yn() {
  local prompt="$1" default="${2:-Y}"
  local input
  echo -en "${BLUE}${prompt}${NC} ${YELLOW}(${default}/$([ "$default" = Y ] && echo n || echo Y))${NC}: "
  read -r input
  input="${input:-$default}"
  [[ "${input^^}" == "Y" ]]
}

detect_existing() {
  [[ -f "$AGENT_ENV_FILE" ]]
}

# ── stop any running DockLite instances ────────────────────────────────────────
stop_docklite() {
  step "Stopping existing DockLite"
  local stopped=0
  for svc in docklite-agent docklite-web docklite; do
    if $SUDO systemctl is-active "${svc}.service" >/dev/null 2>&1; then
      $SUDO systemctl stop "${svc}.service" 2>/dev/null && ok "Stopped ${svc}.service"
      stopped=1
    fi
  done
  if pgrep -x docklite-agent >/dev/null 2>&1; then
    $SUDO pkill -9 -x docklite-agent 2>/dev/null && ok "Killed stray docklite-agent process"
    stopped=1
  fi
  [[ $stopped -eq 0 ]] && ok "No running DockLite instances found"
}

# ── auto-write .dkl manifests for previously-managed containers ───────────────
# Silently writes .dkl files for any Docker container labelled
# docklite.managed=true that has a site directory on disk but is missing its
# manifest. This preserves discoverability across reinstalls.
write_dkl_for_managed_containers() {
  step "Preserving .dkl manifests for previously-managed containers"
  if ! command -v docker >/dev/null 2>&1; then
    warn "docker not found — skipping manifest preservation"
    return
  fi
  local written=0 skipped=0
  while IFS= read -r cid; do
    [[ -z "$cid" ]] && continue
    local domain template_type username internal_port include_www
    domain=$(docker inspect --format '{{index .Config.Labels "docklite.domain"}}' "$cid" 2>/dev/null || true)
    [[ -z "$domain" ]] && continue
    template_type=$(docker inspect --format '{{index .Config.Labels "docklite.template_type"}}' "$cid" 2>/dev/null || echo "static")
    [[ -z "$template_type" ]] && template_type="static"
    username=$(docker inspect --format '{{index .Config.Labels "docklite.username"}}' "$cid" 2>/dev/null || echo "docklite")
    [[ -z "$username" ]] && username="docklite"
    internal_port=$(docker inspect --format '{{index .Config.Labels "docklite.internal_port"}}' "$cid" 2>/dev/null || echo "80")
    [[ -z "$internal_port" ]] && internal_port="80"
    include_www=$(docker inspect --format '{{index .Config.Labels "docklite.include_www"}}' "$cid" 2>/dev/null || echo "false")
    [[ -z "$include_www" ]] && include_wow="false"
    local code_path="${SITE_BASE}/${username}/${domain}"
    local dkl_path="${code_path}/.dkl"
    if [[ ! -d "$code_path" ]]; then
      skipped=$((skipped+1))
      continue
    fi
    if [[ -f "$dkl_path" ]]; then
      ok ".dkl exists: ${domain}"
      skipped=$((skipped+1))
      continue
    fi
    # Write the manifest using python3
    local img="nginx:alpine"
    [[ "$template_type" == "node" ]] && img="node:20-alpine"
    local include_www_bool="false"
    [[ "$include_www" == "true" ]] && include_www_bool="true"
    python3 -c "
import json; from datetime import datetime, timezone
print(json.dumps({'version':'1','domain':'${domain}','templateType':'${template_type}',
  'image':'${img}','internalPort':int('${internal_port}'),'port':3000,
  'includeWww':${include_www_bool},'username':'${username}',
  'createdAt':datetime.now(timezone.utc).isoformat().replace('+00:00','Z')},indent=2))
" > "$dkl_path" 2>/dev/null \
      && ok "Wrote .dkl: ${domain}" && written=$((written+1)) \
      || warn "Failed to write .dkl for ${domain}"
  done < <(docker ps -a --filter "label=docklite.managed=true" --format "{{.ID}}" 2>/dev/null || true)
  if [[ $written -eq 0 && $skipped -eq 0 ]]; then
    ok "No previously-managed containers found"
  elif [[ $written -gt 0 ]]; then
    ok "${written} manifest(s) written — these sites are now discoverable by DockLite"
  fi
}

# ── system packages ────────────────────────────────────────────────────────────
install_system_packages() {
  step "System packages"
  $SUDO apt-get update -qq
  $SUDO apt-get install -y -q \
    ca-certificates curl git rsync openssl unzip \
    build-essential pkg-config libsqlite3-dev python3
  ok "System packages installed"
}

install_docker() {
  step "Docker"
  if command -v docker >/dev/null 2>&1; then
    ok "Docker already installed: $(docker --version | head -1)"
    return
  fi
  curl -fsSL https://get.docker.com | $SUDO sh
  $SUDO usermod -aG docker "${DOCKLITE_USER}" 2>/dev/null || true
  ok "Docker installed"
}

install_nginx_if_needed() {
  [[ -z "${1:-}" ]] && return
  if command -v nginx >/dev/null 2>&1; then
    ok "Nginx already installed"
    return
  fi
  $SUDO apt-get install -y -q nginx && ok "Nginx installed"
}

# ── runtimes ───────────────────────────────────────────────────────────────────
BUN_CMD="/usr/local/bin/bun"

install_bun() {
  if [[ -x /usr/local/bin/bun ]]; then
    ok "Bun already installed: $(/usr/local/bin/bun --version)"
    return
  fi
  echo "  Installing bun..."
  local arch; arch="$(uname -m)"
  case "${arch}" in x86_64) arch="x64" ;; aarch64) arch="aarch64" ;; *) die "Unsupported arch: ${arch}" ;; esac
  curl -fsSL "https://github.com/oven-sh/bun/releases/latest/download/bun-linux-${arch}.zip" -o /tmp/bun.zip
  unzip -o /tmp/bun.zip -d /tmp/bun-install >/dev/null
  $SUDO install -m 0755 "/tmp/bun-install/bun-linux-${arch}/bun" /usr/local/bin/bun
  rm -rf /tmp/bun.zip /tmp/bun-install
  ok "Bun installed: $(/usr/local/bin/bun --version)"
}

install_node() {
  if command -v node >/dev/null 2>&1; then ok "Node.js already installed: $(node -v)"; return; fi
  echo "  Installing Node.js 22.x..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | $SUDO bash - >/dev/null 2>&1
  $SUDO apt-get install -y -q nodejs && ok "Node.js installed: $(node -v)"
}

install_go() {
  if command -v go >/dev/null 2>&1 || [[ -x /usr/local/go/bin/go ]]; then
    ok "Go already installed: $(PATH=/usr/local/go/bin:$PATH go version)"; return
  fi
  local ver="1.22.6" arch; arch="$(uname -m)"
  [[ "$arch" == "x86_64" ]] && arch="amd64"; [[ "$arch" == "aarch64" ]] && arch="arm64"
  echo "  Installing Go ${ver}..."
  curl -fsSL "https://go.dev/dl/go${ver}.linux-${arch}.tar.gz" -o /tmp/go.tgz
  $SUDO rm -rf /usr/local/go && $SUDO tar -C /usr/local -xzf /tmp/go.tgz && rm -f /tmp/go.tgz
  ok "Go installed: $(PATH=/usr/local/go/bin:$PATH go version)"
}

# ── user + directories ─────────────────────────────────────────────────────────
setup_user_and_dirs() {
  step "User and directories"
  if id "$DOCKLITE_USER" >/dev/null 2>&1; then
    ok "User already exists: ${DOCKLITE_USER}"
  else
    $SUDO useradd --system --create-home --home-dir "$INSTALL_DIR" \
      --shell /usr/sbin/nologin "$DOCKLITE_USER"
    ok "Created user: ${DOCKLITE_USER}"
  fi
  $SUDO usermod -aG docker "$DOCKLITE_USER" 2>/dev/null || true
  if [[ "$REPO_DIR" != "$INSTALL_DIR" ]]; then
    echo "  Copying files to ${INSTALL_DIR}..."
    $SUDO mkdir -p "$INSTALL_DIR"
    $SUDO rsync -a --delete \
      --exclude node_modules --exclude .next --exclude data \
      --exclude "*.log" --exclude ".git" --exclude ".bun" \
      "${REPO_DIR}/" "${INSTALL_DIR}/"
    ok "Files copied to ${INSTALL_DIR}"
  else
    ok "Using in-place directory: ${INSTALL_DIR}"
  fi
  $SUDO mkdir -p "${INSTALL_DIR}/data" "${INSTALL_DIR}/logs" /etc/docklite "$SITE_BASE"
  $SUDO chown -R "${DOCKLITE_USER}:${DOCKLITE_USER}" "${INSTALL_DIR}" /etc/docklite 2>/dev/null || true
  ok "Directories ready"
}

# ── config ─────────────────────────────────────────────────────────────────────
write_config() {
  local agent_port="$1" install_mode="$2" admin_user="$3" admin_pass="$4"
  step "Configuration"
  local nextjs_url="http://127.0.0.1:3001"
  [[ "$install_mode" == "headless" ]] && nextjs_url="disabled"
  local token; token=$(openssl rand -hex 32)
  $SUDO tee "$AGENT_ENV_FILE" >/dev/null <<EOF
LISTEN_ADDR=:${agent_port}
NEXTJS_URL=${nextjs_url}
DOCKER_SOCKET_PATH=unix:///var/run/docker.sock
DATABASE_PATH=${INSTALL_DIR}/data/docklite.db
DOCKLITE_TOKEN=${token}
EOF
  ok "Agent env written"
  if [[ "$install_mode" != "headless" ]]; then
    local session_secret; session_secret=$(openssl rand -hex 48)
    $SUDO tee "$WEB_ENV_FILE" >/dev/null <<EOF
NODE_ENV=production
PORT=3001
AGENT_URL=http://127.0.0.1:${agent_port}
AGENT_TOKEN=${token}
DATABASE_PATH=${INSTALL_DIR}/data/docklite.db
SESSION_SECRET=${session_secret}
SEED_ADMIN_USERNAME=${admin_user}
SEED_ADMIN_PASSWORD=${admin_pass}
EOF
    ok "Web env written"
  fi
}

# ── build ──────────────────────────────────────────────────────────────────────
build_gui() {
  local dir="$1" port="$2"
  echo "  Installing Node dependencies..."
  sudo -u "$DOCKLITE_USER" bash -lc "cd '${dir}/webapp' && ${BUN_CMD} install" 2>&1 | tail -2
  ok "Node dependencies installed"
  echo "  Building Next.js..."
  sudo -u "$DOCKLITE_USER" bash -lc \
    "cd '${dir}/webapp' && AGENT_URL=http://127.0.0.1:${port} ${BUN_CMD} run build" 2>&1 | tail -3
  ok "Next.js built"
}

build_agent() {
  sudo -u "$DOCKLITE_USER" bash -lc \
    "cd '${1}/go-app' && PATH=/usr/local/go/bin:/usr/bin:/bin go build -buildvcs=false -o ../bin/docklite-agent ./cmd/docklite-agent/." \
    && ok "Agent binary built" || warn "Agent build failed"
}

build_tui() {
  sudo -u "$DOCKLITE_USER" bash -lc \
    "cd '${1}/cli-repo' && PATH=/usr/local/go/bin:/usr/bin:/bin go build -buildvcs=false -o ../bin/docklite-tui ." \
    && ok "TUI binary built" || warn "TUI build failed (optional)"
}

# ── systemd ────────────────────────────────────────────────────────────────────
install_services() {
  local install_mode="$1"
  step "Systemd services"
  $SUDO sed "s|__INSTALL_DIR__|${INSTALL_DIR}|g" \
    "${INSTALL_DIR}/webapp/scripts/systemd/docklite-agent.service" | \
    $SUDO tee /etc/systemd/system/docklite-agent.service >/dev/null
  if [[ "$install_mode" != "headless" ]]; then
    $SUDO sed "s|__INSTALL_DIR__|${INSTALL_DIR}|g" \
      "${INSTALL_DIR}/webapp/scripts/systemd/docklite-web.service" | \
      $SUDO tee /etc/systemd/system/docklite-web.service >/dev/null
    $SUDO sed -i "s|WorkingDirectory=${INSTALL_DIR}$|WorkingDirectory=${INSTALL_DIR}/webapp|" \
      /etc/systemd/system/docklite-web.service
    $SUDO sed -i "s|ExecStart=.*bun run start.*|ExecStart=${BUN_CMD} run start|" \
      /etc/systemd/system/docklite-web.service
  fi
  $SUDO systemctl daemon-reload
  $SUDO systemctl enable docklite-agent 2>/dev/null || true
  [[ "$install_mode" != "headless" ]] && $SUDO systemctl enable docklite-web 2>/dev/null || true
  ok "Services installed"
}

install_sudoers() {
  $SUDO tee /etc/sudoers.d/docklite-nginx >/dev/null <<EOF
${DOCKLITE_USER} ALL=(ALL) NOPASSWD: /usr/sbin/nginx
EOF
  $SUDO chmod 440 /etc/sudoers.d/docklite-nginx
  ok "Sudoers rule installed"
}

wait_for_agent() {
  local port="$1" token="$2" i=0
  echo -n "  Waiting for agent"
  while [[ $i -lt 20 ]]; do
    if curl -sf -H "Authorization: Bearer ${token}" \
        "http://127.0.0.1:${port}/api/health" >/dev/null 2>&1; then
      echo ""; return 0
    fi
    echo -n "."; sleep 1; i=$((i+1))
  done
  echo ""; warn "Agent not responding after 20s — journalctl -u docklite-agent"
  return 1
}

# ══════════════════════════════════════════════════════════════════════════════
# FRESH INSTALL
# ══════════════════════════════════════════════════════════════════════════════
run_fresh_install() {
  stop_docklite

  step "Install mode"
  echo "  1) Full stack  — Web GUI + Agent (recommended)"
  echo "  2) Headless    — Agent only, TUI/API access"
  echo ""
  local mode_choice=""
  while [[ "$mode_choice" != "1" && "$mode_choice" != "2" ]]; do
    echo -en "${BLUE}Choose mode${NC} ${YELLOW}[1]${NC}: "; read -r mode_choice; mode_choice="${mode_choice:-1}"
  done
  local INSTALL_MODE="full"
  [[ "$mode_choice" == "2" ]] && INSTALL_MODE="headless"
  ok "Mode: ${INSTALL_MODE}"

  step "Network"
  local AGENT_PORT; ask AGENT_PORT "Agent port" "3000"
  ok "Agent will listen on :${AGENT_PORT}"

  step "Admin account"
  local ADMIN_USERNAME ADMIN_PASSWORD
  ask ADMIN_USERNAME "Admin username" "superadmin"
  if ask_yn "Use default password (supersecretpassword123)? Change after first login." "Y"; then
    ADMIN_PASSWORD="supersecretpassword123"
    warn "Using default password — change it after first login!"
  else
    local p1 p2
    while true; do
      echo -en "${BLUE}Admin password${NC}: "; read -rs p1; echo
      echo -en "${BLUE}Confirm${NC}: ";        read -rs p2; echo
      [[ "$p1" == "$p2" ]] && break
      echo -e "  ${RED}Passwords do not match.${NC}"
    done
    ADMIN_PASSWORD="$p1"
  fi
  ok "Admin account: ${ADMIN_USERNAME}"

  step "Options"
  local INSTALL_SERVICE="" INSTALL_NGINX="" BUILD_SOURCE=""
  ask_yn "Install DockLite as a systemd service (auto-start on boot)?" "Y" && INSTALL_SERVICE="1"
  [[ -n "$INSTALL_SERVICE" ]] && ok "Will install systemd service" || warn "Skipping systemd"
  ask_yn "Install/use nginx as a reverse proxy?" "Y" && INSTALL_NGINX="1"
  [[ -n "$INSTALL_NGINX" ]] && ok "Will configure nginx" || warn "Skipping nginx"
  if command -v go >/dev/null 2>&1 || [[ -x /usr/local/go/bin/go ]]; then
    ask_yn "Build Go binaries from source?" "Y" && BUILD_SOURCE="1"
  else
    warn "Go not found — will use pre-built binaries if available"
  fi

  echo ""
  echo -e "${CYAN}${BOLD}── Summary ────────────────────────────────────────${NC}"
  echo -e "  Mode:         ${BOLD}${INSTALL_MODE}${NC}"
  echo -e "  Agent port:   ${BOLD}:${AGENT_PORT}${NC}"
  echo -e "  Admin user:   ${BOLD}${ADMIN_USERNAME}${NC}"
  echo -e "  Systemd:      ${BOLD}$([ -n "$INSTALL_SERVICE" ] && echo yes || echo no)${NC}"
  echo -e "  Nginx:        ${BOLD}$([ -n "$INSTALL_NGINX"   ] && echo yes || echo no)${NC}"
  echo -e "  Build source: ${BOLD}$([ -n "$BUILD_SOURCE"    ] && echo yes || echo no)${NC}"
  echo -e "${CYAN}${BOLD}───────────────────────────────────────────────────${NC}"
  echo ""
  ask_yn "Proceed?" "Y" || { echo "Aborted."; exit 0; }

  install_system_packages
  install_docker
  install_nginx_if_needed "$INSTALL_NGINX"

  step "Runtime"
  install_node; install_bun; install_go

  setup_user_and_dirs
  write_config "$AGENT_PORT" "$INSTALL_MODE" "$ADMIN_USERNAME" "$ADMIN_PASSWORD"

  step "Building"
  [[ "$INSTALL_MODE" != "headless" ]] && build_gui "$INSTALL_DIR" "$AGENT_PORT"
  if [[ -n "$BUILD_SOURCE" ]]; then
    build_agent "$INSTALL_DIR"; build_tui "$INSTALL_DIR"
  elif [[ -f "${REPO_DIR}/bin/docklite-agent" ]]; then
    $SUDO cp "${REPO_DIR}/bin/docklite-agent" "${INSTALL_DIR}/bin/docklite-agent"
    ok "Pre-built agent binary copied"
  fi
  $SUDO chown -R "${DOCKLITE_USER}:${DOCKLITE_USER}" "${INSTALL_DIR}/bin" 2>/dev/null || true

  if [[ -n "$INSTALL_SERVICE" ]]; then
    install_services "$INSTALL_MODE"
    install_sudoers
    step "Starting services"
    $SUDO systemctl start docklite-agent
    [[ "$INSTALL_MODE" != "headless" ]] && $SUDO systemctl start docklite-web
    ok "Services started"
  fi

  # After install: silently write .dkl manifests for previously-managed containers
  write_dkl_for_managed_containers

  local token
  token=$(grep -E '^DOCKLITE_TOKEN=' "$AGENT_ENV_FILE" | cut -d= -f2)
  [[ -n "$INSTALL_SERVICE" ]] && wait_for_agent "$AGENT_PORT" "$token" || true

  echo ""
  echo -e "${CYAN}${BOLD}╔══════════════════════════════════════════════════╗${NC}"
  echo -e "${CYAN}${BOLD}║        DockLite installed successfully!          ║${NC}"
  echo -e "${CYAN}${BOLD}╚══════════════════════════════════════════════════╝${NC}"
  echo ""
  echo -e "  Access:  ${BOLD}http://<your-server-ip>:${AGENT_PORT}${NC}"
  echo -e "  Login:   ${BOLD}${ADMIN_USERNAME}${NC} / (your password)"
  [[ -n "$INSTALL_SERVICE" ]] && echo -e "  Env:     ${BLUE}${AGENT_ENV_FILE}${NC}"
  echo ""
  [[ "$ADMIN_PASSWORD" == "supersecretpassword123" ]] && \
    warn "Change the default password at: Settings → Password"
  echo ""
}

# ══════════════════════════════════════════════════════════════════════════════
# REPAIR
# ══════════════════════════════════════════════════════════════════════════════
run_repair() {
  step "Detecting installation"
  local AGENT_PORT="3000" INSTALL_MODE="full"
  if [[ -f "$AGENT_ENV_FILE" ]]; then
    local addr; addr=$(grep -E '^LISTEN_ADDR=' "$AGENT_ENV_FILE" | cut -d= -f2 || true)
    AGENT_PORT="${addr#:}"; [[ -z "$AGENT_PORT" ]] && AGENT_PORT="3000"
    local nextjs; nextjs=$(grep -E '^NEXTJS_URL=' "$AGENT_ENV_FILE" | cut -d= -f2 || true)
    [[ "$nextjs" == "disabled" ]] && INSTALL_MODE="headless"
    ok "Installation at ${INSTALL_DIR}, port :${AGENT_PORT}"
  fi

  local agent_binary="" gui_built="" agent_running=""
  [[ -f "${INSTALL_DIR}/bin/docklite-agent" ]]  && agent_binary="1"
  [[ -d "${INSTALL_DIR}/webapp/.next" ]]          && gui_built="1"
  $SUDO systemctl is-active docklite-agent >/dev/null 2>&1 && agent_running="1" || true

  echo ""
  echo -e "  Agent binary:  ${BOLD}$([ -n "$agent_binary"  ] && echo found   || echo missing)${NC}"
  echo -e "  Next.js build: ${BOLD}$([ -n "$gui_built"     ] && echo found   || echo missing)${NC}"
  echo -e "  Agent service: ${BOLD}$([ -n "$agent_running" ] && echo running || echo stopped)${NC}"
  echo ""

  if ask_yn "  Reinstall Node dependencies + rebuild Next.js?" "$([ -z "$gui_built" ] && echo Y || echo N)"; then
    step "Building GUI"
    build_gui "$INSTALL_DIR" "$AGENT_PORT"
  fi

  if command -v go >/dev/null 2>&1 || [[ -x /usr/local/go/bin/go ]]; then
    if ask_yn "  Rebuild Go agent binary from source?" "$([ -z "$agent_binary" ] && echo Y || echo N)"; then
      step "Building agent"
      build_agent "$INSTALL_DIR"; build_tui "$INSTALL_DIR"
    fi
  fi

  if ask_yn "  Fix file permissions?" "Y"; then
    step "Permissions"
    $SUDO chown -R "${DOCKLITE_USER}:${DOCKLITE_USER}" "$INSTALL_DIR" /etc/docklite 2>/dev/null || true
    $SUDO chmod 600 "${INSTALL_DIR}/data/docklite.db" 2>/dev/null || true
    ok "Permissions fixed"
  fi

  install_sudoers

  if ask_yn "  Restart services?" "$([ -z "$agent_running" ] && echo Y || echo N)"; then
    step "Services"
    $SUDO systemctl daemon-reload
    $SUDO systemctl restart docklite-agent
    [[ "$INSTALL_MODE" != "headless" ]] && $SUDO systemctl restart docklite-web 2>/dev/null || true
    ok "Services restarted"
  fi

  write_dkl_for_managed_containers

  echo ""
  ok "Repair complete — http://<your-server-ip>:${AGENT_PORT}"
  echo ""
}

# ══════════════════════════════════════════════════════════════════════════════
# ENTRY POINT
# ══════════════════════════════════════════════════════════════════════════════
echo ""
echo -e "${CYAN}${BOLD}╔══════════════════════════════════════╗${NC}"
echo -e "${CYAN}${BOLD}║        DockLite Installer            ║${NC}"
echo -e "${CYAN}${BOLD}╚══════════════════════════════════════╝${NC}"
echo ""

if detect_existing; then
  echo -e "  Existing installation detected at ${BLUE}${INSTALL_DIR}${NC}."
  echo ""
  echo "  1) Fresh install  — clean reinstall (keeps all site data + Docker containers)"
  echo "  2) Repair         — fix a broken or stopped installation"
  echo ""
  ENTRY_CHOICE=""
  while [[ "$ENTRY_CHOICE" != "1" && "$ENTRY_CHOICE" != "2" ]]; do
    echo -en "${BLUE}Choose${NC} ${YELLOW}[2]${NC}: "; read -r ENTRY_CHOICE; ENTRY_CHOICE="${ENTRY_CHOICE:-2}"
  done
  echo ""
  if [[ "$ENTRY_CHOICE" == "1" ]]; then
    run_fresh_install
  else
    run_repair
  fi
else
  echo -e "  No existing installation found."
  echo -e "  Press ${YELLOW}Enter${NC} to accept defaults."
  echo ""
  run_fresh_install
fi
