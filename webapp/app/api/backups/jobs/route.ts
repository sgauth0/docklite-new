import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireAdmin } from '@/lib/auth';
import {
  getBackupJobs,
  createBackupJob,
  updateBackupJob,
  deleteBackupJob,
  getBackupJobsByDestination
} from '@/lib/db';
import type { CreateBackupJobParams } from '@/types';

// GET /api/backups/jobs?destination_id=1 - List backup jobs (optionally filter by destination)
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const searchParams = request.nextUrl.searchParams;
    const destinationId = searchParams.get('destination_id');

    const jobs = destinationId
      ? getBackupJobsByDestination(parseInt(destinationId))
      : getBackupJobs();

    return NextResponse.json({ jobs });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: error.message.includes('admin') ? 403 : 500 });
  }
}

// POST /api/backups/jobs - Create new backup job
export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();

    const { destination_id, target_type, target_id, frequency, retention_days, enabled } = body;

    if (!destination_id || !target_type || !frequency) {
      return NextResponse.json(
        { error: 'Missing required fields: destination_id, target_type, frequency' },
        { status: 400 }
      );
    }

    const params: CreateBackupJobParams = {
      destination_id,
      target_type,
      target_id: target_id || null,
      frequency,
      retention_days: retention_days || 30,
      enabled: enabled !== undefined ? enabled : 1
    };

    const id = createBackupJob(params);
    return NextResponse.json({ id, message: 'Backup job created successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT /api/backups/jobs - Update backup job
export async function PUT(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();

    const { id, destination_id, target_type, target_id, frequency, retention_days, enabled } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Missing required field: id' },
        { status: 400 }
      );
    }

    updateBackupJob(id, {
      destination_id,
      target_type,
      target_id,
      frequency,
      retention_days,
      enabled
    });
    return NextResponse.json({ message: 'Backup job updated successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/backups/jobs?id=1
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

    deleteBackupJob(parseInt(id));
    return NextResponse.json({ message: 'Backup job deleted successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
