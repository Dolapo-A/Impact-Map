## The value it provides for me

I used version control for years without understanding it. The commands were fine, the model was not. When a change broke something three files away, I found out from CI or from production, both expensive places to learn. Building the tool forced me to actually hold that model in my head: import this, that is affected, therefore test that. I came out of it with a mental map I did not have before, which is the value I did not expect to get and now think is the larger one.

The second value is a rule I now follow everywhere. Every edge in the graph is an import you can click and open. Nothing in the tool is a plausible guess. Building it made me apply that standard to my own work: when I write a design note or explain something to a colleague, the claim has to survive being checked. That discipline is stricter than what most internal documents aim for, and I like it more than I expected to.

Third, I learned to plan before building. I had read plenty of PRDs at work and never written one. Writing my own turned up two contradictions inside my own thinking that I would otherwise have discovered in code, and it produced a feature I would never have thought of. That has carried back into how I write tickets and specs.

Fourth, I learned to work with an agent without taking its word for anything. I was told the graph library ships a force-directed layout. It does not. The same gap between a plausible claim and a checked fact caught a stylesheet returning HTTP 200 with the wrong body, which passed every check while the graph rendered empty. I now run things and look at the output, and I would have got all three wrong without that habit.

Fifth is smaller and still real: the accessibility constraint changed how I think about encoding information. Two kinds of fact cannot share one visual channel, and colour alone fails about one man in twelve. Designing around that changed how I reach for colour in anything I build, not only graphs.

What it does not give me is a daily tool. I reach for it when planning a risky change, which is a handful of times a month, and I would like that to be more.