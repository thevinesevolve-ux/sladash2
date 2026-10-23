# Application release and backup policy

Every production release must be saved in this private GitHub repository before it is uploaded to Railway. A local folder, an unpushed branch or a successful Railway upload alone is not a release record.

1. Verify the current running deployment, its source commit and latest GitHub main. Compare any local work first; preserve unfinished changes on a separate reviewed branch. Stop if running source is newer or unidentified.
2. Merge the reviewed application change through a pull request after Application checks and security checks succeed. Never execute migrations merely because SQL source was committed.
3. From a clean checkout of current main, run `node scripts/release/archive.mjs`. It requires successful GitHub checks, creates an exact committed-source GitHub Release, downloads it back and verifies the checksum. A failure blocks release preparation.
4. Obtain the user's production rollout instruction. Keep automatic GitHub deployment disconnected so merging or scanning code cannot silently deploy it. Preserve the current environment variables; never restore old credentials with old source.
5. Extract only the verified archive into a fresh temporary directory and upload it to the explicitly verified Railway project, environment and service. Inspect build/pre-deploy commands first: database migrations, seeds and provider mutations require separate authorization. Do not upload the working folder.
6. Verify deployment success and the application's health and affected workflows. Record the exact commit, GitHub source-release URL, SHA-256, Railway deployment ID, previous deployment and validation in `docs/release-ledger.md`. A source archive does not mean a version is live.

The Application source backup workflow saves committed source and Git history on every main push and daily, with 90-day GitHub Actions artifacts. Production source Release assets persist independently of that expiry. Both are stored at GitHub; this is not an independent-provider backup. Local uncommitted work is not automatically uploaded, since it may include credentials or unfinished features. Save intended work on a reviewed private branch before ending an application task.

Recovery uses a previously verified source archive with current runtime configuration and explicit recovery approval. Do not roll back a database or customer records. Keep a known-good deployment available and never delete archives during normal housekeeping.
