## The value it provides for me

I used version control for years without understanding it. The commands were fine, the model was not. When a change broke something three files away, I found out from CI or from production, both expensive places to learn. Building the tool forced me to hold that model in my head: import this, that is affected, therefore test that. I came out of it with a mental map I did not have before, which is the value I did not expect to get and now think is the larger one.

The second value is a rule I now follow everywhere. Every edge in the graph is an import you can click and open. Nothing in it is a plausible guess. Building it made me hold my own writing to that standard, so the claim has to survive being checked before I put it in a design note or say it to a colleague.

Third, I learned to plan before building. I had read plenty of PRDs at work and never written one. Writing my own turned up two contradictions inside my thinking that I would otherwise have found in code, and it produced the mismatch check, the part of the tool I trust most. That has carried back into how I write tickets and specs.

Fourth, I learned to work with an agent without taking its word for anything. I was told the graph library ships a force-directed layout. It does not. The same gap between a plausible claim and a checked fact caught a stylesheet returning HTTP 200 with the wrong body, which passed every check while the graph rendered empty. I run things and look at the output now. I would have got all three wrong without that habit.

It is not a daily tool. I reach for it when planning a risky change, a handful of times a month, and I would like that to be more.