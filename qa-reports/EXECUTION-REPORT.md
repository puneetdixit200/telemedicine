# QA Execution Report

## 1. Scope and method
- Custom checklist: 49 checks (hybrid runtime API checks + source inspection checks).
- Repository test suite: Jest smoke tests in `tests/app.test.js`.
- Deliverables generated in `qa-reports/`:
  - `checklist-results.md` (per-test pass/fail report)
  - `checklist-results.json` (machine-readable report)
  - `run-checklist.js` (repeatable runner)

## 2. Baseline execution (before fixes)
- Checklist run result: 45 passed, 4 failed.
- Failed checks:
  - A-2: enum name mismatch in checker logic (`UserRole` expected but schema uses `Role`).
  - L-4: `requiresReview: false` existed in AI translation response.
  - L-5: AI UI metadata did not include exact label `Draft - requires human review`.
  - NFR-5: checker regex expected older `api-mode` function signatures.

## 3. Corrections applied
1. AI review policy consistency:
   - Updated `controllers/ai.controller.js` so translation responses always include `requiresReview: true`.
   - Also added `requiresReview: true` to the same-language passthrough translation branch.
2. Explicit draft labeling in UI:
   - Updated `frontend/src/App.jsx` AI result metadata pill to show:
     - `Draft - requires human review` when `requiresReview` is true.
3. QA checker accuracy fixes:
   - Updated `qa-reports/run-checklist.js` enum check from `UserRole` to `Role`.
   - Updated `qa-reports/run-checklist.js` API-mode signature patterns to match current implementation.

## 4. Re-execution after fixes
- Checklist run result: 49 passed, 0 failed.
- Jest suite result: 8 passed, 0 failed.

## 5. Per-test report
- Full per-test pass/fail matrix is in:
  - `qa-reports/checklist-results.md`
- JSON equivalent is in:
  - `qa-reports/checklist-results.json`

## 6. Commands executed
- `node qa-reports/run-checklist.js` (baseline)
- `node qa-reports/run-checklist.js` (post-fix validation)
- `npm test -- --runInBand`
