#!/usr/bin/env node
'use strict';
// outgrow — UserPromptSubmit hook.
//
// Two jobs on every prompt:
//   1. Notice "stop outgrow" / "start outgrow" and flip the off switch.
//   2. Remind the model that outgrow is on, and hand it the learned state
//      for this project — which terms to stop explaining. The counts come
//      from a file, so the fade is deterministic instead of remembered.

const lib = require('./lib');

lib.readStdin(data => {
  try {
    const prompt = String(data.prompt || '').toLowerCase().replace(/\s+/g, ' ').trim();

    const wantsOff =
      /\b(stop|disable|deactivate|quit|exit|turn off)\s+(the\s+)?outgrow\b/.test(prompt) ||
      /\bturn\s+(the\s+)?outgrow\s+off\b/.test(prompt) ||
      /\boutgrow\s+(off|stop)\b/.test(prompt) ||
      /^(please\s+)?(go\s+|back\s+to\s+|switch\s+(back\s+)?to\s+|return\s+to\s+)?normal\s+mode\b/.test(prompt);

    const wantsOn =
      !wantsOff && (
        /\b(start|enable|activate|resume|turn on|use)\s+(the\s+)?outgrow\b/.test(prompt) ||
        /\bturn\s+(the\s+)?outgrow\s+on\b/.test(prompt) ||
        /\boutgrow\s+(on|start)\b/.test(prompt) ||
        /^\/outgrow(:outgrow)?\b/.test(prompt) ||
        /^outgrow[.!]*$/.test(prompt)
      );

    if (wantsOff) lib.setOff(true);
    else if (wantsOn) lib.setOff(false);

    if (lib.isOff()) process.exit(0);

    const cwd = data.cwd || process.cwd();
    const summary = lib.stageSummary(lib.readLearned(cwd));

    let context =
      'OUTGROW ACTIVE. Plain English beside every technical term, term written in backticks. ' +
      'Tag scary output Normal / Warning / Broken. Flag money, cannot-undo, secrets. ' +
      'End every explanation with a next step. ' + summary;

    // Switched on mid-session: the session-start rules were never injected,
    // so hand over the full ruleset now.
    if (wantsOn) {
      const body = lib.loadSkillBody();
      if (body) context += '\n\nFull rules:\n\n' + body;
    }

    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'UserPromptSubmit',
        additionalContext: context,
      },
    }));
  } catch (e) { /* silent */ }
  process.exit(0);
});
