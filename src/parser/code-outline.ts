import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, extname, join, relative } from 'node:path';
import Parser from 'web-tree-sitter';
import type { OutlineNode, OutlineNodeKind, OutlineOptions } from '../types/outline.js';
import { mapNode } from './code-outline-node-map.js';
import {
  EXTENSION_TO_LANGUAGE,
  OUTLINE_LANGUAGES,
  type OutlineLanguageConfig,
  supportedLanguageNames,
} from './code-outline-languages.js';

const require = createRequire(import.meta.url);
const languageCache = new Map<string, Promise<Parser.Language>>();
let parserInitPromise: Promise<void> | undefined;

function initParser(): Promise<void> {
  if (parserInitPromise) return parserInitPromise;
  const parserPackage = require.resolve('web-tree-sitter/package.json');
  const parserDir = dirname(parserPackage);
  const parserWasm = existsSync(join(parserDir, 'tree-sitter.wasm'))
    ? join(parserDir, 'tree-sitter.wasm')
    : join(parserDir, 'web-tree-sitter.wasm');
  parserInitPromise = Parser.init({
    locateFile(scriptName: string) {
      if (scriptName === 'tree-sitter.wasm' || scriptName === 'web-tree-sitter.wasm')
        return parserWasm;
      return scriptName;
    },
  });
  return parserInitPromise;
}

function normalizeLanguage(language?: string): string | undefined {
  if (!language) return undefined;
  const normalized = language.trim().toLowerCase();
  if (normalized === 'ts') return 'typescript';
  if (normalized === 'js') return 'javascript';
  if (normalized === 'py') return 'python';
  return normalized;
}

export function detectOutlineLanguage(filePath?: string, explicitLanguage?: string): string {
  const normalized = normalizeLanguage(explicitLanguage);
  if (normalized) return normalized;
  if (!filePath)
    throw new Error('Language could not be detected. Pass --language when reading from stdin.');
  const extension = extname(filePath).toLowerCase();
  const language = EXTENSION_TO_LANGUAGE[extension];
  if (language) return language;
  throw new Error(
    `Unsupported extension "${extension || '(none)'}". Supported languages: ${supportedLanguageNames().join(', ')}`,
  );
}

async function loadLanguage(languageKey: string): Promise<Parser.Language> {
  const cached = languageCache.get(languageKey);
  if (cached) return cached;
  const task = (async () => {
    const config = OUTLINE_LANGUAGES[languageKey];
    if (!config)
      throw new Error(
        `Unsupported language "${languageKey}". Supported: ${supportedLanguageNames().join(', ')}`,
      );
    await initParser();
    const packageJson = require.resolve('tree-sitter-wasms/package.json');
    return Parser.Language.load(
      join(dirname(packageJson), 'out', `tree-sitter-${config.grammar}.wasm`),
    );
  })();
  languageCache.set(languageKey, task);
  return task;
}

function flattenDeclarationTypes(
  config: OutlineLanguageConfig,
  language: Parser.Language,
): Map<string, OutlineNodeKind> {
  const available = new Set<string>();
  for (let i = 0; i < language.nodeTypeCount; i++) {
    const type = language.nodeTypeForId(i);
    if (type) available.add(type);
  }
  const map = new Map<string, OutlineNodeKind>();
  for (const [kind, types] of Object.entries(config.declarationTypes)) {
    for (const type of types ?? []) if (available.has(type)) map.set(type, kind as OutlineNodeKind);
  }
  return map;
}

function collectNodes(
  parent: Parser.SyntaxNode,
  source: string,
  declarationTypes: Map<string, OutlineNodeKind>,
  inCallable = false,
): OutlineNode[] {
  const output: OutlineNode[] = [];
  for (const child of parent.namedChildren) {
    const rawKind = declarationTypes.get(child.type);
    if (!rawKind) {
      output.push(...collectNodes(child, source, declarationTypes, inCallable));
      continue;
    }
    const mapped = mapNode(child, rawKind, source, inCallable);
    const childInCallable = inCallable || rawKind === 'function' || rawKind === 'method';
    const nested = collectNodes(child, source, declarationTypes, childInCallable);
    if (!mapped) {
      output.push(...nested);
      continue;
    }
    output.push({
      kind: mapped.kind,
      name: mapped.name,
      signature: mapped.signature,
      startLine: child.startPosition.row + 1,
      endLine: child.endPosition.row + 1,
      children: nested.length > 0 ? nested : undefined,
    });
  }
  return output;
}

export async function parseOutline(
  code: string,
  options: OutlineOptions = {},
): Promise<{ nodes: OutlineNode[]; language: string }> {
  const language = detectOutlineLanguage(options.filePath, options.language);
  const config = OUTLINE_LANGUAGES[language];
  if (!config)
    throw new Error(
      `Unsupported language "${language}". Supported: ${supportedLanguageNames().join(', ')}`,
    );
  const treeSitterLanguage = await loadLanguage(language);
  const parser = new Parser();
  try {
    parser.setLanguage(treeSitterLanguage);
    const tree = parser.parse(code);
    if (!tree) throw new Error('Failed to parse source code.');
    return {
      nodes: collectNodes(tree.rootNode, code, flattenDeclarationTypes(config, treeSitterLanguage)),
      language: config.displayName,
    };
  } finally {
    parser.delete();
  }
}

export function detectOutlineLanguageFromPath(filePath: string): string {
  return detectOutlineLanguage(filePath, undefined);
}

export function resolveDisplayPath(inputPath?: string): string {
  if (!inputPath) return '<stdin>';
  const fromCwd = relative(process.cwd(), inputPath);
  return fromCwd.startsWith('..') ? inputPath : fromCwd;
}
