import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getDatabasesByUser, createDatabase, getNextAvailablePort, grantDatabaseAccess } from '@/lib/db';
import { createContainer, pullImage } from '@/lib/docker';
import { generateDatabaseTemplate } from '@/lib/templates/database';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await requireAuth();
    const databases = getDatabasesByUser(user.userId, user.isAdmin);

    return NextResponse.json({ databases });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error listing databases:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();

    const { name, username, password } = body;

    // Validate input
    if (!name) {
      return NextResponse.json(
        { error: 'Database name is required' },
        { status: 400 }
      );
    }

    // Sanitize database name (only alphanumeric and underscores)
    const sanitizedName = name.replace(/[^a-zA-Z0-9_]/g, '_');

    // Get next available port
    const port = getNextAvailablePort();

    // Generate container config
    const containerConfig = generateDatabaseTemplate({
      name: sanitizedName,
      port,
      username: username || 'docklite',
      password,
    });

    // Pull image if it doesn't exist
    await pullImage('postgres:16-alpine');

    // Create container
    const containerId = await createContainer(containerConfig);

    // Save to database
    const database = createDatabase({
      name: sanitizedName,
      container_id: containerId,
      postgres_port: port,
    });

    // Grant access to creator
    grantDatabaseAccess(user.userId, database.id);

    // Get credentials from container labels
    const dbPassword = containerConfig.Labels?.['docklite.password'] || 'unknown';
    const dbUsername = containerConfig.Labels?.['docklite.username'] || username || 'docklite';

    return NextResponse.json({
      database,
      connection: {
        host: 'localhost',
        port,
        database: sanitizedName,
        username: dbUsername,
        password: dbPassword,
      },
    }, { status: 201 });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error creating database:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create database' },
      { status: 500 }
    );
  }
}
