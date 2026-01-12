import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { listContainers, getContainerById, removeContainer } from '@/lib/agent-client';
import { createContainer, pullImage } from '@/lib/docker';
import {
  getFoldersByUser,
  getContainersByFolder,
  getSiteByDomain,
  getSiteByContainerId,
  createSite,
  updateSiteContainerId,
  updateSiteStatus,
  getUserById,
  createFolder,
  getUntrackedContainerIds,
} from '@/lib/db';
import { ContainerInfo, FolderNode } from '@/types';
import { buildFolderTree } from '@/lib/folder-helpers';
import { createSiteDirectory, createDefaultIndexFile, getSitePathByUserId } from '@/lib/site-helpers';
import { generateStaticTemplate } from '@/lib/templates/static';
import { generatePhpTemplate } from '@/lib/templates/php';
import { generateNodeTemplate } from '@/lib/templates/node';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await requireAuth();

    // Get user's folders
    let folders = getFoldersByUser(user.userId);
    if (folders.length === 0) {
      const defaultFolder = createFolder(user.userId, 'Default');
      folders = [defaultFolder];
    }

    // Get all DockLite-managed containers
    let allContainers = await listContainers(true); // true = only managed containers
    const untrackedSet = new Set(getUntrackedContainerIds());
    allContainers = allContainers.filter(container => !untrackedSet.has(container.id));

    // Non-admins only see their own containers
    if (!user.isAdmin) {
      allContainers = allContainers.filter(
        (c) => {
          const site = getSiteByContainerId(c.id);
          if (site) {
            return site.user_id === user.userId;
          }
          return c.labels?.['docklite.user.id'] === String(user.userId);
        }
      );
    }

    const userCache = new Map<number, string>();
    const containersWithOwners = allContainers.map((container) => {
      const site = getSiteByContainerId(container.id);
      let ownerName: string | undefined;
      let ownerId: number | undefined;
      if (site) {
        ownerId = site.user_id;
      } else if (container.labels?.['docklite.user.id']) {
        const parsed = Number(container.labels['docklite.user.id']);
        if (!Number.isNaN(parsed)) ownerId = parsed;
      }
      if (ownerId) {
        if (!userCache.has(ownerId)) {
          const user = getUserById(ownerId);
          if (user) {
            userCache.set(ownerId, user.username);
          }
        }
        ownerName = userCache.get(ownerId);
      }
      return {
        ...container,
        owner_username: ownerName,
      };
    });

    // Build map of containers by folder ID
    const containersByFolderId = new Map<number, ContainerInfo[]>();
    const assignedContainerIds = new Set<string>();

    for (const folder of folders) {
      // Get container IDs assigned to this folder
      const folderContainerIds = getContainersByFolder(folder.id);

      // Find the actual container objects
      const folderContainers = containersWithOwners.filter(c =>
        folderContainerIds.includes(c.id)
      );

      // Track which containers are assigned
      folderContainers.forEach(c => assignedContainerIds.add(c.id));

      containersByFolderId.set(folder.id, folderContainers);
    }

    // Find unassigned containers (containers not in any folder)
    const unassignedContainers = containersWithOwners.filter(c =>
      !assignedContainerIds.has(c.id) && !untrackedSet.has(c.id)
    );

    // Add unassigned containers to Default folder if it exists
    const defaultFolder = folders.find(f => f.name === 'Default');
    if (defaultFolder && unassignedContainers.length > 0) {
      const existing = containersByFolderId.get(defaultFolder.id) || [];
      containersByFolderId.set(defaultFolder.id, [...existing, ...unassignedContainers]);
    }

    // Build hierarchical folder tree
    const folderTree = buildFolderTree(folders, containersByFolderId);

    return NextResponse.json({
      folders: folderTree,
      totalContainers: allContainers.length,
    });

  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error listing containers:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const {
      domain,
      template_type,
      user_id,
      code_path,
      folder_id,
      port,
      include_www = true,
    } = body;

    if (!domain || !template_type) {
      return NextResponse.json({ error: 'Domain and template_type are required' }, { status: 400 });
    }

    const targetUserId = user.isAdmin && user_id ? Number(user_id) : user.userId;
    const targetUser = getUserById(targetUserId);
    if (!targetUser) {
      return NextResponse.json({ error: 'Target user not found' }, { status: 404 });
    }

    const existing = getSiteByDomain(domain);
    let existingContainerId: string | null = null;
    if (existing && existing.container_id) {
      const existingContainer = await getContainerById(existing.container_id);
      if (existingContainer) {
        existingContainerId = existing.container_id;
      }
    }

    // Prepare site directory and code path
    const sitePath = code_path || existing?.code_path || getSitePathByUserId(targetUserId, domain);
    await createSiteDirectory(targetUser.username, domain);
    if (!code_path && !existing) {
      const fs = await import('fs/promises');
      const candidateFiles = ['index.html', 'index.php', 'index.js'];
      const exists = await Promise.all(
        candidateFiles.map(async (file) => {
          try {
            await fs.access(`${sitePath}/${file}`);
            return true;
          } catch {
            return false;
          }
        })
      );
      const hasIndex = exists.some(Boolean);
      if (!hasIndex) {
        await createDefaultIndexFile(sitePath, domain, template_type);
      }
    }

    // Create or reuse DB record
    const site = existing
      ? existing
      : createSite({
          domain,
          template_type,
          user_id: targetUserId,
          code_path: sitePath,
          folder_id: folder_id || null,
        });

    try {
      // If an old container exists, remove it to allow recreation
      if (existingContainerId) {
        try {
          await removeContainer(existingContainerId, true);
        } catch (err) {
          console.error('Failed to remove existing container before recreate:', err);
        }
      }

      // Pull image and create container
      if (template_type === 'static') {
        await pullImage('nginx:alpine');
        const config = generateStaticTemplate({
          domain,
          codePath: sitePath,
          siteId: site.id,
          userId: targetUserId,
          folderId: folder_id,
          includeWww: include_www,
        });
        const containerId = await createContainer(config);
        updateSiteContainerId(site.id, containerId);
        updateSiteStatus(site.id, 'running');
      } else if (template_type === 'php') {
        await pullImage('webdevops/php-nginx:8.2-alpine');
        const config = generatePhpTemplate({
          domain,
          codePath: sitePath,
          siteId: site.id,
          userId: targetUserId,
          folderId: folder_id,
          includeWww: include_www,
        });
        const containerId = await createContainer(config);
        updateSiteContainerId(site.id, containerId);
        updateSiteStatus(site.id, 'running');
      } else if (template_type === 'node') {
        await pullImage('node:20-alpine');
        const config = generateNodeTemplate({
          domain,
          codePath: sitePath,
          siteId: site.id,
          userId: targetUserId,
          folderId: folder_id,
          port,
          includeWww: include_www,
        });
        const containerId = await createContainer(config);
        updateSiteContainerId(site.id, containerId);
        updateSiteStatus(site.id, 'running');
      } else {
        throw new Error('Unsupported template type');
      }

      return NextResponse.json({ success: true, site_id: site.id });
    } catch (error: any) {
      // Rollback DB record on failure
      updateSiteStatus(site.id, 'failed');
      console.error('Error creating site container:', error);
      return NextResponse.json({ error: error.message || 'Failed to create container' }, { status: 500 });
    }
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error creating site:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
