// @vitest-environment node
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readPhotoStatus } from './photo-status.mjs';

describe('the dev server’s view of the background photo download', () => {
  let dir;
  let file;
  beforeAll(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'tabi-status-'));
    file = path.join(dir, 'status.json');
  });
  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('passes on known fields only, and nothing when there is no download', async () => {
    expect(readPhotoStatus(file)).toBeNull();
    await writeFile(file, JSON.stringify({ state: 'running', done: 42, total: 213, published: 40, pid: process.pid, secret: 'x' }));
    expect(readPhotoStatus(file)).toEqual({ state: 'running', done: 42, total: 213, published: 40, missing: 0, updatedAt: 0 });
    await writeFile(file, 'garbage');
    expect(readPhotoStatus(file)).toBeNull();
  });

  it('reads a "running" status left by a process that is gone as stopped', async () => {
    await writeFile(file, JSON.stringify({ state: 'running', done: 1, total: 2, pid: 123 }));
    expect(readPhotoStatus(file, { alive: () => false }).state).toBe('stopped');
    await writeFile(file, JSON.stringify({ state: 'weird', pid: process.pid }));
    expect(readPhotoStatus(file).state).toBe('stopped');
  });
});
