import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync, createReadStream } from 'node:fs';
import { join, resolve, normalize, relative, extname, sep } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const ASSETS = resolve(HERE, '..', 'assets');
const ROOT = join(homedir(), '.dsh', 'dsh-live2d');
const MODELS = join(ROOT, 'models');
const CONFIG = join(ROOT, 'config.json');
const PREFIX = '/dsh-live2d';

/** 默认音色：一个字一声短音 */
const DEFAULT_VOICE = { preset: 'soft', type: 'triangle', base: 400, jit: 10, dur: 60, vol: 32, spd: 62 };

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.wasm': 'application/wasm',
  '.moc3': 'application/octet-stream',
};

export const name = 'dsh-live2d';
export const inject = ['webServer'];

function ensureDirs() {
  mkdirSync(MODELS, { recursive: true });
}

function readConfig() {
  try {
    return JSON.parse(readFileSync(CONFIG, 'utf8'));
  } catch {
    return {};
  }
}

function writeConfig(cfg) {
  ensureDirs();
  writeFileSync(CONFIG, JSON.stringify(cfg, null, 2), 'utf8');
}

/** 目录里找指定后缀的文件（最多两层），返回相对路径 */
function findFiles(dir, suffix) {
  const out = [];
  const walk = (d, depth) => {
    if (depth > 2) return;
    let entries = [];
    try {
      entries = readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p, depth + 1);
      else if (e.name.toLowerCase().endsWith(suffix)) out.push(relative(dir, p));
    }
  };
  walk(dir, 0);
  return out.sort();
}

/** 目录里找 model3.json（最多两层） */
function findModel3(dir) {
  const out = [];
  const walk = (d, depth) => {
    if (depth > 2) return;
    let entries = [];
    try {
      entries = readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p, depth + 1);
      else if (e.name.toLowerCase().endsWith('.model3.json')) out.push(relative(dir, p));
    }
  };
  walk(dir, 0);
  return out[0];
}

function readMeta(id) {
  try {
    return JSON.parse(readFileSync(join(MODELS, id, 'meta.json'), 'utf8'));
  } catch {
    return null;
  }
}

function listModels() {
  ensureDirs();
  const list = [];
  for (const e of readdirSync(MODELS, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const dir = join(MODELS, e.name);
    const meta = readMeta(e.name);
    const model3 = meta?.model3 ?? findModel3(dir);
    if (!model3) continue;
    list.push({
      id: e.name,
      name: meta?.name ?? e.name,
      model3,
      expressions: meta?.expressions ?? [],
      voice: { ...DEFAULT_VOICE, ...(meta?.voice || {}) },
    });
  }
  return list;
}

function safeJoin(base, rel) {
  const clean = normalize(rel).replace(/^([/\\]|\.\.[/\\])+/, '');
  const full = resolve(base, clean);
  if (!full.startsWith(resolve(base) + sep)) return null;
  return full;
}

function send(res, status, body, type) {
  res.writeHead(status, { 'content-type': type || 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
  res.end(body);
}

function sendJson(res, status, obj) {
  send(res, status, JSON.stringify(obj), 'application/json; charset=utf-8');
}

function sendFile(res, file, type) {
  if (!existsSync(file) || !statSync(file).isFile()) return send(res, 404, 'not found');
  res.writeHead(200, {
    'content-type': type || MIME[extname(file).toLowerCase()] || 'application/octet-stream',
    'cache-control': 'no-store',
  });
  createReadStream(file).pipe(res);
}

async function readBody(req, limit = 512 * 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > limit) throw new Error('too large');
    chunks.push(c);
  }
  return Buffer.concat(chunks);
}

async function handle(req, res) {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const path = url.pathname.replace(PREFIX, '') || '/';
  const method = (req.method ?? 'GET').toUpperCase();

  // 观看页
  if (path === '/' || path === '/viewer' || path === '/viewer.html') {
    return sendFile(res, join(ASSETS, 'viewer.html'), MIME['.html']);
  }

  // 内置静态资源
  if (path.startsWith('/assets/')) {
    const file = safeJoin(ASSETS, path.slice('/assets/'.length));
    return file ? sendFile(res, file) : send(res, 403, 'forbidden');
  }

  // 模型文件
  if (path.startsWith('/model/')) {
    const rest = path.slice('/model/'.length);
    const slash = rest.indexOf('/');
    if (slash < 0) return send(res, 404, 'not found');
    const id = decodeURIComponent(rest.slice(0, slash));
    const file = safeJoin(join(MODELS, id), decodeURIComponent(rest.slice(slash + 1)));
    return file ? sendFile(res, file) : send(res, 403, 'forbidden');
  }

  // 音色调音页
  if (path === '/tone' || path === '/tone.html') {
    return sendFile(res, join(ASSETS, 'tone.html'), MIME['.html']);
  }

  // API
  if (path === '/api/voice' && method === 'GET') {
    const id = String(url.searchParams.get('id') ?? '');
    const meta = id ? readMeta(id) : null;
    return sendJson(res, 200, { voice: { ...DEFAULT_VOICE, ...(meta?.voice || {}) }, id });
  }

  if (path === '/api/voice' && method === 'POST') {
    const body = JSON.parse((await readBody(req)).toString('utf8') || '{}');
    const id = String(body.id ?? '');
    const meta = id ? readMeta(id) : null;
    if (!meta) return sendJson(res, 404, { error: 'model not found' });
    const v = body.voice && typeof body.voice === 'object' ? body.voice : {};
    const voice = {
      preset: String(v.preset || 'soft'),
      type: ['triangle', 'square', 'sawtooth', 'sine'].includes(v.type) ? v.type : 'triangle',
      base: Math.max(80, Math.min(1200, Number(v.base) || DEFAULT_VOICE.base)),
      jit: Math.max(0, Math.min(50, Number(v.jit) || 0)),
      dur: Math.max(10, Math.min(200, Number(v.dur) || DEFAULT_VOICE.dur)),
      vol: Math.max(0, Math.min(100, Number(v.vol) || 0)),
      spd: Math.max(20, Math.min(200, Number(v.spd) || DEFAULT_VOICE.spd)),
    };
    writeFileSync(join(MODELS, id, 'meta.json'), JSON.stringify({ ...meta, voice }, null, 2), 'utf8');
    return sendJson(res, 200, { ok: true, voice });
  }

  if (path === '/api/models' && method === 'GET') {
    const cfg = readConfig();
    return sendJson(res, 200, { models: listModels(), selected: cfg.selected ?? null });
  }

  if (path === '/api/select' && method === 'POST') {
    const body = JSON.parse((await readBody(req)).toString('utf8') || '{}');
    writeConfig({ ...readConfig(), selected: body.id ?? null });
    return sendJson(res, 200, { ok: true });
  }

  if (path === '/api/import' && method === 'POST') {
    const id = String(url.searchParams.get('model') ?? '').replace(/[^\w.-]/g, '_');
    const rel = url.searchParams.get('path') ?? '';
    if (!id || !rel) return sendJson(res, 400, { error: 'model/path required' });
    const dest = safeJoin(join(MODELS, id), rel);
    if (!dest) return sendJson(res, 403, { error: 'bad path' });
    mkdirSync(resolve(dest, '..'), { recursive: true });
    writeFileSync(dest, await readBody(req));
    return sendJson(res, 200, { ok: true });
  }

  if (path === '/api/commit' && method === 'POST') {
    const body = JSON.parse((await readBody(req)).toString('utf8') || '{}');
    const id = String(body.id ?? '');
    const dir = join(MODELS, id);
    const model3 = findModel3(dir);
    if (!model3) return sendJson(res, 400, { error: '没有找到 .model3.json' });
    const meta = { name: body.name || id, model3, expressions: findFiles(dir, '.exp3.json') };
    writeFileSync(join(dir, 'meta.json'), JSON.stringify(meta, null, 2), 'utf8');
    writeConfig({ ...readConfig(), selected: id });
    return sendJson(res, 200, { ok: true, id, model3 });
  }

  if (path === '/api/delete' && method === 'POST') {
    const body = JSON.parse((await readBody(req)).toString('utf8') || '{}');
    const id = String(body.id ?? '');
    const dir = safeJoin(MODELS, id);
    if (dir && existsSync(dir)) {
      const { rmSync } = await import('node:fs');
      rmSync(dir, { recursive: true, force: true });
      const cfg = readConfig();
      if (cfg.selected === id) writeConfig({ ...cfg, selected: listModels()[0]?.id ?? null });
    }
    return sendJson(res, 200, { ok: true });
  }

  return send(res, 404, 'not found');
}

export function apply(ctx) {
  ensureDirs();
  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: 'prefix',
        path: PREFIX,
        handler: async (req, res) => {
          try {
            await handle(req, res);
          } catch (e) {
            if (!res.headersSent) sendJson(res, 500, { error: e instanceof Error ? e.message : String(e) });
            else res.end();
          }
        },
      }),
    'dsh-live2d: /dsh-live2d 路由',
  );
}
