#!/usr/bin/env node
/** Local maps diagnostics — run: npm run check:maps */

import { runMapDiagnostics } from '../src/lib/maps/diagnostics.ts';

const d = await runMapDiagnostics();

console.log('Maps diagnostics');
console.log('================');
console.log(`Time: ${d.timestamp}`);
console.log(`ORS configured: ${d.orsConfigured}`);
console.log(`OSRM reachable: ${d.osrmReachable}`);
console.log(`Nominatim reachable: ${d.nominatimReachable}`);
console.log(`OSM tile CSP: ${d.osmTileCspConfigured}`);
console.log(`Map places: ${d.mapPlaces.verified} verified / ${d.mapPlaces.total} total`);
console.log(`Geocode cache: ${d.geocodeCache.active} active / ${d.geocodeCache.total} total`);
console.log(`Storage: ${d.storageDriver}`);
console.log(`Search provider mode: ${d.mapSearchProvider}`);
console.log(`Route provider mode: ${d.mapRouteProvider}`);

if (!d.osmTileCspConfigured || !d.nominatimReachable) {
  process.exitCode = 1;
}
