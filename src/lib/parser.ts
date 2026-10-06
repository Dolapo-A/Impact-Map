/**
 * Tree-sitter wrapper: source text in, list of import specifiers out.
 *
 * A regex would miss multi-line imports and silently produce a wrong graph, which
 * is the one failure this product's thesis forbids. So this uses a real parser.
 *
 * The grammars come from the `tree-sitter-wasms` npm package and are served as
 * local assets — no CDN, no network dependency at parse time.
 */
import { Language, Parser, type Node, type Tree } from 'web-tree-sitter'

import {
  javascriptGrammarUrl,
  treeSitterRuntimeUrl,
  tsxGrammarUrl,
  typescriptGrammarUrl,
} from './wasmPaths'

export interface ImportStatement {
  /** The module specifier as written: `./utils/cart`, `react`, `../types`. */
  specifier: string
  /** 1-based line number where the import statement begins. */
  line: number
  /** `import` / `require` / `export ... from` / `dynamic import`. */
  kind: ImportKind
}

export type ImportKind = 'static' | 'require' | 'reexport' | 'dynamic'

let parserReady: Promise<void> | null = null
const languages = new Map<string, Language>()

/** True for TypeScript source, including the `.tsx` dialect. */
export function isTypeScript(path: string): boolean {
  return /\.[cm]?tsx?$/i.test(path)
}

/**
 * Which grammar parses this file.
 * JSX changes how `<T>` is read, so `.tsx` needs its own grammar — the plain
 * TypeScript grammar misreads TSX generics as comparison operators.
 */
export function grammarFor(path: string): 'typescript' | 'tsx' | 'javascript' {
  if (/\.[cm]?tsx$/i.test(path)) return 'tsx'
  if (isTypeScript(path)) return 'typescript'
  return 'javascript'
}

/**
 * Load the Tree-sitter runtime once. `locateFile` tells the WASM module where to
 * find its own binary, which Vite rewrites to the built asset path.
 */
async function ensureRuntime(): Promise<void> {
  if (parserReady === null) {
    parserReady = Parser.init({
      locateFile: (scriptName: string) =>
        scriptName.endsWith('.wasm') ? treeSitterRuntimeUrl : scriptName,
    }).catch((error: unknown) => {
      // Let a later call retry rather than caching a rejected promise forever.
      parserReady = null
      throw error
    })
  }
  await parserReady
}

async function languageFor(path: string): Promise<Language> {
  await ensureRuntime()

  const key = grammarFor(path)
  const cached = languages.get(key)
  if (cached) return cached

  const urls = {
    typescript: typescriptGrammarUrl,
    tsx: tsxGrammarUrl,
    javascript: javascriptGrammarUrl,
  }

  const language = await Language.load(urls[key])
  languages.set(key, language)
  return language
}

/** Read a string literal node, unwrapping its quotes. */
function readStringLiteral(node: Node | null): string | null {
  if (!node) return null
  const text = node.text
  if (text.length < 2) return null

  const quote = text[0]
  if (quote !== '"' && quote !== "'" && quote !== '`') return null

  return text.slice(1, -1)
}

/**
 * Walk the tree and collect every module specifier this file imports.
 *
 * Handles the four ways JavaScript names a dependency: static import, `require()`,
 * `export … from`, and dynamic `import()`. A multi-line import is no harder than
 * a single-line one here, because we ask the parse tree rather than reading lines.
 */
export function collectImports(tree: Tree): ImportStatement[] {
  const found: ImportStatement[] = []
  // Dedupe on the specifier alone: `import x from './a'` plus `export * from './a'`
  // is still one dependency edge between two files, so the graph wants one entry.
  const seen = new Set<string>()

  const push = (specifier: string | null, node: Node, kind: ImportKind) => {
    if (specifier === null || specifier.length === 0) return
    if (seen.has(specifier)) return
    seen.add(specifier)
    found.push({ specifier, line: node.startPosition.row + 1, kind })
  }

  const visit = (node: Node): void => {
    switch (node.type) {
      case 'import_statement': {
        push(readStringLiteral(node.childForFieldName('source')), node, 'static')
        break
      }

      case 'export_statement': {
        // `export { a } from './a'` and `export * from './a'` both carry a source.
        // A plain `export const x = 1` has none, and must not be treated as one.
        const source = node.childForFieldName('source')
        if (source) push(readStringLiteral(source), node, 'reexport')
        break
      }

      case 'call_expression': {
        // Covers `require('./x')` and dynamic `import('./x')`, wherever they appear —
        // at the top level, inside a function, or nested in an expression.
        const fn = node.childForFieldName('function')
        const args = node.childForFieldName('arguments')
        const first = args?.namedChild(0) ?? null

        if (fn?.type === 'import') {
          push(readStringLiteral(first), node, 'dynamic')
        } else if (fn?.text === 'require') {
          push(readStringLiteral(first), node, 'require')
        }
        break
      }
    }

    for (let i = 0; i < node.namedChildCount; i++) {
      const child = node.namedChild(i)
      if (child) visit(child)
    }
  }

  visit(tree.rootNode)
  return found
}

export interface ParseResult {
  imports: ImportStatement[]
  /** True when Tree-sitter could not parse the file cleanly. */
  parseFailed: boolean
}

/**
 * Parse one file's text and return its imports.
 * `path` selects the grammar — TypeScript files use the TS grammar, which also
 * understands plain JavaScript.
 */
export async function parseFile(path: string, source: string): Promise<ParseResult> {
  const language = await languageFor(path)
  const parser = new Parser()
  parser.setLanguage(language)

  try {
    const tree = parser.parse(source)
    if (tree === null) return { imports: [], parseFailed: true }

    // A tree whose root is entirely ERROR means the grammar rejected the file.
    // Partial errors still yield real imports, so they are not a failure.
    const parseFailed = tree.rootNode.type === 'ERROR'
    const imports = parseFailed ? [] : collectImports(tree)
    tree.delete()
    return { imports, parseFailed }
  } finally {
    parser.delete()
  }
}