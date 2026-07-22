import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '../assets/images/team');

const profiles = {
  'sid-turner': 'sid-turner-a09b96120',
  'kirstie-macdonald': 'kirstie-macdonald-58346987',
  'debbie-braxton': 'debbie-braxton-63389ab5',
  'naomi-awad': 'naomi-awad-868b73120',
  'jo-dunk': 'jo-dunk-1357932b4',
  'keith-saunders': 'keith-saunders-449b5850',
  'simon-edwards': 'simon-edwards-3352a840',
  'ajay-mavinkurve': 'ajay-mavinkurve',
};

await fs.mkdir(outDir, { recursive: true });

for (const [slug, linkedinSlug] of Object.entries(profiles)) {
  try {
    const res = await fetch(`https://unavatar.io/linkedin/${linkedinSlug}`, {
      redirect: 'follow',
      headers: { 'User-Agent': 'CapitalServicesSite/1.0' },
    });
    if (!res.ok) {
      console.log(`FAIL ${slug} ${res.status}`);
      continue;
    }
    const contentType = res.headers.get('content-type') || 'image/jpeg';
    const ext = contentType.includes('png') ? 'png' : 'jpg';
    const dest = path.join(outDir, `${slug}.${ext}`);
    const buf = Buffer.from(await res.arrayBuffer());
    await fs.writeFile(dest, buf);
    console.log(`OK ${slug} -> ${dest} (${buf.length} bytes)`);
  } catch (err) {
    console.log(`ERR ${slug} ${err.message}`);
  }
}
