// Prepare source for an explicitly approved release. Never deploy or access a database.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const run = (name, args) => execFileSync(name, args, {encoding:'utf8', stdio:['ignore','pipe','pipe']}).trim();
const config = JSON.parse(readFileSync(new URL('../../config/release-policy.json', import.meta.url)));
const sha256 = path => createHash('sha256').update(readFileSync(path)).digest('hex');
if (process.argv.length !== 2) throw new Error('Usage: node scripts/release/archive.mjs');
if (run('git',['status','--porcelain','--untracked-files=all'])) throw new Error('Use a clean checkout; commit intended changes first.');
const commit = run('git',['rev-parse','HEAD']);
const main = JSON.parse(run('gh',['api',`repos/${config.repository}/commits/main`])).sha;
if (commit !== main) throw new Error('Only the current GitHub main commit may become a new release.');
const checks = JSON.parse(run('gh',['api',`repos/${config.repository}/commits/${commit}/check-runs?per_page=100`])).check_runs;
for (const name of config.requiredChecks) {
  const latest = checks.filter(c=>c.name===name && c.app?.slug==='github-actions').sort((a,b)=>b.id-a.id)[0];
  if (!latest || latest.status!=='completed' || latest.conclusion!=='success') throw new Error(`Required check did not pass: ${name}`);
}
const tracked = run('git',['ls-tree','-r','--name-only',commit]).split('\n');
for (const path of tracked) if (/(^|\/)(\.env($|\.)|[^/]*\.(key|pem)$)/.test(path) && !path.endsWith('.example')) throw new Error(`Credential filename in release: ${path}`);
const modes = run('git',['ls-tree','-r',commit]);
if (/^(120000|160000) /m.test(modes)) throw new Error('Symlinks and submodules require separate release review.');
const tag = `source-${commit}`;
const directory = mkdtempSync(join(tmpdir(),'verified-source-'));
const archive = join(directory,'source.tar.gz');
run('git',['archive','--format=tar.gz','--output',archive,commit]);
const digest = sha256(archive);
writeFileSync(join(directory,'SHA256SUMS'),`${digest}  source.tar.gz\n`);
writeFileSync(join(directory,'release.json'),JSON.stringify({repository:config.repository,commit,sourceArchiveSha256:digest},null,2)+'\n');
const notes=join(directory,'notes.md');
writeFileSync(notes,`Source backup for commit ${commit}. Archive SHA-256: ${digest}.\n\nThis is a source archive, not evidence of a deployment. No database or credential changes.\n`);
// An existing tag is never overwritten; its downloaded bytes must match.
let releaseExists=false;
try { run('gh',['release','view',tag,'--repo',config.repository,'--json','tagName']);releaseExists=true; } catch { /* create below also fails on denied access */ }
if (!releaseExists) run('gh',['release','create',tag,'--repo',config.repository,'--target',commit,'--title',tag,'--notes-file',notes,archive,join(directory,'SHA256SUMS'),join(directory,'release.json')]);
const downloaded=join(directory,'downloaded');mkdirSync(downloaded);
run('gh',['release','download',tag,'--repo',config.repository,'--pattern','source.tar.gz','--dir',downloaded]);
if (sha256(join(downloaded,'source.tar.gz'))!==digest) throw new Error('GitHub archive verification failed. Do not deploy.');
if (JSON.parse(run('gh',['api',`repos/${config.repository}/commits/main`])).sha!==commit) throw new Error('Main moved while preparing the release; reassess before deploying.');
console.log(JSON.stringify({repository:config.repository,commit,tag,verifiedArchive:join(downloaded,'source.tar.gz'),sha256:digest,productionDeploymentAuthorized:false},null,2));
