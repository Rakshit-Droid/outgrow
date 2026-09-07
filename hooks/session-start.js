#!/usr/bin/env node
'use strict';
// outgrow — SessionStart hook.
//
// A skill on its own only runs when the model decides to invoke it, which
// in practice means never. This hook hands the full rules to the model at
// the start of every session, so outgrow is on without anyone typing
// anything. Same trick the caveman plugin uses.

const lib = require('./lib');

lib.readStdin(data => {
  try {
    if (lib.isOff()) {
      process.stdout.write('OK');
      process.exit(0);
    }

    const cwd = data.cwd || process.cwd();
    const summary = lib.stageSummary(lib.readLearned(cwd));
    const body = lib.loadSkillBody();

    const out = body
      ? 'OUTGROW ACTIVE. The full rules follow. Obey them on every response.\n\n' +
        body +
        '\n\n## Learned state for this project\n\n' + summary
      : 'OUTGROW ACTIVE. Put plain English beside every technical term and write the term ' +
        'in backticks. Tag scary output Normal / Warning / Broken. Flag anything that costs ' +
        'money, cannot be undone, or exposes a secret. End every explanation with a next step.\n\n' +
        summary;

    process.stdout.write(out);
  } catch (e) { /* never block a session over this */ }
  process.exit(0);
});
