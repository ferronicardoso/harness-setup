'use strict';
// Managed-block reconciliation: lets generated content live inside a file a
// user also owns (AGENTS.md, CLAUDE.md) without ever touching what they wrote
// themselves outside the markers.
const { readFile, writeFile, exists } = require('./fsutil');

function markerStart(id) { return `<!-- harness-setup:start ${id} -->`; }
function markerEnd(id) { return `<!-- harness-setup:end ${id} -->`; }

function blockRegex(id) {
  const s = markerStart(id).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const e = markerEnd(id).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`${s}[\\s\\S]*?${e}`, 'g');
}

function renderBlock(id, body) {
  return `${markerStart(id)}\n${body.trim()}\n${markerEnd(id)}`;
}

// Classify a target file relative to one managed block id.
//   missing            -> file does not exist
//   empty               -> file exists but is empty/whitespace-only
//   managed-current     -> file has the block and it already matches desired
//   managed-stale       -> file has the block but content differs (safe to update in place)
//   foreign             -> file exists, has content, but no managed block of this id (needs confirmation to append)
function classify(filePath, id, desiredBody) {
  if (!exists(filePath)) return { status: 'missing' };
  const current = readFile(filePath) || '';
  if (current.trim() === '') return { status: 'empty', current };
  const re = blockRegex(id);
  const match = current.match(re);
  if (!match) return { status: 'foreign', current };
  const currentBlock = match[0];
  const desiredBlock = renderBlock(id, desiredBody);
  return {
    status: currentBlock.trim() === desiredBlock.trim() ? 'managed-current' : 'managed-stale',
    current,
  };
}

// Produce the new full file content for a CREATE (file missing/empty) or an
// in-place UPDATE (block already present). Never call this for 'foreign'
// without explicit approval from the caller.
function upsert(filePath, id, desiredBody, header) {
  const desiredBlock = renderBlock(id, desiredBody);
  const info = classify(filePath, id, desiredBody);
  if (info.status === 'missing' || info.status === 'empty') {
    const preamble = header ? `${header.trim()}\n\n` : '';
    return preamble + desiredBlock + '\n';
  }
  if (info.status === 'managed-stale' || info.status === 'managed-current') {
    return info.current.replace(blockRegex(id), desiredBlock);
  }
  throw new Error(`upsert() called on a 'foreign' file without approval: ${filePath}`);
}

// Append a managed block to a foreign (user-owned, non-empty, unmarked) file.
// Only used after explicit user confirmation.
function appendApproved(filePath, id, desiredBody) {
  const current = readFile(filePath) || '';
  const sep = current.endsWith('\n') ? '\n' : '\n\n';
  return current + sep + renderBlock(id, desiredBody) + '\n';
}

function countMarkers(content) {
  const starts = (content.match(/<!-- harness-setup:start [^\s]+ -->/g) || []).length;
  const ends = (content.match(/<!-- harness-setup:end [^\s]+ -->/g) || []).length;
  return { starts, ends, balanced: starts === ends };
}

module.exports = { markerStart, markerEnd, renderBlock, classify, upsert, appendApproved, countMarkers };
