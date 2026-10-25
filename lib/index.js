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
const MEMES_ROOT = join(homedir(), '.dsh', 'profiles', 'desktop', 'node_modules', 'dsh-meme', 'memes');

/** 情绪 → 图库分类 */
const MEME_TAGS = {
  开心: ['happy', 'like'],
  生气: ['angry', 'baka'],
  委屈: ['sad', 'fool'],
  无语: ['sigh', 'cpu', 'color'],
  害羞: ['shy', 'see'],
  困: ['sleep'],
  惊讶: ['surprised'],
  平静: ['daily', 'morning', 'meow'],
};

const DEFAULT_SETTINGS = {
  /** 多久没人说话才自己开口，单位分钟；0 = 关闭 */
  proactiveInterval: 30,
  /** off | own | both | external —— 测试功能，默认关 */
  memesMode: 'off',
  choices: true,
  memory: true,
  follow: true,
  gaze: true,
  poke: true,
  motion: true,
  sound: true,
};

const MEMES_MODES = ['off', 'own', 'both', 'external'];
const OWN_MEME_DIR = join(ASSETS, 'memes');

function readOwnMemes() {
  try {
    const m = JSON.parse(readFileSync(join(OWN_MEME_DIR, 'manifest.json'), 'utf8'));
    return Array.isArray(m.items) ? m.items : [];
  } catch {
    return [];
  }
}

/** 从自带那套里按情绪挑一张，返回文件名 */
function pickOwnMeme(mood) {
  const items = readOwnMemes();
  if (!items.length) return null;
  const hit = items.filter((it) => Array.isArray(it.moods) && it.moods.includes(mood));
  const pool = hit.length ? hit : items;
  const it = pool[Math.floor(Math.random() * pool.length)];
  return it && it.file ? it.file : null;
}

/** 按模式挑一张配图，返回可直接用的 URL */
function pickImage(mode, mood, label) {
  const m = MEMES_MODES.includes(mode) ? mode : 'off';
  if (m === 'off') return null;
  const pool = [];
  if (m === 'own' || m === 'both') {
    const f = (label && pickOwnMemeByLabel(label)) || pickOwnMeme(mood);
    if (f) pool.push('/dsh-live2d/ownmeme/' + encodeURIComponent(f));
  }
  if (m === 'external' || m === 'both') {
    const f = pickMeme(mood);
    if (f) pool.push('/dsh-live2d/media/' + f.split('/').map(encodeURIComponent).join('/'));
  }
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

function settingsOf(cfg) {
  return { ...DEFAULT_SETTINGS, ...(cfg?.settings || {}) };
}

/** 从表情图库按情绪挑一张，返回相对路径 */
function pickMeme(mood) {
  try {
    const tags = MEME_TAGS[mood] || MEME_TAGS['平静'];
    const galleries = readdirSync(MEMES_ROOT, { withFileTypes: true }).filter((e) => e.isDirectory());
    const pool = [];
    for (const g of galleries) {
      for (const tag of tags) {
        const dir = join(MEMES_ROOT, g.name, 'memes', tag);
        let files = [];
        try {
          files = readdirSync(dir);
        } catch {
          continue;
        }
        for (const f of files) {
          if (/\.(png|jpe?g|webp|gif)$/i.test(f)) pool.push(g.name + '/memes/' + tag + '/' + f);
        }
      }
    }
    if (!pool.length) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  } catch {
    return null;
  }
}

/** 从回复里摘出「||选项1|选项2」这种尾巴 */
function splitChoices(raw) {
  const m = /\|\|\s*([^|]+(?:\|[^|]+)*)\s*$/.exec(raw);
  if (!m) return { text: raw.trim(), choices: [] };
  const choices = m[1]
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 4);
  return { text: raw.slice(0, m.index).trim(), choices };
}

/** 先摘「||图:名字」，再摘「||选项1|选项2」 */
function splitMeta(raw) {
  let text = String(raw || '');
  let imageLabel = '';
  const imgMatch = /\|\|\s*图\s*[:：]\s*([^\n|]+)\s*$/m.exec(text);
  if (imgMatch) {
    imageLabel = imgMatch[1].trim().replace(/^["“「『']+|["”」』']+$/g, '');
    text = (text.slice(0, imgMatch.index) + text.slice(imgMatch.index + imgMatch[0].length)).trim();
  }
  const parsed = splitChoices(text);
  return { text: parsed.text, choices: parsed.choices, imageLabel };
}

/** 按名字取自带那张 */
function pickOwnMemeByLabel(label) {
  const items = readOwnMemes();
  if (!items.length || !label) return null;
  const key = String(label).trim();
  const hit =
    items.find((it) => it.label === key) ||
    items.find((it) => String(it.file).replace(/\.\w+$/, '') === key) ||
    items.find((it) => key && String(it.label).includes(key));
  return hit ? hit.file : null;
}
function guessMood(text) {
  const s = String(text || '');
  if (/[气烦讨厌]/.test(s)) return '生气';
  if (/[委屈难过哭]/.test(s)) return '委屈';
  if (/[困睡熬夜]/.test(s)) return '困';
  if (/[唔害羞]/.test(s)) return '害羞';
  if (/[无语算了]/.test(s)) return '无语';
  if (/[好谢喜欢]/.test(s)) return '开心';
  return '平静';
}

/** 默认音色：一个字一声短音 */
const DEFAULT_VOICE = { preset: 'soft', type: 'triangle', base: 400, jit: 10, dur: 60, vol: 32, spd: 62 };

/** 没写人设卡时用的通用版，不绑定具体角色 */
const DEFAULT_PERSONA = [
  '你叫{name}。',
  '说话短，一句常常不到十五个字；不用感叹号，不写书面语，不解释心情。',
  '情绪落在具体的东西上——桌上有什么、手上在做什么、外面天色怎样。',
  '不总结，不升华，不写括号里的动作。',
].join('\n');

/** 参考密度：只给节奏和信息量，不是让模型照抄内容 */
const TALK_SAMPLES = [
  '他：今天吃啥 —— 你：锅里还有，热的。',
  '他：累死了 —— 你：先坐下。水在桌上。',
  '他：你在干嘛 —— 你：擦桌子。手是湿的。',
  '他：我想你了 —— 你：嗯。我也是。',
  '他：明天要早起 —— 你：那我今晚早点关灯。',
].join('\n');

/** 世界隔离：不说破自己在哪儿 */
const ISOLATION = [
  '【世界隔离】你不知道什么是程序、界面、插件、模型、参数。',
  '有人问起，你就当他就站在你身边。不要提“系统”“设置”“网页”“token”这些词。',
  '你不知道他那边什么样，得他讲给你听。',
].join('\n');

/** 语料：lines = 她的台词，pairs = 一问一答 */
function readCorpus(id) {
  try {
    const d = JSON.parse(readFileSync(join(MODELS, id, 'corpus.json'), 'utf8'));
    return {
      lines: Array.isArray(d.lines) ? d.lines.filter((x) => typeof x === 'string' && x.trim()).slice(0, 500) : [],
      pairs: Array.isArray(d.pairs)
        ? d.pairs
            .filter((p) => p && typeof p.assistant === 'string' && p.assistant.trim())
            .slice(0, 500)
            .map((p) => ({ user: String(p.user || '').slice(0, 200), assistant: String(p.assistant).slice(0, 400) }))
        : [],
    };
  } catch {
    return { lines: [], pairs: [] };
  }
}

function writeCorpus(id, corpus) {
  try {
    writeFileSync(
      join(MODELS, id, 'corpus.json'),
      JSON.stringify({ lines: corpus.lines.slice(0, 500), pairs: corpus.pairs.slice(0, 500) }, null, 2),
      'utf8',
    );
  } catch {}
}

/** 从语料里挑几条最贴当前对话的，拼成样例 */
function pickCorpusSamples(corpus, text, toneN = 2) {
  const out = [];
  const query = String(text || '').trim();
  if (query) {
    const chars = new Set(query);
    const scored = (corpus.pairs || [])
      .map((p) => {
        let hit = 0;
        for (const ch of String(p.user || '')) if (chars.has(ch)) hit += 1;
        return { p, hit };
      })
      .sort((a, b) => b.hit - a.hit);
    for (const s of scored.slice(0, 2)) {
      if (s.p.user) out.push('他：' + s.p.user + ' —— 你：' + s.p.assistant);
      else out.push('你：' + s.p.assistant);
    }
  }
  const pool = (corpus.lines || []).slice();
  for (let i = 0; i < toneN && pool.length; i += 1) {
    const k = Math.floor(Math.random() * pool.length);
    out.push('你：' + pool.splice(k, 1)[0]);
  }
  return out;
}

function personaOf(meta) {
  const p = typeof meta?.persona === 'string' ? meta.persona.trim() : '';
  if (p) return p;
  const nm = String(meta?.name || '她').trim() || '她';
  return DEFAULT_PERSONA.replace('{name}', nm);
}

function readChatStore(id) {
  try {
    const d = JSON.parse(readFileSync(join(MODELS, id, 'chat.json'), 'utf8'));
    return {
      messages: Array.isArray(d.messages) ? d.messages : [],
      summary: typeof d.summary === 'string' ? d.summary : '',
      facts: Array.isArray(d.facts) ? d.facts : [],
    };
  } catch {
    return { messages: [], summary: '', facts: [] };
  }
}

function readChat(id) {
  return readChatStore(id).messages;
}

function writeChat(id, messages, summary, facts) {
  try {
    const prev = readChatStore(id);
    const data = {
      messages: messages.slice(-40),
      summary: summary === undefined ? prev.summary : summary,
      facts: (facts === undefined ? prev.facts : facts).slice(-60),
    };
    writeFileSync(join(MODELS, id, 'chat.json'), JSON.stringify(data, null, 2), 'utf8');
  } catch {}
}

/** 把压缩出来的两段拆开：小结 + 关于他的事实 */
function parseDigest(raw) {
  let text = String(raw || '').trim();
  let summary = text;
  const facts = [];
  const at = text.search(/事实\s*[:：]/);
  if (at >= 0) {
    summary = text.slice(0, at).replace(/^小结\s*[:：]?\s*/, '').trim();
    const body = text.slice(at).replace(/^事实\s*[:：]\s*/, '');
    for (const line of body.split(/\n+/)) {
      const item = line.replace(/^[-*·\s]+/, '').trim();
      if (item.length >= 2 && item.length <= 60) facts.push(item);
    }
  }
  summary = summary.replace(/^小结\s*[:：]?\s*/, '').trim();
  return { summary, facts: facts.slice(0, 12) };
}

/** 攒够了就把前二十句压成小结 + 事实，人物记得住更早的事 */
async function compactChat(slot, store) {
  const head = store.messages.slice(0, 20);
  const tail = store.messages.slice(20);
  if (!head.length) return store;
  const text = head.map((m) => (m.role === 'user' ? '他：' : '你：') + String(m.text ?? '')).join('\n');
  const prompt =
    '下面是一段聊天记录。请用两段输出：\n' +
    '第一段以「小结：」开头，把这段聊了什么压成不超过一百字的第三人称概述，只留事实和情绪走向。\n' +
    '第二段以「事实：」开头，逐行列出从对话里能确定的、关于「他」的稳定信息（名字、作息、口味、忌讳、答应过的事、反复提到的人或物），' +
    '每条一行、以短横线开头、不超过二十字；不确定的不要编。没有就写「事实：无」。\n\n' + text;
  let raw = '';
  try {
    raw = await generate(slot, prompt, 900);
  } catch {
    raw = '';
  }
  const digest = parseDigest(raw);
  const summary = [store.summary, digest.summary].filter(Boolean).join('\n').slice(-1200);
  const merged = [...(store.facts || [])];
  for (const f of digest.facts) {
    if (f === '无') continue;
    if (!merged.some((x) => x === f)) merged.push(f);
  }
  return { messages: tail, summary, facts: merged.slice(-60) };
}

/** 跟他此刻说的话最贴的几条事实 */
function pickFacts(facts, text) {
  if (!facts || !facts.length) return [];
  const chars = new Set(String(text || '').replace(/[\s，。！？、,.!?]/g, ''));
  const scored = facts.map((f) => {
    let hit = 0;
    for (const ch of String(f)) if (chars.has(ch)) hit += 1;
    return { f, hit };
  });
  scored.sort((a, b) => b.hit - a.hit);
  const top = scored.filter((s) => s.hit > 0).slice(0, 6).map((s) => s.f);
  return top;
}

/** 去 AI 味：删套话、砍尾巴、压重复 */
const AI_WORDS = [
  /^(好的|当然|没问题|明白了|收到)[，,。！!、\s]+/,
  /(希望|但愿)[^。！？]{0,12}帮(到|上)你[^。！？]*[。！!]?/g,
  /还有什么(需要|想要|问题|可以帮|能帮)[^。！？]*[。！？]?/g,
  /(总之|总的来说|综上|先说结论|首先|其次|另外|值得一提的是)[，,：:]?/g,
  /作为(一个)?(AI|人工智能|语言模型)[^。！？]*[。！？]?/g,
  /(?:^|[。！？])(我理解你的感受|我很抱歉听到|这一定很不容易)[^。！？]*[。！？]?/g,
];

function humanize(input) {
  const original = String(input || '');
  let t = original;
  for (const re of AI_WORDS) t = t.replace(re, '');
  t = t
    .replace(/[ \t]+/g, ' ')
    .replace(/[。！？]{2,}/g, (m) => m[0])
    .replace(/…{3,}/g, '……')
    .replace(/[，,]\s*$/g, '')
    .trim();
  const parts = t.split(/(?<=[。！？!?~])/).filter((s) => s.trim());
  if (parts.length > 3) t = parts.slice(0, 3).join('');
  if (t.length > 60) {
    const cut = t.match(/^[\s\S]{0,60}?[。！？!?]/);
    t = cut ? cut[0] : t.slice(0, 60);
  }
  return t.trim() || original.trim();
}

/* ── 出口队列：谁能说话，都往这儿扔 ───────────────────────── */
const OUTBOX = [];
const LAST_ACTIVE = { at: Date.now() };
let outSeq = 0;

function pushOut(msg) {
  outSeq += 1;
  OUTBOX.push({ seq: outSeq, at: Date.now(), ...msg });
  if (OUTBOX.length > 64) OUTBOX.splice(0, OUTBOX.length - 64);
  return outSeq;
}

function nowText() {  try {
    return new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
  } catch {
    return new Date().toISOString();
  }
}

/** 拿默认模型，缺了就返回 null */
function modelSlot(ctx) {
  try {
    const sel = ctx?.get?.('agentDefaultModel')?.currentSelection?.();
    const llm = ctx?.get?.('llm');
    if (!llm || typeof llm.stream !== 'function' || !sel?.provider || !sel?.model) return null;
    return { llm, provider: sel.provider, model: sel.model };
  } catch {
    return null;
  }
}

/** 一次生成，只要文字 */
async function generate(slot, prompt, limit = 900) {
  let text = '';
  for await (const chunk of slot.llm.stream({
    provider: slot.provider,
    model: slot.model,
    messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
  })) {
    if (chunk?.type === 'text-delta') text += chunk.text ?? '';
    else if (chunk?.type === 'finish') break;
    if (text.length > limit) break;
  }
  return text
    .replace(/\r?\n+/g, ' ')
    .trim()
    .replace(/^["“「『']+|["”」』']+$/g, '')
    .trim();
}

/* ── 主动开口：没人说话，她自己开一句 ─────────────────────── */
let lastAutoAt = 0;

async function maybeTalk(ctx) {
  const cfg = readConfig();
  const st = settingsOf(cfg);
  const mins = Number(st.proactiveInterval ?? 30);
  if (!(mins > 0)) return;
  const gap = mins * 60 * 1000;
  const now = Date.now();
  if (now - LAST_ACTIVE.at < gap) return;
  if (now - lastAutoAt < gap) return;
  const id = String(cfg.selected || '');
  const meta = id ? readMeta(id) : null;
  if (!meta) return;
  const slot = modelSlot(ctx);
  if (!slot) return;
  lastAutoAt = now;
  const hist = readChat(id)
    .slice(-6)
    .map((m) => (m.role === 'user' ? '他：' : '你：') + String(m.text ?? ''))
    .join('\n');
  const prompt = [
    personaOf(meta),
    '现在是 ' + nowText() + '。',
    hist ? '你们之前说的：\n' + hist : '',
    '有一阵子没人说话了。你想开口，扔一句过去——提一件你正在做的事、问一句、或者吐槽一下都行。',
    '一到两句，四十字以内；具体，别总结，别讲道理。只输出这句话本身，不要引号，不要旁白。',
    '密度参考（别照抄）：\n' + TALK_SAMPLES,
  ]
    .filter(Boolean)
    .join('\n\n');
  let text = '';
  try {
    text = await generate(slot, prompt, 400);
  } catch {
    return;
  }
  if (!text) return;
  const line = humanize(text).slice(0, 120);
  pushOut({ text: line, from: 'proactive' });
  writeChat(id, readChat(id).concat([{ role: 'assistant', text: line, at: Date.now() }]));
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
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

function validId(id) {
  return /^[\w.-]+$/.test(String(id || ''));
}

function readMeta(id) {
  if (!validId(id)) return null;
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

async function handle(req, res, ctx) {
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

  // 自带的 Q 版表情包
  if (path.startsWith('/ownmeme/')) {
    const file = safeJoin(OWN_MEME_DIR, decodeURIComponent(path.slice('/ownmeme/'.length)));
    return file ? sendFile(res, file) : send(res, 403, 'forbidden');
  }

  // 表情图库
  if (path.startsWith('/media/')) {
    const file = safeJoin(MEMES_ROOT, decodeURIComponent(path.slice('/media/'.length)));
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

  // 跟她说话：不进聊天记录，直接问模型
  if (path === '/api/chat' && method === 'POST') {
    const body = JSON.parse((await readBody(req)).toString('utf8') || '{}');
    const text = String(body.text ?? '').trim().slice(0, 1000);
    if (!text) return sendJson(res, 400, { error: 'empty' });
    const cfg = readConfig();
    const id = String(body.id || cfg.selected || '');
    const meta = id ? readMeta(id) : null;
    if (!meta) return sendJson(res, 404, { error: 'model not found' });

    const slot = modelSlot(ctx);
    if (!slot) return sendJson(res, 503, { error: '模型接口不可用' });

    const st = settingsOf(readConfig());
    let store = st.memory ? readChatStore(id) : { messages: [], summary: '' };
    if (st.memory && store.messages.length > 30) {
      try {
        store = await compactChat(slot, store);
        writeChat(id, store.messages, store.summary, store.facts);
      } catch {}
    }
    const facts = st.memory ? pickFacts(store.facts, text) : [];
    const samples = pickCorpusSamples(readCorpus(id), text);
    const hist = store.messages;
    const lines = hist
      .slice(-8)
      .map((m) => (m.role === 'user' ? '他：' : '你：') + String(m.text ?? ''))
      .join('\n');
  const prompt = [
    personaOf(meta),
    meta.isolation === false ? '' : ISOLATION,
    '现在是 ' + nowText() + '。',
    store.summary ? '之前聊过的，你还记得：\n' + store.summary : '',
    facts.length ? '关于他，你记得这些：\n' + facts.map((f) => '- ' + f).join('\n') : '',
    samples.length ? '这个人平时这么说话，只参考语气，别照抄，也别拿这些去回答：\n' + samples.join('\n') : '',
    lines ? '刚才的对话：\n' + lines : '',
    '他现在说：' + text,
    '先接住他这句话：同意、拒绝、反问、解释、或者提一件和他这句有关的事。别答非所问，别自顾自说别的。',
    '一到两句，四十字以内。不总结他，不讲道理，不说“我理解你”“希望帮到你”“还需要什么”；他没问就别建议。接不住就说短的，不要编。',
    '只输出这句话本身：不要引号，不要旁白，不要括号里的动作。',
    '说话密度参考（别照抄内容）：\n' + TALK_SAMPLES,
    st.choices ? '需要他挑的话，最后另起一行写 ||选项一|选项二，最多三项。' : '',
    st.memesMode === 'own' || st.memesMode === 'both'
      ? '想附一张贴图，就在最后另起一行写 ||图:名字。能挑的：' +
        readOwnMemes()
          .map((it) => it.label)
          .filter(Boolean)
          .join('、') +
        '。不想配就别写。'
      : '',
  ]
    .filter(Boolean)
    .join('\n\n');

    let reply = '';
    try {
      reply = await generate(slot, prompt);
    } catch (e) {
      return sendJson(res, 502, { error: '生成失败：' + (e instanceof Error ? e.message : String(e)) });
    }
    LAST_ACTIVE.at = Date.now();
    reply = humanize(reply);
    const parsed = splitMeta(reply || '');
    let line = parsed.text;
    let choices = st.choices ? parsed.choices : [];
    if (line.length > 240) line = line.slice(0, 240);
    if (!line && !choices.length) return sendJson(res, 200, { ok: true, reply: '', id });
    const moodNow = guessMood(line);
    const image =
      st.memesMode === 'off'
        ? null
        : parsed.imageLabel
          ? pickImage(st.memesMode, moodNow, parsed.imageLabel)
          : Math.random() < 0.35
            ? pickImage(st.memesMode, moodNow)
            : null;

    if (st.memory) {
      writeChat(
        id,
        hist.concat([
          { role: 'user', text, at: Date.now() },
          { role: 'assistant', text: line, at: Date.now() },
        ]),
        store.summary,
        store.facts,
      );
    }
    return sendJson(res, 200, { ok: true, reply: line, choices, image: image || undefined, id });
  }

  // 人设卡
  if (path === '/api/persona' && method === 'GET') {
    const id = String(url.searchParams.get('id') ?? '');
    const meta = id ? readMeta(id) : null;
    return sendJson(res, 200, {
      id,
      persona: personaOf(meta),
      custom: typeof meta?.persona === 'string' && !!meta.persona.trim(),
      isolation: meta?.isolation !== false,
    });
  }

  if (path === '/api/persona' && method === 'POST') {
    const body = JSON.parse((await readBody(req)).toString('utf8') || '{}');
    const id = String(body.id ?? '');
    const meta = id ? readMeta(id) : null;
    if (!meta) return sendJson(res, 404, { error: 'model not found' });
    const persona = typeof body.persona === 'string' ? body.persona : meta.persona;
    const isolation = typeof body.isolation === 'boolean' ? body.isolation : meta.isolation !== false;
    writeFileSync(join(MODELS, id, 'meta.json'), JSON.stringify({ ...meta, persona, isolation }, null, 2), 'utf8');
    return sendJson(res, 200, { ok: true, persona: personaOf({ persona }), isolation });
  }

  // 开关：哪些功能开着
  if (path === '/api/settings' && method === 'GET') {
    return sendJson(res, 200, { settings: settingsOf(readConfig()) });
  }

  if (path === '/api/settings' && method === 'POST') {
    const body = JSON.parse((await readBody(req)).toString('utf8') || '{}');
    const cfg = readConfig();
    const cur = settingsOf(cfg);
    const next = { ...cur };
    const patch = body && typeof body.settings === 'object' ? body.settings : body;
    for (const k of Object.keys(DEFAULT_SETTINGS)) {
      if (typeof patch?.[k] === 'boolean') next[k] = patch[k];
    }
    if (typeof patch?.proactiveInterval === 'number' && Number.isFinite(patch.proactiveInterval)) {
      next.proactiveInterval = Math.max(0, Math.min(720, Math.round(patch.proactiveInterval)));
    }
    if (typeof patch?.memesMode === 'string' && MEMES_MODES.includes(patch.memesMode)) {
      next.memesMode = patch.memesMode;
    }
    writeConfig({ ...cfg, settings: next });
    return sendJson(res, 200, { ok: true, settings: next });
  }

  // 出口：别的插件、im 机器人、脚本都能把她要说的话推进来
  if (path === '/api/push' && method === 'POST') {
    const body = JSON.parse((await readBody(req)).toString('utf8') || '{}');
    const text = String(body.text ?? '').trim().slice(0, 2000);
    const image = String(body.image ?? '').trim().slice(0, 2000);
    if (!text && !image) return sendJson(res, 400, { error: 'empty' });
    const seq = pushOut({
      text,
      image: image || undefined,
      mood: body.mood ? String(body.mood) : undefined,
      from: body.from ? String(body.from).slice(0, 40) : 'external',
    });
    LAST_ACTIVE.at = Date.now();
    return sendJson(res, 200, { ok: true, seq });
  }

  // 客户端轮询：拿到她要说的话
  if (path === '/api/poll' && method === 'GET') {
    const since = Number(url.searchParams.get('since') || 0);
    return sendJson(res, 200, { seq: outSeq, items: OUTBOX.filter((m) => m.seq > since) });
  }

  // 手机上一页够用：她的脸 + 一个输入框
  if (path === '/chat' || path === '/mobile') {
    return sendFile(res, join(ASSETS, 'mobile.html'), MIME['.html']);
  }

  // 语料页
  if (path === '/corpus' || path === '/corpus.html') {
    return sendFile(res, join(ASSETS, 'corpus.html'), MIME['.html']);
  }

  // 人设卡页
  if (path === '/persona' || path === '/persona.html') {
    return sendFile(res, join(ASSETS, 'persona.html'), MIME['.html']);
  }

  // 音色调音页
  if (path === '/tone' || path === '/tone.html') {
    return sendFile(res, join(ASSETS, 'tone.html'), MIME['.html']);
  }

  // API

  // 语料
  if (path === '/api/corpus' && method === 'GET') {
    const id = String(url.searchParams.get('id') ?? '');
    if (id && !/^[\w.-]+$/.test(id)) return sendJson(res, 400, { error: 'bad id' });
    const c = id ? readCorpus(id) : { lines: [], pairs: [] };
    return sendJson(res, 200, { id, lines: c.lines, pairs: c.pairs, total: c.lines.length + c.pairs.length });
  }

  if (path === '/api/corpus' && method === 'POST') {
    const body = JSON.parse((await readBody(req)).toString('utf8') || '{}');
    const id = String(body.id ?? '');
    if (!/^[\w.-]+$/.test(id)) return sendJson(res, 400, { error: 'bad id' });
    const meta = readMeta(id);
    if (!meta) return sendJson(res, 404, { error: 'model not found' });
    const corpus = {
      lines: Array.isArray(body.lines) ? body.lines.filter((x) => typeof x === 'string' && x.trim()) : [],
      pairs: Array.isArray(body.pairs)
        ? body.pairs.filter((p) => p && typeof p.assistant === 'string' && p.assistant.trim())
        : [],
    };
    writeCorpus(id, corpus);
    return sendJson(res, 200, { ok: true, total: corpus.lines.length + corpus.pairs.length });
  }
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
            await handle(req, res, ctx);
          } catch (e) {
            if (!res.headersSent) sendJson(res, 500, { error: e instanceof Error ? e.message : String(e) });
            else res.end();
          }
        },
      }),
    'dsh-live2d: /dsh-live2d 路由',
  );
  ctx.effect(() => {
    const timer = setInterval(() => {
      maybeTalk(ctx).catch(() => {});
    }, 60 * 1000);
    timer.unref?.();
    return () => clearInterval(timer);
  }, 'dsh-live2d: 主动开口');
}
