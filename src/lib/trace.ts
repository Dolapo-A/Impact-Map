import type { DependencyGraph } from './graph'

export interface TraceResult {
  /** Files the user chose as the starting point of the change. */
  changed: Set<string>
  /** Files which import a changed file, directly or through other files. */
  affected: Set<string>
  /** Hops from the nearest changed file. Changed files have distance zero. */
  distance: Map<string, number>
  /** The shortest import chain from a changed file to each reached file. */
  pathTo: Map<string, string[]>
}

/**
 * Walk from a changed module to every module that depends on it.
 *
 * Graph edges run importer -> imported module, so the impact walk uses their
 * reverse direction. Sorting both roots and neighbours makes ties repeatable;
 * breadth-first search then guarantees the recorded path is the shortest one.
 */
export function traceImpact(graph: DependencyGraph, changedPaths: Iterable<string>): TraceResult {
  const knownPaths = new Set(graph.nodes.map((node) => node.path))
  const changed = new Set(
    [...changedPaths].filter((path) => knownPaths.has(path)).sort(),
  )
  const importersByPath = new Map<string, string[]>()

  for (const edge of graph.edges) {
    if (edge.isExternal || !knownPaths.has(edge.from) || !knownPaths.has(edge.to)) continue
    const importers = importersByPath.get(edge.to) ?? []
    importers.push(edge.from)
    importersByPath.set(edge.to, importers)
  }

  for (const importers of importersByPath.values()) importers.sort()

  const affected = new Set<string>()
  const distance = new Map<string, number>()
  const pathTo = new Map<string, string[]>()
  const queue = [...changed]

  for (const path of changed) {
    distance.set(path, 0)
    pathTo.set(path, [path])
  }

  for (let cursor = 0; cursor < queue.length; cursor++) {
    const current = queue[cursor]
    const currentDistance = distance.get(current)!
    const currentPath = pathTo.get(current)!

    for (const importer of importersByPath.get(current) ?? []) {
      if (distance.has(importer)) continue
      distance.set(importer, currentDistance + 1)
      pathTo.set(importer, [...currentPath, importer])
      if (!changed.has(importer)) affected.add(importer)
      queue.push(importer)
    }
  }

  return { changed, affected, distance, pathTo }
}
