import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/solfeggio/sessions - list all sessions
export async function GET() {
  try {
    const sessions = await db.solfeggioSession.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        notes: {
          orderBy: { createdAt: 'asc' },
        },
      },
      take: 20,
    });
    return NextResponse.json(sessions);
  } catch (error) {
    console.error('Error fetching sessions:', error);
    return NextResponse.json({ error: 'خطا در دریافت جلسات' }, { status: 500 });
  }
}

// POST /api/solfeggio/sessions - create a new session
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name } = body;

    const session = await db.solfeggioSession.create({
      data: {
        name: name || 'جلسه تمرین',
      },
    });

    return NextResponse.json(session, { status: 201 });
  } catch (error) {
    console.error('Error creating session:', error);
    return NextResponse.json({ error: 'خطا در ایجاد جلسه' }, { status: 500 });
  }
}
