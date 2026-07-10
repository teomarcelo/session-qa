import { NextResponse } from 'next/server';
import { getSession } from '../../../../lib/session.js';
import { requireEnv } from '../../../../lib/env.js';

export const dynamic = 'force-dynamic';

export async function GET() {
  const appUrl = requireEnv('APP_URL');

  const session = await getSession();
  session.destroy();

  return NextResponse.redirect(`${appUrl}/login?logged_out=1`);
}

// Support POST logout (e.g. from a form) as well
export const POST = GET;
