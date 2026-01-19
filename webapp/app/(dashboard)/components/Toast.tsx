'use client';

import { useEffect } from 'react';
import { CheckCircle, XCircle, WarningCircle, Info, X } from '@phosphor-icons/react';

export interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  onClose: () => void;
  duration?: number;
}

export default function Toast({ message, type, onClose, duration = 5000 }: ToastProps) {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const typeStyles = {
    success: {
      bg: 'rgba(57, 255, 20, 0.15)',
      border: 'var(--neon-green)',
      color: 'var(--neon-green)',
      icon: <CheckCircle size={22} weight="duotone" />,
    },
    error: {
      bg: 'rgba(255, 107, 107, 0.15)',
      border: '#ff6b6b',
      color: '#ff6b6b',
      icon: <XCircle size={22} weight="duotone" />,
    },
    warning: {
      bg: 'rgba(255, 200, 87, 0.15)',
      border: 'var(--neon-yellow)',
      color: 'var(--neon-yellow)',
      icon: <WarningCircle size={22} weight="duotone" />,
    },
    info: {
      bg: 'rgba(0, 255, 255, 0.15)',
      border: 'var(--neon-cyan)',
      color: 'var(--neon-cyan)',
      icon: <Info size={22} weight="duotone" />,
    },
  };

  const style = typeStyles[type];

  return (
    <div
      className="fixed top-24 right-6 z-[100000] min-w-[300px] max-w-md card-vapor p-4 rounded-xl border-2 shadow-2xl animate-slide-in-right"
      style={{
        background: style.bg,
        borderColor: style.border,
        backdropFilter: 'blur(12px)',
      }}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0" style={{ color: style.color }}>
          {style.icon}
        </div>
        <div className="flex-1">
          <p className="font-bold text-sm" style={{ color: style.color }}>
            {message}
          </p>
        </div>
        <button
          onClick={onClose}
          className="flex-shrink-0 opacity-70 hover:opacity-100 transition-opacity"
          style={{ color: style.color }}
        >
          <X size={18} weight="bold" />
        </button>
      </div>
      {/* Progress bar */}
      {duration > 0 && (
        <div
          className="absolute bottom-0 left-0 h-1 rounded-b-xl"
          style={{
            background: style.border,
            animation: `toast-progress ${duration}ms linear forwards`,
          }}
        />
      )}
    </div>
  );
}
