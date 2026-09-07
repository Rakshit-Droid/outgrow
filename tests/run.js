#!/usr/bin/env node
'use strict';
// outgrow — test suite. Plain Node, no dependencies.
//
//   node tests/run.js
//
// Two halves: the glossary (so a pull request cannot ship a broken entry)
// and the hooks (JSON in, output out, file effects checked).

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const HOOKS = path.join(ROOT, 'hooks');
const lib = require(path.join(HOOKS, 'lib.js'));

let passed = 0;
let failed = 0;

function check(name, ok, detail) {
  if (ok) { passed++; return; }
  failed++;
  console.log('FAIL  ' + name + (detail ? '\n      ' + detail : ''));
}

// ---------- glossary ----------

const glossary = JSON.parse(fs.readFileSync(path.join(ROOT, 'skills', 'outgrow', 'glossary.json'), 'utf8'));
const terms = glossary.terms;
check('glossary: terms is a non-empty array', Array.isArray(terms) && terms.length > 0);

const seenNames = new Map();
for (const t of terms) {
  const label = 'glossary: "' + (t && t.term) + '"';
  check(label + ' has term', typeof t.term === 'string' && t.term.trim().length > 0);
  check(label + ' has plain', typeof t.plain === 'string' && t.plain.trim().length > 0);
  check(label + ' has next', typeof t.next === 'string' && t.next.trim().length > 0);
  check(label + ' triage is valid', [null, 'normal', 'warning', 'broken'].includes(t.triage));
  check(label + ' danger is valid', [null, 'money', 'irreversible', 'secret'].includes(t.danger));
  check(label + ' aliases is an array', Array.isArray(t.aliases));

  // Short: a beginner reads it in one breath. Two or three short sentences
  // beat one long one, so the cap is on length, not on sentence count.
  const plain = String(t.plain).trim();
  const sentences = plain.split(/[.!?]\s+(?=[A-Z])/).length;
  check(label + ' plain is short (under 160 chars)', plain.length < 160, plain.length + ' chars: ' + plain);
  check(label + ' plain is at most three sentences', sentences <= 3, 'got: ' + plain);

  for (const name of [t.term].concat(t.aliases || [])) {
    const key = String(name).toLowerCase();
    check(label + ' name "' + name + '" is unique', !seenNames.has(key),
      'also used by "' + seenNames.get(key) + '"');
    seenNames.set(key, t.term);
  }
}

// ---------- fixtures ----------

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'outgrow-test-'));
const configDir = path.join(tmp, 'config');
const project = path.join(tmp, 'project');
fs.mkdirSync(configDir, { recursive: true });
fs.mkdirSync(project, { recursive: true });

const env = Object.assign({}, process.env, {
  CLAUDE_PLUGIN_ROOT: ROOT,
  CLAUDE_CONFIG_DIR: configDir,
});

function runHook(script, input) {
  const out = execFileSync(process.execPath, [path.join(HOOKS, script)], {
    input: typeof input === 'string' ? input : JSON.stringify(input),
    env,
    cwd: project,
    encoding: 'utf8',
    timeout: 10000,
  });
  return out;
}

function transcriptLine(type, content, extra) {
  return JSON.stringify(Object.assign({ type, cwd: project, message: { role: type, content } }, extra || {}));
}

function writeTranscript(lines) {
  const p = path.join(tmp, 'transcript.jsonl');
  fs.writeFileSync(p, lines.join('\n') + '\n');
  return p;
}

const learnedFile = path.join(project, '.outgrow', 'learned.json');
function learned() {
  try { return JSON.parse(fs.readFileSync(learnedFile, 'utf8')).terms; } catch (e) { return null; }
}

// ---------- session-start ----------

{
  const out = runHook('session-start.js', { cwd: project, hook_event_name: 'SessionStart' });
  check('session-start: announces active', out.startsWith('OUTGROW ACTIVE'));
  check('session-start: injects the skill body', out.includes('## Persistence'));
  check('session-start: strips frontmatter', !out.includes('name: outgrow'));
  check('session-start: reports empty learned state', out.includes('nothing yet'));
}

// ---------- stop (the counter) ----------

{
  const reply =
    'Running `npm install` (getting the borrowed code pieces).\n\n' +
    'Then open Chrome at `localhost:3000`. The word state appears here in prose, not backticks.';
  const tp = writeTranscript([
    transcriptLine('user', 'please install and run it'),
    transcriptLine('assistant', [{ type: 'text', text: reply }]),
  ]);

  runHook('stop.js', { transcript_path: tp, cwd: project, hook_event_name: 'Stop' });
  let t = learned();
  check('stop: creates learned.json', t !== null);
  check('stop: counts npm install', t && t['npm install'] === 1, JSON.stringify(t));
  check('stop: counts localhost via alias localhost:3000', t && t['localhost'] === 1, JSON.stringify(t));
  check('stop: ignores prose word "state"', t && t['state'] === undefined, JSON.stringify(t));

  runHook('stop.js', { transcript_path: tp, cwd: project, hook_event_name: 'Stop' });
  t = learned();
  check('stop: increments on second reply', t && t['npm install'] === 2, JSON.stringify(t));

  // Reply with tool results in between: only text since the last human prompt.
  const tp2 = writeTranscript([
    transcriptLine('user', 'earlier prompt'),
    transcriptLine('assistant', [{ type: 'text', text: 'Old reply mentioning `git push`.' }]),
    transcriptLine('user', 'new prompt'),
    transcriptLine('assistant', [{ type: 'tool_use', id: 'x', name: 'Bash', input: {} }]),
    transcriptLine('user', [{ type: 'tool_result', tool_use_id: 'x', content: 'ok' }]),
    transcriptLine('assistant', [{ type: 'text', text: 'Now `commit` your work.' }]),
  ]);
  runHook('stop.js', { transcript_path: tp2, cwd: project, hook_event_name: 'Stop' });
  t = learned();
  check('stop: counts text after tool results', t && t['commit'] === 1, JSON.stringify(t));
  check('stop: does not reach back past the last prompt', t && t['git push'] === undefined, JSON.stringify(t));

  // Recursion guard.
  const before = JSON.stringify(learned());
  runHook('stop.js', { transcript_path: tp, cwd: project, stop_hook_active: true });
  check('stop: no-op when stop_hook_active', JSON.stringify(learned()) === before);

  // Garbage in, exit 0 out.
  let okGarbage = true;
  try { runHook('stop.js', 'this is not json'); } catch (e) { okGarbage = false; }
  check('stop: exits 0 on garbage stdin', okGarbage);
}

// ---------- prompt (the reminder) ----------

{
  fs.writeFileSync(learnedFile, JSON.stringify({ terms: { 'localhost': 6, 'npm install': 3, 'port': 1 } }));
  const out = runHook('prompt.js', { prompt: 'why is the page blank', cwd: project });
  let parsed = null;
  try { parsed = JSON.parse(out); } catch (e) { /* handled below */ }
  const ctx = parsed && parsed.hookSpecificOutput && parsed.hookSpecificOutput.additionalContext;
  check('prompt: emits hookSpecificOutput JSON', typeof ctx === 'string', out);
  check('prompt: names the event', parsed && parsed.hookSpecificOutput.hookEventName === 'UserPromptSubmit');
  check('prompt: lists 6+ terms as bare', /bare[^.]*localhost/.test(ctx || ''), ctx);
  check('prompt: lists 3-5 terms as short tag', /Short tag[^.]*npm install/.test(ctx || ''), ctx);
  check('prompt: leaves 1-2 terms to full explanation', !/bare[^.]*\bport\b/.test(ctx || '') && !/Short tag[^.]*\bport\b/.test(ctx || ''), ctx);
}

// ---------- on / off ----------

{
  const offFlag = path.join(configDir, '.outgrow-off');
  const out1 = runHook('prompt.js', { prompt: 'stop outgrow please', cwd: project });
  check('off: "stop outgrow" writes the flag', fs.existsSync(offFlag));
  check('off: emits nothing while off', out1.trim() === '');

  const start = runHook('session-start.js', { cwd: project });
  check('off: session-start stays quiet while off', !start.includes('OUTGROW ACTIVE'));

  const before = JSON.stringify(learned());
  const tp = writeTranscript([
    transcriptLine('user', 'hi'),
    transcriptLine('assistant', [{ type: 'text', text: 'Try `npm run dev`.' }]),
  ]);
  runHook('stop.js', { transcript_path: tp, cwd: project });
  check('off: counter does not run while off', JSON.stringify(learned()) === before);

  const out2 = runHook('prompt.js', { prompt: 'start outgrow', cwd: project });
  check('on: "start outgrow" removes the flag', !fs.existsSync(offFlag));
  check('on: re-injects the full rules when switched on mid-session', out2.includes('## Persistence'));

  runHook('prompt.js', { prompt: 'how do I exit vim normal mode', cwd: project });
  check('off: "normal mode" mid-sentence does not switch off', !fs.existsSync(offFlag));

  runHook('prompt.js', { prompt: 'normal mode', cwd: project });
  check('off: bare "normal mode" switches off', fs.existsSync(offFlag));
  runHook('prompt.js', { prompt: 'turn outgrow on', cwd: project });
  check('on: "turn outgrow on" switches back on', !fs.existsSync(offFlag));
}

// ---------- matching edge cases ----------

{
  const g = lib.loadGlossary();
  const hits = s => lib.termsInBackticks(s, g);
  check('match: exact span', hits('run `npm install`').includes('npm install'));
  check('match: term inside a longer span', hits('`Error: listen EADDRINUSE: address already in use`').includes('EADDRINUSE'));
  check('match: case-insensitive', hits('`NPM INSTALL`').includes('npm install'));
  check('match: no partial-word hit', !hits('`portable`').includes('port'));
  check('match: dotfile term', hits('check your `.env`').includes('.env'));
  check('match: nothing outside backticks', hits('just install things and commit').length === 0);
  check('match: fenced code block is not counted', hits('```\nnpm install\n```').length === 0);
}

// ---------- done ----------

try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) { /* ignore */ }

console.log(passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
