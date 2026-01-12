import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireAdmin } from '@/lib/auth';
import {
  getBackupDestinations,
  createBackupDestination,
  updateBackupDestination,
  deleteBackupDestination
} from '@/lib/db';
import type { CreateBackupDestinationParams } from '@/types';

// GET /api/backups/destinations - List all backup destinations
export async function GET() {
  try {
    await requireAdmin();
    const destinations = getBackupDestinations();
    return NextResponse.json({ destinations });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: error.message.includes('admin') ? 403 : 500 });
  }
}

// POST /api/backups/destinations - Create new backup destination
export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();

    const { name, type, config, enabled } = body;

    if (!name || !type || !config) {
      return NextResponse.json(
        { error: 'Missing required fields: name, type, config' },
        { status: 400 }
      );
    }

    const params: CreateBackupDestinationParams = {
      name,
      type,
      config,
      enabled: enabled !== undefined ? enabled : 1
    };

    const id = createBackupDestination(params);
    return NextResponse.json({ id, message: 'Backup destination created successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT /api/backups/destinations - Update backup destination
export async function PUT(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();

    const { id, name, type, config, enabled } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Missing required field: id' },
        { status: 400 }
      );
    }

    updateBackupDestination(id, { name, type, config, enabled });
    return NextResponse.json({ message: 'Backup destination updated successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/backups/destinations?id=1
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

    deleteBackupDestination(parseInt(id));
    return NextResponse.json({ message: 'Backup destination deleted successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
