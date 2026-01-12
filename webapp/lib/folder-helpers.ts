import { Folder, FolderNode } from '@/types';

// Maximum nesting depth (0 = root, 1 = one level of nesting)
export const MAX_FOLDER_DEPTH = 1;

/**
 * Builds a hierarchical tree from a flat list of folders
 * Uses O(n) algorithm with Map for efficient lookup
 * Limits depth to 2 layers (MAX_FOLDER_DEPTH = 1)
 */
export function buildFolderTree(
  folders: Folder[],
  containersByFolderId: Map<number, any[]>
): FolderNode[] {
  // Create a map for quick folder lookup
  const folderMap = new Map<number, FolderNode>();

  // Initialize all folders as nodes
  folders.forEach(folder => {
    folderMap.set(folder.id, {
      ...folder,
      children: [],
      containers: containersByFolderId.get(folder.id) || [],
    });
  });

  // Build the tree structure
  const rootFolders: FolderNode[] = [];

  folders.forEach(folder => {
    const node = folderMap.get(folder.id)!;

    if (folder.parent_folder_id === null) {
      // Root level folder
      rootFolders.push(node);
    } else {
      // Child folder - add to parent's children
      const parent = folderMap.get(folder.parent_folder_id);
      if (parent) {
        parent.children.push(node);
      } else {
        // Parent not found, treat as root
        rootFolders.push(node);
      }
    }
  });

  // Sort folders by position at each level
  const sortByPosition = (nodes: FolderNode[]) => {
    nodes.sort((a, b) => a.position - b.position);
    nodes.forEach(node => sortByPosition(node.children));
  };

  sortByPosition(rootFolders);

  return rootFolders;
}

/**
 * Check if making folder A a child of folder B would create a circular reference
 * Returns true if targetFolderId is a descendant of ancestorFolderId
 */
export function isDescendant(
  folderId: number,
  potentialAncestorId: number,
  allFolders: Folder[]
): boolean {
  const folderMap = new Map<number, Folder>();
  allFolders.forEach(f => folderMap.set(f.id, f));

  let currentId: number | null = folderId;

  // Walk up the parent chain
  while (currentId !== null) {
    if (currentId === potentialAncestorId) {
      return true; // Found the potential ancestor in the chain
    }

    const folder = folderMap.get(currentId);
    if (!folder) break;

    currentId = folder.parent_folder_id;
  }

  return false;
}

/**
 * Calculate the depth of a folder based on its parent
 */
export function calculateDepth(parentFolderId: number | null, allFolders: Folder[]): number {
  if (parentFolderId === null) {
    return 0; // Root level
  }

  const parent = allFolders.find(f => f.id === parentFolderId);
  if (!parent) {
    return 0; // Parent not found, default to root
  }

  return parent.depth + 1;
}

/**
 * Validate that a folder can be nested at the requested depth
 */
export function canNestFolder(
  folderId: number,
  newParentId: number | null,
  allFolders: Folder[]
): { valid: boolean; error?: string } {
  // Can't nest into itself
  if (folderId === newParentId) {
    return { valid: false, error: 'Cannot nest a folder into itself' };
  }

  // Check for circular reference
  if (newParentId && isDescendant(newParentId, folderId, allFolders)) {
    return { valid: false, error: 'Cannot create circular folder reference' };
  }

  // Check depth limit
  const newDepth = calculateDepth(newParentId, allFolders);
  if (newDepth > MAX_FOLDER_DEPTH) {
    return { valid: false, error: `Maximum nesting depth is ${MAX_FOLDER_DEPTH + 1} layers` };
  }

  // Check if folder has children that would exceed depth limit
  const folder = allFolders.find(f => f.id === folderId);
  if (folder && folder.depth + newDepth > MAX_FOLDER_DEPTH) {
    return { valid: false, error: 'Moving this folder would exceed maximum nesting depth for its children' };
  }

  return { valid: true };
}
