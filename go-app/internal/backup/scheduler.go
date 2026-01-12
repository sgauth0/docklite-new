package backup

import (
	"compress/gzip"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"docklite-agent/internal/docker"
	"docklite-agent/internal/store"
)

const defaultBackupPath = "/var/backups/docklite"

type DestinationConfig struct {
	Path string `json:"path"`
}

func StartScheduler(storeHandle *store.SQLiteStore, dockerClient *docker.Client) {
	go func() {
		ticker := time.NewTicker(5 * time.Minute)
		defer ticker.Stop()

		time.Sleep(30 * time.Second)
		checkAndRunJobs(storeHandle, dockerClient)

		for range ticker.C {
			checkAndRunJobs(storeHandle, dockerClient)
		}
	}()
}

func TriggerJob(ctx context.Context, storeHandle *store.SQLiteStore, dockerClient *docker.Client, jobID int64) error {
	job, err := storeHandle.GetBackupJobByID(jobID)
	if err != nil {
		return err
	}
	if job == nil {
		return fmt.Errorf("job %d not found", jobID)
	}
	return executeBackupJob(ctx, storeHandle, dockerClient, *job)
}

func checkAndRunJobs(storeHandle *store.SQLiteStore, dockerClient *docker.Client) {
	jobs, err := storeHandle.GetEnabledBackupJobs()
	if err != nil {
		return
	}
	for _, job := range jobs {
		if shouldRunJob(job) {
			_ = executeBackupJob(context.Background(), storeHandle, dockerClient, job)
		}
	}
}

func shouldRunJob(job store.BackupJob) bool {
	if job.Enabled == 0 {
		return false
	}
	if job.LastRunAt == nil || *job.LastRunAt == "" {
		return true
	}
	if job.NextRunAt != nil && *job.NextRunAt != "" {
		nextRun, err := time.Parse(time.RFC3339, *job.NextRunAt)
		if err == nil {
			return time.Now().After(nextRun) || time.Now().Equal(nextRun)
		}
	}

	lastRun, err := time.Parse(time.RFC3339, *job.LastRunAt)
	if err != nil {
		return true
	}
	hoursSince := time.Since(lastRun).Hours()

	switch job.Frequency {
	case "hourly":
		return hoursSince >= 1
	case "daily":
		return hoursSince >= 24
	case "every-3-days":
		return hoursSince >= 72
	case "weekly":
		return hoursSince >= 168
	case "monthly":
		return hoursSince >= 720
	default:
		hours, err := strconv.Atoi(job.Frequency)
		return err == nil && hoursSince >= float64(hours)
	}
}

func calculateNextRunTime(frequency string) *string {
	now := time.Now().UTC()
	switch frequency {
	case "hourly":
		now = now.Add(time.Hour)
	case "daily":
		now = now.Add(24 * time.Hour)
	case "every-3-days":
		now = now.Add(72 * time.Hour)
	case "weekly":
		now = now.Add(7 * 24 * time.Hour)
	case "monthly":
		now = now.Add(30 * 24 * time.Hour)
	default:
		if hours, err := strconv.Atoi(frequency); err == nil {
			now = now.Add(time.Duration(hours) * time.Hour)
		}
	}
	next := now.Format(time.RFC3339)
	return &next
}

func executeBackupJob(ctx context.Context, storeHandle *store.SQLiteStore, dockerClient *docker.Client, job store.BackupJob) error {
	dest, err := storeHandle.GetBackupDestinationByID(job.Destination)
	if err != nil {
		return err
	}
	if dest == nil || dest.Enabled == 0 {
		return nil
	}

	targets := make([]targetRef, 0)
	switch job.TargetType {
	case "site":
		if job.TargetID != nil {
			targets = append(targets, targetRef{Type: "site", ID: *job.TargetID})
		}
	case "database":
		if job.TargetID != nil {
			targets = append(targets, targetRef{Type: "database", ID: *job.TargetID})
		}
	case "all-sites":
		sites, err := storeHandle.ListSites()
		if err != nil {
			return err
		}
		for _, site := range sites {
			targets = append(targets, targetRef{Type: "site", ID: site.ID})
		}
	case "all-databases":
		databases, err := storeHandle.ListDatabases()
		if err != nil {
			return err
		}
		for _, database := range databases {
			targets = append(targets, targetRef{Type: "database", ID: database.ID})
		}
	}

	for _, target := range targets {
		if err := executeDestinationBackup(ctx, storeHandle, dockerClient, job, *dest, target); err != nil {
			return err
		}
	}

	if err := storeHandle.UpdateBackupJobRunTime(job.ID, calculateNextRunTime(job.Frequency)); err != nil {
		return err
	}
	return nil
}

type targetRef struct {
	Type string
	ID   int64
}

func executeDestinationBackup(ctx context.Context, storeHandle *store.SQLiteStore, dockerClient *docker.Client, job store.BackupJob, dest store.BackupDestination, target targetRef) error {
	switch dest.Type {
	case "local":
		return executeLocalBackup(ctx, storeHandle, dockerClient, job, dest, target)
	default:
		return fmt.Errorf("%s backup not implemented", dest.Type)
	}
}

func executeLocalBackup(ctx context.Context, storeHandle *store.SQLiteStore, dockerClient *docker.Client, job store.BackupJob, dest store.BackupDestination, target targetRef) error {
	basePath := defaultBackupPath
	if dest.Config != "" {
		var cfg DestinationConfig
		if err := json.Unmarshal([]byte(dest.Config), &cfg); err == nil && cfg.Path != "" {
			basePath = cfg.Path
		}
	}

	record := store.BackupRecord{
		JobID:       &job.ID,
		Destination: dest.ID,
		TargetType:  target.Type,
		TargetID:    target.ID,
		BackupPath:  "",
		SizeBytes:   0,
		Status:      "in_progress",
	}
	backupID, err := storeHandle.CreateBackup(record)
	if err != nil {
		return err
	}

	var backupPath string
	var size int64

	switch target.Type {
	case "site":
		backupPath, size, err = backupSite(ctx, storeHandle, basePath, target.ID)
	case "database":
		backupPath, size, err = backupDatabase(ctx, storeHandle, dockerClient, basePath, target.ID)
	default:
		err = fmt.Errorf("unsupported target type")
	}

	if err != nil {
		message := err.Error()
		_ = storeHandle.UpdateBackupStatus(backupID, "failed", &message, nil, nil)
		return err
	}

	_ = storeHandle.UpdateBackupStatus(backupID, "success", nil, &size, &backupPath)
	return nil
}

func backupSite(ctx context.Context, storeHandle *store.SQLiteStore, destination string, siteID int64) (string, int64, error) {
	site, err := storeHandle.GetSiteByID(siteID)
	if err != nil {
		return "", 0, err
	}
	if site == nil {
		return "", 0, fmt.Errorf("site %d not found", siteID)
	}
	if site.CodePath == "" {
		return "", 0, fmt.Errorf("site path not set")
	}

	if err := os.MkdirAll(destination, 0o755); err != nil {
		return "", 0, err
	}

	timestamp := time.Now().UTC().Format("2006-01-02T15-04-05")
	filename := fmt.Sprintf("site-%s-%s.tar.gz", site.Domain, timestamp)
	backupPath := filepath.Join(destination, filename)

	cmd := exec.CommandContext(ctx, "tar", "-czf", backupPath, "-C", filepath.Dir(site.CodePath), filepath.Base(site.CodePath))
	if output, err := cmd.CombinedOutput(); err != nil {
		return "", 0, fmt.Errorf("tar failed: %s", strings.TrimSpace(string(output)))
	}

	stat, err := os.Stat(backupPath)
	if err != nil {
		return "", 0, err
	}
	return backupPath, stat.Size(), nil
}

func backupDatabase(ctx context.Context, storeHandle *store.SQLiteStore, dockerClient *docker.Client, destination string, databaseID int64) (string, int64, error) {
	database, err := storeHandle.GetDatabaseByID(databaseID)
	if err != nil {
		return "", 0, err
	}
	if database == nil {
		return "", 0, fmt.Errorf("database %d not found", databaseID)
	}
	if database.ContainerID == "" {
		return "", 0, fmt.Errorf("database container not found")
	}

	if err := os.MkdirAll(destination, 0o755); err != nil {
		return "", 0, err
	}

	timestamp := time.Now().UTC().Format("2006-01-02T15-04-05")
	filename := fmt.Sprintf("database-%s-%s.sql.gz", database.Name, timestamp)
	backupPath := filepath.Join(destination, filename)

	file, err := os.Create(backupPath)
	if err != nil {
		return "", 0, err
	}
	defer file.Close()

	gzipWriter := gzip.NewWriter(file)
	defer gzipWriter.Close()

	cmd := []string{"pg_dump", "-U", "docklite", database.Name}
	if err := dockerClient.ExecCommandToWriter(ctx, database.ContainerID, cmd, nil, gzipWriter); err != nil {
		return "", 0, err
	}

	if err := gzipWriter.Close(); err != nil {
		return "", 0, err
	}
	if err := file.Sync(); err != nil {
		return "", 0, err
	}

	stat, err := os.Stat(backupPath)
	if err != nil {
		return "", 0, err
	}
	return backupPath, stat.Size(), nil
}
