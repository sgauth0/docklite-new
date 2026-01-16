import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { Readable, PassThrough } from 'stream';
import { createGzip } from 'zlib';
import { requireDatabaseAccess } from '../db-utils';

export const dynamic = 'force-dynamic';

const RETENTION_ROOT = '/var/backups/docklite/databases';
const RETAIN_PER_DB = 7;

function buildTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function ensureRetentionDir() {
  await fs.promises.mkdir(RETENTION_ROOT, { recursive: true });
}

async function pruneOldDumps(dbName: string) {
  try {
    const entries = await fs.promises.readdir(RETENTION_ROOT);
    const prefix = `docklite-${dbName}-`;
    const files = await Promise.all(
      entries
        .filter((name) => name.startsWith(prefix) && (name.endsWith('.dump') || name.endsWith('.dump.gz')))
        .map(async (name) => {
          const fullPath = path.join(RETENTION_ROOT, name);
          const stat = await fs.promises.stat(fullPath);
          return { name, fullPath, mtimeMs: stat.mtimeMs };
        })
    );

    files.sort((a, b) => b.mtimeMs - a.mtimeMs);
    const stale = files.slice(RETAIN_PER_DB);
    await Promise.all(stale.map((file) => fs.promises.unlink(file.fullPath).catch(() => null)));
  } catch (error) {
    console.error('Error pruning database dumps:', error);
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const databaseId = parseInt(params.id, 10);
    if (Number.isNaN(databaseId)) {
      return NextResponse.json({ error: 'Invalid database ID' }, { status: 400 });
    }

    const database = await requireDatabaseAccess(databaseId);
    if (!database.container_id) {
      return NextResponse.json({ error: 'Database container not found' }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const username = typeof body.username === 'string' ? body.username.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const gzipEnabled = body.gzip !== false;

    if (!username || !password) {
      return NextResponse.json({ error: 'Database username and password are required' }, { status: 400 });
    }

    const args = [
      'exec',
      '-e',
      `PGPASSWORD=${password}`,
      database.container_id,
      'pg_dump',
      '-U',
      username,
      '-d',
      database.name,
      '-F',
      'c',
    ];

    const child = spawn('docker', args);
    const tee = new PassThrough();
    const gzip = gzipEnabled ? createGzip() : null;
    let stderr = '';

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    child.on('error', (error) => {
      tee.destroy(error);
      gzip?.destroy(error);
    });
    child.on('close', (code) => {
      if (code && code !== 0) {
        const err = new Error(stderr.trim() || `pg_dump exited with code ${code}`);
        tee.destroy(err);
        gzip?.destroy(err);
      }
    });

    let retentionEnabled = true;
    try {
      await ensureRetentionDir();
    } catch (error) {
      retentionEnabled = false;
      console.error('Error preparing retention folder:', error);
    }
    const timestamp = buildTimestamp();
    const baseName = `docklite-${database.name}-${timestamp}`;
    const dumpName = `${baseName}.dump`;
    child.stdout.pipe(tee);
    if (retentionEnabled) {
      const dumpPath = path.join(RETENTION_ROOT, dumpName);
      const fileStream = fs.createWriteStream(dumpPath);
      tee.pipe(fileStream);

      fileStream.on('finish', async () => {
        const manifest = {
          app_name: 'DockLite',
          database_name: database.name,
          container_id: database.container_id,
          format: 'custom',
          created_at: new Date().toISOString(),
          filename: dumpName,
          gzip: gzipEnabled,
        };
        const manifestPath = path.join(RETENTION_ROOT, `${baseName}.json`);
        await fs.promises.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
        await pruneOldDumps(database.name);
      });
    }

    const responseStream = gzipEnabled ? tee.pipe(gzip!) : tee;
    const responseName = gzipEnabled ? `${baseName}.dump.gz` : dumpName;
    const stream = Readable.toWeb(responseStream) as ReadableStream;

    return new NextResponse(stream, {
      headers: {
        'Content-Type': gzipEnabled ? 'application/gzip' : 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${responseName}"`,
      },
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (error.message === 'NotFound') {
      return NextResponse.json({ error: 'Database not found' }, { status: 404 });
    }
    console.error('Error downloading database:', error);
    return NextResponse.json({ error: 'Failed to download database' }, { status: 500 });
  }
}
