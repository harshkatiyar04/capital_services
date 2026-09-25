import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(join(root, 'data', 'team-founder-manifest.json'), 'utf8'));
const map = Object.fromEntries(
  Object.entries(manifest.assets).map(([k, v]) => [k, String(v.version)])
);

const re =
  /https:\/\/res\.cloudinary\.com\/foxrj3tm\/image\/upload\/f_auto,q_auto\/v\d+\/capital-services\/team_founder\/(ajay|debbie|jo|keith|kristie|naomi|sid|simon|terry)/g;

for (const rel of ['about.html', 'js/cloudinary-images.js']) {
  const path = join(root, rel);
  let s = readFileSync(path, 'utf8');
  let n = 0;
  s = s.replace(re, (_m, id) => {
    n += 1;
    return `https://res.cloudinary.com/foxrj3tm/image/upload/f_auto,q_auto/v${map[id]}/capital-services/team_founder/${id}`;
  });
  writeFileSync(path, s);
  console.log(rel, n, 'replacements');
}
