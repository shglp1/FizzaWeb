/**
 * POST /api/trips/[id]/chat/attachment — upload chat image
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/session';
import { isChatWindowOpen } from '@/lib/trips/tripLifecycle';
import type { TripStatus } from '@/lib/trips/tripLifecycle';
import { isUserChatBlocked } from '@/lib/trips/tripProximity';
import { saveChatImage, validateImageUpload } from '@/lib/storage/storageService';

function tripEndedAt(trip: { status: string; actualDropoffTime: Date | null; updatedAt: Date }): Date | null {
  if (trip.status === 'COMPLETED') return trip.actualDropoffTime;
  if (trip.status === 'CANCELLED' || trip.status === 'NO_SHOW') return trip.updatedAt;
  return null;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    if (auth.role === 'ADMIN') {
      return NextResponse.json({ data: null, error: { message: 'Admins cannot upload chat attachments' } }, { status: 403 });
    }

    const { id } = await params;

    if (await isUserChatBlocked(auth.userId)) {
      return NextResponse.json({
        data: null,
        error: { message: 'Your chat access is restricted due to FIZZA safety rules.' },
      }, { status: 403 });
    }

    const trip = await prisma.trip.findUnique({
      where: { id },
      select: {
        id: true, status: true, scheduledPickupTime: true,
        chatOpenedAt: true, chatClosedAt: true,
        actualDropoffTime: true, updatedAt: true,
        driver: { select: { profileId: true } },
        subscription: { select: { userId: true } },
        rider: { select: { parentId: true } },
      },
    });
    if (!trip) {
      return NextResponse.json({ data: null, error: { message: 'Trip not found' } }, { status: 404 });
    }

    const parentUserId = trip.subscription?.userId ?? trip.rider?.parentId ?? null;
    if (auth.role === 'DRIVER' && trip.driver?.profileId !== auth.userId) {
      return NextResponse.json({ data: null, error: { message: 'Forbidden' } }, { status: 403 });
    }
    if (auth.role !== 'DRIVER' && parentUserId !== auth.userId) {
      return NextResponse.json({ data: null, error: { message: 'Forbidden' } }, { status: 403 });
    }

    const windowOpen = isChatWindowOpen(
      trip.scheduledPickupTime, trip.status as TripStatus,
      trip.chatOpenedAt, trip.chatClosedAt, Date.now(), tripEndedAt(trip),
    );
    if (!windowOpen) {
      return NextResponse.json({ data: null, error: { message: 'Chat is not open' } }, { status: 422 });
    }

    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof Blob)) {
      return NextResponse.json({ data: null, error: { message: 'file field required' } }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType = file.type || 'application/octet-stream';
    const validation = validateImageUpload(mimeType, buffer.length);
    if (!validation.ok) {
      return NextResponse.json({ data: null, error: { message: validation.error } }, { status: 400 });
    }

    const attachmentUrl = await saveChatImage(id, buffer, validation.ext, mimeType);

    return NextResponse.json({ data: { attachmentUrl }, error: null }, { status: 201 });
  } catch {
    return NextResponse.json({ data: null, error: { message: 'Internal Server Error' } }, { status: 500 });
  }
}
