import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import type { DriverState } from '@/lib/roleRoutes';

// Cache-Control header — session-specific data must never be served stale.
const NO_STORE = { headers: { 'Cache-Control': 'no-store' } };

/**
 * GET /api/me
 *
 * Returns a safe user/session summary for client-side navigation and UX state.
 * This is the single source of truth for the client — Sidebar and MobileNav
 * consume it via the useCurrentUser() hook instead of making separate calls to
 * /api/driver-application.
 *
 * driverState logic:
 *   ADMIN role              → "ADMIN"
 *   DRIVER role             → "APPROVED_DRIVER"
 *   PARENT + no application → "PARENT"
 *   PARENT + application    → "APPLICANT"
 *     (covers PENDING / NEEDS_CHANGES / REJECTED, and APPROVED where the JWT
 *      role hasn't been refreshed yet — the approved card prompts re-login)
 */
export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { userId, role } = auth;

  // ── Fast path: ADMIN — no DB query needed ──────────────────────────────────
  if (role === 'ADMIN') {
    return NextResponse.json(
      {
        data: {
          userId,
          role,
          driverApplication: null,
          driverState: 'ADMIN' as DriverState,
        },
        error: null,
      },
      NO_STORE,
    );
  }

  // ── Fetch profile (all non-ADMIN roles) ────────────────────────────────────
  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    select: { fullName: true, phone: true, avatarUrl: true },
  });

  const safeProfile = profile
    ? {
        fullName:  profile.fullName,
        phone:     profile.phone     ?? null,
        avatarUrl: profile.avatarUrl ?? null,
      }
    : undefined;

  // ── Fast path: approved DRIVER — no application check needed ───────────────
  if (role === 'DRIVER') {
    return NextResponse.json(
      {
        data: {
          userId,
          role,
          profile: safeProfile,
          driverApplication: null,
          driverState: 'APPROVED_DRIVER' as DriverState,
        },
        error: null,
      },
      NO_STORE,
    );
  }

  // ── PARENT role — check for driver application ─────────────────────────────
  const application = await prisma.driverApplication.findFirst({
    where:   { userId },
    orderBy: { createdAt: 'desc' },
    select:  { id: true, status: true, adminResponse: true, updatedAt: true },
  });

  // Any application (including APPROVED-but-JWT-not-refreshed) → APPLICANT state.
  // The approved card on /driver-application will prompt the user to re-login so
  // the new DRIVER role is reflected in the JWT.
  const driverState: DriverState = application ? 'APPLICANT' : 'PARENT';

  return NextResponse.json(
    {
      data: {
        userId,
        role,
        profile: safeProfile,
        driverApplication: application
          ? {
              id:            application.id,
              status:        application.status,
              adminResponse: application.adminResponse ?? null,
              updatedAt:     application.updatedAt.toISOString(),
            }
          : null,
        driverState,
      },
      error: null,
    },
    NO_STORE,
  );
}
