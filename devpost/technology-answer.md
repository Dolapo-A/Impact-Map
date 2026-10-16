## How Impact Map meets the technology requirement

AI is in how this was built. I did not write the code or make the architecture decisions. An AI agent worked the planning documents with me and implemented the app slice by slice, writing the tests first and catching bugs I would have shipped. What I brought was judgement: what to keep, what to cut, and when to throw away something I had already built.

There is no language model inside Impact Map, and I decided that on purpose. The promise the tool makes is that every edge it draws is an import you can open and check. A model writes better prose than a template and invents facts. So the graph is computed and the explanations are templated: "imported by three files, two of which have tests." Correct and dull, and I chose that trade.

## Flipped interaction

The normal shape of building with an agent is that the agent proposes and the developer approves. Flipped interaction inverts it. I drove the interview, the agent answered back, and the questions it asked were sometimes the useful part.

It also proposed things I did not need. Three layouts, one too many: I built the radial layout, looked at it, and deleted it. A test skeleton that appeared in the planning docs and was nobody's requirement, cut before a line of code was written. Every slice ended in something runnable and a commit, and the checklist with its ticks and revisions is in the repository.

## Planning documents

Four documents, each settling a different class of decision. Scope cut the idea to a proof of concept and wrote down what the tool would not do. The PRD turned wishes into requirements, and asking what happens when a pull request names files the folder does not contain produced the mismatch check, which is the part of the tool I trust most. The spec turned behavior into modules and data shapes, with one rule that paid off: `src/lib/` holds no React runtime imports, so 165 tests run in Node in about two seconds. The build checklist ordered the slices.

The documents caught each other's mistakes too. Answers in the PRD contradicted promises in the scope more than once, and finding that on paper cost an edit instead of a rewrite.

## What the agent got right when I would not have

A stylesheet returned HTTP 200 with `index.html` as the body, so the graph rendered with no edges and every check passed. Two source files carried NUL bytes, compiled fine, and made `grep` treat them as binary. The force layout seeded randomly by default, so the same repository drew differently on every load until it was pinned with fixed golden-angle steps and a test that fails if one graph ever lays out two ways.

Each of those was found by running something and looking at the result, which is the part of the process I had to be taught.