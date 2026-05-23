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
 * Single source of truth — Sidebar and MobileNav consume it via useCurrentUser()
 * so no separate call to /api/driver-application is needed for nav decisions.
 *
 * driverState logic:
 *   ADMIN role                                          → "ADMIN"
 *   DRIVER role                                         → "APPROVED_DRIVER"
 *   PARENT + registrationSource "DRIVER_PORTAL"         → "DRIVER_APPLICANT"
 *   PARENT + any driverApplication record               → "DRIVER_APPLICANT"
 *   PARENT + registrationSource "FAMILY" + no app       → "PARENT"
 *
 * PARENT + APPROVED application (JWT not refreshed yet):
 *   driverState = "DRIVER_APPLICANT", application.status = "APPROVED"
 *   The /driver-application approved card prompts the user to re-login so their
 *   JWT is updated with role DRIVER.
 *
 * Portal separation:
 *   registrationSource "FAMILY"  → normal family account; no driver UI
 *   registrationSource "DRIVER_PORTAL" → driver applicant account; restricted driver UI
 *   Only admin approval sets role to DRIVER (the only upgrade path).
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
    select: { fullName: true, phone: true, avatarUrl: true, registrationSource: true },
  });

  const safeProfile = profile
    ? {
        fullName:  profile.fullName,
        phone:     profile.phone     ?? null,
        avatarUrl: profile.avatarUrl ?? null,
      }
    : undefined;

  // ── Fast path: approved DRIVER ─────────────────────────────────────────────
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

  // ── PARENT role — check registrationSource + application ──────────────────
  const application = await prisma.driverApplication.findFirst({
    where:   { userId },
    orderBy: { createdAt: 'desc' },
    select:  { id: true, status: true, adminResponse: true, updatedAt: true },
  });

  // DRIVER_APPLICANT if:
  //   a) came from the driver portal (registrationSource = 'DRIVER_PORTAL'), OR
  //   b) has any driver application (regardless of registration source)
  const isDriverApplicant =
    profile?.registrationSource === 'DRIVER_PORTAL' || application !== null;

  const driverState: DriverState = isDriverApplicant ? 'DRIVER_APPLICANT' : 'PARENT';

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
