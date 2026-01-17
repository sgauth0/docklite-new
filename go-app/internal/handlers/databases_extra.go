package handlers

import (
	"compress/gzip"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"docklite-agent/internal/store"
)

var identifierPattern = regexp.MustCompile(`^[a-zA-Z_][a-zA-Z0-9_]*$`)

const (
	databaseRetentionRoot  = "/var/backups/docklite/databases"
	databaseRetentionCount = 7
)

type lazyHeaderWriter struct {
	writer      http.ResponseWriter
	headers     map[string]string
	wroteHeader bool
	bytes       int64
}

func (l *lazyHeaderWriter) Write(p []byte) (int, error) {
	if !l.wroteHeader {
		for key, value := range l.headers {
			l.writer.Header().Set(key, value)
		}
		l.writer.WriteHeader(http.StatusOK)
		l.wroteHeader = true
	}
	n, err := l.writer.Write(p)
	l.bytes += int64(n)
	return n, err
}

func (l *lazyHeaderWriter) BytesWritten() int64 {
	return l.bytes
}

func (h *Handlers) DatabaseStats(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	ctx, cancel := dockerContext(r.Context())
	defer cancel()

	if dockerDatabases, err := h.docker.ListDatabases(ctx); err == nil {
		for _, db := range dockerDatabases {
			_, _ = h.store.UpsertDatabase(db.Name, db.ID, db.Port)
		}
	}

	dbPath := h.store.Path
	if dbPath == "" {
		dbPath = filepath.Join("data", "docklite.db")
	}

	dockliteDbSize := int64(0)
	if stat, err := os.Stat(dbPath); err == nil {
		dockliteDbSize = stat.Size()
	}

	tableCount, err := h.store.CountTables()
	if err != nil {
		tableCount = 0
	}

	var records []store.DatabaseRecord
	if isAdminRole(r) {
		records, err = h.store.ListDatabases()
	} else {
		userID, _ := readUserID(r)
		if userID == nil {
			writeError(w, http.StatusUnauthorized, "unauthorized")
			return
		}
		records, err = h.store.ListDatabasesByUser(*userID)
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	withSize := make([]map[string]any, 0, len(records))
	for _, database := range records {
		size := int64(0)
		sizeCategory := "empty"

		if database.ContainerID != "" {
			query := fmt.Sprintf("SELECT pg_database_size('%s')", database.Name)
			dockerCtx, dockerCancel := dockerContext(r.Context())
			output, err := h.docker.ExecPostgres(dockerCtx, database.ContainerID, "docklite", database.Name, "", query, false)
			dockerCancel()
			if err == nil {
				if parsed, parseErr := strconv.ParseInt(strings.TrimSpace(output), 10, 64); parseErr == nil {
					size = parsed
					switch {
					case size == 0:
						sizeCategory = "empty"
					case size < 1024*1024:
						sizeCategory = "tiny"
					case size < 10*1024*1024:
						sizeCategory = "small"
					case size < 100*1024*1024:
						sizeCategory = "medium"
					case size < 1024*1024*1024:
						sizeCategory = "large"
					default:
						sizeCategory = "huge"
					}
				}
			}
		}

		withSize = append(withSize, map[string]any{
			"id":            database.ID,
			"name":          database.Name,
			"container_id":  database.ContainerID,
			"postgres_port": database.PostgresPort,
			"created_at":    database.CreatedAt,
			"size":          size,
			"sizeCategory":  sizeCategory,
		})
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"dockliteDb": map[string]any{
			"size":   dockliteDbSize,
			"tables": tableCount,
			"path":   dbPath,
		},
		"databases": withSize,
	})
}

func (h *Handlers) DatabaseRoutes(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/api/databases/")
	parts := strings.Split(path, "/")
	if len(parts) == 0 || parts[0] == "" {
		writeError(w, http.StatusNotFound, "not found")
		return
	}

	dbID, err := strconv.ParseInt(parts[0], 10, 64)
	if err != nil || dbID <= 0 {
		writeError(w, http.StatusBadRequest, "invalid database id")
		return
	}

	if len(parts) == 1 || parts[1] == "" {
		h.Database(w, r, dbID)
		return
	}

	switch parts[1] {
	case "query":
		h.DatabaseQuery(w, r, dbID)
	case "schema":
		h.DatabaseSchema(w, r, dbID)
	case "table":
		h.DatabaseTable(w, r, dbID)
	case "download":
		h.DatabaseDownload(w, r, dbID)
	default:
		writeError(w, http.StatusNotFound, "not found")
	}
}

func (h *Handlers) Database(w http.ResponseWriter, r *http.Request, databaseID int64) {
	switch r.Method {
	case http.MethodGet:
		h.getDatabase(w, r, databaseID)
	case http.MethodPatch:
		h.updateDatabaseCredentials(w, r, databaseID)
	case http.MethodDelete:
		h.deleteDatabase(w, r, databaseID)
	default:
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

func (h *Handlers) getDatabase(w http.ResponseWriter, r *http.Request, databaseID int64) {
	if !isAdminRole(r) {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	database, err := h.store.GetDatabaseByID(databaseID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if database == nil {
		writeError(w, http.StatusNotFound, "database not found")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"database": database})
}

func (h *Handlers) deleteDatabase(w http.ResponseWriter, r *http.Request, databaseID int64) {
	if !isAdminRole(r) {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	database, err := h.store.GetDatabaseByID(databaseID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if database == nil {
		writeError(w, http.StatusNotFound, "database not found")
		return
	}

	if database.ContainerID != "" {
		dockerCtx, dockerCancel := dockerContext(r.Context())
		if err := h.docker.RemoveContainer(dockerCtx, database.ContainerID); err != nil {
			dockerCancel()
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		dockerCancel()
	}

	if err := h.store.DeleteDatabase(databaseID); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"success": true})
}

func (h *Handlers) updateDatabaseCredentials(w http.ResponseWriter, r *http.Request, databaseID int64) {
	if !isAdminRole(r) {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	var body struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := readJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if body.Username == "" || body.Password == "" {
		writeError(w, http.StatusBadRequest, "username and password are required")
		return
	}

	database, err := h.store.GetDatabaseByID(databaseID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if database == nil || database.ContainerID == "" {
		writeError(w, http.StatusNotFound, "database not found")
		return
	}

	dockerCtx, dockerCancel := dockerContext(r.Context())
	defer dockerCancel()

	alterSQL := fmt.Sprintf("ALTER USER %s WITH PASSWORD '%s';", body.Username, body.Password)
	if _, err := h.docker.ExecPostgres(dockerCtx, database.ContainerID, "postgres", "postgres", "", alterSQL, false); err != nil {
		createSQL := fmt.Sprintf("CREATE USER %s WITH PASSWORD '%s';", body.Username, body.Password)
		if _, err := h.docker.ExecPostgres(dockerCtx, database.ContainerID, "postgres", "postgres", "", createSQL, false); err != nil {
			writeError(w, http.StatusInternalServerError, "failed to update credentials")
			return
		}
		grantSQL := fmt.Sprintf("GRANT ALL PRIVILEGES ON DATABASE %s TO %s;", database.Name, body.Username)
		if _, err := h.docker.ExecPostgres(dockerCtx, database.ContainerID, "postgres", "postgres", "", grantSQL, false); err != nil {
			writeError(w, http.StatusInternalServerError, "failed to grant privileges")
			return
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"message": "Database credentials updated successfully",
	})
}

func (h *Handlers) DatabaseQuery(w http.ResponseWriter, r *http.Request, databaseID int64) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	if !isAdminRole(r) {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	var body struct {
		Username string `json:"username"`
		Password string `json:"password"`
		SQL      string `json:"sql"`
	}
	if err := readJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if body.Username == "" || body.Password == "" || body.SQL == "" {
		writeError(w, http.StatusBadRequest, "username, password, and sql are required")
		return
	}

	database, err := h.store.GetDatabaseByID(databaseID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if database == nil || database.ContainerID == "" {
		writeError(w, http.StatusNotFound, "database not found")
		return
	}

	dockerCtx, dockerCancel := dockerContext(r.Context())
	defer dockerCancel()

	normalized := normalizeSQL(body.SQL)
	isSelectable := strings.HasPrefix(strings.ToLower(normalized), "select") || strings.HasPrefix(strings.ToLower(normalized), "with")

	if isSelectable {
		wrapped := fmt.Sprintf("SELECT coalesce(json_agg(t), '[]'::json) FROM (%s) t;", normalized)
		rowsJSON, err := h.docker.ExecPostgres(dockerCtx, database.ContainerID, body.Username, database.Name, body.Password, wrapped, true)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to execute query")
			return
		}
		var rows []map[string]any
		if rowsJSON == "" {
			rowsJSON = "[]"
		}
		if err := json.Unmarshal([]byte(rowsJSON), &rows); err != nil {
			writeError(w, http.StatusInternalServerError, "failed to parse query response")
			return
		}
		columns := columnsFromRows(rows)
		writeJSON(w, http.StatusOK, map[string]any{
			"type":    "select",
			"rows":    rows,
			"columns": columns,
		})
		return
	}

	output, err := h.docker.ExecPostgres(dockerCtx, database.ContainerID, body.Username, database.Name, body.Password, normalized, false)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to execute query")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"type":   "command",
		"output": output,
	})
}

func (h *Handlers) DatabaseSchema(w http.ResponseWriter, r *http.Request, databaseID int64) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	if !isAdminRole(r) {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	var body struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := readJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if body.Username == "" || body.Password == "" {
		writeError(w, http.StatusBadRequest, "username and password are required")
		return
	}

	database, err := h.store.GetDatabaseByID(databaseID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if database == nil || database.ContainerID == "" {
		writeError(w, http.StatusNotFound, "database not found")
		return
	}

	tablesSQL := `
    SELECT coalesce(json_agg(t), '[]'::json)
    FROM (
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    ) t;
  `

	columnsSQL := `
    SELECT coalesce(json_agg(t), '[]'::json)
    FROM (
      SELECT table_name, column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position
    ) t;
  `

	dockerCtx, dockerCancel := dockerContext(r.Context())
	defer dockerCancel()

	tablesJSON, err := h.docker.ExecPostgres(dockerCtx, database.ContainerID, body.Username, database.Name, body.Password, tablesSQL, true)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to fetch schema")
		return
	}
	columnsJSON, err := h.docker.ExecPostgres(dockerCtx, database.ContainerID, body.Username, database.Name, body.Password, columnsSQL, true)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to fetch schema")
		return
	}

	var tables []map[string]any
	var columns []map[string]any
	if tablesJSON == "" {
		tablesJSON = "[]"
	}
	if columnsJSON == "" {
		columnsJSON = "[]"
	}
	_ = json.Unmarshal([]byte(tablesJSON), &tables)
	_ = json.Unmarshal([]byte(columnsJSON), &columns)

	columnsByTable := make(map[string][]map[string]any)
	for _, col := range columns {
		tableName, _ := col["table_name"].(string)
		columnsByTable[tableName] = append(columnsByTable[tableName], col)
	}

	responseTables := make([]map[string]any, 0, len(tables))
	for _, table := range tables {
		tableName, _ := table["table_name"].(string)
		cols := columnsByTable[tableName]
		formatted := make([]map[string]any, 0, len(cols))
		for _, col := range cols {
			name, _ := col["column_name"].(string)
			colType, _ := col["data_type"].(string)
			nullable := false
			if nullableRaw, ok := col["is_nullable"].(string); ok && nullableRaw == "YES" {
				nullable = true
			}
			formatted = append(formatted, map[string]any{
				"name":     name,
				"type":     colType,
				"nullable": nullable,
			})
		}
		responseTables = append(responseTables, map[string]any{
			"name":    tableName,
			"columns": formatted,
		})
	}

	writeJSON(w, http.StatusOK, map[string]any{"tables": responseTables})
}

func (h *Handlers) DatabaseTable(w http.ResponseWriter, r *http.Request, databaseID int64) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	if !isAdminRole(r) {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	var body struct {
		Username string `json:"username"`
		Password string `json:"password"`
		Table    string `json:"table"`
	}
	if err := readJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if body.Username == "" || body.Password == "" || body.Table == "" {
		writeError(w, http.StatusBadRequest, "username, password, and table are required")
		return
	}
	if !identifierPattern.MatchString(body.Table) {
		writeError(w, http.StatusBadRequest, "invalid table name")
		return
	}

	database, err := h.store.GetDatabaseByID(databaseID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if database == nil || database.ContainerID == "" {
		writeError(w, http.StatusNotFound, "database not found")
		return
	}

	columnsSQL := fmt.Sprintf(`
    SELECT coalesce(json_agg(t), '[]'::json)
    FROM (
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = '%s'
      ORDER BY ordinal_position
    ) t;
  `, body.Table)

	rowsSQL := fmt.Sprintf(`
    SELECT coalesce(json_agg(t), '[]'::json)
    FROM (
      SELECT * FROM "%s" LIMIT 10
    ) t;
  `, body.Table)

	dockerCtx, dockerCancel := dockerContext(r.Context())
	defer dockerCancel()

	columnsJSON, err := h.docker.ExecPostgres(dockerCtx, database.ContainerID, body.Username, database.Name, body.Password, columnsSQL, true)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to fetch table data")
		return
	}
	rowsJSON, err := h.docker.ExecPostgres(dockerCtx, database.ContainerID, body.Username, database.Name, body.Password, rowsSQL, true)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to fetch table data")
		return
	}

	var columns []map[string]any
	var rows []map[string]any
	if columnsJSON == "" {
		columnsJSON = "[]"
	}
	if rowsJSON == "" {
		rowsJSON = "[]"
	}
	_ = json.Unmarshal([]byte(columnsJSON), &columns)
	_ = json.Unmarshal([]byte(rowsJSON), &rows)

	formattedColumns := make([]map[string]any, 0, len(columns))
	for _, col := range columns {
		name, _ := col["column_name"].(string)
		colType, _ := col["data_type"].(string)
		nullable := false
		if nullableRaw, ok := col["is_nullable"].(string); ok && nullableRaw == "YES" {
			nullable = true
		}
		formattedColumns = append(formattedColumns, map[string]any{
			"name":     name,
			"type":     colType,
			"nullable": nullable,
		})
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"columns": formattedColumns,
		"rows":    rows,
	})
}

func (h *Handlers) DatabaseDownload(w http.ResponseWriter, r *http.Request, databaseID int64) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	if !isAdminRole(r) {
		userID, err := readUserID(r)
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid user id")
			return
		}
		if userID == nil {
			writeError(w, http.StatusUnauthorized, "unauthorized")
			return
		}
		allowed, err := h.store.HasDatabaseAccess(*userID, databaseID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		if !allowed {
			writeError(w, http.StatusForbidden, "forbidden")
			return
		}
	}

	var body struct {
		Username string `json:"username"`
		Password string `json:"password"`
		Gzip     *bool  `json:"gzip"`
	}
	if err := readJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if body.Username == "" || body.Password == "" {
		writeError(w, http.StatusBadRequest, "username and password are required")
		return
	}
	gzipEnabled := true
	if body.Gzip != nil {
		gzipEnabled = *body.Gzip
	}

	database, err := h.store.GetDatabaseByID(databaseID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if database == nil || database.ContainerID == "" {
		writeError(w, http.StatusNotFound, "database not found")
		return
	}

	dockerCtx, dockerCancel := dockerContext(r.Context())
	defer dockerCancel()

	if _, err := h.docker.ExecPostgres(dockerCtx, database.ContainerID, body.Username, database.Name, body.Password, "SELECT 1", false); err != nil {
		writeError(w, http.StatusBadRequest, "invalid database credentials")
		return
	}

	timestamp := time.Now().UTC().Format("2006-01-02T15-04-05Z")
	baseName := fmt.Sprintf("docklite-%s-%s", database.Name, timestamp)
	downloadName := fmt.Sprintf("%s.dump", baseName)
	if gzipEnabled {
		downloadName = fmt.Sprintf("%s.dump.gz", baseName)
	}

	responseWriter := &lazyHeaderWriter{
		writer: w,
		headers: map[string]string{
			"Content-Type":        "application/octet-stream",
			"Content-Disposition": fmt.Sprintf("attachment; filename=%q", downloadName),
		},
	}

	retentionEnabled := true
	if err := os.MkdirAll(databaseRetentionRoot, 0o755); err != nil {
		retentionEnabled = false
		log.Printf("database retention disabled: %v", err)
	}

	var fileWriter *os.File
	var retentionName string
	if retentionEnabled {
		retentionName = downloadName
		filePath := filepath.Join(databaseRetentionRoot, retentionName)
		fileWriter, err = os.Create(filePath)
		if err != nil {
			retentionEnabled = false
			log.Printf("database retention disabled: %v", err)
		}
	}

	writer := io.Writer(w)
	if retentionEnabled && fileWriter != nil {
		writer = io.MultiWriter(responseWriter, fileWriter)
	} else {
		writer = responseWriter
	}

	var gzipWriter *gzip.Writer
	if gzipEnabled {
		gzipWriter = gzip.NewWriter(writer)
		writer = gzipWriter
	}

	cmd := []string{"pg_dump", "-U", body.Username, "-d", database.Name, "-F", "c"}
	env := []string{fmt.Sprintf("PGPASSWORD=%s", body.Password)}

	execErr := h.docker.ExecCommandToWriter(dockerCtx, database.ContainerID, cmd, env, writer)

	if gzipWriter != nil {
		_ = gzipWriter.Close()
	}
	if fileWriter != nil {
		_ = fileWriter.Close()
	}

	if execErr != nil {
		if responseWriter.BytesWritten() == 0 {
			writeError(w, http.StatusInternalServerError, "failed to create database dump")
			return
		}
		log.Printf("database download failed after response started: %v", execErr)
		return
	}

	if retentionEnabled {
		manifest := map[string]any{
			"app_name":      "DockLite",
			"database_name": database.Name,
			"container_id":  database.ContainerID,
			"format":        "custom",
			"created_at":    time.Now().UTC().Format(time.RFC3339),
			"filename":      retentionName,
			"gzip":          gzipEnabled,
		}
		manifestPath := filepath.Join(databaseRetentionRoot, fmt.Sprintf("%s.json", baseName))
		if data, err := json.MarshalIndent(manifest, "", "  "); err == nil {
			if err := os.WriteFile(manifestPath, data, 0o644); err != nil {
				log.Printf("manifest write failed: %v", err)
			}
		}
		pruneDatabaseDumps(database.Name)
	}
}

func pruneDatabaseDumps(dbName string) {
	entries, err := os.ReadDir(databaseRetentionRoot)
	if err != nil {
		log.Printf("prune database dumps failed: %v", err)
		return
	}

	prefix := fmt.Sprintf("docklite-%s-", dbName)
	type dumpFile struct {
		path    string
		modTime time.Time
		base    string
	}

	var dumps []dumpFile
	for _, entry := range entries {
		name := entry.Name()
		if !strings.HasPrefix(name, prefix) {
			continue
		}
		if !strings.HasSuffix(name, ".dump") && !strings.HasSuffix(name, ".dump.gz") {
			continue
		}
		info, err := entry.Info()
		if err != nil {
			continue
		}
		base := strings.TrimSuffix(name, ".gz")
		base = strings.TrimSuffix(base, ".dump")
		dumps = append(dumps, dumpFile{
			path:    filepath.Join(databaseRetentionRoot, name),
			modTime: info.ModTime(),
			base:    base,
		})
	}

	sort.Slice(dumps, func(i, j int) bool {
		return dumps[i].modTime.After(dumps[j].modTime)
	})

	for i := databaseRetentionCount; i < len(dumps); i++ {
		_ = os.Remove(dumps[i].path)
		_ = os.Remove(filepath.Join(databaseRetentionRoot, fmt.Sprintf("%s.json", dumps[i].base)))
	}
}

func normalizeSQL(sql string) string {
	trimmed := strings.TrimSpace(sql)
	return strings.TrimRightFunc(trimmed, func(r rune) bool {
		return r == ';' || r == '\n' || r == '\r' || r == '\t' || r == ' '
	})
}

func columnsFromRows(rows []map[string]any) []string {
	if len(rows) == 0 {
		return []string{}
	}
	columns := make([]string, 0, len(rows[0]))
	for key := range rows[0] {
		columns = append(columns, key)
	}
	sort.Strings(columns)
	return columns
}
