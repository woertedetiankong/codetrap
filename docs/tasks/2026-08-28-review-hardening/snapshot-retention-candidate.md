Title: Bound content-addressed stores need reachability GC and a retention policy
Context: When snapshot or blob objects are persisted before a transaction's durable index entry, and capacity checks count every object in the store.
Mistake: Adding hard object and byte limits without reachability-based garbage collection or crash reconciliation lets orphaned objects consume capacity forever; deleting arbitrary objects instead can break rollback history.
Fix: Under the same advisory lock, mark snapshot ids referenced by the durable commit index and sweep only unreferenced objects. Add an explicit retention or archival policy before pruning reverted or expired commits, and test a crash between object persistence and index commit.
Severity: warning
Category: other
Tags: phase3,storage,content-addressed,gc,crash-recovery
Path globs: src/lib/phase3-store.ts
Module: phase3-store
