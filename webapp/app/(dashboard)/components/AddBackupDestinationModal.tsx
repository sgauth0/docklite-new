'use client';

import { useState } from 'react';
import { HardDrives, X } from '@phosphor-icons/react';

interface AddBackupDestinationModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

type DestinationType = 'local' | 'sftp' | 's3' | 'gdrive' | 'backblaze';

const DESTINATION_TYPES = [
  { value: 'local', label: 'Local Storage', description: 'Save to local server directory' },
  { value: 'sftp', label: 'SFTP', description: 'Secure File Transfer Protocol' },
  { value: 's3', label: 'Amazon S3', description: 'AWS S3 bucket storage' },
  { value: 'backblaze', label: 'Backblaze B2', description: 'Backblaze cloud storage' },
];

export default function AddBackupDestinationModal({ onClose, onSuccess }: AddBackupDestinationModalProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<DestinationType>('local');
  const [enabled, setEnabled] = useState(true);

  // Local config
  const [path, setPath] = useState('/var/backups/docklite');

  // SFTP config
  const [host, setHost] = useState('');
  const [port, setPort] = useState(22);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remotePath, setRemotePath] = useState('/backups');

  // S3/Backblaze config
  const [bucket, setBucket] = useState('');
  const [region, setRegion] = useState('us-east-1');
  const [accessKey, setAccessKey] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [endpoint, setEndpoint] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let config: any = {};

      switch (type) {
        case 'local':
          config = { path };
          break;
        case 'sftp':
          config = { host, port, username, password, remotePath };
          break;
        case 's3':
          config = { bucket, region, accessKey, secretKey };
          break;
        case 'backblaze':
          config = { bucket, endpoint, accessKey, secretKey };
          break;
      }

      const res = await fetch('/api/backups/destinations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          type,
          config,
          enabled: enabled ? 1 : 0
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create backup destination');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div
        className="card-vapor max-w-2xl w-full p-6 relative max-h-[90vh] overflow-y-auto"
        style={{
          background: 'linear-gradient(135deg, rgba(26, 10, 46, 0.98) 0%, rgba(10, 5, 30, 0.98) 100%)',
          border: '2px solid var(--neon-purple)',
          boxShadow: '0 0 30px rgba(181, 55, 242, 0.5)',
        }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-lg transition-all hover:scale-110"
          style={{
            background: 'rgba(255, 107, 107, 0.2)',
            border: '1px solid #ff6b6b',
          }}
        >
          <X size={20} color="#ff6b6b" weight="bold" />
        </button>

        <div className="mb-6">
          <h2 className="text-2xl font-bold neon-text flex items-center gap-3" style={{ color: 'var(--neon-cyan)' }}>
            <HardDrives size={32} weight="duotone" color="#00e863" />
            Add Backup Destination
          </h2>
          <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
            Configure where backups will be stored
          </p>
        </div>

        {error && (
          <div
            className="mb-4 p-3 rounded-lg border"
            style={{
              background: 'rgba(255, 107, 107, 0.1)',
              border: '1px solid #ff6b6b',
              color: '#ff6b6b',
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold mb-2" style={{ color: 'var(--neon-pink)' }}>
              Destination Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Backup Storage"
              className="input-vapor w-full"
              required
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-bold mb-2" style={{ color: 'var(--neon-pink)' }}>
              Storage Type
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as DestinationType)}
              className="input-vapor w-full"
              required
              disabled={loading}
            >
              {DESTINATION_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label} - {t.description}
                </option>
              ))}
            </select>
          </div>

          {/* Local Storage Config */}
          {type === 'local' && (
            <div>
              <label className="block text-sm font-bold mb-2" style={{ color: 'var(--neon-pink)' }}>
                Local Path
              </label>
              <input
                type="text"
                value={path}
                onChange={(e) => setPath(e.target.value)}
                placeholder="/var/backups/docklite"
                className="input-vapor w-full font-mono text-sm"
                required
                disabled={loading}
              />
              <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                Directory where backups will be stored on the server
              </p>
            </div>
          )}

          {/* SFTP Config */}
          {type === 'sftp' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold mb-2" style={{ color: 'var(--neon-pink)' }}>
                    Host
                  </label>
                  <input
                    type="text"
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                    placeholder="sftp.example.com"
                    className="input-vapor w-full"
                    required
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2" style={{ color: 'var(--neon-pink)' }}>
                    Port
                  </label>
                  <input
                    type="number"
                    value={port}
                    onChange={(e) => setPort(Number(e.target.value))}
                    className="input-vapor w-full"
                    required
                    disabled={loading}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold mb-2" style={{ color: 'var(--neon-pink)' }}>
                    Username
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="input-vapor w-full"
                    required
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2" style={{ color: 'var(--neon-pink)' }}>
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-vapor w-full"
                    required
                    disabled={loading}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold mb-2" style={{ color: 'var(--neon-pink)' }}>
                  Remote Path
                </label>
                <input
                  type="text"
                  value={remotePath}
                  onChange={(e) => setRemotePath(e.target.value)}
                  placeholder="/backups"
                  className="input-vapor w-full font-mono text-sm"
                  required
                  disabled={loading}
                />
              </div>
            </>
          )}

          {/* S3 Config */}
          {type === 's3' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold mb-2" style={{ color: 'var(--neon-pink)' }}>
                    Bucket Name
                  </label>
                  <input
                    type="text"
                    value={bucket}
                    onChange={(e) => setBucket(e.target.value)}
                    placeholder="my-backups"
                    className="input-vapor w-full"
                    required
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2" style={{ color: 'var(--neon-pink)' }}>
                    Region
                  </label>
                  <input
                    type="text"
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    placeholder="us-east-1"
                    className="input-vapor w-full"
                    required
                    disabled={loading}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold mb-2" style={{ color: 'var(--neon-pink)' }}>
                    Access Key ID
                  </label>
                  <input
                    type="text"
                    value={accessKey}
                    onChange={(e) => setAccessKey(e.target.value)}
                    className="input-vapor w-full font-mono text-sm"
                    required
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2" style={{ color: 'var(--neon-pink)' }}>
                    Secret Access Key
                  </label>
                  <input
                    type="password"
                    value={secretKey}
                    onChange={(e) => setSecretKey(e.target.value)}
                    className="input-vapor w-full font-mono text-sm"
                    required
                    disabled={loading}
                  />
                </div>
              </div>
            </>
          )}

          {/* Backblaze Config */}
          {type === 'backblaze' && (
            <>
              <div>
                <label className="block text-sm font-bold mb-2" style={{ color: 'var(--neon-pink)' }}>
                  Bucket Name
                </label>
                <input
                  type="text"
                  value={bucket}
                  onChange={(e) => setBucket(e.target.value)}
                  placeholder="my-backups"
                  className="input-vapor w-full"
                  required
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-sm font-bold mb-2" style={{ color: 'var(--neon-pink)' }}>
                  Endpoint URL
                </label>
                <input
                  type="text"
                  value={endpoint}
                  onChange={(e) => setEndpoint(e.target.value)}
                  placeholder="s3.us-west-002.backblazeb2.com"
                  className="input-vapor w-full font-mono text-sm"
                  required
                  disabled={loading}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold mb-2" style={{ color: 'var(--neon-pink)' }}>
                    Application Key ID
                  </label>
                  <input
                    type="text"
                    value={accessKey}
                    onChange={(e) => setAccessKey(e.target.value)}
                    className="input-vapor w-full font-mono text-sm"
                    required
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2" style={{ color: 'var(--neon-pink)' }}>
                    Application Key
                  </label>
                  <input
                    type="password"
                    value={secretKey}
                    onChange={(e) => setSecretKey(e.target.value)}
                    className="input-vapor w-full font-mono text-sm"
                    required
                    disabled={loading}
                  />
                </div>
              </div>
            </>
          )}

          <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'rgba(0, 232, 99, 0.1)' }}>
            <input
              type="checkbox"
              id="enabled"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="w-4 h-4"
              disabled={loading}
            />
            <label htmlFor="enabled" className="text-sm font-bold" style={{ color: 'var(--neon-green)' }}>
              Enable this destination
            </label>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-3 rounded-lg font-bold transition-all hover:scale-105"
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: 'var(--text-secondary)',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="flex-1 px-4 py-3 rounded-lg font-bold transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: 'linear-gradient(135deg, var(--neon-cyan) 0%, var(--neon-purple) 100%)',
                color: 'white',
                boxShadow: '0 0 20px rgba(0, 232, 99, 0.4)',
              }}
            >
              {loading ? 'Creating...' : 'Create Destination'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
