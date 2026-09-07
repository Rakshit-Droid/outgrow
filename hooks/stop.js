#!/usr/bin/env node
'use strict';
// outgrow — Stop hook. The counter.
//
// Runs after every reply. Reads the reply from the transcript, finds every
// glossary term written in backticks, and adds one to each term's count in
// <project>/.outgrow/learned.json. The model never touches that file.
//
// Lookup only — no network, no thinking. Milliseconds.

const lib = require('./lib');

lib.readStdin(data => {
  try {
    if (data.stop_hook_active) process.exit(0);
    if (lib.isOff()) process.exit(0);
    if (!data.transcript_path) process.exit(0);

    const reply = lib.lastAssistantReply(data.transcript_path);
    if (!reply || !reply.text) process.exit(0);

    const seen = lib.termsInBackticks(reply.text, lib.loadGlossary());
    if (!seen.length) process.exit(0);

    const cwd = data.cwd || reply.cwd || process.cwd();
    const state = lib.readLearnedFile(cwd);

    // Claude Code can fire Stop more than once for the same reply (seen in
    // -p mode). Counting it twice would halve the fade, so the uuid of the
    // last counted reply is remembered and a repeat is skipped.
    if (reply.uuid && state.last === reply.uuid) process.exit(0);

    const terms = state.terms;
    for (const term of seen) {
      terms[term] = (typeof terms[term] === 'number' ? terms[term] : 0) + 1;
    }
    lib.writeLearned(cwd, terms, reply.uuid || null);
  } catch (e) { /* silent */ }
  process.exit(0);
});
