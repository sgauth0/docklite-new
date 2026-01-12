
'use client';

import { useEffect, useState } from 'react';
import { useToast } from '@/lib/hooks/useToast';

interface SslStatus {
  domain: string;
  hasSSL: boolean;
  expiryDate: string | null;
  daysUntilExpiry: number | null;
  status: 'valid' | 'expiring' | 'expired' | 'none';
}

interface SslMeta {
  acmePath?: string | null;
  certCount?: number;
  hostsFound?: number;
  managedCount?: number;
  allCount?: number;
}

export default function SslStatus() {
  const [sslStatus, setSslStatus] = useState<SslStatus[]>([]);
  const [allSslStatus, setAllSslStatus] = useState<SslStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [meta, setMeta] = useState<SslMeta | null>(null);
  const [showAllModal, setShowAllModal] = useState(false);
  const toast = useToast();

  const fetchSslStatus = async () => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/ssl/status');
      if (!res.ok) {
        throw new Error('Failed to fetch SSL status');
      }
      const data = await res.json();
      setSslStatus(data.sites || []);
      setAllSslStatus(data.allSites || []);
      setMeta(data.meta || null);
      setError('');
      setLastChecked(new Date());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const repairSsl = async (domain: string) => {
    try {
      const res = await fetch('/api/ssl/repair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Failed to trigger repair');
      }
      toast.success(`Repair triggered for ${domain}`);
      fetchSslStatus();
    } catch (err: any) {
      toast.error(err.message || 'Failed to repair SSL');
    }
  };

  useEffect(() => {
    fetchSslStatus();

    // Refresh every 5 minutes
    const interval = setInterval(fetchSslStatus, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (showAllModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showAllModal]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'valid':
        return 'var(--neon-green)';
      case 'expiring':
        return '#ffa500';
      case 'expired':
        return '#ff6b6b';
      default:
        return 'var(--text-secondary)';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'valid':
        return '✓';
      case 'expiring':
        return '⚠';
      case 'expired':
        return '✗';
      default:
        return '○';
    }
  };

  const formatExpiryDate = (date: string | null, days: number | null) => {
    if (!date) return 'Unknown';
    const expiryDate = new Date(date);
    const formatted = expiryDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
    if (days !== null) {
      return `${formatted} (${days}d)`;
    }
    return formatted;
  };

  return (
    <>
      <div className="card-vapor p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div>
            <h2 className="text-2xl font-bold neon-text" style={{ color: 'var(--neon-cyan)' }}>
              🔒 SSL Certificates (DockLite Managed)
            </h2>
            <div className="text-xs font-mono mt-1 space-y-1" style={{ color: 'var(--text-secondary)' }}>
              <div>Last checked: {lastChecked ? lastChecked.toLocaleTimeString() : '—'}</div>
              {meta?.acmePath && <div>ACME: {meta.acmePath}</div>}
              {typeof meta?.managedCount === 'number' && <div>Managed containers: {meta.managedCount}</div>}
              {typeof meta?.allCount === 'number' && <div>Total certs: {meta.allCount}</div>}
            </div>
            {error && (
              <div className="text-xs font-bold mt-1" style={{ color: '#ff6b6b' }}>
                ❌ {error}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowAllModal(true)}
              disabled={loading || allSslStatus.length === 0}
              className="btn-neon px-4 py-2 text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              View All Certs ({meta?.allCount || 0})
            </button>
            <button
              onClick={fetchSslStatus}
              disabled={refreshing}
              className="btn-neon px-4 py-2 text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </div>
      {loading ? (
        <div className="text-sm font-mono" style={{ color: 'var(--text-secondary)' }}>
          ⟳ Loading SSL status...
        </div>
      ) : sslStatus.length === 0 ? (
        <div className="text-sm font-mono" style={{ color: 'var(--text-secondary)' }}>
          No DockLite-managed domains with SSL found
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full font-mono text-sm">
            <thead>
              <tr style={{ borderBottom: '2px solid var(--neon-purple)' }}>
                <th className="text-left py-3 px-4" style={{ color: 'var(--neon-pink)' }}>
                  DOMAIN
                </th>
                <th className="text-left py-3 px-4" style={{ color: 'var(--neon-pink)' }}>
                  STATUS
                </th>
                <th className="text-left py-3 px-4" style={{ color: 'var(--neon-pink)' }}>
                  EXPIRES
                </th>
                <th className="text-left py-3 px-4" style={{ color: 'var(--neon-pink)' }}>
                  ACTIONS
                </th>
              </tr>
            </thead>
            <tbody>
              {sslStatus.map((cert) => (
                <tr
                  key={cert.domain}
                  className="hover:bg-white/5 transition-colors"
                  style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}
                >
                  <td className="py-3 px-4" style={{ color: 'var(--neon-cyan)' }}>
                    {cert.domain}
                  </td>
                  <td className="py-3 px-4">
                    <span style={{ color: getStatusColor(cert.status) }}>
                      {getStatusIcon(cert.status)} {cert.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="py-3 px-4" style={{ color: 'var(--text-secondary)' }}>
                    {cert.hasSSL ? formatExpiryDate(cert.expiryDate, cert.daysUntilExpiry) : 'No SSL'}
                  </td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => repairSsl(cert.domain)}
                      className="btn-neon px-3 py-1 text-xs font-bold"
                    >
                      Repair SSL
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </div>

      {/* All Certificates Modal */}
      {showAllModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.8)' }}
          onClick={() => setShowAllModal(false)}
        >
          <div
            className="card-vapor p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold neon-text" style={{ color: 'var(--neon-cyan)' }}>
                All SSL Certificates
              </h2>
              <button
                onClick={() => setShowAllModal(false)}
                className="btn-neon px-4 py-2 text-sm font-bold"
              >
                Close
              </button>
            </div>
            <div className="text-xs font-mono mb-4" style={{ color: 'var(--text-secondary)' }}>
              Showing all {allSslStatus.length} certificates from {meta?.acmePath}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full font-mono text-sm">
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--neon-purple)' }}>
                    <th className="text-left py-3 px-4" style={{ color: 'var(--neon-pink)' }}>
                      DOMAIN
                    </th>
                    <th className="text-left py-3 px-4" style={{ color: 'var(--neon-pink)' }}>
                      STATUS
                    </th>
                    <th className="text-left py-3 px-4" style={{ color: 'var(--neon-pink)' }}>
                      EXPIRES
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {allSslStatus.map((cert) => (
                    <tr
                      key={cert.domain}
                      className="hover:bg-white/5 transition-colors"
                      style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}
                    >
                      <td className="py-3 px-4" style={{ color: 'var(--neon-cyan)' }}>
                        {cert.domain}
                      </td>
                      <td className="py-3 px-4">
                        <span style={{ color: getStatusColor(cert.status) }}>
                          {getStatusIcon(cert.status)} {cert.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-4" style={{ color: 'var(--text-secondary)' }}>
                        {formatExpiryDate(cert.expiryDate, cert.daysUntilExpiry)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
