package handlers

import (
	"bufio"
	"context"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync/atomic"
	"syscall"
	"time"
)

const (
	updateLogFile = "/var/log/docklite/update.log"
	updatePIDFile = "/tmp/docklite-update.pid"
	updateLogTail = 80
)

var updateRunning atomic.Bool

func installDir() string {
	exe, err := os.Executable()
	if err != nil {
		return "/opt/docklite"
	}
	// binary lives at <INSTALL_DIR>/bin/docklite-agent
	return filepath.Dir(filepath.Dir(exe))
}

type updateStatusResponse struct {
	Version          string   `json:"version"`
	GitHash          string   `json:"gitHash"`
	Branch           string   `json:"branch"`
	CommitsBehind    int      `json:"commitsBehind"`
	UpdateAvailable  bool     `json:"updateAvailable"`
	UpdateRunning    bool     `json:"updateRunning"`
	LastUpdated      string   `json:"lastUpdated"`
	Log              []string `json:"log"`
}

func (h *Handlers) SystemUpdateStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	dir := installDir()
	resp := updateStatusResponse{
		Version:       readVersion(dir),
		GitHash:       runGit(dir, "rev-parse", "--short", "HEAD"),
		Branch:        runGit(dir, "rev-parse", "--abbrev-ref", "HEAD"),
		UpdateRunning: updateRunning.Load() || pidFileRunning(),
		Log:           tailLog(updateLogFile, updateLogTail),
	}

	// non-blocking update check with timeout
	ctx, cancel := context.WithTimeout(r.Context(), 8*time.Second)
	defer cancel()
	behind, err := commitsBeindOrigin(ctx, dir, resp.Branch)
	if err == nil {
		resp.CommitsBehind = behind
		resp.UpdateAvailable = behind > 0
	}

	resp.LastUpdated = lastModified(updateLogFile)

	writeJSON(w, http.StatusOK, resp)
}

func (h *Handlers) SystemUpdateRun(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	if !isSuperAdminRole(r) {
		writeError(w, http.StatusForbidden, "super_admin required")
		return
	}
	if updateRunning.Swap(true) {
		writeError(w, http.StatusConflict, "update already in progress")
		return
	}

	dir := installDir()
	scriptPath := filepath.Join(dir, "scripts", "update.sh")

	if _, err := os.Stat(scriptPath); err != nil {
		updateRunning.Store(false)
		writeError(w, http.StatusInternalServerError, "update script not found: "+scriptPath)
		return
	}

	writeJSON(w, http.StatusAccepted, map[string]string{"status": "started"})

	go func() {
		defer updateRunning.Store(false)

		// Rotate log
		_ = os.MkdirAll(filepath.Dir(updateLogFile), 0o755)
		logF, err := os.OpenFile(updateLogFile, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
		if err != nil {
			return
		}
		defer logF.Close()

		cmd := exec.Command("bash", scriptPath)
		cmd.Env = append(os.Environ(),
			"INSTALL_DIR="+dir,
			"LOG_FILE="+updateLogFile,
			"PID_FILE="+updatePIDFile,
		)
		cmd.Stdout = logF
		cmd.Stderr = logF
		// New session so we're not killed by the agent's cgroup stop signal
		cmd.SysProcAttr = &syscall.SysProcAttr{Setsid: true}

		_ = cmd.Run()
	}()
}

// helpers

func readVersion(dir string) string {
	data, err := os.ReadFile(filepath.Join(dir, "VERSION"))
	if err != nil {
		return "unknown"
	}
	return strings.TrimSpace(string(data))
}

func runGit(dir string, args ...string) string {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	out, err := exec.CommandContext(ctx, "git", append([]string{"-C", dir}, args...)...).Output()
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(out))
}

func commitsBeindOrigin(ctx context.Context, dir, branch string) (int, error) {
	// fetch first (with timeout)
	fetch := exec.CommandContext(ctx, "git", "-C", dir, "fetch", "origin", "--quiet")
	_ = fetch.Run()

	out, err := exec.CommandContext(ctx, "git", "-C", dir,
		"rev-list", "HEAD..origin/"+branch, "--count").Output()
	if err != nil {
		return 0, err
	}
	n, err := strconv.Atoi(strings.TrimSpace(string(out)))
	if err != nil {
		return 0, err
	}
	return n, nil
}

func tailLog(path string, n int) []string {
	f, err := os.Open(path)
	if err != nil {
		return nil
	}
	defer f.Close()

	var lines []string
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		lines = append(lines, scanner.Text())
	}
	if len(lines) > n {
		lines = lines[len(lines)-n:]
	}
	return lines
}

func lastModified(path string) string {
	info, err := os.Stat(path)
	if err != nil {
		return ""
	}
	return info.ModTime().UTC().Format(time.RFC3339)
}

func pidFileRunning() bool {
	data, err := os.ReadFile(updatePIDFile)
	if err != nil {
		return false
	}
	pid, err := strconv.Atoi(strings.TrimSpace(string(data)))
	if err != nil {
		return false
	}
	proc, err := os.FindProcess(pid)
	if err != nil {
		return false
	}
	return proc.Signal(syscall.Signal(0)) == nil
}
