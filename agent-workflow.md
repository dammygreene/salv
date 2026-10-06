# CULLER - Agent Execution Workflow

## Before coding
Read these files in order:
1. `build-prompt.md`
2. `plan.md`
3. `design.md`
4. `ui-ux.md`
5. `architecture.md`
6. `tokenomics.md`
7. `security.md`
8. `data-model.md`
9. `api.md`
10. `content.md`
11. `qa.md`

## Implementation order
1. Scaffold application.
2. Implement visual system.
3. Implement homepage.
4. Implement wallet connection.
5. Implement chain adapters.
6. Implement Solana scanner.
7. Implement classification engine.
8. Implement cull transaction builders.
9. Implement verification.
10. Implement reward ledger.
11. Implement watch system.
12. Add public wallet report.
13. Add EVM adapter abstraction.
14. Add production hardening.

## Working rules
- Prefer complete vertical slices.
- Do not create fake API responses except explicit development fixtures.
- Keep provider integrations behind adapters.
- Keep all threshold values in config.
- Avoid large rewrites once real flows exist.
- Add tests when a business rule is introduced.
- Keep UI copy in a centralized content file where practical.

## When blocked
Do not silently fake the feature.

Instead:
1. isolate the interface,
2. return an explicit unsupported state,
3. add a TODO with the exact dependency,
4. continue with the rest of the vertical slice.

## Completion report
Before finishing, report:
- routes created
- components created
- integrations connected
- database migrations
- tests run
- known limitations
- environment variables required
- exact commands used to run locally
