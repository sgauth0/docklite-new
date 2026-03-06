# DockLite Gemini Agent Context

This document provides context for the Gemini agent to understand the DockLite project.

## Project Overview

DockLite is a comprehensive Docker management system designed for flexibility and ease of use. It operates in three distinct modes:

1.  **Full Stack:** Web GUI + Agent + TUI (Best for production, team access).
2.  **Headless:** Agent only (API) (Best for remote servers, automation).
3.  **TUI:** Terminal UI client (Best for terminal enthusiasts, SSH access).

## Directory Structure & Components

The project is organized into three main component directories:

*   **`go-app/` (Backend Agent):**
    *   **Description:** A Go-based API server that bridges the UI and the Docker daemon.
    *   **Tech Stack:** Go, SQLite (metadata), Docker SDK.
    *   **Key Path:** `go-app/cmd/docklite-agent/main.go`
*   **`webapp/` (Frontend GUI):**
    *   **Description:** A full-featured web dashboard.
    *   **Tech Stack:** Next.js (App Router), TypeScript, Tailwind CSS, `iron-session` (auth).
    *   **Key Path:** `webapp/app/`
*   **`cli-repo/` (TUI Client):**
    *   **Description:** A terminal-based user interface.
    *   **Tech Stack:** Go, Bubble Tea.
    *   **Key Path:** `cli-repo/main.go`

## Key Features

*   **Container Management:** Start, stop, restart, logs, stats, exec.
*   **Database Provisioning:** Create and manage PostgreSQL, MySQL, MongoDB containers.
*   **File Management:** Browse, upload, download, and edit files in volumes/containers.
*   **Backup System:** Schedule and execute backups to local storage, S3, or SFTP.
*   **DNS Management:** Manage Cloudflare DNS records directly from the UI.
*   **SSL Monitoring:** Track SSL certificate status.
*   **User Management:** Role-based access control (Super Admin, Admin, User).
*   **Web Terminal:** Interactive terminal access to containers via the web UI.

## Architecture & Data Flow

*   **Agent (Port 3000):** Acts as the central hub. It handles API requests (`/api/*`), manages the SQLite database, interacts with the Docker daemon, and proxies non-API requests to the Next.js GUI.
*   **GUI (Port 3001):** The Next.js application runs internally. The user accesses it via the Agent's proxy on port 3000.
*   **TUI:** Connects directly to the Agent's API, authenticated via a bearer token.

## Key Files & Documentation

### Documentation
*   `README.md`: Quick start and overview.
*   `COMPLETE_STACK.md`: Detailed stack architecture and "Three Modes" explanation.
*   `DEPLOYMENT.md`: Production deployment guide.
*   `DATABASESPEC.md`: Database schema specifications.
*   `WIRING_COMPLETE.md`: Wiring diagrams and connection details.

### Configuration & Scripts
*   `Makefile`: Main build control (`build-all`, `build-agent`, `build-gui`, `build-tui`).
*   `start-fullstack.sh`: **Primary startup script** for the complete experience.
*   `start-agent.sh`: Starts only the headless agent.
*   `start-tui.sh`: Starts the terminal client.
*   `stop-all.sh`: Stops all running services.
*   `.env`: Configuration for ports, tokens, and secrets (see `webapp/.env.example`).

### Source Code Highlights
*   **Agent Routes:** `go-app/internal/api/router.go`
*   **Agent Handlers:** `go-app/internal/handlers/` (Business logic for all features).
*   **Frontend Pages:** `webapp/app/(dashboard)/` (Main UI views).
*   **Database Init:** `webapp/lib/migrations/` (Schema migrations).

## Development Conventions

*   **Language:** Go (Backend/TUI), TypeScript (Frontend).
*   **Style:** Follow existing Go patterns (handlers, stores) and React/Next.js patterns (hooks, components).
*   **Auth:** Bearer token for API/TUI; Session-based (via API proxy) for Web GUI.
*   **Database:** SQLite is the single source of truth for metadata.