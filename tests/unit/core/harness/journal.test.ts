import { describe, expect, test } from 'bun:test';
import type { JournalEntry } from '../../../../src/core/harness/journal.js';
import { appendEntry, readJournal } from '../../../../src/core/harness/journal.js';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { unlinkSync } from 'node:fs';

describe('journal (stub)', () => {
  const path = join(tmpdir(), 'harness-journal-test-' + process.pid + '.ndjson');

  test('appendEntry + readJournal round-trips', () => {
    const entry: JournalEntry = { ts: Date.now(), event: 'test', data: { foo: 1 } };
    appendEntry(path, entry);
    const entries = readJournal(path);
    expect(entries).toHaveLength(1);
    expect(entries[0].event).toBe('test');
    try { unlinkSync(path); } catch {}
  });

  test('readJournal returns empty array for missing file', () => {
    const entries = readJournal('/tmp/nonexistent-journal-' + process.pid + '.ndjson');
    expect(entries).toEqual([]);
  });
});
