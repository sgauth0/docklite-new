import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireAdmin } from '@/lib/auth';
import { triggerBackupJob } from '@/lib/backup-scheduler';

// POST /api/backups/trigger - Manually trigger a backup job
export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();
    const { job_id } = body;

    if (!job_id) {
      return NextResponse.json(
        { error: 'Missing required field: job_id' },
        { status: 400 }
      );
    }

    // Trigger the backup job asynchronously
    triggerBackupJob(job_id).catch(err => {
      console.error(`Error triggering backup job ${job_id}:`, err);
    });

    return NextResponse.json({ message: 'Backup job triggered successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
