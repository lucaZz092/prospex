/**
 * Gera o site estático do Prospex para a Vercel.
 * O backend (Supabase Edge Functions) e o worker Python não fazem parte deste deploy.
 * SUPABASE_ANON_KEY é pública; nunca use a service-role key aqui.
 */
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const source = dirname(fileURLToPath(import.meta.url));
const target = join(source, 'dist');
const url = (process.env.SUPABASE_URL || '').trim();
const key = (process.env.SUPABASE_ANON_KEY || '').trim();

if (!/^https:\/\/[^\s/]+(?:\/[^\s]*)?$/.test(url)) {
  throw new Error('Configure SUPABASE_URL (HTTPS) nas Environment Variables da Vercel.');
}
if (!key || /COLE_AQUI|SEU[-_]PROJETO|SERVICE_ROLE/i.test(key) || key.startsWith('sb_secret_')) {
  throw new Error('Configure SUPABASE_ANON_KEY (publishable/anon), nunca a service-role key.');
}

rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
const extensions = new Set(['.html', '.js', '.css', '.svg', '.png', '.jpg', '.jpeg', '.webp', '.ico', '.webmanifest', '.xml', '.txt']);
const ignored = new Set(['config.js', 'build.mjs']);
for (const entry of readdirSync(source, { withFileTypes: true })) {
  if (!entry.isFile() || ignored.has(entry.name)) continue;
  const extension = entry.name.slice(entry.name.lastIndexOf('.')).toLowerCase();
  if (extensions.has(extension)) cpSync(join(source, entry.name), join(target, entry.name));
}
const publicConfig = {
  SUPABASE_URL: url.replace(/\/$/, ''),
  SUPABASE_ANON_KEY: key,
};
writeFileSync(join(target, 'config.js'), 'window.PROSPEX_CONFIG = ' + JSON.stringify(publicConfig, null, 2) + ';\n');
console.log('Frontend estático do Prospex preparado em prospex/dist.');
