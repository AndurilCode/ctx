import type { LogPruneOptions, LogPruneResult } from '../types/log.js';
import { pruneTerminalLog } from '../utils/log.js';

export function pruneLog(logText: string, options: LogPruneOptions = {}): LogPruneResult {
  return pruneTerminalLog(logText, options);
}
