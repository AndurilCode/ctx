import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, extname, join, relative } from 'node:path';
import Parser from 'web-tree-sitter';
import type { OutlineNode, OutlineNodeKind, OutlineOptions } from '../types/outline.js';
import {
  EXTENSION_TO_LANGUAGE,
  OUTLINE_LANGUAGES,
  type OutlineLanguageConfig,
  supportedLanguageNames,
} from './code-outline-languages.js';

const require = createRequire(import.meta.url);
const languageCache = new Map<string, Promise<Parser.Language>>();
const FN_VALUE_TYPES = new Set(['arrow_function', 'function', 'function_expression']);
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
      if (scriptName === 'tree-sitter.wasm' || scriptName === 'web-tree-sitter.wasm') return parserWasm;
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
  if (!filePath) throw new Error('Language could not be detected. Pass --language when reading from stdin.');
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
    if (!config) throw new Error(`Unsupported language "${languageKey}". Supported: ${supportedLanguageNames().join(', ')}`);
    await initParser();
    const packageJson = require.resolve('tree-sitter-wasms/package.json');
    return Parser.Language.load(join(dirname(packageJson), 'out', `tree-sitter-${config.grammar}.wasm`));
  })();
  languageCache.set(languageKey, task);
  return task;
}

function flattenDeclarationTypes(config: OutlineLanguageConfig, language: Parser.Language): Map<string, OutlineNodeKind> {
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

function findName(text: string, node: Parser.SyntaxNode): string {
  const nameNode = node.childForFieldName('name');
  if (nameNode) return nameNode.text.trim();
  for (const candidate of node.namedChildren) {
    if (candidate.type.includes('identifier') || candidate.type === 'name') return candidate.text.trim();
  }
  return (text.split('\n', 1)[0]?.trim() ?? '').slice(0, 80) || '<anonymous>';
}

function normalizeTypeText(value: string): string {
  return value.replace(/^:\s*/, '').replace(/\s+/g, ' ').trim();
}

function functionSignature(node: Parser.SyntaxNode, name: string): string {
  const params = node.childForFieldName('parameters')?.text ?? node.childForFieldName('parameter_list')?.text ?? '()';
  const returnType = node.childForFieldName('return_type')?.text;
  return `${name}${params}${returnType ? ` -> ${normalizeTypeText(returnType)}` : ''}`;
}

function functionVariable(node: Parser.SyntaxNode): { name: string; signature: string } | undefined {
  for (const declarator of node.descendantsOfType('variable_declarator')) {
    const value = declarator.childForFieldName('value');
    const nameNode = declarator.childForFieldName('name');
    if (!value || !nameNode || !FN_VALUE_TYPES.has(value.type)) continue;
    const name = nameNode.text.trim();
    const params = value.childForFieldName('parameters')?.text ?? '()';
    const returnType = value.childForFieldName('return_type')?.text;
    return { name, signature: `${name}${params}${returnType ? ` -> ${normalizeTypeText(returnType)}` : ''}` };
  }
  return undefined;
}

function mapNode(
  node: Parser.SyntaxNode,
  rawKind: OutlineNodeKind,
  source: string,
  inCallable: boolean,
): { kind: OutlineNodeKind; name: string; signature?: string } | undefined {
  const text = source.slice(node.startIndex, node.endIndex);
  if (rawKind === 'import') {
    const quoted = text.replace(/\s+/g, ' ').trim().match(/['"]([^'"]+)['"]/);
    return { kind: 'import', name: quoted?.[1] ?? text.slice(0, 80) };
  }
  if (rawKind === 'variable') {
    if (inCallable) return undefined;
    const fnVar = functionVariable(node);
    if (fnVar) return { kind: 'function', name: fnVar.name, signature: fnVar.signature };
  }
  const name = findName(text, node);
  if (rawKind === 'function' || rawKind === 'method') return { kind: rawKind, name, signature: functionSignature(node, name) };
  if (rawKind === 'class' || rawKind === 'interface' || rawKind === 'type' || rawKind === 'enum') {
    return { kind: rawKind, name, signature: `${rawKind} ${name}` };
  }
  return { kind: rawKind, name };
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

export async function parseOutline(code: string, options: OutlineOptions = {}): Promise<{ nodes: OutlineNode[]; language: string }> {
  const language = detectOutlineLanguage(options.filePath, options.language);
  const config = OUTLINE_LANGUAGES[language];
  if (!config) throw new Error(`Unsupported language "${language}". Supported: ${supportedLanguageNames().join(', ')}`);
  const treeSitterLanguage = await loadLanguage(language);
  const parser = new Parser();
  try {
    parser.setLanguage(treeSitterLanguage);
    const tree = parser.parse(code);
    if (!tree) throw new Error('Failed to parse source code.');
    return { nodes: collectNodes(tree.rootNode, code, flattenDeclarationTypes(config, treeSitterLanguage)), language: config.displayName };
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
