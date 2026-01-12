import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { deleteDatabase, getDatabaseById } from '@/lib/db';
import { removeContainer } from '@/lib/docker';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const body = await request.json();

    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      );
    }

    const databaseId = parseInt(id, 10);
    if (isNaN(databaseId)) {
      return NextResponse.json(
        { error: 'Invalid database ID' },
        { status: 400 }
      );
    }

    // Get database record
    const database = getDatabaseById(databaseId);
    if (!database) {
      return NextResponse.json(
        { error: 'Database not found' },
        { status: 404 }
      );
    }

    // Update PostgreSQL user credentials in the container
    const containerId = database.container_id;

    // Execute SQL commands to update the user
    try {
      // First, try to alter the existing user's password
      const { stdout, stderr } = await execAsync(
        `docker exec ${containerId} psql -U postgres -d postgres -c "ALTER USER ${username} WITH PASSWORD '${password}';"`
      ).catch(async (alterError) => {
        // If user doesn't exist, create it
        await execAsync(
          `docker exec ${containerId} psql -U postgres -d postgres -c "CREATE USER ${username} WITH PASSWORD '${password}';"`
        );
        // Grant all privileges on the database
        await execAsync(
          `docker exec ${containerId} psql -U postgres -d postgres -c "GRANT ALL PRIVILEGES ON DATABASE ${database.name} TO ${username};"`
        );
        return { stdout: 'User created', stderr: '' };
      });

      console.log('✓ Database credentials updated:', stdout);

      return NextResponse.json({
        success: true,
        message: 'Database credentials updated successfully',
      });
    } catch (err: any) {
      console.error('Error updating database credentials:', err);
      return NextResponse.json(
        { error: 'Failed to update credentials: ' + err.message },
        { status: 500 }
      );
    }
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error updating database:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    if (!user.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const databaseId = parseInt(id, 10);
    if (isNaN(databaseId)) {
      return NextResponse.json(
        { error: 'Invalid database ID' },
        { status: 400 }
      );
    }

    const database = getDatabaseById(databaseId);
    if (!database) {
      return NextResponse.json(
        { error: 'Database not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ database });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error fetching database:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    if (!user.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const databaseId = parseInt(id, 10);
    if (isNaN(databaseId)) {
      return NextResponse.json(
        { error: 'Invalid database ID' },
        { status: 400 }
      );
    }

    const database = getDatabaseById(databaseId);
    if (!database) {
      return NextResponse.json(
        { error: 'Database not found' },
        { status: 404 }
      );
    }

    if (database.container_id) {
      try {
        await removeContainer(database.container_id, true);
      } catch (err: any) {
        if (err?.statusCode !== 404 && !String(err?.message || '').includes('No such container')) {
          throw err;
        }
      }
    }

    deleteDatabase(databaseId);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error deleting database:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
