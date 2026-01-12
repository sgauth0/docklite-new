'use client';

import { useState, useEffect, ReactNode } from 'react';
import { ContainerInfo, FolderNode } from '@/types';
import ContainerCard from './ContainerCard';
import { Folder as FolderIcon, FolderOpen, Pencil, Trash, Plus } from '@phosphor-icons/react';
import {
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface FolderSectionProps {
  folderNode: FolderNode;
  getContainerBadge: (container: ContainerInfo) => ReactNode;
  onAction: (containerId: string, action: 'start' | 'stop' | 'restart') => void;
  onViewDetails: (id: string, name: string) => void;
  onDelete?: (containerId: string, containerName: string) => void;
  onAssign?: (containerId: string, containerName: string) => void;
  canAssign?: boolean;
  onRefresh: () => void;
  onMoveFolder?: (containerId: string, containerName: string) => void;
  onToggleTracking?: (containerId: string, tracked: boolean) => void;
  onAddSubfolder?: (parentId: number, parentName: string) => void;
  onDeleteFolder?: (folderId: number, folderName: string) => void;
}

// Sortable container wrapper component
function SortableContainer({
  container,
  folderId,
  badge,
  onAction,
  onViewDetails,
  onDelete,
  onAssign,
  canAssign,
  onMoveFolder,
  onToggleTracking,
}: {
  container: ContainerInfo;
  folderId: number;
  badge: ReactNode;
  onAction: (containerId: string, action: 'start' | 'stop' | 'restart') => void;
  onViewDetails: (id: string, name: string) => void;
  onDelete?: (containerId: string, containerName: string) => void;
  onAssign?: (containerId: string, containerName: string) => void;
  canAssign?: boolean;
  onMoveFolder?: (containerId: string, containerName: string) => void;
  onToggleTracking?: (containerId: string, tracked: boolean) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: container.id, data: { folderId }, disabled: menuOpen });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const dragProps = menuOpen ? {} : { ...attributes, ...listeners };

  return (
    <div ref={setNodeRef} style={style} className="relative">
      <div
        {...dragProps}
        style={{ cursor: menuOpen ? 'default' : 'grab' }}
      >
        {/* Badge Overlay */}
        <div className="absolute -top-2 -right-2 z-10 pointer-events-none">{badge}</div>

        <ContainerCard
          container={container}
          onAction={onAction}
          onViewDetails={onViewDetails}
          onDelete={onDelete}
          onAssign={onAssign}
          canAssign={canAssign}
          onMoveFolder={onMoveFolder}
          onToggleTracking={onToggleTracking}
          onMenuOpenChange={setMenuOpen}
        />
      </div>
    </div>
  );
}

export default function FolderSection({
  folderNode,
  getContainerBadge,
  onAction,
  onViewDetails,
  onDelete,
  onAssign,
  canAssign,
  onRefresh,
  onMoveFolder,
  onToggleTracking,
  onAddSubfolder,
  onDeleteFolder,
}: FolderSectionProps) {
  const { children, containers, ...folder } = folderNode;
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [localContainers, setLocalContainers] = useState(containers);

  // Update local state when props change
  useEffect(() => {
    setLocalContainers(containers);
  }, [containers]);

  // Calculate indentation based on folder depth
  const indentPixels = folder.depth * 24;

  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: `folder-${folder.id}`,
  });

  return (
    <div className="space-y-4" style={{ marginLeft: `${indentPixels}px` }}>
      {/* Folder Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="flex items-center gap-3 group"
        >
          <span className="text-sm opacity-50 group-hover:opacity-100 transition-opacity">
            {isCollapsed ? '▶' : '▼'}
          </span>
          <span className="transition-transform group-hover:scale-110">
            {isCollapsed ? (
              <FolderIcon size={32} weight="duotone" color="#d90fd9" />
            ) : (
              <FolderOpen size={32} weight="duotone" color="#d90fd9" />
            )}
          </span>
          <h2 className="text-2xl font-bold neon-text transition-all group-hover:brightness-125" style={{ color: 'var(--neon-pink)' }}>
            {folder.name}
          </h2>
          <span className="text-sm font-mono px-2 py-1 rounded-full" style={{
            background: 'rgba(217, 15, 217, 0.2)',
            color: 'var(--neon-pink)',
            border: '1px solid var(--neon-pink)'
          }}>
            {containers.length}
          </span>
        </button>

        {/* Folder Actions */}
        {folder.name !== 'Default' && (
          <div className="flex gap-2">
            {folder.depth < 1 && onAddSubfolder && (
              <button
                onClick={() => onAddSubfolder(folder.id, folder.name)}
                className="px-3 py-1 text-xs font-bold rounded-lg transition-all hover:scale-105 flex items-center gap-1"
                style={{
                  background: 'rgba(0, 255, 255, 0.1)',
                  border: '1px solid var(--neon-cyan)',
                  color: 'var(--neon-cyan)'
                }}
              >
                <Plus size={14} weight="duotone" />
                Add Subfolder
              </button>
            )}
            <button
              className="px-3 py-1 text-xs font-bold rounded-lg transition-all hover:scale-105 flex items-center gap-1"
              style={{
                background: 'rgba(255, 16, 240, 0.1)',
                border: '1px solid var(--neon-pink)',
                color: 'var(--neon-pink)'
              }}
            >
              <Pencil size={14} weight="duotone" />
              Rename
            </button>
            <button
              onClick={() => onDeleteFolder && onDeleteFolder(folder.id, folder.name)}
              className="px-3 py-1 text-xs font-bold rounded-lg transition-all hover:scale-105 flex items-center gap-1"
              style={{
                background: 'rgba(255, 107, 107, 0.1)',
                border: '1px solid #ff6b6b',
                color: '#ff6b6b'
              }}
            >
              <Trash size={14} weight="duotone" />
              Delete
            </button>
          </div>
        )}
      </div>

      {/* Containers Grid with DnD */}
      {!isCollapsed && (
        <SortableContext items={localContainers.map(c => c.id)} strategy={rectSortingStrategy}>
          <div
            ref={setDroppableRef}
            className={`grid min-h-[120px] grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6 p-4 rounded-xl border-2 ${
              isOver ? 'drag-over' : 'border-transparent'
            }`}
          >
            {localContainers.map((container) => {
              const badge = getContainerBadge(container);

              return (
                <SortableContainer
                  key={container.id}
                  container={container}
                  folderId={folder.id}
                  badge={badge}
                  onAction={onAction}
                  onViewDetails={onViewDetails}
                  onDelete={onDelete}
                  onAssign={onAssign}
                  canAssign={canAssign}
                  onMoveFolder={onMoveFolder}
                  onToggleTracking={onToggleTracking}
                />
              );
            })}
          </div>
        </SortableContext>
      )}

      {/* Empty State */}
      {!isCollapsed && containers.length === 0 && children.length === 0 && (
        <div className="text-center py-12 card-vapor rounded-lg border-2 border-transparent">
          <p className="text-sm font-mono opacity-50">No containers in this folder</p>
        </div>
      )}

      {/* Recursive rendering of child folders */}
      {!isCollapsed && children.length > 0 && (
        <div className="space-y-6 mt-6">
          {children.map((childFolder) => (
            <FolderSection
              key={childFolder.id}
              folderNode={childFolder}
              getContainerBadge={getContainerBadge}
              onAction={onAction}
              onViewDetails={onViewDetails}
              onDelete={onDelete}
              onAssign={onAssign}
              canAssign={canAssign}
              onRefresh={onRefresh}
              onMoveFolder={onMoveFolder}
              onToggleTracking={onToggleTracking}
              onAddSubfolder={onAddSubfolder}
            />
          ))}
        </div>
      )}
    </div>
  );
}
