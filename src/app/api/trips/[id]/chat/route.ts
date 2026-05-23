import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/session';
import { z } from 'zod';
import { isChatWindowOpen } from '@/lib/trips/tripLifecycle';
import { moderateMessage } from '@/lib/trips/chatModeration';
import { isUserChatBlocked } from '@/lib/trips/tripProximity';
import { notifyChatOpened, notifyMessageFlagged } from '@/lib/trips/tripNotifications';
import type { TripStatus } from '@/lib/trips/tripLifecycle';

const chatMessageSchema = z.object({
  body: z.string().min(1).max(2000),
  messageType: z.enum(['TEXT', 'QUICK_REPLY', 'IMAGE']).default('TEXT'),
  attachmentUrl: z.string().url().optional(),
});

function tripEndedAt(trip: {
  status: string;
  actualDropoffTime: Date | null;
  updatedAt: Date;
}): Date | null {
  if (trip.status === 'COMPLETED') return trip.actualDropoffTime;
  if (trip.status === 'CANCELLED' || trip.status === 'NO_SHOW') return trip.updatedAt;
  return null;
}

async function checkChatAccess(tripId: string, auth: { userId: string; role: string }) {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: {
      id: true, status: true, scheduledPickupTime: true,
      chatOpenedAt: true, chatClosedAt: true,
      actualDropoffTime: true, updatedAt: true,
      driver: { select: { profileId: true } },
      subscription: { select: { userId: true } },
      rider: { select: { parentId: true } },
    },
  });
  if (!trip) return { trip: null, allowed: false, windowOpen: false };
  const parentUserId = trip.subscription?.userId ?? trip.rider?.parentId ?? null;
  const endedAt = tripEndedAt(trip);
  const windowOpen = isChatWindowOpen(
    trip.scheduledPickupTime, trip.status as TripStatus,
    trip.chatOpenedAt, trip.chatClosedAt, Date.now(), endedAt,
  );
  if (auth.role === 'ADMIN') return { trip, allowed: true, windowOpen: true };
  if (auth.role === 'DRIVER') {
    return { trip, allowed: trip.driver?.profileId === auth.userId, windowOpen };
  }
  const allowed = parentUserId === auth.userId;
  return { trip, allowed, windowOpen };
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { id } = await params;
    const { trip, allowed } = await checkChatAccess(id, auth);
    if (!trip) return NextResponse.json({ data: null, error: { message: 'Trip not found' } }, { status: 404 });
    if (!allowed) return NextResponse.json({ data: null, error: { message: 'Forbidden' } }, { status: 403 });

    const messages = await prisma.tripChatMessage.findMany({
      where: { tripId: id, deletedAt: null },
      orderBy: { createdAt: 'asc' },
      select: { id: true, senderUserId: true, senderRole: true, messageType: true, body: true, attachmentUrl: true, moderationStatus: true, createdAt: true },
    });

    const visible = auth.role === 'ADMIN' ? messages : messages.filter((m) => m.moderationStatus !== 'BLOCKED');
    return NextResponse.json({
      data: {
        messages: visible,
        chatOpenedAt: trip.chatOpenedAt,
        chatClosedAt: trip.chatClosedAt,
        windowOpen: isChatWindowOpen(
          trip.scheduledPickupTime, trip.status as TripStatus,
          trip.chatOpenedAt, trip.chatClosedAt, Date.now(), tripEndedAt(trip),
        ),
      },
      error: null,
    });
  } catch {
    return NextResponse.json({ data: null, error: { message: 'Internal Server Error' } }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    const { id } = await params;
    const { trip, allowed, windowOpen } = await checkChatAccess(id, auth);
    if (!trip) return NextResponse.json({ data: null, error: { message: 'Trip not found' } }, { status: 404 });
    if (!allowed) return NextResponse.json({ data: null, error: { message: 'Forbidden' } }, { status: 403 });
    if (auth.role !== 'ADMIN' && await isUserChatBlocked(auth.userId)) {
      return NextResponse.json({
        data: null,
        error: { message: 'Your chat access is restricted due to FIZZA safety rules.' },
      }, { status: 403 });
    }
    if (!windowOpen && auth.role !== 'ADMIN') {
      return NextResponse.json({ data: null, error: { message: 'Chat is not open yet. It opens 20 minutes before pickup.' } }, { status: 422 });
    }

    let body: unknown;
    try { body = await req.json(); } catch { return NextResponse.json({ data: null, error: { message: 'Invalid JSON' } }, { status: 400 }); }
    const parsed = chatMessageSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ data: null, error: { message: parsed.error.issues[0]?.message ?? 'Invalid input' } }, { status: 400 });

    const { body: msgBody, messageType, attachmentUrl } = parsed.data;
    const moderation = moderateMessage(msgBody);
    const moderationStatus = moderation.status;

    if (moderationStatus === 'BLOCKED') {
      return NextResponse.json({
        data: null,
        error: { message: 'Message blocked by moderation policy', matchedWords: moderation.matchedWords },
      }, { status: 422 });
    }

    if (!trip.chatOpenedAt) {
      await prisma.trip.update({ where: { id }, data: { chatOpenedAt: new Date() } });
      const parentUserId = trip.subscription?.userId ?? trip.rider?.parentId ?? null;
      await notifyChatOpened({
        tripId: id,
        parentUserId,
        driverProfileId: trip.driver?.profileId ?? null,
      });
    }

    const message = await prisma.tripChatMessage.create({
      data: { tripId: id, senderUserId: auth.userId, senderRole: auth.role, messageType, body: msgBody, attachmentUrl: attachmentUrl ?? null, moderationStatus },
      select: { id: true, senderUserId: true, senderRole: true, messageType: true, body: true, attachmentUrl: true, moderationStatus: true, createdAt: true },
    });

    if (moderationStatus !== 'CLEAN') {
      await prisma.tripEvent.create({
        data: {
          tripId: id,
          eventType: 'MODERATION_FLAGGED',
          actorUserId: auth.userId,
          actorRole: auth.role,
          message: `Flagged words: ${moderation.matchedWords.join(', ')}`,
        },
      });
      const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' }, select: { id: true } });
      await notifyMessageFlagged({ tripId: id, adminUserId: admin?.id ?? null, messagePreview: msgBody });
    }

    return NextResponse.json({ data: message, error: null }, { status: 201 });
  } catch {
    return NextResponse.json({ data: null, error: { message: 'Internal Server Error' } }, { status: 500 });
  }
}
