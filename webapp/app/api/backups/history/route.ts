import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { clearBackupHistory } from '@/lib/db';

export const dynamic = 'force-dynamic';

// DELETE /api/backups/history - Clear backup history records
export async function DELETE() {
  try {
    await requireAdmin();
    const deleted = clearBackupHistory();
    return NextResponse.json({ message: 'Backup history cleared', deleted });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
