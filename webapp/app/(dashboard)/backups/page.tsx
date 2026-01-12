'use client';

import { useState, useEffect } from 'react';
import { HardDrives, ClockCounterClockwise, Gear, Plus, Play } from '@phosphor-icons/react';
import AddBackupDestinationModal from '../components/AddBackupDestinationModal';
import AddBackupJobModal from '../components/AddBackupJobModal';
import ConfirmDeleteModal from '../components/ConfirmDeleteModal';
import { useToast } from '@/lib/hooks/useToast';

type Tab = 'destinations' | 'jobs' | 'history' | 'local';

export default function BackupsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('destinations');
  const [destinations, setDestinations] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [backups, setBackups] = useState([]);
  const [localBackups, setLocalBackups] = useState([]);
  const [localBackupPath, setLocalBackupPath] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAddDestinationModal, setShowAddDestinationModal] = useState(false);
  const [showAddJobModal, setShowAddJobModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    type: 'destination' | 'job' | 'local-file' | 'history';
    id?: number;
    name: string;
  } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const toast = useToast();

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'destinations') {
        const res = await fetch('/api/backups/destinations');
        const data = await res.json();
        setDestinations(data.destinations || []);
      } else if (activeTab === 'jobs') {
        const res = await fetch('/api/backups/jobs');
        const data = await res.json();
        setJobs(data.jobs || []);
      } else if (activeTab === 'history') {
        const [backupsRes, destinationsRes] = await Promise.all([
          fetch('/api/backups'),
          fetch('/api/backups/destinations')
        ]);
        const backupsData = await backupsRes.json();
        const destinationsData = await destinationsRes.json();
        setBackups(backupsData.backups || []);
        setDestinations(destinationsData.destinations || []);
      } else if (activeTab === 'local') {
        const res = await fetch('/api/backups/local');
        const data = await res.json();
        setLocalBackups(data.files || []);
        setLocalBackupPath(data.path || '');
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmAction) return;
    setDeleteLoading(true);
    try {
      let endpoint = '';

      if (confirmAction.type === 'destination') {
        endpoint = `/api/backups/destinations?id=${confirmAction.id}`;
      } else if (confirmAction.type === 'job') {
        endpoint = `/api/backups/jobs?id=${confirmAction.id}`;
      } else if (confirmAction.type === 'local-file') {
        endpoint = `/api/backups/local?file=${encodeURIComponent(confirmAction.name)}`;
      } else if (confirmAction.type === 'history') {
        endpoint = '/api/backups/history';
      }

      const res = await fetch(endpoint, { method: 'DELETE' });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete');
      }

      loadData();
      setConfirmAction(null);
      if (confirmAction.type === 'destination') {
        toast.success('Destination deleted successfully');
      } else if (confirmAction.type === 'job') {
        toast.success('Backup job deleted successfully');
      } else if (confirmAction.type === 'local-file') {
        toast.success('Backup file deleted successfully');
      } else if (confirmAction.type === 'history') {
        toast.success('Backup history cleared');
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold neon-text-pink">
          <HardDrives size={32} weight="duotone" color="#d90fd9" className="inline mr-2" />
          Backups
        </h1>
        <button
          onClick={() => {
            if (activeTab === 'destinations') {
              setShowAddDestinationModal(true);
            } else if (activeTab === 'jobs') {
              setShowAddJobModal(true);
            }
          }}
          className="cyber-button flex items-center gap-2"
        >
          <Plus size={20} weight="duotone" />
          {activeTab === 'destinations' && 'Add Destination'}
          {activeTab === 'jobs' && 'Add Backup Job'}
          {(activeTab === 'history' || activeTab === 'local') && 'Refresh'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-neon-purple/30">
        <button
          onClick={() => setActiveTab('destinations')}
          className={`px-4 py-2 font-bold transition-colors ${
            activeTab === 'destinations'
              ? 'border-b-2 border-neon-pink text-neon-pink'
              : 'text-gray-400 hover:text-neon-cyan'
          }`}
        >
          <Gear size={20} weight="duotone" className="inline mr-2" />
          Destinations
        </button>
        <button
          onClick={() => setActiveTab('jobs')}
          className={`px-4 py-2 font-bold transition-colors ${
            activeTab === 'jobs'
              ? 'border-b-2 border-neon-pink text-neon-pink'
              : 'text-gray-400 hover:text-neon-cyan'
          }`}
        >
          <ClockCounterClockwise size={20} weight="duotone" className="inline mr-2" />
          Jobs
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 font-bold transition-colors ${
            activeTab === 'history'
              ? 'border-b-2 border-neon-pink text-neon-pink'
              : 'text-gray-400 hover:text-neon-cyan'
          }`}
        >
          <HardDrives size={20} weight="duotone" className="inline mr-2" />
          History
        </button>
        <button
          onClick={() => setActiveTab('local')}
          className={`px-4 py-2 font-bold transition-colors ${
            activeTab === 'local'
              ? 'border-b-2 border-neon-pink text-neon-pink'
              : 'text-gray-400 hover:text-neon-cyan'
          }`}
        >
          <HardDrives size={20} weight="duotone" className="inline mr-2" />
          Local
        </button>
      </div>

      {/* Content */}
      <div className="cyber-card p-6">
        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading...</div>
        ) : (
          <>
            {activeTab === 'destinations' && (
              <DestinationsTab
                destinations={destinations}
                onRefresh={loadData}
                onDelete={(id: number, name: string) => setConfirmAction({ type: 'destination', id, name })}
              />
            )}
            {activeTab === 'jobs' && (
              <JobsTab
                jobs={jobs}
                onRefresh={loadData}
                onDelete={(id: number, name: string) => setConfirmAction({ type: 'job', id, name })}
                toast={toast}
              />
            )}
            {activeTab === 'history' && (
              <HistoryTab
                backups={backups}
                onClearHistory={() => setConfirmAction({ type: 'history', name: 'All backup history' })}
              />
            )}
            {activeTab === 'local' && (
              <LocalBackupsTab
                localBackups={localBackups}
                backupPath={localBackupPath}
                onDeleteFile={(fileName: string) => setConfirmAction({ type: 'local-file', name: fileName })}
              />
            )}
          </>
        )}
      </div>

      {showAddDestinationModal && (
        <AddBackupDestinationModal
          onClose={() => setShowAddDestinationModal(false)}
          onSuccess={() => {
            loadData();
            setActiveTab('destinations');
          }}
        />
      )}

      {showAddJobModal && (
        <AddBackupJobModal
          destinations={destinations}
          onClose={() => setShowAddJobModal(false)}
          onSuccess={() => {
            loadData();
            setActiveTab('jobs');
          }}
        />
      )}

      {confirmAction && (
        <ConfirmDeleteModal
          title={
            confirmAction.type === 'destination'
              ? 'Delete Backup Destination'
              : confirmAction.type === 'job'
                ? 'Delete Backup Job'
                : confirmAction.type === 'local-file'
                  ? 'Delete Backup File'
                  : 'Clear Backup History'
          }
          message={
            confirmAction.type === 'destination'
              ? 'Are you sure you want to delete this destination? All jobs using this destination will be affected.'
              : confirmAction.type === 'job'
                ? 'Are you sure you want to delete this backup job?'
                : confirmAction.type === 'local-file'
                  ? 'Are you sure you want to delete this backup file?'
                  : 'Are you sure you want to clear all backup history records?'
          }
          itemName={confirmAction.name}
          onConfirm={handleDelete}
          onCancel={() => setConfirmAction(null)}
          loading={deleteLoading}
        />
      )}
      <toast.ToastContainer />
    </div>
  );
}

function DestinationsTab({ destinations, onRefresh, onDelete }: any) {
  const getDestinationIcon = (type: string) => {
    return <HardDrives size={24} weight="duotone" color="#00e863" />;
  };

  return (
    <div className="space-y-4">
      {destinations.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          No backup destinations configured yet
        </div>
      ) : (
        destinations.map((dest: any) => (
          <div
            key={dest.id}
            className="flex items-center justify-between p-4 bg-dark-bg/50 rounded-lg border border-neon-purple/20 hover:border-neon-cyan/40 transition-colors"
          >
            <div className="flex items-center gap-4">
              {getDestinationIcon(dest.type)}
              <div>
                <h3 className="font-bold text-neon-cyan">{dest.name}</h3>
                <p className="text-sm text-gray-400">
                  Type: {dest.type.toUpperCase()} • {dest.enabled ? 'Enabled' : 'Disabled'}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => onDelete(dest.id, dest.name)}
                className="cyber-button-sm bg-red-500/20 hover:bg-red-500/30 border border-red-500/30"
                style={{ color: '#ff6b6b' }}
              >
                Delete
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function JobsTab({ jobs, onRefresh, onDelete, toast }: any) {
  const triggerJob = async (jobId: number) => {
    try {
      const res = await fetch('/api/backups/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_id: jobId })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to trigger backup job');
      }

      toast.success('Backup job triggered successfully!');
      onRefresh();
    } catch (error) {
      console.error('Error triggering job:', error);
      const message = error instanceof Error ? error.message : 'Failed to trigger backup job';
      toast.error(message);
    }
  };

  return (
    <div className="space-y-4">
      {jobs.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No backup jobs configured yet</div>
      ) : (
        jobs.map((job: any) => (
          <div
            key={job.id}
            className="flex items-center justify-between p-4 bg-dark-bg/50 rounded-lg border border-neon-purple/20 hover:border-neon-cyan/40 transition-colors"
          >
            <div className="flex-1">
              <h3 className="font-bold text-neon-pink">
                {job.target_type.replace('-', ' ').toUpperCase()}
                {job.target_id ? ` #${job.target_id}` : ''}
              </h3>
              <p className="text-sm text-gray-400">
                Frequency: {job.frequency} • Retention: {job.retention_days} days
              </p>
              {job.last_run_at && (
                <p className="text-xs text-gray-500">
                  Last run: {new Date(job.last_run_at).toLocaleString()}
                </p>
              )}
              {job.next_run_at && (
                <p className="text-xs text-gray-500">
                  Next run: {new Date(job.next_run_at).toLocaleString()}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => triggerJob(job.id)}
                className="cyber-button-sm flex items-center gap-2"
              >
                <Play size={16} weight="duotone" />
                Run Now
              </button>
              <button
                onClick={() => onDelete(job.id, `${job.target_type} backup`)}
                className="cyber-button-sm bg-red-500/20 hover:bg-red-500/30 border border-red-500/30"
                style={{ color: '#ff6b6b' }}
              >
                Delete
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function formatBytes(bytes?: number) {
  if (bytes === undefined || bytes === null || Number.isNaN(bytes)) return 'N/A';
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, index);
  const decimals = value >= 10 || index === 0 ? 0 : 2;
  return `${value.toFixed(decimals)} ${units[index]}`;
}

function HistoryTab({ backups, onClearHistory }: any) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'text-neon-green';
      case 'failed':
        return 'text-red-500';
      case 'in_progress':
        return 'text-yellow-500';
      default:
        return 'text-gray-400';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-400">
          Total records: {backups.length}
        </div>
        <button
          onClick={onClearHistory}
          className="cyber-button-sm bg-red-500/20 hover:bg-red-500/30 border border-red-500/30"
          style={{ color: '#ff6b6b' }}
        >
          Clear History
        </button>
      </div>
      {backups.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No backup history yet</div>
      ) : (
        backups.map((backup: any) => (
          <div
            key={backup.id}
            className="flex items-center justify-between p-4 bg-dark-bg/50 rounded-lg border border-neon-purple/20"
          >
            <div className="flex-1">
              <h3 className="font-bold text-neon-cyan">
                {backup.target_type.toUpperCase()} #{backup.target_id}
              </h3>
              <p className="text-sm text-gray-400">
                Path: {backup.backup_path || 'N/A'}
              </p>
              <p className="text-sm text-gray-400">
                Size: {formatBytes(backup.size_bytes)}
              </p>
              <p className="text-xs text-gray-500">
                Created: {new Date(backup.created_at).toLocaleString()}
              </p>
            </div>
            <div className="text-right">
              <p className={`font-bold ${getStatusColor(backup.status)}`}>
                {backup.status.toUpperCase()}
              </p>
              {backup.error_message && (
                <p className="text-xs text-red-400 mt-1">{backup.error_message}</p>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function LocalBackupsTab({ localBackups, backupPath, onDeleteFile }: any) {
  return (
    <div className="space-y-4">
      {backupPath && (
        <div className="text-xs text-gray-500">
          Directory: {backupPath}
        </div>
      )}
      {localBackups.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No local backups yet</div>
      ) : (
        localBackups.map((backup: any) => {
          return (
            <div
              key={backup.name}
              className="flex items-center justify-between p-4 bg-dark-bg/50 rounded-lg border border-neon-purple/20"
            >
              <div className="flex-1">
                <h3 className="font-bold text-neon-cyan">
                  {backup.name}
                </h3>
                <p className="text-sm text-gray-400">
                  Size: {formatBytes(backup.size)}
                </p>
                {backup.modified_at && (
                  <p className="text-xs text-gray-500">
                    Modified: {new Date(backup.modified_at).toLocaleString()}
                  </p>
                )}
              </div>
              <div className="text-right flex flex-col gap-2 items-end">
                <a
                  href={`/api/backups/local/download?file=${encodeURIComponent(backup.name)}`}
                  className="cyber-button-sm"
                >
                  Download
                </a>
                <button
                  onClick={() => onDeleteFile(backup.name)}
                  className="cyber-button-sm bg-red-500/20 hover:bg-red-500/30 border border-red-500/30"
                  style={{ color: '#ff6b6b' }}
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
