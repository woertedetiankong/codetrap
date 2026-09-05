# Implementation log

## 2026-09-04 — Identity compatibility and scope
- Existing v1 events already encode project/global scope in `revision`; derive scope from that explicit prefix instead of migrating append-only evidence. Unqualified historical references remain unknown and cannot open a guessed Library item.
- Ratings fold by Run + scope + trap ID. Revisions within that identity are corrections; feedback history remains immutable. Candidate event IDs remain stable; scoped group keys separate previously conflated findings.
- Deliver a typed, independent Overview component while preserving the existing client adapter and standalone packaging. A whole-client framework migration would make this reliability/UI slice unnecessarily broad.

## 2026-09-04 — Validation findings
- A memory-contribution test expected a negative case with irrelevant baseline output to pass. With the corrected gate, the baseline fails and the clean candidate passes; the test now verifies that improvement instead of preserving the false positive.
- Evaluation fixtures retained in-memory SQLite connections. Explicit ownership and `finally` closure cover primary/fallback stores and construction errors. The complete suite now finishes with 546 passing tests; no claim is made that this alone explains the earlier exit 137.
- Mobile screenshot review found that column flex layout combined with a 100% navigation flex basis stretched the header and clipped tools. The phone header now uses two grid rows. Regression checks inspect every button's bounds/height/text in English and Chinese, beyond document overflow alone.
