'use client';

import { useState, useCallback } from 'react';
import Toast, { ToastProps } from '@/app/(dashboard)/components/Toast';

interface ToastData {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
}

let toastId = 0;

export function useToast() {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const showToast = useCallback((message: string, type: ToastProps['type'] = 'info', duration = 5000) => {
    const id = toastId++;
    setToasts(prev => [...prev, { id, message, type, duration }]);
  }, []);

  const success = useCallback((message: string, duration?: number) => {
    showToast(message, 'success', duration);
  }, [showToast]);

  const error = useCallback((message: string, duration?: number) => {
    showToast(message, 'error', duration);
  }, [showToast]);

  const warning = useCallback((message: string, duration?: number) => {
    showToast(message, 'warning', duration);
  }, [showToast]);

  const info = useCallback((message: string, duration?: number) => {
    showToast(message, 'info', duration);
  }, [showToast]);

  const closeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const ToastContainer = useCallback(() => {
    return (
      <>
        {toasts.map((toast, index) => (
          <div key={toast.id} style={{ top: `${6 + index * 5.5}rem` }}>
            <Toast
              message={toast.message}
              type={toast.type}
              onClose={() => closeToast(toast.id)}
              duration={toast.duration}
            />
          </div>
        ))}
      </>
    );
  }, [toasts, closeToast]);

  return {
    success,
    error,
    warning,
    info,
    ToastContainer,
  };
}
