# HONEST BUILD PLAN

This document provides an unvarnished, engineering-focused evaluation of the 8-feature product scope proposed for MIRROR. The estimates and evaluations below are based on industry standards, the realities of solo development with AI tools, and the constraints of free-tier infrastructure.

## SECTION 1 — REFERENCE COSTS

To understand the scope of the proposed features, here is what comparable systems cost to build and maintain in the wild:

*   **Chess Analysis Platform (chess.com / Lichess):** 
    *   *Reference:* chess.com Game Review and opening explorers.
    *   *Scale:* Dozens of backend engineers, data engineers, and UI/UX specialists. Decades of iterative refinement.
    *   *Cost:* Tens of millions of dollars in engineering payroll and server costs to store millions of master games and run cloud-based evaluations.
*   **HackerRank-for-Chess Task System (Chess Tempo / Lichess Puzzles):**
    *   *Reference:* Chess Tempo.
    *   *Scale:* Started by a solo developer (Richard Jones) but took over 15 years to reach its current density, relying heavily on crowdsourced data mining from millions of real games to generate tactical motifs.
    *   *Cost:* Order of magnitude: $500k+ in equivalent engineering time, plus significant ongoing database costs.
*   **Multiplayer Infrastructure (Lichess):**
    *   *Reference:* Lichess.org.
    *   *Scale:* Originally built solo by Thibault Duplessis, but scaling it to handle real-time WebSockets, matchmaking, and reconnection took 10+ years and the open-source contributions of hundreds of developers.
    *   *Cost:* Millions in equivalent engineering hours.
*   **Ranked Play & Anti-Cheat:**
    *   *Reference:* chess.com Fair Play team.
    *   *Scale:* Dedicated teams of data scientists and chess masters constantly updating heuristics to catch engine use.
    *   *Cost:* Millions annually. Anti-cheat is a continuous cat-and-mouse game, not a feature you build once.
*   **Full Story Mode (AAA Narrative Games):**
    *   *Reference:* Supergiant Games (Hades).
    *   *Scale:* Dedicated writers, concept artists, illustrators, and narrative designers. 
    *   *Cost:* $1M-$5M+. Writing 19 branching chapters of culturally sensitive, original narrative with 15 characters is a massive undertaking.
*   **Children's Learning Mode (ChessKid):**
    *   *Reference:* ChessKid.com.
    *   *Scale:* Specialized pedagogues, compliance lawyers (COPPA), and child-friendly UX designers.
    *   *Cost:* $1M+.

## SECTION 2 — REALISTIC BUILD COST IF DONE BY A REAL TEAM

If a funded startup were to build this exact 8-feature spec to compete directly with chess.com:

*   **Team Composition Needed:**
    *   2-3 Senior Backend/Infrastructure Engineers (WebSockets, matchmaking, database scaling)
    *   2 Senior Frontend Engineers (Board UX, analysis UI, animations)
    *   1 Game Designer / Pedagogy Specialist (Task progression, children's mode)
    *   1 Narrative Writer & 1 Illustrator (Story mode, character portraits)
    *   1 Data Scientist (Anti-cheat, rating math)
    *   QA and Compliance (COPPA)
*   **Minimum Time to Ship:** 18 to 24 months.
*   **Minimum Budget:** $1.5M – $3M in direct payroll and infrastructure costs.
*   **Maximum Quality Achievable Solo with AI Agents:** You will not achieve parity with chess.com. AI agents can scaffold code quickly, but they struggle with complex, distributed system bugs (like WebSocket race conditions) and deep architectural planning. The result of building all 8 features solo will be a fragile, generic-feeling product where every feature is a 4/10 rather than a single feature that is a 10/10.

## SECTION 3 — WHAT THE HUMAN CAN ACTUALLY BUILD SOLO WITH AI AGENTS

Here is the honest reality of what you can build solo working 6 hours/day, 5 days/week using AI agents and free-tier infrastructure.

1.  **AI Mirror Opponent:**
    *   *Achievable:* A fully functional, locally-run Stockfish opponent driven by the current StyleVector profile. The code has 11 behavioral/profile fields plus schema metadata. (Largely already built).
    *   *Grade:* 9/10 (Unique market differentiator).
    *   *Time:* 1–2 weeks to fix bugs and polish.
    *   *Sacrifices:* Relies on client-side WebAssembly, draining mobile batteries.

2.  **Local Multiplayer (Pass & Play):**
    *   *Achievable:* Board flipping, local turn tracking.
    *   *Grade:* 10/10 (Trivial feature).
    *   *Time:* 1 week.
    *   *Sacrifices:* None.

3.  **HackerRank-for-Chess Task System:**
    *   *Achievable:* Ingesting the open-source Lichess puzzle database, basic spaced repetition, and motif tagging.
    *   *Grade:* 6/10 (Functional, but lacks custom curation).
    *   *Time:* 4–6 weeks.
    *   *Sacrifices:* Free-tier databases cannot hold millions of puzzles. You must filter down to a small, static subset.

4.  **Full Chess Analysis Platform:**
    *   *Achievable:* Client-side Stockfish evaluation bars, basic arrow drawing.
    *   *Grade:* 5/10 (Basic utility).
    *   *Time:* 4–6 weeks.
    *   *Sacrifices:* No cloud evaluation. No massive master game database (too expensive to host). You cannot compete with chess.com's Game Review solo.

5.  **Multiplayer Across Devices:**
    *   *Achievable:* Basic Supabase WebSockets/Realtime for move transmission.
    *   *Grade:* 4/10 (Fragile).
    *   *Time:* 6–8 weeks.
    *   *Sacrifices:* Free-tier WebSockets will drop connections. Reconnection logic built by AI is notoriously buggy. High latency. 

6.  **Ranked Play & Anti-Cheat:**
    *   *Achievable:* Basic Elo math stored in a database.
    *   *Grade:* 2/10 (Meaningless).
    *   *Time:* 2–3 weeks.
    *   *Sacrifices:* Zero anti-cheat. The moment the game gets popular, players will use Stockfish to dominate the leaderboard, ruining the experience. Solo developers cannot fight the anti-cheat war.

7.  **Full Story Mode:**
    *   *Achievable:* 19 chapters of AI-generated text and AI-generated static portraits. 
    *   *Grade:* 4/10 (Novelty, not AAA).
    *   *Time:* 8–10 weeks.
    *   *Sacrifices:* No voice acting. Generic narrative feel. Extremely difficult to maintain cultural authenticity via LLM generation. 

8.  **Children's Learning Mode:**
    *   *Achievable:* Stripped-down UI with text-based tutorials.
    *   *Grade:* 3/10 (Boring for kids).
    *   *Time:* 3–4 weeks.
    *   *Sacrifices:* No interactive animations or audio narration. Cannot legally target under-13s in the US without strict, complex COPPA compliance.

## SECTION 4 — A PROPOSED BUILD SEQUENCE (UPDATED)

We have successfully executed the sequence through `v1.10.0-multi-move-puzzles`, bypassing the need for heavy backend multiplayer.

1.  **Step 1: The Mirror** (Completed in `v1.0.0-mirror-verified`)
2.  **Step 2: Core Chess & Pass-and-Play** (Completed in `v1.1.0-core-chess`)
3.  **Step 3: Human-Mirror Loop** (Completed in `v1.3.0-human-mirror-loop`)
4.  **Step 4: Basic Analysis** (Completed in `v1.4.0-basic-analysis`)
5.  **Step 5: Clue Chess & Puzzles** (Completed in `v1.5.0` & `v1.10.0`)
6.  **Step 6: Story Mode (Mahabharata)** (Completed Act 1 in `v1.8.0`)
7.  **Step 7: Audio FX** (Completed in `v1.9.0-audio-fx-1`)

**Cumulative Timeline:** We achieved this efficiently by focusing on local-first capabilities (IndexedDB, Web Worker Stockfish) and skipping heavy backend cloud requirements.

## SECTION 5 — DECISION MATRIX

| System | Status | What got sacrificed |
| :--- | :--- | :--- |
| **Mirror Engine** | DONE | Nothing (Core focus) |
| **Local Multiplayer** | DONE | Nothing |
| **Task System** | DONE | Huge remote databases |
| **Analysis Platform** | DONE | Master DB, cloud eval |
| **Story Mode** | IN PROGRESS | AAA art, voice acting |
| **Cross-Device MP** | SKIPPED | Stability, low latency |
| **Ranked Play** | SKIPPED | Anti-cheat |
| **Children's Mode** | PENDING | Animations, COPPA safety |

## SECTION 6 — WHAT TO DO WITH THE EXISTING CODEBASE

**DO NOT REBUILD FROM SCRATCH.** 

The codebase currently represents a complete, functioning local-first application. We have built 10 successful milestones on this architecture.

**Recommendation:** Keep the existing codebase. Continue extending the features sequentially as defined in `docs/current-status.md`.
