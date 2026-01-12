'use client';

import { X, Warning } from '@phosphor-icons/react';

interface ConfirmDeleteModalProps {
  title: string;
  message: string;
  itemName?: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export default function ConfirmDeleteModal({
  title,
  message,
  itemName,
  onConfirm,
  onCancel,
  loading = false
}: ConfirmDeleteModalProps) {
  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div
        className="card-vapor max-w-md w-full p-6 relative"
        style={{
          background: 'linear-gradient(135deg, rgba(46, 10, 26, 0.98) 0%, rgba(30, 5, 10, 0.98) 100%)',
          border: '2px solid #ff6b6b',
          boxShadow: '0 0 30px rgba(255, 107, 107, 0.5)',
        }}
      >
        {/* Close button */}
        <button
          onClick={onCancel}
          disabled={loading}
          className="absolute top-4 right-4 p-2 rounded-lg transition-all hover:scale-110"
          style={{
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
          }}
        >
          <X size={20} color="#fff" weight="bold" />
        </button>

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-3">
            <div
              className="p-3 rounded-lg"
              style={{
                background: 'rgba(255, 107, 107, 0.2)',
                border: '1px solid #ff6b6b',
              }}
            >
              <Warning size={32} color="#ff6b6b" weight="duotone" />
            </div>
            <h2 className="text-2xl font-bold" style={{ color: '#ff6b6b' }}>
              {title}
            </h2>
          </div>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {message}
          </p>
        </div>

        {itemName && (
          <div
            className="mb-6 p-4 rounded-lg font-mono text-sm"
            style={{
              background: 'rgba(255, 107, 107, 0.1)',
              border: '1px solid rgba(255, 107, 107, 0.3)',
              color: '#ff6b6b',
            }}
          >
            {itemName}
          </div>
        )}

        <div
          className="mb-6 p-3 rounded-lg text-sm"
          style={{
            background: 'rgba(255, 165, 0, 0.1)',
            border: '1px solid rgba(255, 165, 0, 0.3)',
            color: '#ffa500',
          }}
        >
          ⚠️ This action cannot be undone.
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 px-4 py-3 rounded-lg font-bold transition-all hover:scale-105 disabled:opacity-50"
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: 'var(--text-secondary)',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 px-4 py-3 rounded-lg font-bold transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: 'linear-gradient(135deg, #ff6b6b 0%, #d90000 100%)',
              color: 'white',
              boxShadow: '0 0 20px rgba(255, 107, 107, 0.4)',
            }}
          >
            {loading ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}
