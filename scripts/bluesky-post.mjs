import { open, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { blueskyLogin, feedItems, putBlueskyPost } from '../lib/bluesky.mjs';
import { publicOrigin } from '../lib/publication-feed.mjs';

const statePath = process.env.BLUESKY_STATE_FILE;
const identifier = process.env.BLUESKY_IDENTIFIER?.trim();
const password = process.env.BLUESKY_APP_PASSWORD?.trim();
if (!statePath || !path.isAbsolute(statePath) || !identifier || !password) {
  console.error('Set BLUESKY_STATE_FILE (absolute path), BLUESKY_IDENTIFIER and BLUESKY_APP_PASSWORD.');
  process.exit(1);
}
const lockPath = `${statePath}.lock`;
let lock;
async function saveState(state) {
  const temporary = `${statePath}.${randomUUID()}.tmp`;
  try { await writeFile(temporary, JSON.stringify(state), { mode: 0o600, flag: 'wx' }); await rename(temporary, statePath); }
  finally { await unlink(temporary).catch(() => {}); }
}
try {
  lock = await open(lockPath, 'wx', 0o600);
  const origin = publicOrigin();
  const response = await fetch(`${origin}/feed.xml`, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`Feed HTTP ${response.status}`);
  const items = feedItems(await response.text(), origin);
  let state;
  try { state = JSON.parse(await readFile(statePath, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') state = null; else throw error; }
  if (!state) {
    // First run establishes a baseline without reposting the existing feed.
    await saveState({ version: 1, seen: items.map(item => item.id) });
    console.log(`Bluesky initialized with ${items.length} existing feed items; no posts sent.`);
  } else {
    if (state.version !== 1 || !Array.isArray(state.seen) || state.seen.some(id => typeof id !== 'string' || !/^[1-9]\d*$/.test(id))) throw new Error('Invalid Bluesky state file.');
    const seen = new Set(state.seen);
    const pending = [...items].reverse().filter(item => !seen.has(item.id)).slice(0, 10);
    if (pending.length) {
      const session = await blueskyLogin(identifier, password);
      for (const item of pending) {
        await putBlueskyPost(session, item);
        seen.add(item.id);
        await saveState({ version: 1, seen: [...seen] });
      }
    }
    console.log(`Bluesky: ${pending.length} post(s) published.`);
  }
} catch (error) {
  console.error('Bluesky publication failed:', error.code === 'EEXIST' ? 'another run is active or a stale lock needs removal' : error.message);
  process.exitCode = 1;
} finally {
  if (lock) { await lock.close(); await unlink(lockPath).catch(() => {}); }
}
