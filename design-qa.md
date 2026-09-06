# Codetrap workbench design QA

Date: 2026-09-05 (America/Los_Angeles)

Full-web completion pass: 2026-09-06 (America/Los_Angeles). See the completion section below for the expanded scope and latest validation.

final result: passed

## Findings

Follow-up correction: the user identified three missing section icons that the initial QA overlooked. Library and Review now both render official Phosphor concentric-circle, warning-circle, and filled check-circle icons, with text aligned beneath the heading text. Verified in the browser at 1280 × 720; captures are `library-section-icons.png` and `review-section-icons.png` in the screenshot directory below. The user's supplied focused reference was `/var/folders/k4/rgcnt9fx0lj1npnqxst8367w0000gn/T/codex-clipboard-3211dfc4-99ba-4625-91ed-6e04c84e15d1.png`. The icon omission is resolved. Typecheck, regenerated bundle consistency, and diff whitespace checks passed after this correction.

No remaining actionable P0/P1/P2 findings in the reviewed Library and Review states. This implements the approved combination of option 2's compact three-pane workbench and option 3's reading-first review. It is not a pixel-identical reproduction of either standalone mockup.

## Visual evidence

Source visual truth:

- Option 2: `/Users/superstorm/.codex/generated_images/01a074b3-f9c5-73c1-95c1-6c4c557128de/exec-7cca2b47-0f9c-4bc3-b4a4-1c48962c8582.png`
- Option 3: `/Users/superstorm/.codex/generated_images/01a074b3-f9c5-73c1-95c1-6c4c557128de/exec-6338f80f-845f-4cc0-b539-842eee6a26c8.png`

Implementation: local source preview at `http://127.0.0.1:4750/`, authenticated in the Codex browser.

Screenshot directory: `/Users/superstorm/.codex/visualizations/2026/09/06/01a074b3-f9c5-73c1-95c1-6c4c557128de/codetrap-workbench/`

- `library-desktop.png`: Library, SQLite lesson #5 selected, filters collapsed, code comparison and task evidence visible.
- `review-desktop.png`: proposed candidate `cand-001`, stable serialized browser function binding, reading mode, evidence collapsed, review actions visible.
- `review-phone.png`: responsive English review reader.
- `review-phone-zh.png`: responsive Chinese review reader with the same stored English lesson content.

Both source images and desktop screenshots are 1487 × 1058 pixels. Browser CSS viewport was 1487 × 1058 with devicePixelRatio 1. No density normalization, browser frame, or device-frame cropping was necessary. Phone verification used 390 × 844 CSS pixels and screenshots at the same pixel dimensions. There is no separate mobile source mockup; phone checks assess responsive adaptation rather than exact source fidelity.

The two source images and two final desktop captures were opened together in one comparison input. Full-resolution titles, body text, navigation icons, code blocks, and primary controls were readable; separate focused crops were unnecessary. The phone capture was inspected separately for text wrapping, navigation, reader scrolling, and persistent actions.

## Required fidelity surfaces

- **Fonts and typography:** system sans-serif retains the macOS character, with a smaller 29px desktop reader heading and 15px body at 1.75 line height. Long real titles wrap without truncation. Metadata remains secondary, section labels are distinct, and monospace code is legible. Phone titles and body scale down while preserving hierarchy. Generated mockup text is not a font specification; tighter typography is an intentional user-approved adaptation.
- **Spacing and layout:** a 188px navigation pane, compact list, and flexible reader replace oversized introductory cards. Search, summary filters, and actual lessons are immediately visible. Flat rows, fine separators, modest radii, and restrained shadows follow the source direction. Review actions remain at the bottom of the reader. Narrow layouts use horizontal navigation and explicit list/detail transitions so the candidate list does not push the reader below the fold.
- **Colors and tokens:** pale neutral navigation/list surfaces, white reader, teal selection and primary actions, and a teal solution rule reflect the references. Colors are centralized in the existing root tokens. Code explicitly uses the normal dark text token on its light surface. Error/warning semantics remain distinct. No decorative glass or gradients were introduced.
- **Image quality and assets:** the selected app screens require no photographic or illustrative raster assets. Navigation uses vendored official Phosphor icons with its MIT license, consistently sized and sharp. The existing Codetrap wordmark is retained. The mockup's invented brand emblem and nonexistent product sections are not implemented.
- **Copy and content:** English and Chinese interface labels are consistent and descriptive. Actual stored lessons, metadata, counts, evidence, and source text are preserved. The mockups' rewritten lesson text and invented second candidate do not replace real data. Preview content uses textContent, including multiline and HTML-like input.

## Intentional product adaptations

- The combined design uses option 2 navigation throughout and option 3 reading-first Review, with smaller headings and tighter spacing as agreed.
- Real project/session switching remains available through the existing toggle; imaginary Team, Integrations, and Preferences features are omitted.
- Existing list ordering and counters are retained. Wide before/after code blocks sit side by side; narrow layouts stack them.
- Task evidence and revisions stay expanded initially so existing evidence and retry controls remain discoverable. Technical details and source evidence are collapsible.
- Editing opens the existing fields on demand, with core lesson fields first and metadata in a disclosure. Draft recovery and review mutation contracts are preserved.

## Comparison history

1. **[P2, resolved] Code contrast and oversized summary controls.** `library-initial.png` showed inherited light code text on a light background and summary controls each occupying a full row. These weakened readability and pushed results down. Added explicit code foreground and automatic-width compact summary controls. Final evidence: `library-desktop.png` shows readable code and compact summaries above both lessons.
2. **[P1, resolved] Review feedback could intercept acceptance.** Browser regression testing exposed a receipt overlay covering review controls. Review receipts/status now sit above the footer with bounded, scrollable height. Acceptance and recovery regression tests pass; `review-desktop.png` and phone captures show an unobstructed action footer in the resting state.
3. **[P2, resolved] Phone Review stacked list above content.** `review-phone-initial.png` showed the old stacked layout wasting the first screen. Review now uses list/detail navigation, a Back control, and a route that preserves explicit list mode. Final evidence: `review-phone.png` and `review-phone-zh.png`; browser tests cover Back, browser history, and draft retention.

## Interaction and regression verification

- Browser inspection: Library selection, filters, Review read/edit/read transitions, metadata disclosure, phone list/reader navigation, and English/Chinese UI. No real lesson was accepted, rejected, or edited during manual visual QA.
- Desktop document width equals viewport width (1487px); phone document width equals viewport width (390px). Phone primary controls remain within the 844px viewport. Browser error log returned no errors.
- `bun run typecheck`, `bun run check:web`, and `git diff --check` passed; generated client bundle rebuilt through `bun run build:web`.
- Latest combined run: 71 passing tests, zero failures across review browser, client text, client route, review model, library model, console, learning browser, and learning recovery browser suites.
- Additional focused smoke, access, draft recovery, and Library browser suites passed during implementation, covering pane layout, navigation, filtering, authentication, editing, saving, and recovery.
- Test fixtures isolate mutation checks from the user's real data. No full-repository test claim is made.

## Open questions and follow-up polish

No blocking open questions or required P3 follow-ups. This was a focused visual and functional check, not a complete WCAG audit or exhaustive assistive-technology/zoom matrix.

## Implementation checklist

- [x] Compact navigation and Library list/reader structure.
- [x] Reading-first Review with on-demand editing and persistent primary actions.
- [x] Preserve filtering, drafts, evidence, authentication, and review behavior.
- [x] Responsive navigation and Chinese/English checks.
- [x] Recapture and compare the revised implementation against both selected references.
- [x] Pass focused regression and build checks; keep local preview available.

## Full-web completion — 2026-09-06

final result: passed

The user authorized finishing the remaining Learning, Impact, Embeddings, and cross-cutting state/responsive work using the already selected workbench direction. No new product features, external publishing, model downloads, or changes to real learning/review records were needed.

### Coverage and findings

| Surface | Changes and checks | Result |
| --- | --- | --- |
| Review and Library | Rechecked read/edit/save, acceptance and receipts, recovery, filtering, unavailable records, and phone history/navigation. The three section icons remain present. | Passed |
| Learning | Compact collapsed filters that retain their state across resizing; semantic title and selected controls; consistent sans-serif reading; readable long project/collection names; separate empty-library and no-matching-results states; practice, proposal, source coverage, and chapter navigation remain available. | Passed |
| Impact overview | Smaller heading and metrics, reduced top spacing, restrained connection panel, and earlier access to recent tasks. Empty-project setup and disposable demo remain usable. | Passed |
| Run timeline | Compact selected rows and heading; readable long IDs; full-height phone detail with an explicit task selector; timeline, event details, evidence links, and review remain functional. | Passed |
| Evaluations | Consistent cards, headings, and numeric scale; responsive form/dialog layouts; keyboard-operated tabs. Existing suite creation, preview, acceptance, comparisons, export, and revision/rollback flows pass. | Passed |
| Embeddings | Provider form moved out of the narrow rail into the reader. Rail is a compact status summary; phone shows settings directly. Added load/error/retry states, guarded stale project reads, disabled duplicate saves/concurrent reindex controls, and retained unsaved fields after failed saves. Technical profile details are collapsible. | Passed |
| Shared states | Explicit search/project labels, pressed/selected states, focus rings, status live regions, Chinese workspace title, long-text wrapping, and bounded notices. | Passed |

Resolved findings from this pass:

1. **P1: Embeddings settings were buried beneath oversized narrow metrics.** The initial `embeddings-before.png` shows a model name fragmented into many lines and the configuration below the fold. The final `embeddings-desktop.png` places provider choices, model descriptions, Save, and Reindex in the main content area; `embeddings-phone.png` shows the same flow without a redundant sidebar.
2. **P2: Learning filters dominated the list and an empty search could imply no library existed.** Filters now default closed, retain explicit open state, and no-result copy reflects existing filtered content. A regression test clears the filters on phone and returns to the selected note. The empty-library prompt remains available on both responsive layouts.
3. **P2: Long collection/project labels were clipped.** The first populated-page inspection caught non-wrapping progress labels. The final `learning-populated-desktop.png` visibly wraps them; the chapter list and reader stay aligned.
4. **P2: Mobile Impact exposed stacked list/workspace chrome.** The final mobile layout gives the detail pane the available viewport, hides the redundant rail, and opens Projects & sessions explicitly as an overlay. Runs retain an accessible task selector. `runs-phone.png` and `evals-phone.png` show the corrected content layout.
5. **P2: Keyboard and status semantics were incomplete.** Impact tabs now support Left/Right/Home/End plus Enter activation. Learning progress, feedback, provider, locale, and run selection have explicit selected/pressed state. Search and project fields have names; global feedback has polite live-region semantics. The Chinese workspace title is now translated.

### Evidence and visual comparison

Evidence directory: `/Users/superstorm/.codex/visualizations/2026/09/06/01a074b3-f9c5-73c1-95c1-6c4c557128de/codetrap-full-web/`.

- Before: `learning-before.png`, `impact-before.png`, `embeddings-before.png` (1117 × 767, the original browser panel size).
- Final desktop: `learning-populated-desktop.png`, `impact-desktop.png`, `runs-desktop.png`, `evals-desktop.png`, `embeddings-desktop.png` (1487 × 1058).
- Phone: `learning-populated-phone.png`, `learning-practice-phone.png`, `runs-phone.png`, `evals-phone.png`, `embeddings-phone.png` (390 × 844).
- Evaluation dialogs: `suite-desktop.png` (1440 × 1000), `suite-mobile.png` (390 × 844), captured by the real browser regression workflow against isolated fixture data.

The selected option 2 visual truth, final Learning, and final Embeddings captures were reopened together in the same comparison input. They share a 1487 × 1058 frame with 1× browser density. These additional routes extend the selected style; no route-specific mockups exist, so comparison evaluates the agreed typography, spacing, selection, and surface system rather than inventing pixel-accuracy claims. Before captures have a different viewport and are used only as evidence of the observed usability issues, not for geometric measurements.

The five required fidelity surfaces were checked again: system-font headings and readable body wrapping; compact pane spacing and card rhythm; tokenized neutral/teal palette; unchanged official vector icon assets with no raster content needed; and coherent English/Chinese interface copy with real data preserved. The full-resolution captures make the important text and controls readable. Phone practice and suite-dialog captures provide focused evidence for form boundaries, focus visibility, wrapping, and actions below the fold.

Learning's populated screenshots use an isolated temporary fixture on port 4751, including a long Chinese note and code sample. They are explicitly test content, not additions to the user's real library. The actual workspace's empty Learning page, existing run, evaluations, and embedding status were inspected on port 4750. No real accept/reject, source edits, reindexing, or evaluation writes were performed during manual QA.

### Validation

- All **58 relevant tests across 13 files passed**, run in three sequential batches: 21 + 19 + 18, with 603 assertions. Coverage includes Review, Library, Learning and durable recovery, workbench states, navigation/routes, access/bootstrap recovery, evaluations, and experience revisions.
- A prior single-process combined run was terminated with exit 137 before completion. It is not counted as a pass; all requested suites were subsequently completed in the three successful batches.
- The final workspace-title/accessibility-label adjustment also passed the client-text and workbench browser suites separately.
- TypeScript checks, browser bundle regeneration/consistency, and `git diff --check` passed.
- Browser regression checks cover 320, 390, 768, 1024, 1280, and 1487px widths. No document-level horizontal overflow was found in the checked destinations. Actual phone browser inspection confirmed a 390 × 844 viewport at devicePixelRatio 1 and an empty browser error log.
- Key token contrast ratios: normal text on white 17.22:1; muted text on the list surface 5.61:1; secondary text on white 4.98:1; primary button text 7.80:1; error text on its semantic surface 5.73:1; warning text on its semantic surface 4.70:1.

No actionable P0/P1/P2 findings remain in this authorized frontend pass. This is a completed product UI and regression pass, not a formal WCAG certification, a full browser/assistive-technology matrix, or validation of external embedding providers. The existing model services and their availability were not changed.
