import { createHash } from 'node:crypto';

export function hashString(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

export function shortHash(s: string, len = 4): string {
  const normalized = s.replace(/\r\n/g, '\n').replace(/^\s+|\s+$/g, '');
  return createHash('sha256').update(normalized).digest('hex').slice(0, len);
}
