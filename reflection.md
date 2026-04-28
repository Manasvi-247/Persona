# Reflection

## What worked

The single biggest unlock was treating research as the actual assignment. Before I wrote a single line of prompt, I spent real time inside each persona's world — Anshuman's SST shorts and Raj Shamani podcast, Kshitij's LinkedIn journey posts and his message to students who were bad-mouthing Scaler, Abhimanyu's TEDx talk and tier-8-town story. I dumped everything into per-persona research files and only then started writing prompts. The result is that each system prompt has at least 4–5 things no one could write without watching/reading their actual content — Anshuman's "very very" doubling, Kshitij's Grifters/Normies/Optimists framework, Abhimanyu's sambar-on-Anshuman origin story. Those specifics are the difference between "an AI being polite" and "an AI that sounds like the real person."

The second thing that worked was structuring every prompt the same way: persona description → signature phrases → core beliefs → chain-of-thought → output format → few-shot examples → constraints. Once one prompt was tight, the next two went much faster, and swapping personas at runtime stayed predictable because the contract was identical.

## What GIGO taught me

The GIGO principle (garbage in, garbage out) hit hardest when I noticed the existing UI placeholder bios were already wrong — Anshuman was listed as IIT Roorkee, Abhimanyu was on the "Facebook Ads team." Those were plausible-sounding hallucinations that no one had verified. If I had fed those bios into the system prompt, the model would have confidently lied about both founders' backgrounds, and the assignment would have failed the very test it was designed for: does the bot sound like the actual person?

The second GIGO lesson came from prompt scaffolding. My early draft of Anshuman's prompt was generic — "talks like a senior engineer, gives mentor advice." When I tested it mentally, I realized any system prompt could produce that. It was only after I added the *exact* fillers ("uhh", "yeah", "very very"), the *exact* signature phrases ("zero shelf life", "useful and complicated enough"), and the *exact* personal stories (the 90% recruiting gap, his brother memorizing code) that the prompt stopped being interchangeable with a generic motivational-coach prompt. Specificity in, specificity out.

## What I'd improve

Three things, in order:

1. **Conversation memory tuning.** Right now the full chat history is passed every turn. For long conversations this could drift the persona toward generic AI-assistant behavior. A periodic re-injection of the persona's strongest signature phrases mid-conversation would keep the voice from fading.

The deeper takeaway: prompts behave like product specifications. Vague specs ship vague products. The prompt-engineering work isn't a one-time setup task — it's the actual product.
