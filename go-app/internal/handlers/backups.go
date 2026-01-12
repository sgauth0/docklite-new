package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	"docklite-agent/internal/backup"
)

const defaultBackupPath = "/var/backups/docklite"

func (h *Handlers) Backups(w http.ResponseWriter, r *http.Request) {
	if !isAdminRole(r) {
		writeError(w, http.StatusForbidden, "forbidden")
		return
	}
	switch r.Method {
	case http.MethodGet:
		h.listBackups(w, r)
	case http.MethodDelete:
		h.deleteBackup(w, r)
	case http.MethodPost:
		h.cleanupBackups(w, r)
	default:
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

func (h *Handlers) BackupDestinations(w http.ResponseWriter, r *http.Request) {
	if !isAdminRole(r) {
		writeError(w, http.StatusForbidden, "forbidden")
		return
	}
	switch r.Method {
	case http.MethodGet:
		destinations, err := h.store.GetBackupDestinations()
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"destinations": destinations})
	case http.MethodPost:
		var body struct {
			Name    string          `json:"name"`
			Type    string          `json:"type"`
			Config  json.RawMessage `json:"config"`
			Enabled *int            `json:"enabled"`
		}
		if err := readJSON(r, &body); err != nil {
			writeError(w, http.StatusBadRequest, "invalid request body")
			return
		}
		if body.Name == "" || body.Type == "" || len(body.Config) == 0 {
			writeError(w, http.StatusBadRequest, "missing required fields: name, type, config")
			return
		}
		enabled := 1
		if body.Enabled != nil {
			enabled = *body.Enabled
		}
		id, err := h.store.CreateBackupDestination(body.Name, body.Type, string(body.Config), enabled)
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"id": id, "message": "Backup destination created successfully"})
	case http.MethodPut:
		var body struct {
			ID      int64           `json:"id"`
			Name    *string         `json:"name"`
			Type    *string         `json:"type"`
			Config  json.RawMessage `json:"config"`
			Enabled *int            `json:"enabled"`
		}
		if err := readJSON(r, &body); err != nil {
			writeError(w, http.StatusBadRequest, "invalid request body")
			return
		}
		if body.ID <= 0 {
			writeError(w, http.StatusBadRequest, "missing required field: id")
			return
		}
		params := make(map[string]any)
		if body.Name != nil {
			params["name"] = *body.Name
		}
		if body.Type != nil {
			params["type"] = *body.Type
		}
		if body.Config != nil {
			params["config"] = string(body.Config)
		}
		if body.Enabled != nil {
			params["enabled"] = *body.Enabled
		}
		if err := h.store.UpdateBackupDestination(body.ID, params); err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"message": "Backup destination updated successfully"})
	case http.MethodDelete:
		idStr := r.URL.Query().Get("id")
		id, err := strconv.ParseInt(idStr, 10, 64)
		if err != nil || id <= 0 {
			writeError(w, http.StatusBadRequest, "missing required parameter: id")
			return
		}
		if err := h.store.DeleteBackupDestination(id); err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"message": "Backup destination deleted successfully"})
	default:
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

func (h *Handlers) BackupJobs(w http.ResponseWriter, r *http.Request) {
	if !isAdminRole(r) {
		writeError(w, http.StatusForbidden, "forbidden")
		return
	}
	switch r.Method {
	case http.MethodGet:
		destID := r.URL.Query().Get("destination_id")
		if destID != "" {
			id, err := strconv.ParseInt(destID, 10, 64)
			if err != nil || id <= 0 {
				writeError(w, http.StatusBadRequest, "invalid destination_id")
				return
			}
			jobs, err := h.store.GetBackupJobsByDestination(id)
			if err != nil {
				writeError(w, http.StatusInternalServerError, err.Error())
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"jobs": jobs})
			return
		}
		jobs, err := h.store.GetBackupJobs()
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"jobs": jobs})
	case http.MethodPost:
		var body struct {
			DestinationID int64  `json:"destination_id"`
			TargetType    string `json:"target_type"`
			TargetID      *int64 `json:"target_id"`
			Frequency     string `json:"frequency"`
			RetentionDays *int   `json:"retention_days"`
			Enabled       *int   `json:"enabled"`
		}
		if err := readJSON(r, &body); err != nil {
			writeError(w, http.StatusBadRequest, "invalid request body")
			return
		}
		if body.DestinationID == 0 || body.TargetType == "" || body.Frequency == "" {
			writeError(w, http.StatusBadRequest, "missing required fields: destination_id, target_type, frequency")
			return
		}
		retention := 30
		if body.RetentionDays != nil {
			retention = *body.RetentionDays
		}
		enabled := 1
		if body.Enabled != nil {
			enabled = *body.Enabled
		}
		id, err := h.store.CreateBackupJob(body.DestinationID, body.TargetType, body.TargetID, body.Frequency, retention, enabled)
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"id": id, "message": "Backup job created successfully"})
	case http.MethodPut:
		var body struct {
			ID            int64   `json:"id"`
			DestinationID *int64  `json:"destination_id"`
			TargetType    *string `json:"target_type"`
			TargetID      *int64  `json:"target_id"`
			Frequency     *string `json:"frequency"`
			RetentionDays *int    `json:"retention_days"`
			Enabled       *int    `json:"enabled"`
		}
		if err := readJSON(r, &body); err != nil {
			writeError(w, http.StatusBadRequest, "invalid request body")
			return
		}
		if body.ID <= 0 {
			writeError(w, http.StatusBadRequest, "missing required field: id")
			return
		}
		params := make(map[string]any)
		if body.DestinationID != nil {
			params["destination_id"] = *body.DestinationID
		}
		if body.TargetType != nil {
			params["target_type"] = *body.TargetType
		}
		if body.TargetID != nil {
			params["target_id"] = *body.TargetID
		}
		if body.Frequency != nil {
			params["frequency"] = *body.Frequency
		}
		if body.RetentionDays != nil {
			params["retention_days"] = *body.RetentionDays
		}
		if body.Enabled != nil {
			params["enabled"] = *body.Enabled
		}
		if err := h.store.UpdateBackupJob(body.ID, params); err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"message": "Backup job updated successfully"})
	case http.MethodDelete:
		idStr := r.URL.Query().Get("id")
		id, err := strconv.ParseInt(idStr, 10, 64)
		if err != nil || id <= 0 {
			writeError(w, http.StatusBadRequest, "missing required parameter: id")
			return
		}
		if err := h.store.DeleteBackupJob(id); err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"message": "Backup job deleted successfully"})
	default:
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

func (h *Handlers) BackupHistory(w http.ResponseWriter, r *http.Request) {
	if !isAdminRole(r) {
		writeError(w, http.StatusForbidden, "forbidden")
		return
	}
	if r.Method != http.MethodDelete {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	deleted, err := h.store.ClearBackupHistory()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"message": "Backup history cleared", "deleted": deleted})
}

func (h *Handlers) BackupTrigger(w http.ResponseWriter, r *http.Request) {
	if !isAdminRole(r) {
		writeError(w, http.StatusForbidden, "forbidden")
		return
	}
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	var body struct {
		JobID int64 `json:"job_id"`
	}
	if err := readJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if body.JobID <= 0 {
		writeError(w, http.StatusBadRequest, "missing required field: job_id")
		return
	}
	go func() {
		_ = backup.TriggerJob(context.Background(), h.store, h.docker, body.JobID)
	}()
	writeJSON(w, http.StatusOK, map[string]any{"message": "Backup job triggered successfully"})
}

func (h *Handlers) LocalBackups(w http.ResponseWriter, r *http.Request) {
	if !isAdminRole(r) {
		writeError(w, http.StatusForbidden, "forbidden")
		return
	}
	switch r.Method {
	case http.MethodGet:
		entries, err := os.ReadDir(defaultBackupPath)
		if err != nil {
			if os.IsNotExist(err) {
				writeJSON(w, http.StatusOK, map[string]any{"path": defaultBackupPath, "files": []any{}})
				return
			}
			writeError(w, http.StatusInternalServerError, "internal server error")
			return
		}
		files := make([]map[string]any, 0)
		for _, entry := range entries {
			if entry.IsDir() {
				continue
			}
			info, err := entry.Info()
			if err != nil {
				continue
			}
			files = append(files, map[string]any{
				"name":        entry.Name(),
				"size":        info.Size(),
				"modified_at": info.ModTime().UTC().Format(time.RFC3339),
			})
		}
		sort.Slice(files, func(i, j int) bool {
			return files[i]["modified_at"].(string) > files[j]["modified_at"].(string)
		})
		writeJSON(w, http.StatusOK, map[string]any{"path": defaultBackupPath, "files": files})
	case http.MethodDelete:
		fileName := r.URL.Query().Get("file")
		if fileName == "" {
			writeError(w, http.StatusBadRequest, "file name is required")
			return
		}
		resolvedPath, ok := resolveBackupPath(fileName)
		if !ok {
			writeError(w, http.StatusForbidden, "forbidden")
			return
		}
		if err := os.Remove(resolvedPath); err != nil {
			if os.IsNotExist(err) {
				writeError(w, http.StatusNotFound, "file not found")
				return
			}
			writeError(w, http.StatusInternalServerError, "internal server error")
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"message": "Backup file deleted successfully"})
	default:
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

func (h *Handlers) LocalBackupDownload(w http.ResponseWriter, r *http.Request) {
	if !isAdminRole(r) {
		writeError(w, http.StatusForbidden, "forbidden")
		return
	}
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	fileName := r.URL.Query().Get("file")
	if fileName == "" {
		writeError(w, http.StatusBadRequest, "file name is required")
		return
	}
	resolvedPath, ok := resolveBackupPath(fileName)
	if !ok {
		writeError(w, http.StatusForbidden, "forbidden")
		return
	}
	info, err := os.Stat(resolvedPath)
	if err != nil {
		if os.IsNotExist(err) {
			writeError(w, http.StatusNotFound, "file not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}
	file, err := os.Open(resolvedPath)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}
	defer file.Close()

	w.Header().Set("Content-Disposition", "attachment; filename=\""+filepath.Base(resolvedPath)+"\"")
	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Content-Length", strconv.FormatInt(info.Size(), 10))
	http.ServeContent(w, r, info.Name(), info.ModTime(), file)
}

func resolveBackupPath(fileName string) (string, bool) {
	cleaned := filepath.Clean(fileName)
	if cleaned == "." || cleaned == "/" || strings.HasPrefix(cleaned, "..") {
		return "", false
	}
	if filepath.IsAbs(cleaned) {
		cleaned = strings.TrimPrefix(cleaned, string(filepath.Separator))
	}
	target := filepath.Join(defaultBackupPath, cleaned)
	if !strings.HasPrefix(target, defaultBackupPath+string(filepath.Separator)) {
		return "", false
	}
	return target, true
}

func (h *Handlers) listBackups(w http.ResponseWriter, r *http.Request) {
	jobIDStr := r.URL.Query().Get("job_id")
	targetType := r.URL.Query().Get("target_type")
	targetIDStr := r.URL.Query().Get("target_id")

	if jobIDStr != "" {
		jobID, err := strconv.ParseInt(jobIDStr, 10, 64)
		if err != nil || jobID <= 0 {
			writeError(w, http.StatusBadRequest, "invalid job_id")
			return
		}
		backups, err := h.store.GetBackupsByJob(jobID, 50)
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"backups": backups})
		return
	}

	if targetType != "" && targetIDStr != "" {
		targetID, err := strconv.ParseInt(targetIDStr, 10, 64)
		if err != nil || targetID <= 0 {
			writeError(w, http.StatusBadRequest, "invalid target_id")
			return
		}
		backups, err := h.store.GetBackupsByTarget(targetType, targetID, 50)
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"backups": backups})
		return
	}

	backups, err := h.store.GetBackups(100)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"backups": backups})
}

func (h *Handlers) deleteBackup(w http.ResponseWriter, r *http.Request) {
	idStr := r.URL.Query().Get("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil || id <= 0 {
		writeError(w, http.StatusBadRequest, "missing required parameter: id")
		return
	}
	if err := h.store.DeleteBackup(id); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"message": "Backup deleted successfully"})
}

func (h *Handlers) cleanupBackups(w http.ResponseWriter, r *http.Request) {
	var body struct {
		DestinationID int64 `json:"destination_id"`
		RetentionDays int   `json:"retention_days"`
	}
	if err := readJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if body.DestinationID == 0 || body.RetentionDays == 0 {
		writeError(w, http.StatusBadRequest, "missing required fields: destination_id, retention_days")
		return
	}
	deleted, err := h.store.DeleteOldBackups(body.DestinationID, body.RetentionDays)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"message": "Old backups cleaned up successfully", "deleted": deleted})
}
