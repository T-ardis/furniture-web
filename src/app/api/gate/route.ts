import { Client } from '@notionhq/client';
import { NextRequest, NextResponse } from 'next/server';

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const DB_ID = process.env.NOTION_DATABASE_ID!;

/**
 * POST /api/gate
 *
 * { action: "check", email: "user@example.com" }
 *   → { found: true/false }
 *
 * Checks whether the email exists in the Notion waitlist database.
 */
export async function POST(req: NextRequest) {
  const { email } = await req.json();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ found: false, error: 'Invalid email' }, { status: 400 });
  }

  try {
    const result = await notion.dataSources.query({
      data_source_id: DB_ID,
      filter: {
        property: 'Email',
        title: { equals: email.toLowerCase().trim() },
      },
      page_size: 1,
    });

    return NextResponse.json({ found: result.results.length > 0 });
  } catch (err) {
    console.error('Notion query error:', err);
    return NextResponse.json({ found: false, error: 'Failed to check' }, { status: 500 });
  }
}
