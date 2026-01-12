import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getUserById } from '@/lib/db';
import fs from 'fs/promises';
import path from 'path';

export const dynamic = 'force-dynamic';

type TransferAction = 'move' | 'copy';

async function buildUniquePath(targetDir: string, name: string): Promise<string> {
  const parsed = path.parse(name);
  let counter = 1;
  let candidate = path.join(targetDir, name);

  while (true) {
    try {
      await fs.access(candidate);
      const suffix = `_${counter}`;
      const nextName = parsed.ext
        ? `${parsed.name}${suffix}${parsed.ext}`
        : `${parsed.name}${suffix}`;
      candidate = path.join(targetDir, nextName);
      counter += 1;
    } catch {
      return candidate;
    }
  }
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function copyRecursive(sourcePath: string, targetPath: string): Promise<void> {
  await fs.cp(sourcePath, targetPath, { recursive: true });
}

async function movePath(sourcePath: string, targetPath: string): Promise<void> {
  try {
    await fs.rename(sourcePath, targetPath);
  } catch (error: any) {
    if (error.code === 'EXDEV') {
      await copyRecursive(sourcePath, targetPath);
      await fs.rm(sourcePath, { recursive: true, force: true });
      return;
    }
    throw error;
  }
}

export async function POST(request: Request) {
  try {
    const userSession = await requireAuth();
    const { sourcePath, targetDir, action } = await request.json() as {
      sourcePath?: string;
      targetDir?: string;
      action?: TransferAction;
    };

    if (!sourcePath || !targetDir || !action) {
      return NextResponse.json({ error: 'Source path, target directory, and action are required' }, { status: 400 });
    }

    if (action !== 'move' && action !== 'copy') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const resolvedSource = path.resolve(sourcePath);
    const resolvedTargetDir = path.resolve(targetDir);

    if (!resolvedSource.startsWith('/var/www/sites') || !resolvedTargetDir.startsWith('/var/www/sites')) {
      return NextResponse.json({ error: 'Forbidden: Access outside allowed directory' }, { status: 403 });
    }

    const user = getUserById(userSession.userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (!userSession.isAdmin) {
      const userPath = `/var/www/sites/${user.username}`;
      if (!resolvedSource.startsWith(userPath) || !resolvedTargetDir.startsWith(userPath)) {
        return NextResponse.json({ error: 'Forbidden: You can only manage files within your own directory' }, { status: 403 });
      }
    }

    const sourceStat = await fs.stat(resolvedSource).catch(() => null);
    if (!sourceStat) {
      return NextResponse.json({ error: 'Source not found' }, { status: 404 });
    }

    const targetDirStat = await fs.stat(resolvedTargetDir).catch(() => null);
    if (!targetDirStat || !targetDirStat.isDirectory()) {
      return NextResponse.json({ error: 'Target directory not found' }, { status: 404 });
    }

    const baseName = path.basename(resolvedSource);
    const targetCandidate = path.join(resolvedTargetDir, baseName);

    if (resolvedSource === targetCandidate) {
      return NextResponse.json({ success: true, targetPath: resolvedSource });
    }

    let targetPath = targetCandidate;
    if (await pathExists(targetCandidate)) {
      targetPath = await buildUniquePath(resolvedTargetDir, baseName);
    }

    if (action === 'copy') {
      await copyRecursive(resolvedSource, targetPath);
    } else {
      await movePath(resolvedSource, targetPath);
    }

    return NextResponse.json({ success: true, targetPath });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error transferring file:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
