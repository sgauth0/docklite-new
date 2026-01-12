import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import {
  getDNSZones,
  getDNSZoneById,
  getCloudflareConfig,
  clearDNSRecords,
  createDNSRecord,
  updateDNSZoneSyncTime
} from '@/lib/db';
import { CloudflareClient } from '@/lib/cloudflare';

// POST /api/dns/sync - Sync DNS records from Cloudflare
export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();
    const { zone_id } = body; // Optional: sync specific zone

    const config = getCloudflareConfig();
    if (!config?.api_token) {
      return NextResponse.json(
        { error: 'Cloudflare API token not configured' },
        { status: 400 }
      );
    }

    if (!config.enabled) {
      return NextResponse.json(
        { error: 'Cloudflare integration is disabled' },
        { status: 400 }
      );
    }

    const client = new CloudflareClient(config.api_token);

    // Get zones to sync
    const zonesToSync = zone_id
      ? [getDNSZoneById(zone_id)]
      : getDNSZones().filter(z => z.enabled);

    if (!zonesToSync.length || !zonesToSync[0]) {
      return NextResponse.json(
        { error: 'No zones to sync' },
        { status: 400 }
      );
    }

    let totalRecords = 0;
    const results: any[] = [];

    for (const zone of zonesToSync) {
      if (!zone) continue;

      try {
        // Fetch records from Cloudflare
        const cfRecords = await client.listDNSRecords(zone.zone_id);

        // Clear existing records for this zone
        clearDNSRecords(zone.id);

        // Insert new records
        for (const cfRecord of cfRecords) {
          createDNSRecord({
            zone_id: zone.id,
            cloudflare_record_id: cfRecord.id,
            type: cfRecord.type,
            name: cfRecord.name,
            content: cfRecord.content,
            ttl: cfRecord.ttl,
            priority: cfRecord.priority || null,
            proxied: cfRecord.proxied ? 1 : 0
          });
          totalRecords++;
        }

        // Update sync time
        updateDNSZoneSyncTime(zone.id);

        results.push({
          zone: zone.domain,
          records: cfRecords.length,
          status: 'success'
        });
      } catch (error: any) {
        results.push({
          zone: zone.domain,
          records: 0,
          status: 'failed',
          error: error.message
        });
      }
    }

    return NextResponse.json({
      message: `Synced ${totalRecords} records from ${results.length} zone(s)`,
      results
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
