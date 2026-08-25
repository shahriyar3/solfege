import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/solfeggio/sessions/[id] - get a single session with notes
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await db.solfeggioSession.findUnique({
      where: { id },
      include: {
        notes: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!session) {
      return NextResponse.json({ error: 'جلسه یافت نشد' }, { status: 404 });
    }

    return NextResponse.json(session);
  } catch (error) {
    console.error('Error fetching session:', error);
    return NextResponse.json({ error: 'خطا در دریافت جلسه' }, { status: 500 });
  }
}

// DELETE /api/solfeggio/sessions/[id] - delete a session
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await db.solfeggioNote.deleteMany({ where: { sessionId: id } });
    await db.solfeggioSession.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting session:', error);
    return NextResponse.json({ error: 'خطا در حذف جلسه' }, { status: 500 });
  }
}
