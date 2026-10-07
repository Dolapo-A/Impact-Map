import type { DependencyGraph } from './graph'

/** Source path → sorted test files that reach it through imports. */
export type CoverageByPath = Map<string, string[]>

/**
 * Find test coverage structurally. A test covers every repository file it
 * imports, directly or through other local modules. This says nothing about
 * whether the test is good; it only records the dependency evidence we have.
 */
export function findCoverage(graph: DependencyGraph): CoverageByPath {
  const knownPaths = new Set(graph.nodes.map((node) => node.path))
  const importsByPath = new Map<string, string[]>()

  for (const edge of graph.edges) {
    if (edge.isExternal || !knownPaths.has(edge.from) || !knownPaths.has(edge.to)) continue
    const imports = importsByPath.get(edge.from) ?? []
    imports.push(edge.to)
    importsByPath.set(edge.from, imports)
  }

  for (const imports of importsByPath.values()) imports.sort()

  const coveredBy = new Map<string, Set<string>>()
  const testPaths = graph.nodes
    .filter((node) => node.isTest)
    .map((node) => node.path)
    .sort()

  for (const testPath of testPaths) {
    const visited = new Set<string>([testPath])
    const queue = [testPath]

    for (let cursor = 0; cursor < queue.length; cursor++) {
      const current = queue[cursor]
      for (const importedPath of importsByPath.get(current) ?? []) {
        if (visited.has(importedPath)) continue
        visited.add(importedPath)
        queue.push(importedPath)

        const coveringTests = coveredBy.get(importedPath) ?? new Set<string>()
        coveringTests.add(testPath)
        coveredBy.set(importedPath, coveringTests)
      }
    }
  }

  return new Map(
    [...coveredBy.entries()].map(([path, testPaths]) => [path, [...testPaths].sort()]),
  )
}
