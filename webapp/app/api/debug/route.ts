import { NextResponse } from 'next/server';
import { getSession, requireAdmin } from '@/lib/auth';
import { listContainers } from '@/lib/docker';
import Database from 'better-sqlite3';
import path from 'path';

export async function GET() {
  if (process.env.ENABLE_DEBUG_PAGES !== 'true') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    await requireAdmin();
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message.includes('Admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const debugInfo = {
    timestamp: new Date().toISOString(),
    database: {
      status: 'unknown',
      error: null as string | null,
      details: {} as any
    },
    docker: {
      status: 'unknown', 
      error: null as string | null,
      details: {} as any
    },
    authentication: {
      status: 'unknown',
      error: null as string | null,
      details: {} as any
    }
  };

  // Test 1: Database Connection
  try {
    const dbPath = path.join(process.cwd(), 'data', 'docklite.db');
    const testDb = new Database(dbPath);
    
    // Test basic query
    const result = testDb.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
    
    debugInfo.database.status = 'connected';
    debugInfo.database.details = {
      path: dbPath,
      userCount: result.count,
      tables: testDb.prepare("SELECT name FROM sqlite_master WHERE type='table'").all()
    };
    
    testDb.close();
  } catch (error: any) {
    debugInfo.database.status = 'error';
    debugInfo.database.error = error.message;
    debugInfo.database.details = {
      path: path.join(process.cwd(), 'data', 'docklite.db')
    };
  }

  // Test 2: Docker Connection
  try {
    const containers = await listContainers(true);
    debugInfo.docker.status = 'connected';
    debugInfo.docker.details = {
      containerCount: containers.length,
      containers: containers.slice(0, 3).map(c => ({
        id: c.id.substring(0, 12),
        name: c.name,
        status: c.status,
        state: c.state
      }))
    };
  } catch (error: any) {
    debugInfo.docker.status = 'error';
    debugInfo.docker.error = error.message;
    debugInfo.docker.details = {
      socketPath: '/var/run/docker.sock'
    };
  }

  // Test 3: Authentication
  try {
    const session = await getSession();
    debugInfo.authentication.status = session.user ? 'authenticated' : 'not_authenticated';
    debugInfo.authentication.details = {
      hasSession: !!session.user,
      user: session.user ? {
        userId: session.user.userId,
        username: session.user.username,
        isAdmin: session.user.isAdmin
      } : null
    };
  } catch (error: any) {
    debugInfo.authentication.status = 'error';
    debugInfo.authentication.error = error.message;
  }

  // Overall system status
  const overallStatus = 
    debugInfo.database.status === 'connected' && 
    debugInfo.docker.status === 'connected' ? 'healthy' : 'unhealthy';

  return NextResponse.json({
    status: overallStatus,
    debug: debugInfo
  });
}
