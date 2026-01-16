
# DockLite Gemini Agent Context

This document provides context for the Gemini agent to understand the DockLite project.

## Project Overview

DockLite is a minimal Docker management system with three modes of operation:

1.  **Headless:** Agent only (no GUI)
2.  **TUI:** Terminal UI client
3.  **Full Stack:** Web GUI + Agent + TUI

The project is composed of three main components:

*   **Go Agent (`docklite-agent`):** A Go-based API server that interacts with the Docker API and manages a SQLite database for metadata.
*   **Next.js Web GUI:** A web-based dashboard for managing Docker containers, databases, files, and more.
*   **Go TUI (`docklite-tui`):** A terminal-based UI for interacting with the agent.

## Architecture

The core of the project is the `docklite-agent`, which serves as a bridge between the UIs (web and TUI) and the Docker daemon. It exposes a RESTful API for managing Docker resources.

### Full Stack Mode

*   The Next.js GUI runs on port 3001.
*   The agent runs on port 3000 and proxies requests to the Next.js GUI.
*   The TUI connects to the agent on port 3000.

### Headless Mode

*   The agent runs on port 3000.
*   The TUI connects to the agent on port 3000.
*   The Next.js GUI is disabled.

## Key Files

*   `README.md`: Project overview and quick start guide.
*   `Makefile`: Build and run scripts.
*   `start-fullstack.sh`: Script to start the full stack (agent + GUI).
*   `go-app/cmd/docklite-agent/main.go`: Entry point for the Go agent.
*   `webapp/package.json`: Dependencies and scripts for the Next.js GUI.
*   `cli-repo/main.go`: Entry point for the TUI.
*   `go-app/internal/api/router.go`: API routes handled by the agent.
*   `DEPLOYMENT.md`: Detailed deployment guide.

## Building and Running

### Building

The project can be built using the `Makefile`:

```bash
# Build everything (agent, TUI, and GUI)
make build-all

# Build the agent only
make build-agent

# Build the TUI only
make build-tui

# Build the Next.js GUI
make build-gui
```

### Running

#### Full Stack

To run the full stack (agent + GUI), use the `start-fullstack.sh` script:

```bash
./start-fullstack.sh
```

This will start the agent on port 3000 and the GUI on port 3001. The application will be accessible at `http://localhost:3000`.

#### Development Mode

The `Makefile` provides targets for running the components in development mode:

```bash
# Run the agent in development mode
make run-agent

# Run the TUI in development mode
make run-tui

# Run the GUI in development mode
make run-gui
```

## Development Conventions

*   **Backend:** The backend is written in Go. Dependencies are managed with Go modules.
*   **Frontend:** The frontend is a Next.js application written in TypeScript. Dependencies are managed with npm.
*   **API:** The agent exposes a RESTful API for managing Docker resources. Authentication is done via a bearer token.
*   **Database:** The agent uses a SQLite database to store metadata.
*   **Styling:** The frontend uses Tailwind CSS for styling.
