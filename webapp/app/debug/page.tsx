'use client';

import { useEffect, useState } from 'react';

interface DebugData {
  status: string;
  debug: {
    timestamp: string;
    database: {
      status: string;
      error: string | null;
      details: any;
    };
    docker: {
      status: string;
      error: string | null;
      details: any;
    };
    authentication: {
      status: string;
      error: string | null;
      details: any;
    };
  };
}

export default function DebugPage() {
  const [data, setData] = useState<DebugData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDebugData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/debug');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const debugData = await response.json();
      setData(debugData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch debug data');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDebugData();
    // Refresh every 10 seconds
    const interval = setInterval(fetchDebugData, 10000);
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
      case 'authenticated':
      case 'healthy':
        return '✅';
      case 'error':
      case 'unhealthy':
        return '❌';
      case 'not_authenticated':
        return '⚠️';
      default:
        return '❓';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
      case 'authenticated':
      case 'healthy':
        return 'text-green-400';
      case 'error':
      case 'unhealthy':
        return 'text-red-400';
      case 'not_authenticated':
        return 'text-yellow-400';
      default:
        return 'text-gray-400';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold mb-8 text-center">
            🔍 DockLite Debug Dashboard
          </h1>
          <div className="text-center">
            <div className="text-2xl mb-4">⟳ Loading debug information...</div>
            <div className="text-gray-400">This may take a few seconds</div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold mb-8 text-center">
            🔍 DockLite Debug Dashboard
          </h1>
          <div className="bg-red-900 border border-red-700 rounded-lg p-6">
            <h2 className="text-2xl font-bold mb-4 text-red-400">❌ Error</h2>
            <p className="text-red-300 mb-4">{error}</p>
            <button
              onClick={fetchDebugData}
              className="bg-red-700 hover:bg-red-600 text-white px-4 py-2 rounded"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold mb-8 text-center">
            🔍 DockLite Debug Dashboard
          </h1>
          <div className="text-center text-gray-400">
            No debug data available
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-center">
          🔍 DockLite Debug Dashboard
        </h1>

        {/* Overall Status */}
        <div className={`mb-8 p-6 rounded-lg border-2 ${
          data.status === 'healthy' 
            ? 'bg-green-900 border-green-700' 
            : 'bg-red-900 border-red-700'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold mb-2">
                {getStatusIcon(data.status)} System Status: {data.status.toUpperCase()}
              </h2>
              <p className="text-gray-300">
                Last updated: {new Date(data.debug.timestamp).toLocaleString()}
              </p>
            </div>
            <button
              onClick={fetchDebugData}
              className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded"
            >
              🔄 Refresh
            </button>
          </div>
        </div>

        {/* Database Status */}
        <div className="mb-6 bg-gray-800 border border-gray-700 rounded-lg p-6">
          <h3 className="text-xl font-bold mb-4 flex items-center">
            <span className={getStatusColor(data.debug.database.status)}>
              {getStatusIcon(data.debug.database.status)}
            </span>
            <span className="ml-2">Database Connection</span>
          </h3>
          <div className="ml-6">
            <p className={`font-semibold ${getStatusColor(data.debug.database.status)}`}>
              Status: {data.debug.database.status}
            </p>
            {data.debug.database.error && (
              <p className="text-red-400 mt-2">
                Error: {data.debug.database.error}
              </p>
            )}
            {data.debug.database.details && (
              <div className="mt-4 space-y-2">
                <p><strong>Database Path:</strong> {data.debug.database.details.path}</p>
                <p><strong>User Count:</strong> {data.debug.database.details.userCount}</p>
                <p><strong>Tables:</strong></p>
                <ul className="list-disc list-inside ml-4">
                  {data.debug.database.details.tables?.map((table: any, index: number) => (
                    <li key={index} className="text-gray-300">{table.name}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Docker Status */}
        <div className="mb-6 bg-gray-800 border border-gray-700 rounded-lg p-6">
          <h3 className="text-xl font-bold mb-4 flex items-center">
            <span className={getStatusColor(data.debug.docker.status)}>
              {getStatusIcon(data.debug.docker.status)}
            </span>
            <span className="ml-2">Docker Connection</span>
          </h3>
          <div className="ml-6">
            <p className={`font-semibold ${getStatusColor(data.debug.docker.status)}`}>
              Status: {data.debug.docker.status}
            </p>
            {data.debug.docker.error && (
              <p className="text-red-400 mt-2">
                Error: {data.debug.docker.error}
              </p>
            )}
            {data.debug.docker.details && (
              <div className="mt-4 space-y-2">
                <p><strong>Total Containers:</strong> {data.debug.docker.details.containerCount}</p>
                <p><strong>Socket Path:</strong> {data.debug.docker.details.socketPath || '/var/run/docker.sock'}</p>
                {data.debug.docker.details.containers && data.debug.docker.details.containers.length > 0 && (
                  <div>
                    <p><strong>Sample Containers:</strong></p>
                    <ul className="list-disc list-inside ml-4">
                      {data.debug.docker.details.containers.map((container: any, index: number) => (
                        <li key={index} className="text-gray-300">
                          {container.name} ({container.id}) - {container.status}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Authentication Status */}
        <div className="mb-6 bg-gray-800 border border-gray-700 rounded-lg p-6">
          <h3 className="text-xl font-bold mb-4 flex items-center">
            <span className={getStatusColor(data.debug.authentication.status)}>
              {getStatusIcon(data.debug.authentication.status)}
            </span>
            <span className="ml-2">Authentication</span>
          </h3>
          <div className="ml-6">
            <p className={`font-semibold ${getStatusColor(data.debug.authentication.status)}`}>
              Status: {data.debug.authentication.status}
            </p>
            {data.debug.authentication.error && (
              <p className="text-red-400 mt-2">
                Error: {data.debug.authentication.error}
              </p>
            )}
            {data.debug.authentication.details && (
              <div className="mt-4 space-y-2">
                <p><strong>Has Session:</strong> {data.debug.authentication.details.hasSession ? 'Yes' : 'No'}</p>
                {data.debug.authentication.details.user && (
                  <div>
                    <p><strong>Current User:</strong></p>
                    <ul className="list-disc list-inside ml-4">
                      <li className="text-gray-300">ID: {data.debug.authentication.details.user.id}</li>
                      <li className="text-gray-300">Username: {data.debug.authentication.details.user.username}</li>
                      <li className="text-gray-300">Admin: {data.debug.authentication.details.user.isAdmin ? 'Yes' : 'No'}</li>
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Troubleshooting Tips */}
        <div className="bg-yellow-900 border border-yellow-700 rounded-lg p-6">
          <h3 className="text-xl font-bold mb-4 text-yellow-400">
            💡 Troubleshooting Tips
          </h3>
          <div className="space-y-2 text-yellow-200">
            <p><strong>Database Issues:</strong> Check if the data/docklite.db file exists and is writable.</p>
            <p><strong>Docker Issues:</strong> Ensure Docker daemon is running and the socket path is correct.</p>
            <p><strong>Authentication Issues:</strong> Try logging in at /login - default credentials are admin/admin.</p>
            <p><strong>Container Issues:</strong> Check Docker logs and ensure containers are properly created.</p>
          </div>
        </div>
      </div>
    </div>
  );
}