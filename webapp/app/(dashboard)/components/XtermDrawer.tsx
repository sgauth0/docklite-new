'use client';

import { useEffect, useRef, useState } from 'react';
import { Lightning } from '@phosphor-icons/react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

type XtermDrawerProps = {
  open: boolean;
  onClose: () => void;
};

export default function XtermDrawer({ open, onClose }: XtermDrawerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [visible, setVisible] = useState(open);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (open) {
      setVisible(true);
      setClosing(false);
      return;
    }

    if (!visible) return;
    setClosing(true);
    const timer = window.setTimeout(() => {
      setVisible(false);
      setClosing(false);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [open, visible]);

  useEffect(() => {
    if (!containerRef.current || terminalRef.current) return;

    const terminal = new Terminal({
      cursorBlink: true,
      fontFamily: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      fontSize: 13,
      theme: {
        background: '#070312',
        foreground: '#b6ffe3',
        cursor: '#00e863',
        selectionBackground: 'rgba(0, 232, 99, 0.2)',
      },
    });
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(containerRef.current);
    fitAddon.fit();
    terminal.writeln('DockLite Terminal');
    terminal.writeln('Backend not connected yet. This is a local shell UI placeholder.');

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    const handleResize = () => fitAddon.fit();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    if (open && fitAddonRef.current) {
      fitAddonRef.current.fit();
    }
  }, [open]);

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-[9998] ${open ? 'pointer-events-auto' : 'pointer-events-none'}`}
    >
      <div
        className={`absolute inset-0 z-0 transition-opacity duration-300 ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        style={{ background: 'rgba(5, 2, 12, 0.55)' }}
        onClick={onClose}
      />
      <div
        className={`absolute inset-x-0 bottom-0 z-10 transition-transform duration-500 ${
          open ? 'translate-y-0' : 'translate-y-full'
        } ${open ? 'pointer-events-auto' : 'pointer-events-none'} ${closing ? 'translate-y-full' : ''}`}
        style={{ transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)' }}
      >
        <div className="mx-auto max-w-[1200px]">
          <div
            className="rounded-t-2xl border-2 border-emerald-400/40 shadow-2xl overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, rgba(6, 3, 18, 0.98) 0%, rgba(5, 18, 19, 0.98) 100%)',
              boxShadow: '0 0 30px rgba(0, 232, 99, 0.25)',
            }}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-emerald-400/20">
              <div className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--neon-green)' }}>
                <Lightning size={16} weight="duotone" />
                DockLite Terminal
              </div>
              <button
                onClick={onClose}
                className="px-3 py-1 text-xs font-bold rounded-lg transition-all hover:scale-105"
                style={{
                  background: 'rgba(255, 107, 107, 0.15)',
                  color: '#ff6b6b',
                  border: '1px solid rgba(255, 107, 107, 0.4)',
                }}
              >
                Close
              </button>
            </div>
            <div className="h-[40vh] sm:h-[45vh] border-t border-emerald-400/20" style={{ boxShadow: 'inset 0 -8px 20px rgba(0, 0, 0, 0.45)' }}>
              <div ref={containerRef} className="h-full w-full" />
            </div>
            <div className="h-2 w-full" style={{ background: 'linear-gradient(90deg, rgba(0, 232, 99, 0.5), rgba(0, 188, 212, 0.5))' }} />
          </div>
        </div>
      </div>
    </div>
  );
}
