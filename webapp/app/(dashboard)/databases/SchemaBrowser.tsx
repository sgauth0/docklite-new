'use client';

import { useEffect, useMemo, useState } from 'react';

interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
}

interface TableInfo {
  name: string;
  columns: ColumnInfo[];
}

interface SchemaResponse {
  tables: TableInfo[];
}

const STORAGE_PREFIX = 'docklite-db-edit-';

function getDbId(pathname: string | null): string | null {
  if (!pathname) return null;
  const match = pathname.match(/^\/databases\/(\d+)\/edit/);
  return match?.[1] || null;
}

export default function SchemaBrowser() {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const dbId = useMemo(() => getDbId(typeof window === 'undefined' ? null : window.location.pathname), []);

  useEffect(() => {
    if (!dbId) {
      setLoading(false);
      setError('Missing database context.');
      return;
    }

    const rawAuth = sessionStorage.getItem(`${STORAGE_PREFIX}${dbId}`);
    if (!rawAuth) {
      setLoading(false);
      setError('Missing database credentials. Return to the databases page to enter edit mode.');
      return;
    }

    const auth = JSON.parse(rawAuth) as { username: string; password: string };

    const fetchSchema = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/databases/${dbId}/schema`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(auth),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to load schema');
        }

        const data = (await res.json()) as SchemaResponse;
        setTables(data.tables || []);
        if (data.tables?.length) {
          const firstTable = data.tables[0].name;
          window.dispatchEvent(new CustomEvent('docklite-db-select', { detail: { table: firstTable } }));
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load schema');
      } finally {
        setLoading(false);
      }
    };

    fetchSchema();
  }, [dbId]);

  if (loading) {
    return (
      <div className="p-4 text-xs font-mono" style={{ color: 'var(--neon-cyan)' }}>
        ⟳ Loading schema...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-xs font-mono" style={{ color: '#ff6b6b' }}>
        {error}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="text-xs font-bold" style={{ color: 'var(--neon-cyan)' }}>
        🧬 Schema Browser
      </div>
      {tables.length === 0 ? (
        <div className="text-xs font-mono opacity-70" style={{ color: 'var(--text-secondary)' }}>
          No tables found.
        </div>
      ) : (
        <div className="space-y-2">
          {tables.map((table) => {
            const isExpanded = !!expanded[table.name];
            return (
              <div key={table.name} className="text-xs font-mono">
                <button
                  type="button"
                  className="w-full flex items-center gap-2 px-2 py-2 rounded-md transition-all hover:bg-white/5"
                  style={{ color: 'var(--neon-pink)' }}
                  onClick={() => {
                    setExpanded((prev) => ({ ...prev, [table.name]: !isExpanded }));
                    window.dispatchEvent(new CustomEvent('docklite-db-select', { detail: { table: table.name } }));
                  }}
                >
                  <span className="text-sm">{isExpanded ? '▾' : '▸'}</span>
                  <span className="text-sm">🗂️</span>
                  <span className="truncate font-bold">{table.name}</span>
                </button>
                {isExpanded && (
                  <div className="mt-1 space-y-1 border-l border-purple-500/30 pl-4 ml-3">
                    {table.columns.map((column) => (
                      <div key={column.name} className="flex items-center gap-2 text-[11px]">
                        <span className="opacity-70" style={{ color: 'var(--text-secondary)' }}>
                          ├
                        </span>
                        <span>📄</span>
                        <span style={{ color: 'var(--neon-cyan)' }}>{column.name}</span>
                        <span className="opacity-70" style={{ color: 'var(--text-secondary)' }}>
                          {column.type}
                          {column.nullable ? '' : ' • not null'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
