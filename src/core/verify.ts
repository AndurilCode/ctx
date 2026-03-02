import type { CompactOptions, ExpandOptions } from '../types/options.js';
import {
  type VerifyRoundTripDiagnostics,
  verifyRoundTrip,
  verifyRoundTripWithDiagnostics,
} from './roundtrip-verify.js';

/**
 * @deprecated Use verifyRoundTrip from core/roundtrip-verify.js.
 */
export function verify(
  markdown: string,
  compactOptions: CompactOptions = {},
  expandOptions: ExpandOptions = {},
): boolean {
  return verifyRoundTrip(markdown, compactOptions, expandOptions);
}

export type VerifyDiagnostics = VerifyRoundTripDiagnostics;

/**
 * @deprecated Use verifyRoundTripWithDiagnostics from core/roundtrip-verify.js.
 */
export function verifyWithDiagnostics(
  markdown: string,
  compactOptions: CompactOptions = {},
  expandOptions: ExpandOptions = {},
): VerifyDiagnostics {
  return verifyRoundTripWithDiagnostics(markdown, compactOptions, expandOptions);
}
