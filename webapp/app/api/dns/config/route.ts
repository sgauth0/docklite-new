import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { getCloudflareConfig, updateCloudflareConfig } from '@/lib/db';
import { CloudflareClient } from '@/lib/cloudflare';

// GET /api/dns/config - Get Cloudflare configuration (without exposing API token)
export async function GET() {
  try {
    await requireAdmin();
    const config = getCloudflareConfig();

    if (!config) {
      return NextResponse.json({ enabled: false, hasToken: false });
    }

    return NextResponse.json({
      enabled: config.enabled === 1,
      hasToken: !!config.api_token,
      accountId: config.account_id
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/dns/config - Update Cloudflare configuration
export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();
    const { api_token, account_id, enabled } = body;

    // Verify API token if provided
    if (api_token) {
      const client = new CloudflareClient(api_token);
      const isValid = await client.verifyToken();

      if (!isValid) {
        return NextResponse.json(
          { error: 'Invalid Cloudflare API token' },
          { status: 400 }
        );
      }
    }

    updateCloudflareConfig(api_token, account_id, enabled ? 1 : 0);

    return NextResponse.json({ message: 'Configuration updated successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
