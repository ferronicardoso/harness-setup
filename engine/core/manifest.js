'use strict';
const path = require('path');
const { readFile, writeFile, exists } = require('./fsutil');

const MANIFEST_NAME = '.harness-setup.json';
const SCHEMA_VERSION = 1;

function manifestPath(root) { return path.join(root, MANIFEST_NAME); }

function read(root) {
  const p = manifestPath(root);
  if (!exists(p)) return null;
  const raw = readFile(p);
  try {
    return JSON.parse(raw);
  } catch {
    return { __parseError: true, raw };
  }
}

function empty() {
  return {
    schemaVersion: SCHEMA_VERSION,
    setupVersion: require('../../VERSION.json').version,
    lastRun: null,
    targets: [],
    managed: { 'project-instructions': false, skills: [], agents: [], commands: [] },
    decisions: {},
    ignored: [],
  };
}

function write(root, manifest) {
  manifest.schemaVersion = SCHEMA_VERSION;
  manifest.setupVersion = require('../../VERSION.json').version;
  manifest.lastRun = new Date().toISOString();
  writeFile(manifestPath(root), JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}

module.exports = { MANIFEST_NAME, SCHEMA_VERSION, manifestPath, read, write, empty };
