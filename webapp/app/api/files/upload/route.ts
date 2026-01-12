
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import fs from 'fs/promises';
import path from 'path';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';

export async function POST(request: Request) {
  try {
    await requireAuth();
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const uploadPath = formData.get('path') as string;

    if (!file || !uploadPath) {
      return NextResponse.json({ error: 'File and path are required' }, { status: 400 });
    }

    const resolvedPath = path.resolve(uploadPath);

    // Security check: Ensure the path is within the intended directory
    if (!resolvedPath.startsWith('/var/www/sites')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const filePath = path.join(resolvedPath, file.name);
    const fileStream = file.stream();
    const writeStream = await fs.open(filePath, 'w');
    await pipeline(Readable.fromWeb(fileStream as any), writeStream.createWriteStream());

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error uploading file:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
