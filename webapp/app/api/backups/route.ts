import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireAdmin } from '@/lib/auth';
import {
  getBackups,
  getBackupsByJob,
  getBackupsByTarget,
  deleteBackup,
  deleteOldBackups
} from '@/lib/db';

// GET /api/backups?job_id=1&target_type=site&target_id=1 - List backups with optional filters
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const searchParams = request.nextUrl.searchParams;
    const jobId = searchParams.get('job_id');
    const targetType = searchParams.get('target_type') as 'site' | 'database' | null;
    const targetId = searchParams.get('target_id');

    let backups;

    if (jobId) {
      backups = getBackupsByJob(parseInt(jobId));
    } else if (targetType && targetId) {
      backups = getBackupsByTarget(targetType, parseInt(targetId));
    } else {
      backups = getBackups();
    }

    return NextResponse.json({ backups });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: error.message.includes('admin') ? 403 : 500 });
  }
}

// DELETE /api/backups?id=1 - Delete a specific backup
export async function DELETE(request: NextRequest) {
  try {
    await requireAdmin();
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Missing required parameter: id' },
        { status: 400 }
      );
    }

    deleteBackup(parseInt(id));
    return NextResponse.json({ message: 'Backup deleted successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/backups/cleanup - Delete old backups based on retention policies
export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();
    const { destination_id, retention_days } = body;

    if (!destination_id || !retention_days) {
      return NextResponse.json(
        { error: 'Missing required fields: destination_id, retention_days' },
        { status: 400 }
      );
    }

    const destinationId = Number(destination_id);
    const retentionDays = Number(retention_days);

    if (!Number.isFinite(destinationId) || !Number.isFinite(retentionDays)) {
      return NextResponse.json(
        { error: 'Invalid fields: destination_id, retention_days' },
        { status: 400 }
      );
    }

    deleteOldBackups(destinationId, retentionDays);
    return NextResponse.json({ message: 'Old backups cleaned up successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
