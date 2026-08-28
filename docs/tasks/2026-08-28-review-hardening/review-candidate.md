Title: Do not pair unbounded synchronous persistence with age-only stale-lock stealing
Context: A local read-modify-write command holds an advisory lock while serializing or rewriting snapshots, histories, indexes, or other data whose size grows over time.
Mistake: Treating a lock directory older than a short threshold as abandoned can delete a live owner's lock when synchronous work blocks heartbeats; storing duplicate full snapshots makes that critical section progressively longer and turns the timing bug into a realistic data race.
Fix: Bound or content-address the persistent history, check owner-process liveness before reclaiming, elect one reclaimer with an atomic directory move, and test a live owner whose critical section exceeds the stale threshold.
Category: other
Scope: project
Severity: error
Tags: concurrency,locking,persistence,snapshot,review-feedback
Path globs: src/lib/advisory-lock.ts,src/lib/phase3-store.ts
Module: locking,phase3
Evidence: Independent review connected Phase 3's duplicated full snapshots to a synchronous critical section that could exceed the five-second stale threshold. The confirmed fix landed with bounded content-addressed snapshots and live-owner-safe atomic reclaim.
