import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// POST /api/solfeggio/notes - add a note to a session
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, noteName, solfege, octave, frequency, cents, isAccurate } = body;

    if (!sessionId || !noteName || octave === undefined || frequency === undefined || cents === undefined) {
      return NextResponse.json({ error: 'پارامترهای ناقص' }, { status: 400 });
    }

    const note = await db.solfeggioNote.create({
      data: {
        sessionId,
        noteName,
        solfege: solfege || noteName,
        octave,
        frequency,
        cents,
        isAccurate: isAccurate ?? false,
      },
    });

    return NextResponse.json(note, { status: 201 });
  } catch (error) {
    console.error('Error creating note:', error);
    return NextResponse.json({ error: 'خطا در ثبت نت' }, { status: 500 });
  }
}

// GET /api/solfeggio/notes?sessionId=xxx - get notes for a session
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({ error: 'شناسه جلسه الزامی است' }, { status: 400 });
    }

    const notes = await db.solfeggioNote.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json(notes);
  } catch (error) {
    console.error('Error fetching notes:', error);
    return NextResponse.json({ error: 'خطا در دریافت نت‌ها' }, { status: 500 });
  }
}