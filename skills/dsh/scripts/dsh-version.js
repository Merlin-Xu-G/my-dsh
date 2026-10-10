#!/usr/bin/env node
// Print the installed DSH desktop app version by reading app.asar's package.json.
// Resolution order: CLI argument > $DSH_APP_ASAR > default per-user install path.
'use strict';
const fs = require('fs');
const path = require('path');

const candidates = [];
if (process.argv[2]) candidates.push(process.argv[2]);
if (process.env.DSH_APP_ASAR) candidates.push(process.env.DSH_APP_ASAR);
if (process.env.LOCALAPPDATA) {
  candidates.push(path.join(process.env.LOCALAPPDATA, 'Programs', 'DeepSeek Harness', 'resources', 'app.asar'));
}

for (const asar of candidates) {
  try {
    const fd = fs.openSync(asar, 'r');
    const head = Buffer.alloc(16);
    fs.readSync(fd, head, 0, 16, 0);
    const headerSize = head.readUInt32LE(4);
    const jsonLen = head.readUInt32LE(12);
    const headerBuf = Buffer.alloc(jsonLen);
    fs.readSync(fd, headerBuf, 0, jsonLen, 16);
    const header = JSON.parse(headerBuf.toString('utf8').replace(/\0+$/, ''));
    const entry = header.files && header.files['package.json'];
    if (!entry || entry.unpacked) continue;
    const buf = Buffer.alloc(entry.size);
    fs.readSync(fd, buf, 0, entry.size, 8 + headerSize + Number(entry.offset));
    console.log(JSON.parse(buf.toString('utf8')).version);
    process.exit(0);
  } catch {
    /* try the next candidate */
  }
}
console.error('dsh-version: no readable app.asar found; pass its path as an argument');
process.exit(1);
