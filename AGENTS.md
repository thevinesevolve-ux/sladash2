
## Production release safety

Read `docs/production-releases.md` before production work. Always save intended application changes in this private GitHub repository, pass required checks and run `node scripts/release/archive.mjs` from clean current main before a production upload. Deploy only its verified archive when the user authorizes rollout. Never deploy an uncommitted local folder. Preserve runtime variables; database migrations and data changes require separate authorization. Keep automatic GitHub deployment disconnected. Record every deployment in `docs/release-ledger.md`.
