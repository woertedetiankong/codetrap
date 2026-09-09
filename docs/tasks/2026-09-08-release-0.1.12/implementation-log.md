# Release decisions

- Registry latest and local package were 0.1.11; v0.1.12 was unused. Use patch 0.1.12 and align src/lib/version.ts.
- Use the repository's GitHub Actions trusted npm publisher. No local credential changes.
- Verify installation in a fresh temporary prefix, preserving the maintainer's source-linked CLI.

- Initial preflight caught plugin manifest version drift (106/107 suites passed). Aligned the plugin version and documented all three version sources in the release playbook, then reran preflight.
