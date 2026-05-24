import fs from 'node:fs';
import path from 'node:path';

const reps = [
  ['icon="📋"', 'icon="clipboard"'],
  ['icon="🗓️"', 'icon="calendar"'],
  ['icon="🗺️"', 'icon="map"'],
  ['icon="🛡️"', 'icon="shield"'],
  ['icon="🔔"', 'icon="bell"'],
  ['icon="💳"', 'icon="card"'],
  ['icon="👤"', 'icon="rider"'],
  ['icon="👦"', 'icon="rider"'],
  ['icon="🚗"', 'icon="car"'],
  ['icon="📝"', 'icon="file"'],
];

function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (p.endsWith('.tsx')) {
      let t = fs.readFileSync(p, 'utf8');
      const o = t;
      for (const [a, b] of reps) t = t.split(a).join(b);
      if (t !== o) fs.writeFileSync(p, t);
    }
  }
}

walk('src');
console.log('done');
