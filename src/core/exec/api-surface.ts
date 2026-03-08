import { resolve } from 'node:path';
import { tree } from '../tree.js';
import { budgetedRead } from '../read.js';
import { assembleContext } from '../context.js';
import { autoContext } from '../auto-context.js';
import { relevance } from '../relevance.js';
import { focus } from '../focus.js';
import { symbols } from '../symbols.js';
import { fileImports } from '../imports.js';
import { codeOutline } from '../code-outline.js';
import { tokenCount } from '../token-count.js';
import { patch } from '../patch.js';
import { insert } from '../insert.js';
import { rename } from '../rename.js';

export interface ApiSurfaceOptions {
  allowWrite: boolean;
  outputBuffer: string[];
}

export function buildApiSurface(
  cwd: string,
  opts: ApiSurfaceOptions,
): Record<string, Function> {
  const api: Record<string, Function> = {
    tree: (o?: Record<string, unknown>) => tree({ path: cwd, ...o }),

    read: (o: { file: string; [k: string]: unknown }) =>
      budgetedRead({ ...o, file: resolve(cwd, o.file) }),

    context: (o: Record<string, unknown>) =>
      assembleContext(o as unknown as Parameters<typeof assembleContext>[0]),

    gather: (o: Record<string, unknown>) =>
      autoContext({ path: cwd, ...o } as unknown as Parameters<typeof autoContext>[0]),

    rank: (o: Record<string, unknown>) =>
      relevance(o as unknown as Parameters<typeof relevance>[0]),

    focus: (o: Record<string, unknown>) => {
      const file = o.file ? resolve(cwd, String(o.file)) : undefined;
      return focus({ ...o, file, root: cwd } as Parameters<typeof focus>[0]);
    },

    symbols: (o?: Record<string, unknown>) => symbols({ path: cwd, ...o } as Parameters<typeof symbols>[0]),

    imports: (o: Record<string, unknown>) => {
      const file = o.file ? resolve(cwd, String(o.file)) : undefined;
      return fileImports({ ...o, file, root: cwd } as Parameters<typeof fileImports>[0]);
    },

    outline: (file: string) => codeOutline(resolve(cwd, file)),

    tokenCount: (text: string) => tokenCount({ text }),

    log: (...args: unknown[]) => {
      opts.outputBuffer.push(
        args
          .map((a) => (typeof a === 'string' ? a : JSON.stringify(a, null, 2)))
          .join(' '),
      );
    },

    json: (v: unknown) => {
      opts.outputBuffer.push(JSON.stringify(v, null, 2));
    },
  };

  if (opts.allowWrite) {
    api.patch = (o: Record<string, unknown>) => {
      const file = o.file ? resolve(cwd, String(o.file)) : undefined;
      return patch({ ...o, file } as Parameters<typeof patch>[0]);
    };
    api.insert = (o: Record<string, unknown>) => {
      const file = o.file ? resolve(cwd, String(o.file)) : undefined;
      return insert({ ...o, file } as Parameters<typeof insert>[0]);
    };
    api.rename = (o: Record<string, unknown>) =>
      rename({ ...o, root: cwd } as unknown as Parameters<typeof rename>[0]);
  } else {
    api.patch = () => {
      throw new Error('patch() requires --allow-write');
    };
    api.insert = () => {
      throw new Error('insert() requires --allow-write');
    };
    api.rename = () => {
      throw new Error('rename() requires --allow-write');
    };
  }

  return api;
}
