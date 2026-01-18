package backup

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"time"

	"docklite-agent/internal/docker"
	"docklite-agent/internal/store"
)

type DestinationConfig struct {
	Path string `json:"path"`
}

func StartScheduler(storeHandle *store.SQLiteStore, dockerClient *docker.Client, backupBaseDir string) {
	go func() {
		ticker := time.NewTicker(5 * time.Minute)
		defer ticker.Stop()

		time.Sleep(30 * time.Second)
		checkAndRunJobs(storeHandle, dockerClient, backupBaseDir)

		for range ticker.C {
			checkAndRunJobs(storeHandle, dockerClient, backupBaseDir)
		}
	}()
}

func TriggerJob(ctx context.Context, storeHandle *store.SQLiteStore, dockerClient *docker.Client, backupBaseDir string, jobID int64) error {
	job, err := storeHandle.GetBackupJobByID(jobID)
	if err != nil {
		return err
	}
	if job == nil {
		return fmt.Errorf("job %d not found", jobID)
	}
	return executeBackupJob(ctx, storeHandle, dockerClient, backupBaseDir, *job)
}

func checkAndRunJobs(storeHandle *store.SQLiteStore, dockerClient *docker.Client, backupBaseDir string) {
	jobs, err := storeHandle.GetEnabledBackupJobs()
	if err != nil {
		return
	}
	for _, job := range jobs {
		if shouldRunJob(job) {
			_ = executeBackupJob(context.Background(), storeHandle, dockerClient, backupBaseDir, job)
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

func executeBackupJob(ctx context.Context, storeHandle *store.SQLiteStore, dockerClient *docker.Client, backupBaseDir string, job store.BackupJob) error {
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
		if err := executeDestinationBackup(ctx, storeHandle, dockerClient, backupBaseDir, job, *dest, target); err != nil {
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

func executeDestinationBackup(ctx context.Context, storeHandle *store.SQLiteStore, dockerClient *docker.Client, backupBaseDir string, job store.BackupJob, dest store.BackupDestination, target targetRef) error {
	switch dest.Type {
	case "local":
		return executeLocalBackup(ctx, storeHandle, dockerClient, backupBaseDir, job, dest, target)
	default:
		return fmt.Errorf("%s backup not implemented", dest.Type)
	}
}

func executeLocalBackup(ctx context.Context, storeHandle *store.SQLiteStore, dockerClient *docker.Client, backupBaseDir string, job store.BackupJob, dest store.BackupDestination, target targetRef) error {
	basePath := backupBaseDir
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

	var artifact *ArtifactResult

	switch target.Type {
	case "site":
		artifact, err = CreateSiteBackup(ctx, storeHandle, basePath, "sites", target.ID, "")
	case "database":
		artifact, err = CreateDatabaseBackup(ctx, storeHandle, dockerClient, basePath, "databases", target.ID, "")
	default:
		err = fmt.Errorf("unsupported target type")
	}

	if err != nil {
		message := err.Error()
		_ = storeHandle.UpdateBackupStatus(backupID, "failed", &message, nil, nil)
		return err
	}

	if artifact != nil {
		_ = storeHandle.UpdateBackupStatus(backupID, "success", nil, &artifact.Size, &artifact.Path)
	} else {
		_ = storeHandle.UpdateBackupStatus(backupID, "success", nil, nil, nil)
	}

	if job.RetentionDays > 0 {
		_ = cleanupOldBackups(storeHandle, dest.ID, job.RetentionDays)
	}
	return nil
}
