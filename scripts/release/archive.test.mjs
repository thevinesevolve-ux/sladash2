import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, copyFileSync, rmSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
function fixture(t) {
  const root=mkdtempSync(join(tmpdir(),'archive-test-'));
  t.after(()=>rmSync(root,{recursive:true,force:true}));
  const repo=join(root,'repo'), bin=join(root,'bin');
  mkdirSync(join(repo,'scripts/release'),{recursive:true});mkdirSync(join(repo,'config'));mkdirSync(bin);
  copyFileSync(new URL('./archive.mjs',import.meta.url),join(repo,'scripts/release/archive.mjs'));
  writeFileSync(join(repo,'config/release-policy.json'),JSON.stringify({repository:'owner/test',requiredChecks:['Application checks']}));
  writeFileSync(join(repo,'app.txt'),'application source');
  const git=(...args)=>execFileSync('git',args,{cwd:repo,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
  git('init','-q');git('add','.');git('-c','user.name=CI','-c','user.email=ci@example.invalid','commit','-qm','fixture');
  const commit=git('rev-parse','HEAD');
  writeFileSync(join(bin,'gh'),`#!/usr/bin/env node
const fs=require('node:fs'),path=require('node:path');const a=process.argv.slice(2);const out=process.env.TEST_REMOTE;
if(a[0]==='api') console.log(JSON.stringify(a[1].endsWith('/main')?{sha:process.env.TEST_MAIN}:{check_runs:[{id:1,name:'Application checks',app:{slug:'github-actions'},status:'completed',conclusion:process.env.TEST_CHECK||'success'}]}));
else if(a[1]==='view')process.exit(1);
else if(a[1]==='create'){fs.copyFileSync(a.find(x=>x.endsWith('/source.tar.gz')),out);}
else if(a[1]==='download'){const file=path.join(a[a.indexOf('--dir')+1],'source.tar.gz');if(process.env.TEST_TAMPER)fs.writeFileSync(file,'wrong archive');else fs.copyFileSync(out,file);}
else process.exit(1);
`,{mode:0o755});
  const run=(extra={})=>spawnSync(process.execPath,['scripts/release/archive.mjs'],{cwd:repo,encoding:'utf8',env:{...process.env,PATH:bin+':'+process.env.PATH,TEST_MAIN:commit,TEST_REMOTE:join(root,'remote.tar.gz'),TMPDIR:root,...extra}});
  return {repo,git,run};
}
test('rejects uncommitted application source',t=>{const f=fixture(t);writeFileSync(join(f.repo,'app.txt'),'changed');const r=f.run();assert.notEqual(r.status,0);assert.match(r.stderr,/clean checkout/);});
test('rejects a commit behind GitHub main',t=>{const f=fixture(t),r=f.run({TEST_MAIN:'a'.repeat(40)});assert.notEqual(r.status,0);assert.match(r.stderr,/current GitHub main/);});
test('rejects unsuccessful required checks',t=>{const f=fixture(t),r=f.run({TEST_CHECK:'failure'});assert.notEqual(r.status,0);assert.match(r.stderr,/Required check did not pass/);});
test('rejects committed credential files',t=>{const f=fixture(t);writeFileSync(join(f.repo,'.env'),'PLACEHOLDER=example');f.git('add','.env');f.git('-c','user.name=CI','-c','user.email=ci@example.invalid','commit','-qm','unsafe fixture');const r=f.run({TEST_MAIN:f.git('rev-parse','HEAD')});assert.notEqual(r.status,0);assert.match(r.stderr,/Credential filename/);});
test('rejects a remote archive with different bytes',t=>{const f=fixture(t),r=f.run({TEST_TAMPER:'1'});assert.notEqual(r.status,0);assert.match(r.stderr,/archive verification failed/);});
test('accepts an identical GitHub archive without deploying',t=>{const f=fixture(t),r=f.run();assert.equal(r.status,0,r.stderr);const result=JSON.parse(r.stdout);assert.equal(result.productionDeploymentAuthorized,false);assert.match(result.sha256,/^[a-f0-9]{64}$/);});
