'use client';

import { useState, useEffect } from 'react';
import { Globe, Plus, ArrowsClockwise, Gear } from '@phosphor-icons/react';
import AddDnsZoneModal from '../components/AddDnsZoneModal';
import AddDnsRecordModal from '../components/AddDnsRecordModal';
import ConfirmDeleteModal from '../components/ConfirmDeleteModal';

export default function DNSPage() {
  const [activeTab, setActiveTab] = useState<'config' | 'zones' | 'records'>('config');
  const [config, setConfig] = useState<any>(null);
  const [zones, setZones] = useState<any[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [selectedZone, setSelectedZone] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [showAddZoneModal, setShowAddZoneModal] = useState(false);
  const [showAddRecordModal, setShowAddRecordModal] = useState(false);
  const [deleteZone, setDeleteZone] = useState<{ id: number; domain: string } | null>(null);
  const [deleteRecord, setDeleteRecord] = useState<{ id: number; name: string; type: string } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    loadConfig();
    loadZones();
  }, []);

  useEffect(() => {
    if (selectedZone && activeTab === 'records') {
      loadRecords(selectedZone);
    }
  }, [selectedZone, activeTab]);

  const loadConfig = async () => {
    try {
      const res = await fetch('/api/dns/config');
      const data = await res.json();
      setConfig(data);
    } catch (error) {
      console.error('Error loading config:', error);
    }
  };

  const loadZones = async () => {
    try {
      const res = await fetch('/api/dns/zones');
      const data = await res.json();
      setZones(data.zones || []);
      if (data.zones?.length > 0 && !selectedZone) {
        setSelectedZone(data.zones[0].id);
      }
    } catch (error) {
      console.error('Error loading zones:', error);
    }
  };

  const loadRecords = async (zoneId: number) => {
    try {
      const res = await fetch(`/api/dns/records?zone_id=${zoneId}`);
      const data = await res.json();
      setRecords(data.records || []);
    } catch (error) {
      console.error('Error loading records:', error);
    }
  };

  const saveConfig = async (apiToken: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/dns/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_token: apiToken, enabled: 1 })
      });

      if (res.ok) {
        alert('Configuration saved successfully!');
        loadConfig();
      } else {
        const data = await res.json();
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Error saving config:', error);
      alert('Failed to save configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteZone = async () => {
    if (!deleteZone) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/dns/zones?id=${deleteZone.id}`, {
        method: 'DELETE'
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete zone');
      }

      loadZones();
      setDeleteZone(null);
      alert('✓ DNS zone deleted successfully');
    } catch (error: any) {
      alert(`❌ Error: ${error.message}`);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleDeleteRecord = async () => {
    if (!deleteRecord) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/dns/records?id=${deleteRecord.id}`, {
        method: 'DELETE'
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete record');
      }

      if (selectedZone) loadRecords(selectedZone);
      setDeleteRecord(null);
      alert('✓ DNS record deleted successfully');
    } catch (error: any) {
      alert(`❌ Error: ${error.message}`);
    } finally {
      setDeleteLoading(false);
    }
  };

  const syncRecords = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/dns/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      const data = await res.json();
      if (res.ok) {
        alert(`✓ Success: ${data.message}\n\n${data.results?.map((r: any) =>
          `${r.zone}: ${r.records} records (${r.status})`
        ).join('\n') || ''}`);
        loadZones();
        if (selectedZone) loadRecords(selectedZone);
      } else {
        // Better error messages
        let errorMsg = data.error;
        if (errorMsg.includes('API token not configured')) {
          errorMsg = '⚠️ Cloudflare API token not configured.\n\nPlease go to the Configuration tab and add your API token first.';
        } else if (errorMsg.includes('No zones to sync')) {
          errorMsg = '⚠️ No DNS zones configured.\n\nPlease add a DNS zone first using the "Add Zone" button in the Zones tab.';
        } else if (errorMsg.includes('integration is disabled')) {
          errorMsg = '⚠️ Cloudflare integration is disabled.\n\nPlease enable it in the Configuration tab.';
        }
        alert(errorMsg);
      }
    } catch (error) {
      console.error('Error syncing records:', error);
      alert('❌ Failed to sync records. Please check your network connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold neon-text-pink">
          <Globe size={32} weight="duotone" color="#d90fd9" className="inline mr-2" />
          DNS Management
        </h1>
        <div className="flex gap-2">
          {config?.hasToken && (
            <button
              onClick={syncRecords}
              disabled={loading}
              className="cyber-button flex items-center gap-2"
            >
              <ArrowsClockwise size={20} weight="duotone" />
              Sync from Cloudflare
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-neon-purple/30">
        <button
          onClick={() => setActiveTab('config')}
          className={`px-4 py-2 font-bold transition-colors ${
            activeTab === 'config'
              ? 'border-b-2 border-neon-pink text-neon-pink'
              : 'text-gray-400 hover:text-neon-cyan'
          }`}
        >
          <Gear size={20} weight="duotone" className="inline mr-2" />
          Configuration
        </button>
        <button
          onClick={() => setActiveTab('zones')}
          className={`px-4 py-2 font-bold transition-colors ${
            activeTab === 'zones'
              ? 'border-b-2 border-neon-pink text-neon-pink'
              : 'text-gray-400 hover:text-neon-cyan'
          }`}
        >
          <Globe size={20} weight="duotone" className="inline mr-2" />
          Zones
        </button>
        <button
          onClick={() => setActiveTab('records')}
          className={`px-4 py-2 font-bold transition-colors ${
            activeTab === 'records'
              ? 'border-b-2 border-neon-pink text-neon-pink'
              : 'text-gray-400 hover:text-neon-cyan'
          }`}
        >
          DNS Records
        </button>
      </div>

      {/* Content */}
      <div className="cyber-card p-6">
        {activeTab === 'config' && (
          <ConfigTab
            config={config}
            onSave={saveConfig}
            loading={loading}
          />
        )}
        {activeTab === 'zones' && (
          <ZonesTab
            zones={zones}
            onRefresh={loadZones}
            onAddZone={() => setShowAddZoneModal(true)}
            onDeleteZone={(id: number, domain: string) => setDeleteZone({ id, domain })}
          />
        )}
        {activeTab === 'records' && (
          <RecordsTab
            records={records}
            zones={zones}
            selectedZone={selectedZone}
            onZoneChange={setSelectedZone}
            onRefresh={() => selectedZone && loadRecords(selectedZone)}
            onAddRecord={() => setShowAddRecordModal(true)}
            onDeleteRecord={(id: number, name: string, type: string) => setDeleteRecord({ id, name, type })}
          />
        )}
      </div>

      {showAddZoneModal && (
        <AddDnsZoneModal
          onClose={() => setShowAddZoneModal(false)}
          onSuccess={() => {
            loadZones();
            if (activeTab === 'zones') {
              // Stay on zones tab after adding
            } else {
              setActiveTab('zones');
            }
          }}
        />
      )}

      {showAddRecordModal && (
        <AddDnsRecordModal
          zones={zones}
          selectedZone={selectedZone}
          onClose={() => setShowAddRecordModal(false)}
          onSuccess={() => {
            if (selectedZone) loadRecords(selectedZone);
          }}
        />
      )}

      {deleteZone && (
        <ConfirmDeleteModal
          title="Delete DNS Zone"
          message="Are you sure you want to delete this DNS zone? All associated DNS records will also be removed."
          itemName={deleteZone.domain}
          onConfirm={handleDeleteZone}
          onCancel={() => setDeleteZone(null)}
          loading={deleteLoading}
        />
      )}

      {deleteRecord && (
        <ConfirmDeleteModal
          title="Delete DNS Record"
          message="Are you sure you want to delete this DNS record?"
          itemName={`${deleteRecord.type} ${deleteRecord.name}`}
          onConfirm={handleDeleteRecord}
          onCancel={() => setDeleteRecord(null)}
          loading={deleteLoading}
        />
      )}
    </div>
  );
}

function ConfigTab({ config, onSave, loading }: any) {
  const [apiToken, setApiToken] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (apiToken.trim()) {
      onSave(apiToken);
      setApiToken('');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-neon-cyan mb-4">Cloudflare API Configuration</h2>
        <p className="text-gray-400 mb-6">
          Enter your Cloudflare API token to enable DNS management.
          Create a token at{' '}
          <a
            href="https://dash.cloudflare.com/profile/api-tokens"
            target="_blank"
            rel="noopener noreferrer"
            className="text-neon-pink hover:underline"
          >
            dash.cloudflare.com/profile/api-tokens
          </a>
        </p>

        <div className="bg-dark-bg/50 p-4 rounded-lg mb-6">
          <p className="text-sm text-gray-400">
            Status: {config?.hasToken ? (
              <span className="text-neon-green">✓ Configured</span>
            ) : (
              <span className="text-yellow-500">⚠ Not configured</span>
            )}
          </p>
          {config?.hasToken && (
            <p className="text-sm text-gray-400 mt-2">
              Integration: {config.enabled ? (
                <span className="text-neon-green">Enabled</span>
              ) : (
                <span className="text-gray-500">Disabled</span>
              )}
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-neon-cyan mb-2">
              Cloudflare API Token
            </label>
            <input
              type="password"
              value={apiToken}
              onChange={(e) => setApiToken(e.target.value)}
              placeholder="Enter your Cloudflare API token..."
              className="input-vapor w-full"
              disabled={loading}
            />
            <p className="text-xs text-gray-500 mt-2">
              Your token is stored securely and never exposed in the UI
            </p>
          </div>

          <button
            type="submit"
            disabled={loading || !apiToken.trim()}
            className="cyber-button"
          >
            {loading ? 'Verifying...' : 'Save Configuration'}
          </button>
        </form>
      </div>
    </div>
  );
}

function ZonesTab({ zones, onRefresh, onAddZone, onDeleteZone }: any) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-neon-cyan">DNS Zones</h2>
        <button
          onClick={onAddZone}
          className="cyber-button-sm flex items-center gap-2"
        >
          <Plus size={16} weight="duotone" />
          Add Zone
        </button>
      </div>

      {zones.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          No DNS zones configured yet
        </div>
      ) : (
        zones.map((zone: any) => (
          <div
            key={zone.id}
            className="flex items-center justify-between p-4 bg-dark-bg/50 rounded-lg border border-neon-purple/20"
          >
            <div>
              <h3 className="font-bold text-neon-cyan">{zone.domain}</h3>
              <p className="text-sm text-gray-400">Zone ID: {zone.zone_id}</p>
              {zone.last_synced_at && (
                <p className="text-xs text-gray-500">
                  Last synced: {new Date(zone.last_synced_at).toLocaleString()}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => onDeleteZone(zone.id, zone.domain)}
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

function RecordsTab({ records, zones, selectedZone, onZoneChange, onRefresh, onAddRecord, onDeleteRecord }: any) {
  const selectedZoneData = zones.find((z: any) => z.id === selectedZone);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold text-neon-cyan">DNS Records</h2>
          {zones.length > 0 && (
            <select
              value={selectedZone || ''}
              onChange={(e) => onZoneChange(parseInt(e.target.value))}
              className="input-vapor"
            >
              {zones.map((zone: any) => (
                <option key={zone.id} value={zone.id}>
                  {zone.domain}
                </option>
              ))}
            </select>
          )}
        </div>
        {zones.length === 0 ? (
          <div
            className="px-4 py-2 rounded-lg text-sm font-bold"
            style={{
              background: 'rgba(255, 165, 0, 0.1)',
              border: '1px solid rgba(255, 165, 0, 0.3)',
              color: '#ffa500',
            }}
          >
            ⚠️ Add a zone first to create records
          </div>
        ) : (
          <button
            onClick={onAddRecord}
            className="cyber-button-sm flex items-center gap-2"
          >
            <Plus size={16} weight="duotone" />
            Add Record
          </button>
        )}
      </div>

      {zones.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-400 mb-4">
            No zones configured yet.
          </p>
          <p className="text-sm text-gray-500">
            Go to the <span className="text-neon-cyan font-bold">Zones</span> tab to add a DNS zone first.
          </p>
        </div>
      ) : records.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          No DNS records found. Try syncing from Cloudflare or add a record manually.
        </div>
      ) : (
        <div className="space-y-2">
          {records.map((record: any) => (
            <div
              key={record.id}
              className="flex items-center justify-between p-4 bg-dark-bg/50 rounded-lg border border-neon-purple/20"
            >
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <span className="px-2 py-1 bg-neon-purple/20 text-neon-purple text-xs font-bold rounded">
                    {record.type}
                  </span>
                  <span className="font-bold text-neon-cyan">{record.name}</span>
                  {record.proxied === 1 && (
                    <span className="px-2 py-1 bg-orange-500/20 text-orange-400 text-xs font-bold rounded">
                      PROXIED
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-400 mt-1">{record.content}</p>
                <p className="text-xs text-gray-500">
                  TTL: {record.ttl === 1 ? 'Auto' : `${record.ttl}s`}
                  {record.priority && ` • Priority: ${record.priority}`}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => onDeleteRecord(record.id, record.name, record.type)}
                  className="cyber-button-sm bg-red-500/20 hover:bg-red-500/30 border border-red-500/30"
                  style={{ color: '#ff6b6b' }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
