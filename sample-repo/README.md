# impact-map-sample-repo

A small storefront codebase, bundled with Impact Map as **demo input**.

This folder exists to be **analysed**, not to be a working application. There is no
dev server and nothing to run — pick it in Impact Map's folder picker and the tool
builds its dependency graph.

Its job is to contain the structures that make the tool worth looking at:

| What | Where | Why |
| --- | --- | --- |
| A circular import | `src/utils/cart.ts` ↔ `src/utils/totals.ts` | Each calls the other, so a circular import shows up in the graph and the tracer has to survive one |
| An untested source file | `src/domain/reservations.ts` | No test imports it, so it appears as a red "no tests" marker and demonstrates the tool's most actionable finding |
| A cross-directory import | `src/api/orders.ts` → `src/utils/totals.ts` | Shows a `../` path resolving across folders |
| A re-exporting barrel | `src/index.ts` | One import pulls in a wide slice of the codebase, which is what makes a good blast radius |
| A `.tsx` file | `src/components/CartBadge.tsx` | Exercises the TSX grammar and a real import edge |

## The tests here are real, and they pass

```bash
npm install
npm test
```

They exist for two reasons: they give the coverage channel something true to
detect, and they are genuine regression tests for the cart and totals arithmetic —
including the discount threshold and the "tax applies after the discount" rule.

`src/domain/reservations.ts` is deliberately left **untested**, so the tool has
something to report.

## A note on the parent folder

This `package.json` exists so that `npm` commands run *here* rather than silently
walking up into Impact Map's own project and starting the dev server by mistake.
