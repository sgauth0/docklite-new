'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
}

interface TableData {
  columns: ColumnInfo[];
  rows: Record<string, any>[];
}

interface DatabaseInfo {
  id: number;
  name: string;
  postgres_port: number;
}

interface QueryResult {
  type: 'select' | 'command';
  columns?: string[];
  rows?: Record<string, any>[];
  output?: string;
}

const STORAGE_PREFIX = 'docklite-db-edit-';

export default function DatabaseEditPage() {
  const params = useParams();
  const router = useRouter();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const dbId = useMemo(() => (id ? String(id) : null), [id]);

  const [auth, setAuth] = useState<{ username: string; password: string } | null>(null);
  const [dbInfo, setDbInfo] = useState<DatabaseInfo | null>(null);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tableData, setTableData] = useState<TableData | null>(null);
  const [loadingTable, setLoadingTable] = useState(false);
  const [tableError, setTableError] = useState<string | null>(null);
  const [sql, setSql] = useState('SELECT * FROM users LIMIT 10;');
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [runningQuery, setRunningQuery] = useState(false);
  const [activeTab, setActiveTab] = useState<'table' | 'sql'>('table');

  useEffect(() => {
    if (!dbId) return;
    const rawAuth = sessionStorage.getItem(`${STORAGE_PREFIX}${dbId}`);
    if (!rawAuth) {
      return;
    }
    setAuth(JSON.parse(rawAuth));
  }, [dbId]);

  useEffect(() => {
    if (!dbId) return;
    const fetchDb = async () => {
      const res = await fetch(`/api/databases/${dbId}`);
      if (!res.ok) return;
      const data = await res.json();
      setDbInfo(data.database);
    };
    fetchDb();
  }, [dbId]);

  useEffect(() => {
    const handleSelect = (event: Event) => {
      const detail = (event as CustomEvent<{ table: string }>).detail;
      if (detail?.table) {
        setSelectedTable(detail.table);
      }
    };
    window.addEventListener('docklite-db-select', handleSelect);
    return () => window.removeEventListener('docklite-db-select', handleSelect);
  }, []);

  useEffect(() => {
    if (!dbId || !auth || !selectedTable) return;

    const fetchTable = async () => {
      try {
        setLoadingTable(true);
        setTableError(null);
        const res = await fetch(`/api/databases/${dbId}/table`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...auth, table: selectedTable }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to load table');
        }
        const data = await res.json();
        setTableData(data);
      } catch (err: any) {
        setTableError(err.message || 'Failed to load table');
      } finally {
        setLoadingTable(false);
      }
    };

    fetchTable();
  }, [dbId, auth, selectedTable]);

  const handleRunQuery = async () => {
    if (!dbId || !auth || !sql.trim()) return;
    try {
      setRunningQuery(true);
      setQueryError(null);
      const res = await fetch(`/api/databases/${dbId}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...auth, sql }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Query failed');
      }
      setQueryResult(data);
    } catch (err: any) {
      setQueryError(err.message || 'Query failed');
    } finally {
      setRunningQuery(false);
    }
  };

  if (!dbId) {
    return (
      <div className="card-vapor p-8 max-w-xl">
        <h1 className="text-xl font-bold" style={{ color: '#ff6b6b' }}>Missing database ID</h1>
      </div>
    );
  }

  if (!auth) {
    return (
      <div className="max-w-xl card-vapor p-8">
        <h1 className="text-xl font-bold mb-3" style={{ color: '#ff6b6b' }}>
          Missing database credentials
        </h1>
        <p className="text-sm font-mono mb-6" style={{ color: 'var(--text-secondary)' }}>
          Return to the databases page and enter edit mode again.
        </p>
        <button
          type="button"
          onClick={() => router.push('/databases')}
          className="btn-neon px-5 py-2 text-sm font-bold"
        >
          ← Back to Databases
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      <div className="card-vapor p-6 rounded-xl border border-purple-500/30">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold neon-text" style={{ color: 'var(--neon-cyan)' }}>
              ✨ Database Edit Mode
            </h1>
            <p className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>
              {dbInfo ? `${dbInfo.name} • localhost:${dbInfo.postgres_port}` : 'Loading database info...'}
            </p>
            {auth && (
              <div
                className="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono"
                style={{
                  background: 'rgba(0, 255, 255, 0.1)',
                  border: '1px solid rgba(0, 255, 255, 0.4)',
                  color: 'var(--neon-cyan)',
                }}
              >
                ✅ Connected as <span className="font-bold">{auth.username}</span>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => router.push('/databases')}
            className="px-4 py-2 rounded-lg font-bold transition-all hover:scale-105"
            style={{
              background: 'linear-gradient(135deg, var(--neon-purple) 0%, var(--neon-pink) 100%)',
              color: 'white',
            }}
          >
            ← Exit Edit Mode
          </button>
        </div>
      </div>

      <div className="card-vapor p-4 rounded-xl border border-purple-500/30">
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setActiveTab('table')}
            className="px-4 py-2 rounded-lg text-sm font-bold transition-all"
            style={{
              background: activeTab === 'table'
                ? 'linear-gradient(135deg, var(--neon-pink) 0%, var(--neon-purple) 100%)'
                : 'rgba(255, 255, 255, 0.05)',
              color: activeTab === 'table' ? 'white' : 'var(--text-secondary)',
              border: activeTab === 'table' ? '2px solid var(--neon-pink)' : '2px solid transparent',
            }}
          >
            📊 Table View
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('sql')}
            className="px-4 py-2 rounded-lg text-sm font-bold transition-all"
            style={{
              background: activeTab === 'sql'
                ? 'linear-gradient(135deg, var(--neon-cyan) 0%, var(--neon-green) 100%)'
                : 'rgba(255, 255, 255, 0.05)',
              color: activeTab === 'sql' ? 'white' : 'var(--text-secondary)',
              border: activeTab === 'sql' ? '2px solid var(--neon-cyan)' : '2px solid transparent',
            }}
          >
            ⚡ Run SQL
          </button>
        </div>
      </div>

      {activeTab === 'table' && (
        <div className="card-vapor p-6 rounded-xl border border-purple-500/20">
          <h2 className="text-xl font-bold neon-text mb-4" style={{ color: 'var(--neon-pink)' }}>
            📊 Table View {selectedTable ? `• ${selectedTable}` : ''}
          </h2>
          {loadingTable && (
            <div className="text-sm font-mono" style={{ color: 'var(--neon-cyan)' }}>
              ⟳ Loading table...
            </div>
          )}
          {tableError && (
            <div className="text-sm font-mono" style={{ color: '#ff6b6b' }}>
              {tableError}
            </div>
          )}
          {!loadingTable && !tableError && tableData && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-3">
                {tableData.columns.map((col) => (
                  <div
                    key={col.name}
                    className="px-3 py-1 rounded-full text-xs font-mono border"
                    style={{
                      borderColor: 'rgba(0, 255, 255, 0.4)',
                      color: 'var(--neon-cyan)',
                      background: 'rgba(0, 255, 255, 0.08)',
                    }}
                  >
                    {col.name} • {col.type}
                  </div>
                ))}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs font-mono">
                  <thead>
                    <tr>
                      {tableData.columns.map((col) => (
                        <th
                          key={col.name}
                          className="px-3 py-2 text-left"
                          style={{ color: 'var(--neon-purple)' }}
                        >
                          {col.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tableData.rows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={tableData.columns.length}
                          className="px-3 py-4 text-center opacity-60"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          No rows found.
                        </td>
                      </tr>
                    ) : (
                      tableData.rows.map((row, idx) => (
                        <tr key={idx} className="border-t border-purple-500/10">
                          {tableData.columns.map((col) => (
                            <td key={col.name} className="px-3 py-2">
                              {row[col.name] === null || row[col.name] === undefined ? '-' : String(row[col.name])}
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {!loadingTable && !tableError && !tableData && (
            <div className="text-sm font-mono opacity-70" style={{ color: 'var(--text-secondary)' }}>
              Select a table from the schema browser.
            </div>
          )}
        </div>
      )}

      {activeTab === 'sql' && (
        <div className="card-vapor p-6 rounded-xl border border-purple-500/20">
          <h2 className="text-xl font-bold neon-text mb-4" style={{ color: 'var(--neon-green)' }}>
            ⚡ Run SQL
          </h2>
          <textarea
            className="w-full h-40 p-3 rounded-lg text-xs font-mono mb-3"
            style={{
              background: 'rgba(15, 5, 30, 0.7)',
              border: '2px solid var(--neon-purple)',
              color: 'var(--text-primary)',
            }}
            value={sql}
            onChange={(e) => setSql(e.target.value)}
          />
          <button
            type="button"
            disabled={runningQuery}
            onClick={handleRunQuery}
            className="btn-neon w-full py-2 text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {runningQuery ? '⟳ Running...' : '▶ Execute SQL'}
          </button>

          {queryError && (
            <div className="mt-3 text-xs font-mono" style={{ color: '#ff6b6b' }}>
              {queryError}
            </div>
          )}

          {queryResult && (
            <div className="mt-4 space-y-3 text-xs font-mono">
              {queryResult.type === 'select' && queryResult.rows ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr>
                        {queryResult.columns?.map((col) => (
                          <th key={col} className="px-2 py-1 text-left" style={{ color: 'var(--neon-cyan)' }}>
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {queryResult.rows.length === 0 ? (
                        <tr>
                          <td
                            colSpan={queryResult.columns?.length || 1}
                            className="px-2 py-2 opacity-60"
                            style={{ color: 'var(--text-secondary)' }}
                          >
                            Query returned no rows.
                          </td>
                        </tr>
                      ) : (
                        queryResult.rows.map((row, idx) => (
                          <tr key={idx} className="border-t border-purple-500/10">
                            {queryResult.columns?.map((col) => (
                              <td key={col} className="px-2 py-1">
                                {row[col] === null || row[col] === undefined ? '-' : String(row[col])}
                              </td>
                            ))}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-3 rounded-lg border border-purple-500/30 bg-black/30">
                  <div style={{ color: 'var(--neon-cyan)' }}>
                    {queryResult.output || 'Query executed.'}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
