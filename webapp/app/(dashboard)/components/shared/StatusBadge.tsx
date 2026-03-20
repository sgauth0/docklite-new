import React from 'react';

export type StatusType = 'running' | 'stopped' | 'success' | 'failed' | 'in_progress' | 'pending' | 'active' | 'inactive';

interface StatusBadgeProps {
  status: StatusType | string;
  variant?: 'service' | 'backup' | 'container';
  className?: string;
}

export default function StatusBadge({ status, variant = 'service', className = '' }: StatusBadgeProps) {
  const getStatusStyles = () => {
    const normalized = status.toLowerCase();

    // Success/Running states
    if (normalized === 'running' || normalized === 'success' || normalized === 'active') {
      return {
        background: 'linear-gradient(135deg, var(--neon-green) 0%, var(--neon-cyan) 100%)',
        color: 'var(--bg-darker)',
        shadow: '0 2px 8px rgba(var(--status-success-rgb), 0.3)',
      };
    }

    // Error/Stopped states
    if (normalized === 'stopped' || normalized === 'failed' || normalized === 'inactive') {
      return {
        background: 'linear-gradient(135deg, var(--status-error) 0%, var(--neon-pink) 100%)',
        color: 'var(--button-text)',
        shadow: '0 2px 8px rgba(var(--status-error-rgb), 0.3)',
      };
    }

    // In progress/Pending states
    if (normalized === 'in_progress' || normalized === 'pending') {
      return {
        background: 'linear-gradient(135deg, var(--neon-yellow) 0%, var(--neon-purple) 100%)',
        color: 'var(--button-text)',
        shadow: '0 2px 8px rgba(var(--status-warning-rgb), 0.3)',
      };
    }

    // Default/Unknown states
    return {
      background: 'rgba(var(--text-muted-rgb), 0.3)',
      color: 'var(--text-primary)',
      shadow: '0 2px 8px rgba(var(--text-muted-rgb), 0.2)',
    };
  };

  const styles = getStatusStyles();

  return (
    <span
      className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${className}`}
      style={{
        background: styles.background,
        color: styles.color,
        boxShadow: styles.shadow,
        letterSpacing: '0.5px',
      }}
    >
      {status}
    </span>
  );
}
