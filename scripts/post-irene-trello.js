// Publishes the Sody redesign brief + user-story epics to the Trello list "user stories irene".
// Reads TRELLO_API_KEY / TRELLO_TOKEN from .env.local. Safe to re-run: it first archives
// cards it previously created (matched by the [sody-brief] marker in the description footer).
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const LIST_ID = '6a6c737ddd17be4c2c151e86'; // "user stories irene"
const MARKER = '\n\n---\n*[sody-brief] auto-published from `docs/design/irene/sody-user-stories.md` — edits welcome here; we sync decisions back to the doc.*';

const env = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8');
const KEY = env.match(/TRELLO_API_KEY=(\S+)/)[1];
const TOKEN = env.match(/TRELLO_TOKEN=(\S+)/)[1];
const auth = `key=${KEY}&token=${TOKEN}`;

async function api(method, pathname, params = {}) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`https://api.trello.com/1${pathname}?${auth}${qs ? '&' + qs : ''}`, { method });
  if (!res.ok) throw new Error(`${method} ${pathname} -> ${res.status}: ${await res.text()}`);
  return res.json();
}

function attachFile(cardId, filePath, name) {
  execFileSync('curl.exe', ['-s', '-F', `file=@${filePath}`, '-F', `name=${name}`,
    `https://api.trello.com/1/cards/${cardId}/attachments?${auth}`], { stdio: 'pipe' });
}

// The HTML brief references images by relative path; a Trello download loses them.
// Produce a standalone copy with every local image inlined as a data URI.
function buildStandaloneBrief() {
  const dir = path.join(ROOT, 'docs', 'design', 'irene');
  const html = fs.readFileSync(path.join(dir, 'sody-design-brief.html'), 'utf8')
    .replace(/src="(assets\/[^"]+)"/g, (m, rel) => {
      const file = path.join(dir, ...rel.split('/'));
      if (!fs.existsSync(file)) return m;
      return `src="data:image/png;base64,${fs.readFileSync(file).toString('base64')}"`;
    });
  const out = path.join(ROOT, 'docs', 'design', 'irene', 'sody-design-brief.standalone.html');
  fs.writeFileSync(out, html);
  return out;
}

// Convert markdown tables (unsupported by Trello) into bold-bullet lists.
function detable(md) {
  return md.split('\n').filter((l) => !/^\|[\s-|]+\|$/.test(l)).map((l) => {
    const m = l.match(/^\|(.+)\|$/);
    if (!m) return l;
    const cells = m[1].split('|').map((c) => c.trim());
    if (cells[0] === 'Area' || cells[0] === 'Screens' || cells[0] === 'Screens & surfaces') return null;
    return `- **${cells[0].replace(/\*\*/g, '')}** — ${cells.slice(1).join(' · ').replace(/\*\*/g, '')}`;
  }).filter((l) => l !== null).join('\n');
}

const md = fs.readFileSync(path.join(ROOT, 'docs', 'design', 'irene', 'sody-user-stories.md'), 'utf8');

// Split the doc into sections keyed by "## " headings.
const sections = {};
let current = null;
for (const line of md.split('\n')) {
  const h = line.match(/^## (.+)$/);
  if (h) { current = h[1].trim(); sections[current] = []; continue; }
  if (current) sections[current].push(line);
}
const sec = (name) => {
  const k = Object.keys(sections).find((t) => t.startsWith(name));
  if (!k) throw new Error('section not found: ' + name);
  return sections[k].join('\n').trim();
};

const epicKeys = Object.keys(sections).filter((t) => t.startsWith('Epic '));

const cards = [];

cards.push({
  name: '🚀 START HERE — Welcome Irene: the Sody redesign brief',
  desc: [
    `Hi Irene! Everything you need to redesign **Embodi → Sody** lives in this list. Each card below is one epic of user stories — they describe **what** the app must do; the **how** (look, feel, flow) is entirely yours. You're invited to be critical of everything we built.`,
    '',
    '**Your deliverable:** a complete redesigned frontend (every screen, light + dark, all states).',
    '',
    '**Attached to this card:** the brand baseline sheet, the full design brief (open the HTML in any browser), and the master user-stories doc.',
    '',
    '## The product in one paragraph',
    sec('1. The product in one paragraph'),
    '',
    '## Brand baseline',
    sec('2. Brand baseline'),
    '',
    '## How we work',
    sec('Working agreement'),
  ].join('\n'),
  attachments: [
    ['docs/design/irene/assets/sody-brand.png', 'Sody brand baseline'],
    ['docs/design/irene/sody-design-brief.standalone.html', 'Sody design brief (download & open in browser)'],
    ['docs/design/irene/sody-user-stories.md', 'Master user stories doc (markdown)'],
  ],
});

cards.push({ name: '👥 Personas — who we design for', desc: sec("3. Who we're designing for") });
cards.push({ name: '📐 Design principles + your license to be critical', desc: sec('4. Design principles') });
cards.push({ name: '🗺️ App map — 4 tabs, ~40 screens (current IA)', desc: detable(sec('5. App map')) });

for (const key of epicKeys) {
  const num = key.match(/Epic (\d+)/)[1];
  const title = key.replace(/^Epic \d+ — /, '');
  const emoji = { 1: '🎨', 2: '🔐', 3: '🏠', 4: '🩺', 5: '📋', 6: '🏋️', 7: '🏁', 8: '🎯', 9: '📚', 10: '🫂', 11: '📈', 12: '💚', 13: '⚙️', 14: '🤖', 15: '🔮' }[num] || '⭐';
  cards.push({ name: `${emoji} Epic ${num} — ${title}`, desc: sections[key].join('\n').trim() });
}

cards.push({
  name: '✅ Cross-cutting acceptance criteria + scope',
  desc: [
    '## Applies to every epic',
    sec('Cross-cutting acceptance criteria'),
    '',
    "## Out of scope for Irene",
    sec("What's explicitly out of scope"),
  ].join('\n'),
});

cards.push({
  name: '🖼️ Old design gallery — context, NOT direction',
  desc: '⚠️ These screenshots are the **old Embodi design and internal prototypes**. They show which features and interaction ideas exist/were validated — the visual language is yours to replace entirely. Full set also in the repo at `docs/design/irene/assets/research/`.',
  attachments: fs.readdirSync(path.join(ROOT, 'docs', 'design', 'irene', 'assets', 'research'))
    .map((f) => [path.posix.join('docs/design/irene/assets/research', f), f.replace(/_[0-9a-f]{24}\.png$/, '').replace(/_/g, ' ')]),
});

(async () => {
  buildStandaloneBrief();
  // Archive previously auto-published cards so re-runs don't duplicate.
  const existing = await api('GET', `/lists/${LIST_ID}/cards`);
  for (const c of existing) {
    if ((c.desc || '').includes('[sody-brief]')) {
      await api('PUT', `/cards/${c.id}`, { closed: 'true' });
      console.log('archived old:', c.name);
    }
  }

  for (const card of cards) {
    const created = await api('POST', '/cards', { idList: LIST_ID, name: card.name, desc: card.desc + MARKER, pos: 'bottom' });
    console.log('created:', card.name, '->', created.shortUrl);
    for (const [file, name] of card.attachments || []) {
      attachFile(created.id, path.join(ROOT, file), name);
      console.log('   attached:', name);
    }
  }
  console.log('\nDone. List: https://trello.com/b/o2oRLfWu/embody');
})().catch((e) => { console.error(e); process.exit(1); });
