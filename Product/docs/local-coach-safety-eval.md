# Local Coach Safety Evaluation

MIRROR's local coach now includes deterministic safety and quality checks for coach cards, summarized context, Markdown exports, JSON exports, and future prompt contexts. This is not a runtime GenAI evaluator and does not call an LLM.

## What Is Checked

The safety evaluator runs local TypeScript checks over:

- `CoachCard` recommendations
- `MirrorCoachContext`
- Markdown coach reports
- JSON coach context exports
- future prompt context objects

The evaluator returns a `CoachSafetyReport` with pass/fail status, findings, severity counts, and checked-surface metadata.

## Coach Card Checks

Cards are checked for:

- missing evidence on non-data-quality cards
- exact statistics without evidence/source metadata
- high-priority cards with low confidence
- overconfident insufficient-data cards
- medical, psychological, or diagnostic wording
- sacred or religious parody
- unsupported rating, skill, or permanent-trait claims

The goal is not to make the deterministic coach perfect. The goal is to stop obvious unsafe or unsupported recommendations before any future GenAI layer exists.

## Privacy Guardrails

Context checks enforce that:

- `safe_to_send_to_llm` defaults to `false`
- raw local identifiers are flagged
- raw PGN/FEN-like strings are blocked
- account-link and email fields are blocked
- backup-like records are blocked
- source files and privacy flags are present
- insufficient-data behavior is visible

Player IDs and display names can exist in the local UI context, but they are flagged as local-private and are not treated as LLM-safe by default.

## Export Safety

Markdown and JSON exports are checked for:

- access tokens
- refresh tokens
- service-role text
- API-key-like text
- JWT-like strings
- raw PGN or FEN
- raw backup JSON or database table collections
- invalid JSON wrappers

The app exports local summary artifacts only. It does not upload exports or require login.

## Prompt Context Validation

`promptContextValidator.ts` validates future GenAI context objects before any optional adapter could use them. It checks:

- bounded serialized size
- privacy flags
- source files
- insufficient-data behavior
- no raw backup JSON
- no account-link records
- no raw PGN/FEN unless explicitly allowed for a local-only review mode
- no secret-like fields

No LLM adapter is implemented in this milestone.

## Why This Matters Before Runtime GenAI

Agentic and GenAI systems fail most visibly when they:

- invent facts
- overstate confidence
- leak private context
- ignore missing data
- blur product logic with model prose

MIRROR now has deterministic checks around those failure modes before adding any optional model runtime. This makes the local coach easier to test, easier to audit, and safer to evolve.

## Limitations

Deterministic evaluation cannot understand every possible unsafe phrase or subtle hallucination. It uses pattern checks, schema checks, and metadata checks. It should be treated as a baseline guardrail, not a complete safety system.

Future work can add:

- broader golden datasets of safe/unsafe coach cards
- stricter schema validation
- redaction transforms for consent-gated prompt contexts
- optional local model evaluation
- optional external evaluator only after explicit user consent and privacy controls

Runtime GenAI coaching remains a future milestone.
