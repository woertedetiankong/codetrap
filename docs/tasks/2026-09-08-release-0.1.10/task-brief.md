# Release 0.1.11 (originally planned as 0.1.10)

Created: 2026-09-08
Parent plan: User explicitly requested the npm upgrade following interactive study delivery.

## Goal

Publish codetrap 0.1.11 so other computers can install the interactive study feature.

## Success Criteria

Local release preflight, Linux/Windows CI and release workflows pass. npm latest
resolves to 0.1.11. A fresh isolated npm install reports the version and includes
the study skill and artifact command.

## Scope

Version bump, release gate parity, package and binary publication, installation proof.

## Constraints

Use a new immutable tag/version. Keep existing local source-linked installation.
Do not expose registry credentials, browser tokens or alter real Learning content.
