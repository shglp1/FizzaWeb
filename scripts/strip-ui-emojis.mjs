import fs from 'node:fs';
import path from 'node:path';

/** Files still needing manual Lucide migration — run targeted replacements. */
const filePatches = {
  'src/app/tracking/[tripId]/page.tsx': [
    ['<span>❌</span>', '<XCircle className="h-5 w-5 text-red-500" aria-hidden />'],
    ['★ {trip.driver.rating.toFixed(1)}', '{trip.driver.rating.toFixed(1)} rating'],
  ],
  'src/app/admin/page.tsx': [
    ['🚫', ''],
    ['<Button variant="ghost" size="sm">🗺 Route</Button>', '<Button variant="ghost" size="sm">Route</Button>'],
    ['⚡ Generate Trips', 'Generate Trips'],
    ['📎 Attachment', 'Attachment'],
  ],
  'src/app/driver/trips/page.tsx': [
    ['Navigate ↗', 'Navigate'],
    ['⏱ ', ''],
  ],
  'src/app/admin/sections/SubscriptionsSection.tsx': [
    ['⚠ ', 'Warning: '],
    ['★ ', ''],
  ],
};

for (const [rel, patches] of Object.entries(filePatches)) {
  const p = path.join(process.cwd(), rel);
  if (!fs.existsSync(p)) continue;
  let t = fs.readFileSync(p, 'utf8');
  for (const [a, b] of patches) t = t.split(a).join(b);
  fs.writeFileSync(p, t);
}
