import type Parser from 'web-tree-sitter';
import type { OutlineNodeKind } from '../types/outline.js';

const FN_VALUE_TYPES = new Set(['arrow_function', 'function', 'function_expression']);

function findName(text: string, node: Parser.SyntaxNode): string {
  const nameNode = node.childForFieldName('name');
  if (nameNode) return nameNode.text.trim();
  for (const candidate of node.namedChildren) {
    if (candidate.type.includes('identifier') || candidate.type === 'name') {
      return candidate.text.trim();
    }
  }
  return (text.split('\n', 1)[0]?.trim() ?? '').slice(0, 80) || '<anonymous>';
}

function normalizeTypeText(value: string): string {
  return value.replace(/^:\s*/, '').replace(/\s+/g, ' ').trim();
}

function functionSignature(node: Parser.SyntaxNode, name: string): string {
  const params =
    node.childForFieldName('parameters')?.text ??
    node.childForFieldName('parameter_list')?.text ??
    '()';
  const returnType = node.childForFieldName('return_type')?.text;
  return `${name}${params}${returnType ? ` -> ${normalizeTypeText(returnType)}` : ''}`;
}

function functionVariable(
  node: Parser.SyntaxNode,
): { name: string; signature: string } | undefined {
  for (const declarator of node.descendantsOfType('variable_declarator')) {
    const value = declarator.childForFieldName('value');
    const nameNode = declarator.childForFieldName('name');
    if (!value || !nameNode || !FN_VALUE_TYPES.has(value.type)) continue;
    const name = nameNode.text.trim();
    const params = value.childForFieldName('parameters')?.text ?? '()';
    const returnType = value.childForFieldName('return_type')?.text;
    return {
      name,
      signature: `${name}${params}${returnType ? ` -> ${normalizeTypeText(returnType)}` : ''}`,
    };
  }
  return undefined;
}

export function mapNode(
  node: Parser.SyntaxNode,
  rawKind: OutlineNodeKind,
  source: string,
  inCallable: boolean,
): { kind: OutlineNodeKind; name: string; signature?: string } | undefined {
  const text = source.slice(node.startIndex, node.endIndex);
  if (rawKind === 'import') {
    const quoted = text
      .replace(/\s+/g, ' ')
      .trim()
      .match(/['"]([^'"]+)['"]/);
    return { kind: 'import', name: quoted?.[1] ?? text.slice(0, 80) };
  }
  if (rawKind === 'export') {
    if (node.childForFieldName('declaration')) return undefined;
    const normalized = text.replace(/\s+/g, ' ').trim();
    const quoted = normalized.match(/from\s+['"]([^'"]+)['"]/);
    return { kind: 'export', name: quoted?.[1] ?? normalized.slice(0, 80) };
  }
  if (rawKind === 'variable') {
    if (inCallable) return undefined;
    const fnVar = functionVariable(node);
    if (fnVar) return { kind: 'function', name: fnVar.name, signature: fnVar.signature };
  }
  const name = findName(text, node);
  if (rawKind === 'function' || rawKind === 'method') {
    return { kind: rawKind, name, signature: functionSignature(node, name) };
  }
  if (rawKind === 'class' || rawKind === 'interface' || rawKind === 'type' || rawKind === 'enum') {
    return { kind: rawKind, name, signature: `${rawKind} ${name}` };
  }
  return { kind: rawKind, name };
}
