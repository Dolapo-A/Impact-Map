## How Impact Map meets the technology requirement

I want to be straight about the shape of the answer, because the honest version has two halves and the first one is unusual.

AI is in how this was built. I did not write the code and I did not make the architecture decisions. An AI agent worked the planning documents with me and implemented the app slice by slice, writing the tests first and catching bugs I would have shipped. What I brought was judgement: what to cut, what to keep, and when to throw a feature away after building it.

There is no language model inside Impact Map, and I decided that on purpose. Dependency tracing is deterministic work, and the promise the tool makes is that every edge it draws is an import you can open and check. A model writes better prose than a template and invents facts. So the graph is computed, and the explanations are templated: "imported by three files, two of which have tests." Correct and dull, and I chose that trade. The seam for a model is left where it can add interpretation about an area without being trusted with the structure underneath it.

## Flipped interaction

The normal shape of building with an agent is that the agent proposes and the developer approves. Flipped interaction inverts it. I drove the interview, the agent answered back, and the questions it asked were sometimes the useful part.

The way that showed up in practice: I gave real answers to the planning questions, and the decisions worth keeping came from those answers. The agent's suggestions mostly lost to them. An agent proposed three layouts, which was one too many. I built the radial layout, looked at it, and deleted it, because two honest answers beat three and the third existed because I liked the geometry. A test skeleton was the agent's idea during planning and nobody's requirement, so we cut it before writing a line of code.

Every slice ended in something runnable and a commit. The checklist for those slices is in the repository with ticks and revisions, which is a slightly embarrassing and genuinely useful artifact to ship.

## Planning documents

Four documents, each one settling a different class of decision.

Scope cut the idea down to a proof of concept. That is where the language model left the design, and where I wrote down what the tool would not do so it could not quietly grow back.

The PRD turned wishes into requirements. I had read plenty of PRDs at work and never written one, and writing the first exposed how many decisions a PRD quietly settles. My scope said the tool would "trace dependencies and explain what might be affected", which reads like a requirement and is a wish. The PRD is where wishes get interrogated: asking what the tool does when a pull request names files the chosen folder does not contain produced the mismatch check, which is now the part of the tool I trust most. It fell out of being specific.

The spec turned behavior into a blueprint: modules, data shapes, file layout, and one architectural rule that paid for itself. `src/lib/` holds no React runtime imports, so the parser, resolver, graph builder, tracer, coverage detector, both layouts, and the animation timing are plain modules that test in Node without a browser. That is where 165 tests in about two seconds comes from.

The build checklist ordered the slices and marked the hands-on moments where I drove the work myself.

The documents also caught each other's mistakes. Answers in the PRD contradicted promises in the scope more than once, and finding that on paper cost an edit instead of a rewrite.

## What the agent got right when I would not have

A few of these were real bugs with invisible causes, and they are the clearest argument for how the work was done.

I was told early that the graph library ships a force-directed layout. It does not. Nodes sit where you put them unless you add physics yourself, and that claim sat in my spec for a while before somebody ran it. The same split between a plausible claim and a checked fact caught a stylesheet that returned HTTP 200 with `index.html` as the body, which made the graph render with no edges and every check pass.

Two source files carried literal NUL bytes as string separators, compiled fine, and made `grep` treat both files as binary so nobody could search them. The force layout seeded positions randomly by default and would draw the same repository differently on every load, so determinism had to be enforced with fixed golden-angle steps and tests that fail if one graph ever lays out two ways.

Each of those was found by running something and looking at the result, which is the part of the process I had to be taught.