import type { OutlineNodeKind } from '../types/outline.js';

export interface OutlineLanguageConfig {
  displayName: string;
  grammar: string;
  declarationTypes: Partial<Record<OutlineNodeKind, string[]>>;
}

export const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'tsx',
  '.js': 'javascript',
  '.jsx': 'jsx',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.py': 'python',
  '.swift': 'swift',
  '.kt': 'kotlin',
  '.kts': 'kotlin',
  '.go': 'go',
  '.rs': 'rust',
  '.java': 'java',
  '.cs': 'c_sharp',
  '.rb': 'ruby',
  '.c': 'c',
  '.h': 'c',
  '.cpp': 'cpp',
  '.cc': 'cpp',
  '.hpp': 'cpp',
  '.php': 'php',
};

const TS_DECLS: OutlineLanguageConfig['declarationTypes'] = {
  import: ['import_statement'],
  export: ['export_statement'],
  class: ['class_declaration', 'abstract_class_declaration'],
  interface: ['interface_declaration'],
  type: ['type_alias_declaration'],
  enum: ['enum_declaration'],
  function: ['function_declaration'],
  method: ['method_definition'],
  variable: ['lexical_declaration', 'variable_declaration'],
};

const JS_DECLS: OutlineLanguageConfig['declarationTypes'] = {
  import: ['import_statement'],
  export: ['export_statement'],
  class: ['class_declaration'],
  function: ['function_declaration'],
  method: ['method_definition'],
  variable: ['lexical_declaration', 'variable_declaration'],
};

export const OUTLINE_LANGUAGES: Record<string, OutlineLanguageConfig> = {
  typescript: { displayName: 'TypeScript', grammar: 'typescript', declarationTypes: TS_DECLS },
  tsx: { displayName: 'TSX', grammar: 'tsx', declarationTypes: TS_DECLS },
  javascript: {
    displayName: 'JavaScript',
    grammar: 'javascript',
    declarationTypes: JS_DECLS,
  },
  jsx: {
    displayName: 'JSX',
    grammar: 'javascript',
    declarationTypes: JS_DECLS,
  },
  python: {
    displayName: 'Python',
    grammar: 'python',
    declarationTypes: {
      import: ['import_statement', 'import_from_statement'],
      class: ['class_definition'],
      function: ['function_definition'],
      variable: ['assignment'],
    },
  },
  swift: {
    displayName: 'Swift',
    grammar: 'swift',
    declarationTypes: {
      import: ['import_declaration'],
      class: ['class_declaration', 'struct_declaration'],
      interface: ['protocol_declaration'],
      enum: ['enum_declaration'],
      function: ['function_declaration'],
      variable: ['property_declaration'],
    },
  },
  kotlin: {
    displayName: 'Kotlin',
    grammar: 'kotlin',
    declarationTypes: {
      import: ['import_header'],
      class: ['class_declaration', 'object_declaration'],
      interface: ['interface_declaration'],
      type: ['type_alias'],
      function: ['function_declaration'],
      variable: ['property_declaration'],
    },
  },
  go: {
    displayName: 'Go',
    grammar: 'go',
    declarationTypes: {
      import: ['import_declaration'],
      class: ['type_declaration'],
      function: ['function_declaration'],
      method: ['method_declaration'],
      type: ['type_spec'],
      variable: ['var_declaration', 'short_var_declaration', 'const_declaration'],
    },
  },
  rust: {
    displayName: 'Rust',
    grammar: 'rust',
    declarationTypes: {
      import: ['use_declaration'],
      class: ['struct_item', 'trait_item', 'impl_item'],
      enum: ['enum_item'],
      function: ['function_item'],
      type: ['type_item'],
      variable: ['const_item', 'static_item'],
    },
  },
  java: {
    displayName: 'Java',
    grammar: 'java',
    declarationTypes: {
      import: ['import_declaration'],
      class: ['class_declaration'],
      interface: ['interface_declaration'],
      enum: ['enum_declaration'],
      method: ['method_declaration', 'constructor_declaration'],
      variable: ['field_declaration', 'local_variable_declaration'],
    },
  },
  c_sharp: {
    displayName: 'C#',
    grammar: 'c_sharp',
    declarationTypes: {
      import: ['using_directive'],
      class: ['class_declaration', 'struct_declaration'],
      interface: ['interface_declaration'],
      enum: ['enum_declaration'],
      method: ['method_declaration', 'constructor_declaration'],
      variable: ['field_declaration', 'property_declaration'],
    },
  },
  ruby: {
    displayName: 'Ruby',
    grammar: 'ruby',
    declarationTypes: {
      class: ['class', 'singleton_class'],
      method: ['method', 'singleton_method'],
      variable: ['assignment'],
      import: ['call'],
    },
  },
  c: {
    displayName: 'C',
    grammar: 'c',
    declarationTypes: {
      import: ['preproc_include'],
      class: ['struct_specifier', 'union_specifier'],
      enum: ['enum_specifier'],
      function: ['function_definition'],
      variable: ['declaration'],
    },
  },
  cpp: {
    displayName: 'C++',
    grammar: 'cpp',
    declarationTypes: {
      import: ['preproc_include'],
      class: ['class_specifier', 'struct_specifier'],
      enum: ['enum_specifier'],
      function: ['function_definition'],
      method: ['function_definition'],
      variable: ['declaration'],
    },
  },
  php: {
    displayName: 'PHP',
    grammar: 'php',
    declarationTypes: {
      import: ['namespace_use_declaration'],
      class: ['class_declaration', 'trait_declaration'],
      interface: ['interface_declaration'],
      function: ['function_definition'],
      method: ['method_declaration'],
      variable: ['property_declaration', 'const_declaration'],
    },
  },
};

export function supportedLanguageNames(): string[] {
  return Object.keys(OUTLINE_LANGUAGES).sort();
}
