/**
 * Locating the WebAssembly binaries, in both Vite's browser build and Node (tests).
 *
 * `?url` imports are a Vite convention: in the browser they become a correct asset
 * path, but under Node they resolve to a bare specifier that `fs` cannot open.
 * So each environment gets the path form it can actually use.
 *
 * Grammar choice — why these and not the newest available:
 * `@vscode/tree-sitter-wasm` ships grammar binaries built at ABI 14. The
 * `web-tree-sitter@0.27` runtime accepts ABI 13–15, so they are compatible.
 * The `tree-sitter-wasms` package is also tempting (more languages), but its
 * binaries are built at an older ABI and are rejected by this runtime — the
 * `dylink` metadata check fails on load.
 */
import tsGrammarAsset from '@vscode/tree-sitter-wasm/wasm/tree-sitter-typescript.wasm?url'
import tsxGrammarAsset from '@vscode/tree-sitter-wasm/wasm/tree-sitter-tsx.wasm?url'
import jsGrammarAsset from '@vscode/tree-sitter-wasm/wasm/tree-sitter-javascript.wasm?url'
import runtimeAsset from 'web-tree-sitter/web-tree-sitter.wasm?url'

const isNode = typeof process !== 'undefined' && process.versions?.node != null

/** In Node, `?url` collapses to the bare specifier — rebuild a real filesystem path. */
function nodePath(specifier: string, fallbackSegments: string[]): string {
  const marker = 'node_modules/'
  const index = specifier.indexOf(marker)
  if (index !== -1) {
    const relative = specifier.slice(index + marker.length).replace(/\?.*$/, '')
    return `${process.cwd()}/node_modules/${relative}`
  }
  return `${process.cwd()}/${fallbackSegments.join('/')}`
}

function assetUrl(specifier: string, fallback: string[]): string {
  return isNode ? nodePath(specifier, fallback) : specifier
}

const GRAMMAR_DIR = ['node_modules/@vscode/tree-sitter-wasm/wasm']

export const typescriptGrammarUrl = assetUrl(tsGrammarAsset, [
  ...GRAMMAR_DIR,
  'tree-sitter-typescript.wasm',
])

export const tsxGrammarUrl = assetUrl(tsxGrammarAsset, [
  ...GRAMMAR_DIR,
  'tree-sitter-tsx.wasm',
])

export const javascriptGrammarUrl = assetUrl(jsGrammarAsset, [
  ...GRAMMAR_DIR,
  'tree-sitter-javascript.wasm',
])

export const treeSitterRuntimeUrl = assetUrl(runtimeAsset, [
  'node_modules/web-tree-sitter/web-tree-sitter.wasm',
])