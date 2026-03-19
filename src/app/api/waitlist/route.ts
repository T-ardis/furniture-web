import { Client } from '@notionhq/client';
import { NextRequest, NextResponse } from 'next/server';

const notion = new Client({ auth: process.env.NOTION_API_KEY });

function richText(value: string) {
  return { rich_text: [{ text: { content: value ?? '' } }] };
}

export async function POST(req: NextRequest) {
  let {
    email,
    utm_source,
    utm_medium,
    utm_campaign,
    utm_term,
    utm_content,
    referrer,
  } = await req.json();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
  }

  // Fallback defaults for furniture-web signups
  if (!utm_source) utm_source = 'furniture-web';
  if (!utm_medium) utm_medium = 'product';

  try {
    await notion.pages.create({
      parent: { database_id: process.env.NOTION_DATABASE_ID! },
      properties: {
        Email: {
          title: [{ text: { content: email } }],
        },
        'Signed Up': {
          date: { start: new Date().toISOString() },
        },
        ...(utm_source   && { utm_source:   richText(utm_source) }),
        ...(utm_medium   && { utm_medium:   richText(utm_medium) }),
        ...(utm_campaign && { utm_campaign: richText(utm_campaign) }),
        ...(utm_term     && { utm_term:     richText(utm_term) }),
        ...(utm_content  && { utm_content:  richText(utm_content) }),
        ...(referrer     && { Referrer:     richText(referrer) }),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Notion error:', err);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}
