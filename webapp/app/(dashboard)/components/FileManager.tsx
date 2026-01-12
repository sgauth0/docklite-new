'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import FileEditorModal from './FileEditorModal';
import { useToast } from '@/lib/hooks/useToast';

interface FileEntry {
  name: string;
  isDirectory: boolean;
}

interface FileManagerProps {
  userSession?: { username: string; isAdmin: boolean } | null;
  embedded?: boolean;
}

export default function FileManager({ userSession, embedded = false }: FileManagerProps) {
  // Determine initial path based on user role
  const getInitialPath = () => {
    if (!userSession) return '/var/www/sites';
    if (userSession.isAdmin) return '/var/www/sites';
    return `/var/www/sites/${userSession.username}`;
  };

  const [currentPath, setCurrentPath] = useState(getInitialPath());
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedFile, setSelectedFile] = useState<FileEntry | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; file: FileEntry } | null>(null);
  const [transferMode, setTransferMode] = useState<'move' | 'copy' | null>(null);
  const [transferFile, setTransferFile] = useState<FileEntry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FileEntry | null>(null);
  const [pickerPath, setPickerPath] = useState(getInitialPath());
  const [pickerEntries, setPickerEntries] = useState<FileEntry[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerError, setPickerError] = useState('');
  const [transferError, setTransferError] = useState('');
  const [transferLoading, setTransferLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  useEffect(() => {
    fetchFiles();
  }, [currentPath]);

  useEffect(() => {
    const closeMenu = () => setContextMenu(null);
    if (contextMenu) {
      window.addEventListener('click', closeMenu);
      window.addEventListener('scroll', closeMenu, true);
    }
    return () => {
      window.removeEventListener('click', closeMenu);
      window.removeEventListener('scroll', closeMenu, true);
    };
  }, [contextMenu]);

  async function fetchFiles() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/files?path=${encodeURIComponent(currentPath)}`);
      if (!res.ok) {
        throw new Error(await res.text());
      }
      const data = await res.json();
      setFiles(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const handleFileClick = async (file: FileEntry) => {
    if (file.isDirectory) {
      setCurrentPath(`${currentPath}/${file.name}`);
    } else {
      setSelectedFile(file);
      try {
        const res = await fetch(`/api/files/content?path=${encodeURIComponent(`${currentPath}/${file.name}`)}`);
        if (!res.ok) {
          throw new Error(await res.text());
        }
        const data = await res.json();
        setFileContent(data.content);
        setIsModalOpen(true);
      } catch (err: any) {
        setError(err.message);
      }
    }
  };

  const minPath = userSession?.isAdmin
    ? '/var/www/sites'
    : userSession?.username
      ? `/var/www/sites/${userSession.username}`
      : '/var/www/sites';

  const handleBackClick = () => {
    const parentPath = currentPath.substring(0, currentPath.lastIndexOf('/'));

    // Only navigate back if parent is within allowed directory
    if (parentPath && parentPath.length >= minPath.length) {
      setCurrentPath(parentPath);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedFile(null);
    setFileContent('');
  };

  const handleSaveFile = async (filePath: string, content: string) => {
    try {
      const res = await fetch('/api/files/content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ filePath, content }),
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleCreateItem = async (type: 'file' | 'folder') => {
    const label = type === 'file' ? 'file' : 'folder';
    const name = window.prompt(`New ${label} name`);
    const trimmedName = name?.trim();
    if (!trimmedName) return;

    setError('');
    try {
      const res = await fetch('/api/files/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          basePath: currentPath,
          name: trimmedName,
          type,
        }),
      });
      if (!res.ok) {
        const message = await res.text();
        throw new Error(message || `Failed to create ${label}`);
      }
      fetchFiles();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);
    if (selectedFiles.length === 0) return;

    setError('');
    try {
      for (const file of selectedFiles) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('path', currentPath);

        const res = await fetch('/api/files/upload', {
          method: 'POST',
          body: formData,
        });
        if (!res.ok) {
          throw new Error(await res.text());
        }
      }
      fetchFiles(); // Refresh file list
    } catch (err: any) {
      setError(err.message);
    } finally {
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  const handleDownloadClick = (file: FileEntry) => {
    window.location.href = `/api/files/download?path=${encodeURIComponent(`${currentPath}/${file.name}`)}`;
  };

  const handleContextMenu = (event: React.MouseEvent, file: FileEntry) => {
    event.preventDefault();
    event.stopPropagation();
    const menuWidth = 180;
    const padding = 12;
    const maxX = window.innerWidth - menuWidth - padding;
    const maxY = window.innerHeight - padding;
    const x = Math.max(padding, Math.min(event.clientX, maxX));
    const y = Math.max(padding, Math.min(event.clientY, maxY));
    setContextMenu({
      x,
      y,
      file,
    });
  };

  const loadPickerEntries = async (pathToLoad: string) => {
    setPickerLoading(true);
    setPickerError('');
    try {
      const res = await fetch(`/api/files?path=${encodeURIComponent(pathToLoad)}`);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Failed to load folder');
      }
      const data = await res.json();
      setPickerEntries((data || []).filter((entry: FileEntry) => entry.isDirectory));
    } catch (err: any) {
      setPickerError(err.message || 'Failed to load folders');
    } finally {
      setPickerLoading(false);
    }
  };

  const openTransferModal = async (mode: 'move' | 'copy', file: FileEntry) => {
    setTransferMode(mode);
    setTransferFile(file);
    setPickerPath(currentPath);
    setTransferError('');
    await loadPickerEntries(currentPath);
  };

  const handlePickerOpen = async (dirName: string) => {
    const nextPath = `${pickerPath}/${dirName}`;
    setPickerPath(nextPath);
    await loadPickerEntries(nextPath);
  };

  const handlePickerBack = async () => {
    const parentPath = pickerPath.substring(0, pickerPath.lastIndexOf('/'));
    if (!parentPath || parentPath.length < minPath.length) return;
    setPickerPath(parentPath);
    await loadPickerEntries(parentPath);
  };

  const handleTransferSubmit = async () => {
    if (!transferMode || !transferFile) return;
    setTransferLoading(true);
    setTransferError('');
    try {
      const res = await fetch('/api/files/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourcePath: `${currentPath}/${transferFile.name}`,
          targetDir: pickerPath,
          action: transferMode,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Transfer failed');
      }
      const data = await res.json().catch(() => ({}));
      const actionLabel = transferMode === 'move' ? 'Moved' : 'Copied';
      toast.success(`${actionLabel} to ${data?.targetPath || pickerPath}`);
      setTransferMode(null);
      setTransferFile(null);
      setPickerEntries([]);
      fetchFiles();
    } catch (err: any) {
      setTransferError(err.message || 'Transfer failed');
    } finally {
      setTransferLoading(false);
    }
  };

  const handleDeleteEntry = (file: FileEntry) => {
    if (!userSession?.isAdmin) return;
    setDeleteTarget(file);
  };

  const confirmDeleteEntry = async () => {
    if (!deleteTarget) return;
    setTransferError('');
    try {
      const res = await fetch('/api/files/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: `${currentPath}/${deleteTarget.name}`,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Delete failed');
      }
      toast.success(`Deleted ${deleteTarget.name}`);
      setDeleteTarget(null);
      fetchFiles();
    } catch (err: any) {
      setTransferError(err.message || 'Delete failed');
    }
  };

  return (
    <div className={`flex flex-col h-full ${embedded ? '' : 'w-full'}`}>
      <div className="p-4 border-b border-purple-500/20 flex items-center justify-between">
        <div>
          <div className="text-sm font-bold text-cyan-300">File Browser</div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-purple-200/70">Local Sites</div>
        </div>
        <div className="flex items-center gap-2">
          <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" multiple />
          <button onClick={() => handleCreateItem('folder')} className="btn-neon px-3 py-1 text-xs font-bold">
            New Folder
          </button>
          <button onClick={() => handleCreateItem('file')} className="btn-neon px-3 py-1 text-xs font-bold">
            New File
          </button>
          <button onClick={handleUploadClick} className="btn-neon px-3 py-1 text-xs font-bold">
            Upload
          </button>
        </div>
      </div>
      <div className="p-3 border-b border-purple-500/20">
        <button
          onClick={handleBackClick}
          disabled={currentPath === minPath}
          className="btn-neon px-3 py-1 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
        >
          ← Back
        </button>
        <div className="text-[11px] truncate mt-2 text-purple-200/70">{currentPath}</div>
      </div>
      <div
        className="flex-1 p-3 overflow-y-auto"
        onContextMenu={(event) => {
          event.preventDefault();
          setContextMenu(null);
        }}
      >
        {loading && <p className="text-sm text-cyan-200/80">Loading...</p>}
        {error && <p className="text-sm text-pink-300">{error}</p>}
        {!loading && !error && files.length === 0 && (
          <p className="text-xs text-purple-200/60">No files in this folder.</p>
        )}
        {!loading && !error && files.length > 0 && (
          <ul className="space-y-1">
            {files.map((file) => (
              <li
                key={file.name}
                className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-purple-900/30 transition-colors"
                onContextMenu={(event) => handleContextMenu(event, file)}
              >
                <button
                  onClick={() => handleFileClick(file)}
                  className="flex items-center gap-2 text-left min-w-0"
                >
                  <span>{file.isDirectory ? '📁' : '📄'}</span>
                  <span className="text-sm text-cyan-100 truncate">{file.name}</span>
                </button>
                {!file.isDirectory && (
                  <button
                    onClick={() => handleDownloadClick(file)}
                    className="btn-neon px-2 py-1 text-[11px] font-bold"
                  >
                    Download
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      {isModalOpen && selectedFile && (
        <FileEditorModal
          filePath={`${currentPath}/${selectedFile.name}`}
          initialContent={fileContent}
          onClose={closeModal}
          onSave={handleSaveFile}
        />
      )}
      {contextMenu && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[10000]"
          onClick={() => setContextMenu(null)}
        >
          <div
            className="absolute rounded-lg overflow-hidden"
            style={{
              top: contextMenu.y,
              left: contextMenu.x,
              background: '#0b0616',
              border: '1px solid rgba(181, 55, 242, 0.9)',
              boxShadow: '0 0 28px rgba(181, 55, 242, 0.65)',
              width: '180px',
              maxWidth: 'calc(100vw - 24px)',
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => {
                setContextMenu(null);
                openTransferModal('move', contextMenu.file);
              }}
              className="w-full px-4 py-3 text-left text-sm font-bold transition-all hover:bg-white/5"
              style={{ color: 'var(--neon-cyan)' }}
            >
              Move to...
            </button>
            <button
              type="button"
              onClick={() => {
                setContextMenu(null);
                openTransferModal('copy', contextMenu.file);
              }}
              className="w-full px-4 py-3 text-left text-sm font-bold transition-all hover:bg-white/5"
              style={{ color: 'var(--neon-purple)' }}
            >
              Copy to...
            </button>
            {userSession?.isAdmin && (
              <button
                type="button"
                onClick={() => {
                  const target = contextMenu.file;
                  setContextMenu(null);
                  handleDeleteEntry(target);
                }}
                className="w-full px-4 py-3 text-left text-sm font-bold transition-all hover:bg-red-500/20"
                style={{ color: '#ff6b6b' }}
              >
                Delete
              </button>
            )}
          </div>
        </div>,
        document.body
      )}
      {transferMode && transferFile && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="cyber-card max-w-xl w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold neon-text-pink">
                {transferMode === 'move' ? 'Move to' : 'Copy to'}
              </h2>
              <button
                onClick={() => {
                  setTransferMode(null);
                  setTransferFile(null);
                }}
                className="text-gray-400 hover:text-neon-cyan transition-colors"
              >
                ✕
              </button>
            </div>
            <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
              {transferMode === 'move' ? 'Moving' : 'Copying'}{' '}
              <span className="font-bold" style={{ color: 'var(--neon-cyan)' }}>
                {transferFile.name}
              </span>
            </p>

            <div className="mb-4 rounded-lg border border-purple-500/30 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-mono text-purple-200/80 truncate">{pickerPath}</div>
                <button
                  type="button"
                  onClick={handlePickerBack}
                  disabled={pickerPath === minPath}
                  className="btn-neon px-2 py-1 text-[11px] disabled:opacity-50"
                >
                  ← Back
                </button>
              </div>
              <div className="mt-3 max-h-52 overflow-y-auto">
                {pickerLoading && (
                  <p className="text-xs text-cyan-200/80">Loading folders...</p>
                )}
                {pickerError && (
                  <p className="text-xs text-pink-300">{pickerError}</p>
                )}
                {!pickerLoading && !pickerError && pickerEntries.length === 0 && (
                  <p className="text-xs text-purple-200/60">No subfolders here.</p>
                )}
                {!pickerLoading && !pickerError && pickerEntries.length > 0 && (
                  <ul className="space-y-1">
                    {pickerEntries.map((entry) => (
                      <li key={entry.name}>
                        <button
                          type="button"
                          onClick={() => handlePickerOpen(entry.name)}
                          className="w-full text-left px-2 py-2 rounded-md hover:bg-purple-900/30 text-sm text-cyan-100"
                        >
                          📁 {entry.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {transferError && (
              <div className="mb-4 p-3 rounded-lg bg-red-500/20 border border-red-500/50">
                <p className="text-sm text-red-400">{transferError}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setTransferMode(null);
                  setTransferFile(null);
                }}
                className="flex-1 px-4 py-2 rounded-lg font-bold border-2 border-gray-600 text-gray-300 hover:border-gray-500 transition-colors"
                disabled={transferLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleTransferSubmit}
                className="flex-1 cyber-button"
                disabled={transferLoading}
              >
                {transferLoading ? 'Working...' : transferMode === 'move' ? 'Move here' : 'Copy here'}
              </button>
            </div>
          </div>
        </div>
      )}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="cyber-card max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold neon-text-pink">Delete item</h2>
              <button
                onClick={() => setDeleteTarget(null)}
                className="text-gray-400 hover:text-neon-cyan transition-colors"
              >
                ✕
              </button>
            </div>
            <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
              This will permanently delete{' '}
              <span className="font-bold" style={{ color: 'var(--neon-cyan)' }}>
                {deleteTarget.name}
              </span>
              .
            </p>
            {transferError && (
              <div className="mb-4 p-3 rounded-lg bg-red-500/20 border border-red-500/50">
                <p className="text-sm text-red-400">{transferError}</p>
              </div>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="flex-1 px-4 py-2 rounded-lg font-bold border-2 border-gray-600 text-gray-300 hover:border-gray-500 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteEntry}
                className="flex-1 px-4 py-2 rounded-lg font-bold bg-red-600/80 text-white hover:bg-red-500 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
