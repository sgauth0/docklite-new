'use client';

import { ContainerInfo } from '@/types';
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { Package, Clock, Plug, IdentificationCard, Eye, Trash, Play, ArrowsClockwise, Stop, DotsThree, Copy, Flower, Database, Lightning, UserCircle, Folder } from '@phosphor-icons/react';
import { useToast } from '@/lib/hooks/useToast';

interface ContainerCardProps {
  container: ContainerInfo;
  onAction: (containerId: string, action: 'start' | 'stop' | 'restart') => void;
  onViewDetails?: (containerId: string, containerName: string) => void;
  onDelete?: (containerId: string, containerName: string) => void;
  onMenuOpenChange?: (open: boolean) => void;
  canAssign?: boolean;
  onAssign?: (containerId: string, containerName: string) => void;
  onMoveFolder?: (containerId: string, containerName: string) => void;
  onToggleTracking?: (containerId: string, tracked: boolean) => void;
  isTracked?: boolean;
}

export default function ContainerCard({
  container,
  onAction,
  onViewDetails,
  onDelete,
  onMenuOpenChange,
  canAssign,
  onAssign,
  onMoveFolder,
  onToggleTracking,
  isTracked = true,
}: ContainerCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuPopupRef = useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const stopDnd = (event: React.PointerEvent) => event.stopPropagation();
  const toast = useToast();

  const isRunning = container.state === 'running';
  const statusColor = isRunning ? 'var(--neon-green)' : '#ff6b6b';
  const statusIcon = isRunning ? '●' : '○';
  const statusText = isRunning ? 'ONLINE' : 'OFFLINE';

  // Determine container type from labels
  const containerType = container.labels?.['docklite.type'] || 'other';
  const isSite = ['static', 'php', 'node'].includes(containerType);
  const isDatabase = containerType === 'postgres';

  // Set border color based on type
  const borderColor = isSite
    ? 'var(--neon-pink)'
    : isDatabase
    ? 'var(--neon-green)'
    : 'var(--neon-cyan)';

  // Get actual hex color for shadows (CSS vars don't always work in box-shadow)
  const shadowColor = isSite
    ? '#ff6bd6'
    : isDatabase
    ? '#6bffb0'
    : '#4fd6ff';

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      const inButton = menuRef.current?.contains(target);
      const inMenu = menuPopupRef.current?.contains(target);
      if (!inButton && !inMenu) {
        setMenuOpen(false);
        onMenuOpenChange?.(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!menuOpen || !menuButtonRef.current) return;
    const rect = menuButtonRef.current.getBoundingClientRect();
    setMenuPosition({
      top: rect.bottom + 8,
      left: rect.left,
    });
  }, [menuOpen]);

  return (
    <div
      className="p-4 rounded-xl transition-all hover:scale-[1.02] group relative h-[340px] flex flex-col"
      style={{
        background: 'rgba(10, 5, 20, 0.3)',
        backdropFilter: 'blur(12px)',
        border: `2px solid ${shadowColor}`,
        boxShadow: `
          0 0 3px ${shadowColor},
          0 0 6px ${shadowColor}B3,
          0 0 12px ${shadowColor}80,
          0 0 18px ${shadowColor}60,
          inset 0 0 2px ${shadowColor},
          inset 0 0 4px ${shadowColor}99,
          inset 0 0 8px ${shadowColor}70
        `,
        overflow: 'visible',
      }}
    >
      {/* 3-Dot Menu - Top left */}
      <div
        className="absolute top-3 left-3 z-20 pointer-events-auto"
        ref={menuRef}
        onPointerDown={stopDnd}
        onPointerDownCapture={stopDnd}
      >
        <button
          ref={menuButtonRef}
          onClick={(e) => {
            e.stopPropagation();
            const nextOpen = !menuOpen;
            setMenuOpen(nextOpen);
            onMenuOpenChange?.(nextOpen);
          }}
          onPointerDown={stopDnd}
          className="p-2 rounded-lg text-sm font-bold transition-all hover:scale-105"
          style={{
            background: 'transparent',
            border: `2px solid ${shadowColor}`,
            color: shadowColor,
            boxShadow: `
              0 0 5px ${shadowColor},
              0 0 10px ${shadowColor}60,
              inset 0 0 5px ${shadowColor}40
            `
          }}
          title="More options"
        >
          <DotsThree size={16} weight="bold" />
        </button>

        {/* Dropdown Menu */}
        {menuOpen && menuPosition && typeof document !== 'undefined' &&
          createPortal(
            <div
              className="fixed inset-0 z-[10000]"
              onClick={() => {
                setMenuOpen(false);
                onMenuOpenChange?.(false);
              }}
              onPointerDown={stopDnd}
              onPointerDownCapture={stopDnd}
            >
              <div
                ref={menuPopupRef}
                className="absolute rounded-lg overflow-hidden animate-slide-down"
                style={{
                  top: menuPosition.top,
                  left: menuPosition.left,
                  background: '#0b0616',
                  border: '1px solid rgba(181, 55, 242, 0.9)',
                  boxShadow: '0 0 28px rgba(181, 55, 242, 0.65)',
                  width: '200px',
                  maxWidth: 'calc(100vw - 24px)',
                }}
                onClick={(e) => e.stopPropagation()}
                onPointerDown={stopDnd}
                onPointerDownCapture={stopDnd}
              >
              {onViewDetails && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    onMenuOpenChange?.(false);
                    onViewDetails(container.id, container.name);
                  }}
                  onPointerDown={stopDnd}
                  className="w-full px-4 py-3 text-left text-sm font-bold transition-all hover:bg-white/5 flex items-center gap-3"
                  style={{ color: 'var(--neon-cyan)' }}
                >
                  <Eye size={16} weight="duotone" />
                  View Details
                </button>
              )}
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  let copied = false;
                  try {
                    if (navigator.clipboard?.writeText) {
                      await navigator.clipboard.writeText(container.name);
                      copied = true;
                    } else {
                      const input = document.createElement('textarea');
                      input.value = container.name;
                      input.style.position = 'fixed';
                      input.style.opacity = '0';
                      input.style.pointerEvents = 'none';
                      document.body.appendChild(input);
                      input.focus();
                      input.select();
                      copied = document.execCommand('copy');
                      document.body.removeChild(input);
                    }
                  } catch (err) {
                    copied = false;
                  }

                  if (copied) {
                    toast.success('Copied name');
                  } else {
                    toast.error('Copy failed');
                  }

                  setMenuOpen(false);
                  onMenuOpenChange?.(false);
                }}
                onPointerDown={stopDnd}
                className="w-full px-4 py-3 text-left text-sm font-bold transition-all hover:bg-white/5 flex items-center gap-3"
                style={{ color: 'var(--neon-purple)' }}
              >
                <Copy size={16} weight="duotone" />
                Copy name
              </button>
              {canAssign && onAssign && isSite && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    onMenuOpenChange?.(false);
                    onAssign(container.id, container.name);
                  }}
                  onPointerDown={stopDnd}
                  className="w-full px-4 py-3 text-left text-sm font-bold transition-all hover:bg-white/5 flex items-center gap-3"
                  style={{ color: 'var(--neon-green)' }}
                >
                  <UserCircle size={16} weight="duotone" />
                  Assign to user
                </button>
              )}
              {onMoveFolder && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    onMenuOpenChange?.(false);
                    onMoveFolder(container.id, container.name);
                  }}
                  onPointerDown={stopDnd}
                  className="w-full px-4 py-3 text-left text-sm font-bold transition-all hover:bg-white/5 flex items-center gap-3"
                  style={{ color: 'var(--neon-cyan)' }}
                >
                  <Folder size={16} weight="duotone" />
                  Move to folder
                </button>
              )}
              {onToggleTracking && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    onMenuOpenChange?.(false);
                    onToggleTracking(container.id, isTracked);
                  }}
                  onPointerDown={stopDnd}
                  className="w-full px-4 py-3 text-left text-sm font-bold transition-all hover:bg-white/5 flex items-center gap-3"
                  style={{ color: isTracked ? '#ff6b6b' : 'var(--neon-green)' }}
                >
                  <Eye size={16} weight="duotone" />
                  {isTracked ? 'Untrack' : 'Track'}
                </button>
              )}
              {onDelete && isSite && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    onMenuOpenChange?.(false);
                    onDelete(container.id, container.labels?.['docklite.domain'] || container.name);
                  }}
                  onPointerDown={stopDnd}
                  className="w-full px-4 py-3 text-left text-sm font-bold transition-all hover:bg-red-500/20 flex items-center gap-3"
                  style={{ color: '#ff6b6b' }}
                >
                  <Trash size={16} weight="duotone" />
                  Delete
                </button>
              )}
              </div>
            </div>,
            document.body
          )}
      </div>


      {/* Status Crate - Top center */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2">
        <Package
          size={48}
          weight="duotone"
          style={{
            color: isRunning ? '#00ffff' : '#4a4a4a',
            filter: isRunning
              ? 'drop-shadow(0 0 8px #00ffff) drop-shadow(0 0 12px #00ffff) drop-shadow(0 0 16px #00ffff80)'
              : 'drop-shadow(0 0 2px #4a4a4a40)',
          }}
        />
      </div>

      {/* Container Name - Better typography */}
      <div className="mb-2 text-center mt-10 relative z-20" style={{ overflow: 'visible', background: 'transparent' }}>
        <h3
          className="font-bold text-lg neon-text mb-1 leading-tight line-clamp-3"
          style={{
            color: 'var(--neon-cyan)',
            height: '4.5rem',
            background: 'transparent',
            border: 'none',
            padding: '12px 8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {container.name}
        </h3>
        <p className="text-xs font-mono opacity-75 truncate" style={{ color: 'var(--text-secondary)' }}>
          {container.image.split(':')[0]}
        </p>
      </div>

      {/* Container Info - Better organized */}
      <div className="space-y-1 mb-2">
        {container.owner_username && (
          <div className="flex items-center gap-2 text-xs font-mono" style={{ color: 'var(--neon-green)' }}>
            <UserCircle size={16} weight="duotone" />
            <span className="truncate">Owner: {container.owner_username}</span>
          </div>
        )}
        {/* Uptime */}
        {container.uptime && (
          <div className="flex items-center gap-2 text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>
            <Clock size={16} weight="duotone" />
            <span>{container.uptime}</span>
          </div>
        )}

        {/* Ports */}
        {container.ports && (
          <div className="flex items-center gap-2 text-xs font-mono" style={{ color: 'var(--neon-purple)' }}>
            <Plug size={16} weight="duotone" />
            <span className="truncate">{container.ports}</span>
          </div>
        )}

        {/* ID - Truncated */}
        <div className="flex items-center gap-2 text-xs font-mono opacity-60" style={{ color: 'var(--text-secondary)' }}>
          <IdentificationCard size={16} weight="duotone" />
          <span className="truncate">{container.id.substring(0, 12)}</span>
        </div>
      </div>

      {/* Actions - Better button layout with tooltips */}
      <div className="flex gap-2 mt-auto pt-2 border-t border-purple-500/20">
        {!isRunning ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAction(container.id, 'start');
            }}
            onPointerDown={stopDnd}
            className="flex-1 px-3 py-2 rounded-lg text-sm font-bold transition-all hover:scale-105 group/btn flex items-center justify-center gap-1"
            style={{
              background: 'transparent',
              border: `2px solid ${shadowColor}`,
              color: shadowColor,
              boxShadow: `
                0 0 3px ${shadowColor},
                0 0 6px ${shadowColor}40,
                inset 0 0 3px ${shadowColor}30
              `
            }}
            title="Start container"
          >
            <Play size={16} weight="duotone" className="group-hover/btn:scale-110 transition-transform" />
            <span>START</span>
          </button>
        ) : (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAction(container.id, 'restart');
              }}
              onPointerDown={stopDnd}
              className="flex-1 px-3 py-2 rounded-lg text-sm font-bold transition-all hover:scale-105 group/btn flex items-center justify-center"
              style={{
                background: 'transparent',
                border: `2px solid ${shadowColor}`,
                color: shadowColor,
                boxShadow: `
                  0 0 3px ${shadowColor},
                  0 0 6px ${shadowColor}40,
                  inset 0 0 3px ${shadowColor}30
                `
              }}
              title="Restart container"
            >
              <ArrowsClockwise size={16} weight="duotone" className="group-hover/btn:rotate-180 transition-transform duration-500" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAction(container.id, 'stop');
              }}
              onPointerDown={stopDnd}
              className="flex-1 px-3 py-2 rounded-lg text-sm font-bold transition-all hover:scale-105 group/btn flex items-center justify-center"
              style={{
                background: 'transparent',
                border: `2px solid ${shadowColor}`,
                color: shadowColor,
                boxShadow: `
                  0 0 3px ${shadowColor},
                  0 0 6px ${shadowColor}40,
                  inset 0 0 3px ${shadowColor}30
                `
              }}
              title="Stop container"
            >
              <Stop size={16} weight="duotone" className="group-hover/btn:scale-110 transition-transform" />
            </button>
          </>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onViewDetails?.(container.id, container.name);
          }}
          onPointerDown={stopDnd}
          className="px-4 py-2 rounded-lg text-sm font-bold transition-all hover:scale-105 group/btn flex items-center justify-center"
          style={{
            background: 'transparent',
            border: `2px solid ${shadowColor}`,
            color: shadowColor,
            boxShadow: `
              0 0 3px ${shadowColor},
              0 0 6px ${shadowColor}40,
              inset 0 0 3px ${shadowColor}30
            `
          }}
          title="View container details"
        >
          <Eye size={16} weight="duotone" className="group-hover/btn:scale-110 transition-transform" />
        </button>
      </div>
    </div>
  );
}
