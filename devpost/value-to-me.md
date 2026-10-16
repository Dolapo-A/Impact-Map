## The value it provides for me

I used version control for years without understanding it. The commands were fine, the model was not. When a change broke something three files away, I found out from CI or from production, both expensive places to learn. Building the tool forced me to hold that model in my head, and I came out with a mental map I did not have before.

Second, I learned to plan before building. I had read plenty of PRDs and never written one. Writing my own turned up two contradictions inside my thinking that I would otherwise have found in code, and it produced the mismatch check, the part of the tool I trust most.

Third, I learned to stop trusting what an agent tells me. I was told the graph library ships a force-directed layout. It does not. The same gap caught a stylesheet returning HTTP 200 with the wrong body, which passed every check while the graph rendered empty. I run things and look at the output now.

It is not a daily tool. I reach for it when planning a risky change, and I would like that to be more.