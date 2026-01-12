import cron from 'node-cron';
import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import {
  getEnabledBackupJobs,
  getBackupJobById,
  getBackupDestinationById,
  createBackup,
  updateBackupStatus,
  updateBackupJobRunTime,
  getSiteById,
  getDatabaseById,
  getAllSites,
  getAllDatabases
} from './db';
import type { BackupJob, BackupDestination, BackupDestinationConfig } from '@/types';

const execAsync = promisify(exec);

// Parse frequency string to determine if job should run
function shouldRunJob(job: BackupJob): boolean {
  if (!job.enabled) return false;

  const now = new Date();

  // If never run before, run it
  if (!job.last_run_at) return true;

  // If next_run_at is set and in the past, run it
  if (job.next_run_at) {
    const nextRun = new Date(job.next_run_at);
    return now >= nextRun;
  }

  // Parse frequency and check
  const lastRun = new Date(job.last_run_at);
  const hoursSinceLastRun = (now.getTime() - lastRun.getTime()) / (1000 * 60 * 60);

  switch (job.frequency) {
    case 'hourly':
      return hoursSinceLastRun >= 1;
    case 'daily':
      return hoursSinceLastRun >= 24;
    case 'every-3-days':
      return hoursSinceLastRun >= 72;
    case 'weekly':
      return hoursSinceLastRun >= 168;
    case 'monthly':
      return hoursSinceLastRun >= 720; // ~30 days
    default:
      // If it's a number like "2", treat as hours
      const hours = parseInt(job.frequency);
      if (!isNaN(hours)) {
        return hoursSinceLastRun >= hours;
      }
      return false;
  }
}

// Calculate next run time based on frequency
function calculateNextRunTime(frequency: string): string {
  const now = new Date();

  switch (frequency) {
    case 'hourly':
      now.setHours(now.getHours() + 1);
      break;
    case 'daily':
      now.setDate(now.getDate() + 1);
      break;
    case 'every-3-days':
      now.setDate(now.getDate() + 3);
      break;
    case 'weekly':
      now.setDate(now.getDate() + 7);
      break;
    case 'monthly':
      now.setMonth(now.getMonth() + 1);
      break;
    default:
      // If it's a number, treat as hours
      const hours = parseInt(frequency);
      if (!isNaN(hours)) {
        now.setHours(now.getHours() + hours);
      }
  }

  return now.toISOString();
}

// Ensure backup directory exists
async function ensureBackupDir(basePath: string): Promise<void> {
  await fs.mkdir(basePath, { recursive: true });
}

// Backup a site (tar the code directory)
async function backupSite(siteId: number, destinationPath: string): Promise<{ path: string; size: number }> {
  const site = getSiteById(siteId, 0, true); // Admin access for background jobs
  if (!site) throw new Error(`Site ${siteId} not found`);

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFileName = `site-${site.domain}-${timestamp}.tar.gz`;
  const backupPath = path.join(destinationPath, backupFileName);

  // Ensure backup directory exists
  await ensureBackupDir(destinationPath);

  // Create tar.gz of the site directory
  const command = `tar -czf "${backupPath}" -C "${path.dirname(site.code_path)}" "${path.basename(site.code_path)}"`;
  await execAsync(command);

  // Get file size
  const stats = await fs.stat(backupPath);

  return {
    path: backupPath,
    size: stats.size
  };
}

// Backup a database (pg_dump)
async function backupDatabase(dbId: number, destinationPath: string): Promise<{ path: string; size: number }> {
  const database = getDatabaseById(dbId);
  if (!database) throw new Error(`Database ${dbId} not found`);

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFileName = `database-${database.name}-${timestamp}.sql.gz`;
  const backupPath = path.join(destinationPath, backupFileName);

  // Ensure backup directory exists
  await ensureBackupDir(destinationPath);

  // pg_dump the database
  const command = `docker exec ${database.container_id} pg_dump -U docklite ${database.name} | gzip > "${backupPath}"`;
  await execAsync(command);

  // Get file size
  const stats = await fs.stat(backupPath);

  return {
    path: backupPath,
    size: stats.size
  };
}

// Execute backup to local destination
async function executeLocalBackup(
  job: BackupJob,
  destination: BackupDestination,
  targetType: 'site' | 'database',
  targetId: number
): Promise<void> {
  const config: BackupDestinationConfig = JSON.parse(destination.config);
  const basePath = config.path || '/var/backups/docklite';

  // Create backup record
  const backupId = createBackup({
    job_id: job.id,
    destination_id: destination.id,
    target_type: targetType,
    target_id: targetId,
    backup_path: '',
    status: 'in_progress'
  });

  try {
    let result;

    if (targetType === 'site') {
      result = await backupSite(targetId, basePath);
    } else {
      result = await backupDatabase(targetId, basePath);
    }

    // Update backup record with success
    updateBackupStatus(backupId, 'success', null, result.size, result.path);

    console.log(`✓ Backup completed: ${result.path} (${(result.size / 1024 / 1024).toFixed(2)} MB)`);
  } catch (error: any) {
    // Update backup record with failure
    updateBackupStatus(backupId, 'failed', error.message);
    console.error(`✗ Backup failed:`, error.message);
    throw error;
  }
}

// Execute backup to SFTP destination
async function executeSFTPBackup(
  job: BackupJob,
  destination: BackupDestination,
  targetType: 'site' | 'database',
  targetId: number
): Promise<void> {
  // TODO: Implement SFTP backup using ssh2-sftp-client
  console.log('SFTP backup not yet implemented');
  throw new Error('SFTP backup not yet implemented');
}

// Execute backup to S3 destination
async function executeS3Backup(
  job: BackupJob,
  destination: BackupDestination,
  targetType: 'site' | 'database',
  targetId: number
): Promise<void> {
  // TODO: Implement S3 backup using @aws-sdk/client-s3
  console.log('S3 backup not yet implemented');
  throw new Error('S3 backup not yet implemented');
}

// Execute backup to Google Drive destination
async function executeGDriveBackup(
  job: BackupJob,
  destination: BackupDestination,
  targetType: 'site' | 'database',
  targetId: number
): Promise<void> {
  // TODO: Implement Google Drive backup using googleapis
  console.log('Google Drive backup not yet implemented');
  throw new Error('Google Drive backup not yet implemented');
}

// Execute a single backup job
async function executeBackupJob(job: BackupJob): Promise<void> {
  const destination = getBackupDestinationById(job.destination_id);
  if (!destination || !destination.enabled) {
    console.log(`Skipping job ${job.id}: destination not available`);
    return;
  }

  console.log(`▶ Running backup job ${job.id} (${job.target_type} → ${destination.name})`);

  try {
    // Determine what to backup
    const targets: Array<{ type: 'site' | 'database'; id: number }> = [];

    if (job.target_type === 'site' && job.target_id) {
      targets.push({ type: 'site', id: job.target_id });
    } else if (job.target_type === 'database' && job.target_id) {
      targets.push({ type: 'database', id: job.target_id });
    } else if (job.target_type === 'all-sites') {
      const sites = getAllSites();
      sites.forEach(site => targets.push({ type: 'site', id: site.id }));
    } else if (job.target_type === 'all-databases') {
      const databases = getAllDatabases();
      databases.forEach(db => targets.push({ type: 'database', id: db.id }));
    }

    // Execute backup for each target
    for (const target of targets) {
      switch (destination.type) {
        case 'local':
          await executeLocalBackup(job, destination, target.type, target.id);
          break;
        case 'sftp':
          await executeSFTPBackup(job, destination, target.type, target.id);
          break;
        case 's3':
        case 'backblaze':
          await executeS3Backup(job, destination, target.type, target.id);
          break;
        case 'gdrive':
          await executeGDriveBackup(job, destination, target.type, target.id);
          break;
      }
    }

    // Update job run time
    const nextRun = calculateNextRunTime(job.frequency);
    updateBackupJobRunTime(job.id, nextRun);

    console.log(`✓ Backup job ${job.id} completed. Next run: ${nextRun}`);
  } catch (error: any) {
    console.error(`✗ Backup job ${job.id} failed:`, error.message);
  }
}

// Check and run due jobs
async function checkAndRunJobs(): Promise<void> {
  const jobs = getEnabledBackupJobs();

  for (const job of jobs) {
    if (shouldRunJob(job)) {
      // Run in background, don't wait
      executeBackupJob(job).catch(err => {
        console.error(`Error executing backup job ${job.id}:`, err);
      });
    }
  }
}

// Start the backup scheduler
export function startBackupScheduler(): void {
  console.log('🔄 Starting backup scheduler (checks every 5 minutes)...');

  // Check every 5 minutes
  cron.schedule('*/5 * * * *', () => {
    console.log('⏰ Checking for due backup jobs...');
    checkAndRunJobs().catch(err => {
      console.error('Error checking backup jobs:', err);
    });
  });

  // Also run on startup (after 30 seconds)
  setTimeout(() => {
    console.log('⏰ Running initial backup check...');
    checkAndRunJobs().catch(err => {
      console.error('Error on initial backup check:', err);
    });
  }, 30000);
}

// Manual trigger for testing
export async function triggerBackupJob(jobId: number): Promise<void> {
  const job = getBackupJobById(jobId);
  if (!job) throw new Error(`Job ${jobId} not found`);

  await executeBackupJob(job);
}
