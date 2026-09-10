'use strict';
const { writeFile } = require('./fsutil');

// actions: from adapters' planActions(). opts.approvedIds: Set of action ids
// the caller (the agent, after asking the user) has explicitly approved this
// run, in addition to whatever is low-risk.
function reconcile(actions, opts = {}) {
  const approved = opts.approvedIds || new Set();
  const applied = [];
  const pending = [];
  const kept = [];
  const skipped = [];

  for (const action of actions) {
    if (action.kind === 'KEEP') { kept.push(action); continue; }
    if (action.kind === 'SKIP') { skipped.push(action); continue; }

    const canApply = action.risk === 'low' || approved.has(action.id);
    if (!canApply) { pending.push(action); continue; }

    if (!opts.dryRun) {
      const content = action.apply();
      writeFile(action.file, content);
    }
    applied.push(action);
  }

  return { applied, pending, kept, skipped };
}

module.exports = { reconcile };
