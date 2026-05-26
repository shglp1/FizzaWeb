import type { NextConfig } from 'next';

const isProd = process.env.NODE_ENV === 'production';

// ── Content Security Policy ────────────────────────────────────────────────────
//
// ⚠️  KNOWN LIMITATION — unsafe-inline for scripts
// Next.js 15 App Router injects inline hydration scripts that cannot be
// hash-whitelisted at build time without a nonce-based CSP middleware approach.
// For now `unsafe-inline` is included in script-src. To harden further:
//   1. Implement a nonce in src/middleware.ts and pass it through layout.tsx.
//   2. Replace 'unsafe-inline' with 'nonce-{nonce}' in the CSP string.
//
// 'unsafe-eval' is only allowed in development (Next.js hot-reload requires it).
//
// Mapbox GL JS (legacy):
//   - Loads tiles from *.mapbox.com  →  img-src / connect-src
//
// Leaflet + OpenStreetMap (StableMapPicker):
//   - Standard tiles: {a,b,c}.tile.openstreetmap.org
//   - HOT/detailed tiles: {a,b,c}.tile.openstreetmap.fr  →  img-src
//   - Geocode/reverse/route stay server-side via /api/maps/* (connect-src 'self')
//   - Optional NEXT_PUBLIC_MAP_TILE_URL / NEXT_PUBLIC_MAP_ATTRIBUTION for custom tiles
//
// MyFatoorah:
//   - Payment redirect is a full-page navigation (no XHR), so it only needs
//     form-action or navigation-src. We add both host patterns for safety.
//
const scriptSrc = isProd
  ? "'self' 'unsafe-inline'"
  : "'self' 'unsafe-inline' 'unsafe-eval'";

const cspDirectives = [
  "default-src 'self'",
  `script-src ${scriptSrc}`,
  "style-src 'self' 'unsafe-inline'",
  [
    "img-src 'self' data: blob:",
    'https://*.mapbox.com',
    'https://*.tile.openstreetmap.org',
    'https://tile.openstreetmap.org',
    'https://a.tile.openstreetmap.org',
    'https://b.tile.openstreetmap.org',
    'https://c.tile.openstreetmap.org',
    'https://*.openstreetmap.org',
    'https://*.tile.openstreetmap.fr',
    'https://a.tile.openstreetmap.fr',
    'https://b.tile.openstreetmap.fr',
    'https://c.tile.openstreetmap.fr',
  ].join(' '),
  [
    "connect-src 'self'",
    'https://*.mapbox.com',
    'https://events.mapbox.com',
  ].join(' '),
  "font-src 'self'",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  [
    "form-action 'self'",
    'https://apitest.myfatoorah.com',
    'https://api.myfatoorah.com',
  ].join(' '),
  "worker-src blob:",
  "manifest-src 'self'",
].join('; ');

// ── Shared headers (all environments) ─────────────────────────────────────────
const sharedHeaders = [
  // Prevent MIME-type sniffing
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Deny framing (belt-and-suspenders with CSP frame-ancestors)
  { key: 'X-Frame-Options', value: 'DENY' },
  // Limit referrer information to origin only on cross-origin requests
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Restrict browser feature access
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(self)',
  },
  // CSP
  { key: 'Content-Security-Policy', value: cspDirectives },
];

// ── Production-only headers ────────────────────────────────────────────────────
const productionHeaders = isProd
  ? [
      // HSTS — only safe on HTTPS (i.e. production).
      // Browsers will refuse HTTP for this domain for 1 year after seeing this header.
      // Remove `preload` if you don't intend to submit to the HSTS preload list.
      {
        key: 'Strict-Transport-Security',
        value: 'max-age=31536000; includeSubDomains; preload',
      },
    ]
  : [];

const nextConfig: NextConfig = {
  typedRoutes: true,

  async headers() {
    return [
      {
        // Apply to all routes
        source: '/(.*)',
        headers: [...sharedHeaders, ...productionHeaders],
      },
    ];
  },
};

export default nextConfig;
