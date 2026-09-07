'use strict';
// outgrow — shared helpers for the three hooks.
//
// Every hook must exit 0 no matter what. A hook that fails breaks every
// command the user runs, so all file IO here is best-effort and silent.

const fs = require('fs');
const path = require('path');
const os = require('os');

// Claude Code sets CLAUDE_PLUGIN_ROOT when it runs a plugin hook. The
// fallback covers a plain checkout (hooks/ sits next to skills/).
const PLUGIN_ROOT = process.env.CLAUDE_PLUGIN_ROOT || path.join(__dirname, '..');
const CLAUDE_DIR = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const OFF_FLAG = path.join(CLAUDE_DIR, '.outgrow-off');

// Matches the table in SKILL.md: 1-2 full, 3-5 short tag, 6+ silent.
const SHORT_FROM = 3;
const SILENT_FROM = 6;

// Read the whole of stdin as JSON. Never throws; hands back {} on any
// problem, and gives up after 2 s in case stdin is never closed.
function readStdin(cb) {
  let input = '';
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    let data = {};
    try { data = JSON.parse(input || '{}'); } catch (e) { /* not JSON */ }
    if (!data || typeof data !== 'object') data = {};
    cb(data);
  };
  try {
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => { input += chunk; });
    process.stdin.on('error', finish);
    process.stdin.on('end', finish);
  } catch (e) { finish(); }
  setTimeout(finish, 2000).unref();
}

function loadGlossary() {
  try {
    const p = path.join(PLUGIN_ROOT, 'skills', 'outgrow', 'glossary.json');
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    return Array.isArray(data.terms) ? data.terms : [];
  } catch (e) { return []; }
}

// SKILL.md without its YAML frontmatter — the single source of truth for
// behaviour, read at runtime so edits never need copying into a script.
function loadSkillBody() {
  try {
    const p = path.join(PLUGIN_ROOT, 'skills', 'outgrow', 'SKILL.md');
    return fs.readFileSync(p, 'utf8').replace(/^---[\s\S]*?---\s*/, '');
  } catch (e) { return ''; }
}

// ---------- on / off ----------

function isOff() {
  try { return fs.lstatSync(OFF_FLAG).isFile(); } catch (e) { return false; }
}

function setOff(off) {
  try {
    if (off) {
      fs.mkdirSync(CLAUDE_DIR, { recursive: true });
      fs.writeFileSync(OFF_FLAG, 'off\n');
    } else {
      fs.unlinkSync(OFF_FLAG);
    }
  } catch (e) { /* best-effort */ }
}

// ---------- learned state ----------

function learnedPath(cwd) {
  return path.join(cwd || process.cwd(), '.outgrow', 'learned.json');
}

function readLearned(cwd) {
  try {
    const p = learnedPath(cwd);
    if (fs.lstatSync(p).isSymbolicLink()) return {};
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    return data && data.terms && typeof data.terms === 'object' ? data.terms : {};
  } catch (e) { return {}; }
}

function writeLearned(cwd, terms) {
  try {
    const p = learnedPath(cwd);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    try { if (fs.lstatSync(p).isSymbolicLink()) return; } catch (e) { /* new file */ }
    const tmp = p + '.' + process.pid + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify({ terms }, null, 2) + '\n');
    fs.renameSync(tmp, p);
  } catch (e) { /* best-effort */ }
}

// One line the model can obey: which terms to stop explaining.
function stageSummary(terms) {
  const short = [];
  const silent = [];
  for (const term of Object.keys(terms)) {
    const n = terms[term];
    if (typeof n !== 'number') continue;
    if (n >= SILENT_FROM) silent.push(term);
    else if (n >= SHORT_FROM) short.push(term);
  }
  short.sort();
  silent.sort();
  if (!short.length && !silent.length) {
    return 'Learned so far: nothing yet. Every term gets the full explanation.';
  }
  const parts = [];
  if (silent.length) parts.push('Use bare, no explanation (seen 6+ times): ' + silent.join(', ') + '.');
  if (short.length) parts.push('Short tag only (seen 3-5 times): ' + short.join(', ') + '.');
  parts.push('Everything else: full explanation.');
  return parts.join(' ');
}

// ---------- counting ----------

// Read at most the last `maxBytes` of a file. Transcripts grow large and
// the hook only needs the tail.
function readTail(file, maxBytes) {
  const fd = fs.openSync(file, 'r');
  try {
    const size = fs.fstatSync(fd).size;
    const start = Math.max(0, size - maxBytes);
    const buf = Buffer.alloc(size - start);
    fs.readSync(fd, buf, 0, buf.length, start);
    return buf.toString('utf8');
  } finally {
    fs.closeSync(fd);
  }
}

function isHumanPrompt(entry) {
  if (!entry || entry.type !== 'user' || !entry.message) return false;
  const c = entry.message.content;
  if (typeof c === 'string') return true;
  return Array.isArray(c) && c.some(b => b && b.type === 'text');
}

// The text of the assistant's most recent reply: every text block written
// since the last human prompt, joined. Tool results sit in between as
// `user` lines, so those are skipped rather than treated as a boundary.
function lastAssistantReply(transcriptPath) {
  let raw;
  try { raw = readTail(transcriptPath, 4 * 1024 * 1024); } catch (e) { return null; }
  const lines = raw.split('\n');
  const texts = [];
  let cwd = null;
  let seenAssistant = false;
  for (let i = lines.length - 1, scanned = 0; i >= 0 && scanned < 400; i--, scanned++) {
    const line = lines[i].trim();
    if (!line) continue;
    let entry;
    try { entry = JSON.parse(line); } catch (e) { continue; }
    if (isHumanPrompt(entry)) { if (seenAssistant) break; else continue; }
    if (entry.type !== 'assistant' || !entry.message) continue;
    seenAssistant = true;
    if (!cwd && entry.cwd) cwd = entry.cwd;
    const c = entry.message.content;
    if (Array.isArray(c)) {
      for (const b of c) if (b && b.type === 'text' && typeof b.text === 'string') texts.unshift(b.text);
    } else if (typeof c === 'string') {
      texts.unshift(c);
    }
  }
  if (!texts.length) return null;
  return { text: texts.join('\n'), cwd };
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Glossary terms that appear inside single backticks in `text`. Only
// backticked spans count, so common words like "state" or "build" in
// ordinary prose never inflate a count. Each term counts once per reply.
function termsInBackticks(text, glossary) {
  const spans = [];
  const re = /`([^`\n]+)`/g;
  let m;
  while ((m = re.exec(text)) !== null) spans.push(m[1].toLowerCase());
  if (!spans.length) return [];

  const seen = [];
  for (const entry of glossary) {
    if (!entry || typeof entry.term !== 'string') continue;
    const names = [entry.term].concat(Array.isArray(entry.aliases) ? entry.aliases : [])
      .map(n => String(n).toLowerCase())
      .filter(Boolean);
    const hit = names.some(name => {
      const word = new RegExp('(^|[^a-z0-9])' + escapeRegex(name) + '([^a-z0-9]|$)');
      return spans.some(span => span === name || word.test(span));
    });
    if (hit) seen.push(entry.term);
  }
  return seen;
}

module.exports = {
  PLUGIN_ROOT,
  CLAUDE_DIR,
  OFF_FLAG,
  readStdin,
  loadGlossary,
  loadSkillBody,
  isOff,
  setOff,
  learnedPath,
  readLearned,
  writeLearned,
  stageSummary,
  lastAssistantReply,
  termsInBackticks,
};
