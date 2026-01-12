.PHONY: build-all build-agent build-cli build-tui build-gui run-agent run-tui run-gui install-gui dev-gui clean

ROOT := $(abspath $(dir $(lastword $(MAKEFILE_LIST))))
BIN := $(ROOT)/bin

# Build everything (agent, TUI, and GUI)
build-all: build-agent build-tui build-gui

# Build the Go agent (HTTP API server)
build-agent:
	mkdir -p $(BIN)
	cd go-app && go build -o $(BIN)/docklite-agent ./cmd/docklite-agent

# Build the CLI tool (alias for TUI)
build-cli: build-tui

# Build the standalone TUI client
build-tui:
	mkdir -p $(BIN)
	cd cli-repo && go build -o $(BIN)/docklite-tui .

# Build the Next.js GUI for production
build-gui:
	cd webapp && npm install && npm run build

# Install GUI dependencies only (without building)
install-gui:
	cd webapp && npm install

# Run the agent in development mode
run-agent:
	cd go-app && go run ./cmd/docklite-agent

# Run the TUI in development mode
run-tui:
	cd cli-repo && go run .

# Run the GUI in development mode (port 3000)
run-gui:
	cd webapp && npm run dev

# Run the GUI in production mode (port 3000)
dev-gui:
	cd webapp && npm run dev

# Start GUI in production mode (port 3000, or use PORT env var)
start-gui:
	cd webapp && npm start

# Clean built binaries and Next.js build artifacts
clean:
	rm -rf $(BIN)
	rm -rf webapp/.next
	rm -rf webapp/node_modules
