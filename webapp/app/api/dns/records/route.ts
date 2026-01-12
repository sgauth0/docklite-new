import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import {
  getDNSRecords,
  createDNSRecord,
  updateDNSRecord,
  deleteDNSRecord,
  getCloudflareConfig,
  getDNSZoneById
} from '@/lib/db';
import { CloudflareClient } from '@/lib/cloudflare';
import type { CreateDNSRecordParams } from '@/types';

// GET /api/dns/records?zone_id=1 - List DNS records for a zone
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const searchParams = request.nextUrl.searchParams;
    const zoneId = searchParams.get('zone_id');

    const records = zoneId ? getDNSRecords(parseInt(zoneId)) : getDNSRecords();
    return NextResponse.json({ records });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/dns/records - Create a DNS record (both locally and in Cloudflare)
export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();
    const { zone_id, type, name, content, ttl, priority, proxied } = body;

    if (!zone_id || !type || !name || !content) {
      return NextResponse.json(
        { error: 'Missing required fields: zone_id, type, name, content' },
        { status: 400 }
      );
    }

    // Get zone info
    const zone = getDNSZoneById(zone_id);
    if (!zone) {
      return NextResponse.json({ error: 'Zone not found' }, { status: 404 });
    }

    // Get Cloudflare config
    const config = getCloudflareConfig();
    let cloudflareRecordId: string | null = null;

    // Create in Cloudflare if enabled
    if (config?.enabled && config.api_token) {
      try {
        const client = new CloudflareClient(config.api_token);
        const cfRecord = await client.createDNSRecord(zone.zone_id, {
          type,
          name,
          content,
          ttl: ttl || 1,
          priority,
          proxied: proxied === 1
        });
        cloudflareRecordId = cfRecord.id;
      } catch (error: any) {
        return NextResponse.json(
          { error: `Cloudflare error: ${error.message}` },
          { status: 500 }
        );
      }
    }

    // Create local record
    const params: CreateDNSRecordParams = {
      zone_id,
      cloudflare_record_id: cloudflareRecordId,
      type,
      name,
      content,
      ttl: ttl || 1,
      priority,
      proxied: proxied || 0
    };

    const id = createDNSRecord(params);
    return NextResponse.json({ id, message: 'DNS record created successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT /api/dns/records - Update a DNS record
export async function PUT(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();
    const { id, type, name, content, ttl, priority, proxied } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Missing required field: id' },
        { status: 400 }
      );
    }

    // TODO: Update in Cloudflare as well

    updateDNSRecord(id, { type, name, content, ttl, priority, proxied });
    return NextResponse.json({ message: 'DNS record updated successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/dns/records?id=1
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

    // TODO: Delete from Cloudflare as well

    deleteDNSRecord(parseInt(id));
    return NextResponse.json({ message: 'DNS record deleted successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
