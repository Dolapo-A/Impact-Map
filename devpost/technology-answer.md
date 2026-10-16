## How Impact Map meets the technology requirement

An AI agent built this. I did not write the code or make the architecture decisions; I worked the planning documents with the agent and it implemented the app slice by slice, writing tests first and catching bugs I would have shipped. What I brought was judgement about what to keep, cut, and throw away after building.

There is no language model inside Impact Map, and I decided that on purpose. The tool promises that every edge it draws is an import you can open and check. A model writes better prose and invents facts, so the graph is computed and the explanations are templated: "imported by three files, two of which have tests."

### Flipped interaction

The agent normally proposes and the developer approves. Flipped interaction inverts that. I drove the interview, the agent answered back, and it also proposed things I did not need. Three layouts, one too many: I built the radial layout and deleted it. A test skeleton nobody had asked for, cut before any code was written. Every slice ended runnable and committed, with the checklist in the repository.

### Planning documents

Scope cut the idea to a proof of concept. The PRD turned wishes into requirements, and asking what happens when a pull request names files the folder does not contain produced the mismatch check, the part of the tool I trust most. The spec set modules and data shapes, with one rule that paid off: `src/lib/` holds no React runtime imports, so 165 tests run in Node in about two seconds.

The documents also caught each other's mistakes. Answers in the PRD contradicted the scope, and finding that on paper cost an edit instead of a rewrite.

### Bugs I would have shipped

A stylesheet returned HTTP 200 with `index.html` as the body, so the graph rendered empty while every check passed. Two source files carried NUL bytes, which made grep treat them as binary. The force layout seeded randomly until it was pinned with fixed golden-angle steps. Each was found by running something and looking at the result, which is the habit I had to learn.