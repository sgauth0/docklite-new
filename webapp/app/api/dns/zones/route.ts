import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import {
  getDNSZones,
  createDNSZone,
  updateDNSZone,
  deleteDNSZone,
  getCloudflareConfig
} from '@/lib/db';
import { CloudflareClient } from '@/lib/cloudflare';
import type { CreateDNSZoneParams } from '@/types';

// GET /api/dns/zones - List all DNS zones
export async function GET() {
  try {
    await requireAdmin();
    const zones = getDNSZones();
    return NextResponse.json({ zones });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/dns/zones - Create or import a DNS zone
export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();
    const { domain, zone_id, account_id, auto_import } = body;

    if (!domain || !zone_id) {
      return NextResponse.json(
        { error: 'Missing required fields: domain, zone_id' },
        { status: 400 }
      );
    }

    const params: CreateDNSZoneParams = {
      domain,
      zone_id,
      account_id,
      enabled: 1
    };

    const id = createDNSZone(params);

    // Auto-import records from Cloudflare if requested
    if (auto_import) {
      const config = getCloudflareConfig();
      if (config?.api_token) {
        const client = new CloudflareClient(config.api_token);
        // This will be handled by the sync endpoint
        // Just acknowledge the request here
      }
    }

    return NextResponse.json({ id, message: 'DNS zone created successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT /api/dns/zones - Update a DNS zone
export async function PUT(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();
    const { id, domain, zone_id, account_id, enabled } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Missing required field: id' },
        { status: 400 }
      );
    }

    updateDNSZone(id, { domain, zone_id, account_id, enabled });
    return NextResponse.json({ message: 'DNS zone updated successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/dns/zones?id=1
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

    deleteDNSZone(parseInt(id));
    return NextResponse.json({ message: 'DNS zone deleted successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
