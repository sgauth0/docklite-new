#!/usr/bin/env bash
set -euo pipefail

# DockLite Quick Installer
# This script helps set up DockLite on a new machine

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== DockLite Quick Installer ===${NC}"
echo ""

# Parse arguments
SKIP_DEPS=""
SKIP_BUILD=""
FULL_INSTALL=""

for arg in "$@"; do
    case $arg in
        --skip-deps)
            SKIP_DEPS="1"
            shift
            ;;
        --skip-build)
            SKIP_BUILD="1"
            shift
            ;;
        --full)
            FULL_INSTALL="1"
            shift
            ;;
        --help|-h)
            echo "DockLite Quick Installer"
            echo ""
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --skip-deps    Skip installing system dependencies"
            echo "  --skip-build   Skip building Go binaries"
            echo "  --full         Full installation (creates systemd services)"
            echo "  --help, -h     Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0              # Standard install (no systemd)"
            echo "  $0 --full       # Full install with systemd services"
            echo "  $0 --skip-build # Skip building (use pre-built binaries)"
            exit 0
            ;;
    esac
done

# Check OS
if [[ -f /etc/os-release ]]; then
    . /etc/os-release
    OS=$ID
    OS_VERSION=$VERSION_ID
else
    echo -e "${RED}Cannot detect OS${NC}"
    exit 1
fi

echo -e "${BLUE}Detected OS: $OS $OS_VERSION${NC}"
echo ""

# 1. Check Docker
check_docker() {
    if ! command -v docker >/dev/null 2>&1; then
        echo -e "${RED}Docker is not installed${NC}"
        return 1
    fi

    if ! docker info >/dev/null 2>&1; then
        echo -e "${RED}Docker is not running${NC}"
        echo "Please start Docker:"
        echo "  sudo systemctl start docker"
        return 1
    fi

    # Check if user is in docker group
    if ! groups | grep -q docker; then
        echo -e "${YELLOW}Your user is not in the docker group${NC}"
        echo "Add yourself with:"
        echo "  sudo usermod -aG docker \$USER"
        echo "Then log out and back in."
        return 1
    fi

    echo -e "${GREEN}✓ Docker is installed and running${NC}"
    return 0
}

# 2. Check Node.js
check_node() {
    if ! command -v node >/dev/null 2>&1; then
        echo -e "${RED}Node.js is not installed${NC}"
        return 1
    fi

    local node_version=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [[ $node_version -lt 18 ]]; then
        echo -e "${RED}Node.js version must be 18 or higher (found $(node -v))${NC}"
        return 1
    fi

    echo -e "${GREEN}✓ Node.js $(node -v) is installed${NC}"
    return 0
}

# 3. Check Go (optional, for building)
check_go() {
    if ! command -v go >/dev/null 2>&1; then
        echo -e "${YELLOW}Go is not installed${NC}"
        echo "Go is needed to build the binaries from source."
        echo "You can:"
        echo "  1. Install Go and run: make build-all"
        echo "  2. Use pre-built binaries if available"
        return 1
    fi

    local go_version=$(go version | awk '{print $3}' | sed 's/go//')
    local major=$(echo $go_version | cut -d'.' -f1)
    local minor=$(echo $go_version | cut -d'.' -f2)

    if [[ $major -lt 1 ]] || [[ $major -eq 1 && $minor -lt 22 ]]; then
        echo -e "${YELLOW}Go version should be 1.22+ (found $go_version)${NC}"
        return 1
    fi

    echo -e "${GREEN}✓ Go $go_version is installed${NC}"
    return 0
}

# Install dependencies for Ubuntu/Debian
install_ubuntu_deps() {
    echo -e "${BLUE}Installing system dependencies...${NC}"
    sudo apt-get update -y
    sudo apt-get install -y \
        curl \
        git \
        ca-certificates \
        rsync \
        openssl

    # Install Docker if not present
    if ! command -v docker >/dev/null 2>&1; then
        echo -e "${BLUE}Installing Docker...${NC}"
        curl -fsSL https://get.docker.com | sh
        sudo usermod -aG docker $USER
        echo -e "${YELLOW}Please log out and back in for Docker group changes to take effect${NC}"
    fi

    # Install Node.js if not present
    if ! command -v node >/dev/null 2>&1 || [[ $(node -v | cut -d'v' -f2 | cut -d'.' -f1) -lt 18 ]]; then
        echo -e "${BLUE}Installing Node.js 20.x...${NC}"
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt-get install -y nodejs
    fi
}

# Main installation flow
main() {
    # Check dependencies unless skipped
    if [[ -z "$SKIP_DEPS" ]]; then
        echo -e "${BLUE}Checking dependencies...${NC}"
        echo ""

        check_docker || {
            if [[ "$OS" == "ubuntu" ]] || [[ "$OS" == "debian" ]]; then
                echo -e "${YELLOW}Would you like to install missing dependencies? (y/N)${NC}"
                read -r answer
                if [[ "$answer" =~ ^[Yy]$ ]]; then
                    install_ubuntu_deps
                else
                    echo -e "${RED}Installation cancelled${NC}"
                    exit 1
                fi
            else
                echo -e "${RED}Please install the missing dependencies manually${NC}"
                exit 1
            fi
        }

        check_node || {
            echo -e "${RED}Please install Node.js 18+ manually${NC}"
            exit 1
        }

        echo ""
    fi

    # Build binaries unless skipped
    if [[ -z "$SKIP_BUILD" ]]; then
        if check_go; then
            echo -e "${BLUE}Building DockLite binaries...${NC}"
            if [[ ! -d "bin" ]]; then
                mkdir -p bin
            fi

            # Build agent
            echo "Building agent..."
            cd go-app && go build -o ../bin/docklite-agent ./cmd/docklite-agent && cd ..
            if [[ -f "bin/docklite-agent" ]]; then
                echo -e "${GREEN}✓ Agent binary built${NC}"
            else
                echo -e "${RED}✗ Agent build failed${NC}"
                exit 1
            fi

            # Build TUI
            echo "Building TUI..."
            cd cli-repo && go build -o ../bin/docklite-tui . && cd ..
            if [[ -f "bin/docklite-tui" ]]; then
                echo -e "${GREEN}✓ TUI binary built${NC}"
            else
                echo -e "${YELLOW}⚠ TUI build failed (optional)${NC}"
            fi

            echo ""
        else
            if [[ -z "$SKIP_DEPS" ]]; then
                echo -e "${YELLOW}Skipping binary build (Go not installed)${NC}"
                echo "If pre-built binaries exist in bin/, installation will continue."
            fi
        fi
    fi

    # Install Node.js dependencies
    if [[ ! -d "webapp/node_modules" ]]; then
        echo -e "${BLUE}Installing Node.js dependencies...${NC}"
        cd webapp && npm install && cd ..
        echo -e "${GREEN}✓ Node.js dependencies installed${NC}"
        echo ""
    fi

    # Build Next.js app
    if [[ ! -d "webapp/.next" ]]; then
        echo -e "${BLUE}Building Next.js app...${NC}"
        cd webapp && npm run build && cd ..
        echo -e "${GREEN}✓ Next.js app built${NC}"
        echo ""
    fi

    # Create data directory
    mkdir -p data logs

    # Full installation (systemd services)
    if [[ -n "$FULL_INSTALL" ]]; then
        echo -e "${BLUE}Setting up systemd services...${NC}"
        echo -e "${YELLOW}This will install DockLite as a system service${NC}"
        echo -e "${YELLOW}Requires sudo privileges${NC}"
        echo ""
        read -p "Continue? (y/N) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            if [[ -f "webapp/scripts/install.sh" ]]; then
                bash webapp/scripts/install.sh
            else
                echo -e "${RED}System installer not found${NC}"
                exit 1
            fi
        else
            echo -e "${YELLOW}Skipping systemd installation${NC}"
        fi
        echo ""
    fi

    # Success!
    echo -e "${GREEN}=== Installation Complete! ===${NC}"
    echo ""
    echo -e "${BLUE}Next steps:${NC}"
    echo ""
    echo "  Quick start:"
    echo "    ./start-fullstack.sh"
    echo ""
    echo "  Headless mode:"
    echo "    ./start-agent.sh"
    echo ""
    echo "  TUI client:"
    echo "    ./start-tui.sh"
    echo ""
    echo "  Stop all services:"
    echo "    ./stop-all.sh"
    echo ""
    echo -e "${BLUE}Web GUI will be available at:${NC} http://localhost:3000"
    echo -e "${BLUE}Default credentials:${NC} superadmin / admin"
    echo ""
    echo -e "${YELLOW}⚠ IMPORTANT: Change the default password after first login!${NC}"
    echo ""

    # Check if binaries exist
    if [[ ! -f "bin/docklite-agent" ]]; then
        echo -e "${YELLOW}⚠ Warning: Agent binary not found${NC}"
        echo "Build it with: make build-agent"
    fi
}

main
