import { describe, expect, it } from 'vitest';
import { downloadStatus, noticeText, placeholderReason } from './photoNotice.js';

const health = (over = {}) => ({ asked: 4, ready: 0, failed: 0, loading: 0, waiting: 0, enabled: true, online: true, blocked: false, transport: true, ...over });

describe('placeholderReason — when the art on screen needs explaining', () => {
  it('says nothing while photos arrive, are all there, or none were asked for', () => {
    expect(placeholderReason(health({ loading: 4 }))).toBeNull();
    expect(placeholderReason(health({ waiting: 4 }))).toBeNull();
    expect(placeholderReason(health({ ready: 4 }))).toBeNull();
    expect(placeholderReason(health({ asked: 0 }))).toBeNull();
    // A slot or two with no usable picture on Commons is not worth a notice.
    expect(placeholderReason(health({ ready: 3, failed: 1 }))).toBeNull();
    // Tests and builds without a network transport never show it.
    expect(placeholderReason(health({ transport: false, blocked: true }))).toBeNull();
    expect(placeholderReason(null)).toBeNull();
  });

  it('names why the photos could not load', () => {
    expect(placeholderReason(health({ enabled: false, waiting: 4 }))).toBe('off');
    expect(placeholderReason(health({ online: false, waiting: 4 }))).toBe('offline');
    expect(placeholderReason(health({ blocked: true, waiting: 4 }))).toBe('blocked');
    expect(placeholderReason(health({ failed: 4 }))).toBe('failed');
    expect(placeholderReason(health({ failed: 2, asked: 2 }))).toBeNull();
  });
});

describe('noticeText — what the notice says', () => {
  it('explains the placeholders and how to get the photos', () => {
    const blocked = noticeText('blocked', { bundled: 0, total: 213 });
    expect(blocked.title).toBe('The photos couldn’t load');
    expect(blocked.body).toMatch(/placeholder art, not photographs/);
    expect(blocked.body).toMatch(/Wikimedia Commons/);
    expect(blocked.hint).toMatch(/npm run photos:fetch/);
    expect(blocked.action).toBe('retry');
    expect(noticeText('offline', { bundled: 0, total: 213 })).toMatchObject({ title: 'You’re offline', action: null });
    expect(noticeText('off', { bundled: 0, total: 213 }).action).toBe('enable');
    expect(noticeText(null)).toBeNull();
  });

  it('follows the background download of npm run dev instead of sending people to the terminal', () => {
    const running = noticeText('blocked', { download: { state: 'running', done: 42, total: 213 }, bundled: 0, total: 213 });
    expect(running.hint).toBe('Your terminal is downloading the real photos right now (42 of 213). They replace the art here by themselves.');
    expect(noticeText('blocked', { download: { state: 'offline', done: 0, total: 213 } }).hint).toMatch(/couldn’t connect either/);
    // Every photo bundled: no command to suggest.
    expect(noticeText('off', { bundled: 213, total: 213 }).hint).toBe('');
  });

  it('only trusts a well-formed download status', () => {
    expect(downloadStatus({ state: 'running', done: 3, total: 9, pid: 1 })).toEqual({ state: 'running', done: 3, total: 9, published: 0 });
    expect(downloadStatus({ state: 'hacked' })).toBeNull();
    expect(downloadStatus({ state: 'done', done: -1, total: 'x' })).toEqual({ state: 'done', done: 0, total: 0, published: 0 });
    expect(downloadStatus(null)).toBeNull();
  });
});
