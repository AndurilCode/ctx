import { appendFileSync, readFileSync } from 'node:fs';

export interface JournalEntry {
  ts: number;
  event: string;
  data: Record<string, unknown>;
}

export function appendEntry(journalPath: string, entry: JournalEntry): void {
  appendFileSync(journalPath, JSON.stringify(entry) + '\n');
}

export function readJournal(journalPath: string): JournalEntry[] {
  try {
    const raw = readFileSync(journalPath, 'utf8');
    return raw.trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
  } catch {
    return [];
  }
}
