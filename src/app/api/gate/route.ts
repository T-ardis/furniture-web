import { Client } from '@notionhq/client';
import { NextRequest, NextResponse } from 'next/server';

const notion = new Client({ auth: process.env.NOTION_API_KEY });

/**
 * POST /api/gate
 *
 * { email: "user@example.com" }
 *   → { found: true/false }
 *
 * Checks whether the email exists in the Notion waitlist database
 * using the search API (compatible with Notion SDK v5).
 */
export async function POST(req: NextRequest) {
  const { email } = await req.json();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ found: false, error: 'Invalid email' }, { status: 400 });
  }

  try {
    const result = await notion.search({
      query: email.toLowerCase().trim(),
      filter: { property: 'object', value: 'page' },
      page_size: 5,
    });

    // Check if any result has an exact email match in the title
    const found = result.results.some((page) => {
      const props = (page as Record<string, unknown>)['properties'] as Record<string, unknown> | undefined;
      if (!props?.Email) return false;
      const title = props.Email as { title?: Array<{ text?: { content?: string } }> };
      const value = title.title?.[0]?.text?.content?.toLowerCase().trim();
      return value === email.toLowerCase().trim();
    });

    return NextResponse.json({ found });
  } catch (err) {
    console.error('Notion query error:', err);
    return NextResponse.json({ found: false, error: 'Failed to check' }, { status: 500 });
  }
}
