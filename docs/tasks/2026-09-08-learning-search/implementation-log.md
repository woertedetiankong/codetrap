# Decisions

- Reuse EmbeddingRuntime and keep a separate derived JSON Learning index instead of introducing another model or database. Explicit rebuild may repair corrupt derived data; no automatic downloads during search.
- Initial 1,000-character windows diluted related topics: the real Portal cost paraphrase did not exceed similarity 0.3. Switched to paragraph boundaries with at most 500 characters and 80-character overlap. The same query then retrieved the correct cost explanation without lowering the threshold.
- Fingerprints bind text and source metadata; profile binds provider/model/dimensions and passage format. Search rereads content after asynchronous inference, and indexing rechecks its snapshot before atomic replacement.
- Per-insight RRF avoids long lessons dominating through many chunks. The web retains collection reading order while showing semantic evidence.
- Existing HTML is discoverable through associated Learning text. No HTML parsing, script execution, chapter anchors or experience-rule promotion is added.

- Validation completed: 109/109 regression files, then 20 focused tests with 134 assertions after final UI/help changes; typecheck, generated bundle and skill validation passed. Live browser and standalone CLI confirmed real Portal paraphrase retrieval. No release or commit performed.

- User requested removal of approve-only review buttons; retained backend authorization and hid empty conflict menus. 30 related tests passed. User subsequently authorized committing and pushing the completed work.
