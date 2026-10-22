import test from "node:test";
import assert from "node:assert/strict";
import {hasMigratableData,planCommunityMigration} from "../src/lib/community-migration-plan.ts";

const empty=()=>({value:null,revision:0});
const sampleResume={profile:{contact:{name:"Pessoa Fictícia"}},template:"classico"};
const sampleJob={id:"job-test-1"};
const sampleVersion={version:1,job:{url:"https://jobs.example.com/123"}};

test("an earlier SQLite resume does not block importing older approved CV versions",()=>{
 const legacy={resume:sampleResume,opportunities:[sampleJob],resume_versions:[sampleVersion]};
 const stored={resume:{value:sampleResume,revision:3},opportunities:{value:[sampleJob],revision:2},
   resume_versions:empty()};
 const plan=planCommunityMigration(legacy,stored);
 assert.equal(plan.resume,null);
 assert.equal(plan.opportunities,null);
 assert.deepEqual(plan.resume_versions,[sampleVersion]);
 assert.deepEqual(plan.skipped,["currículo","oportunidades"]);
 assert.deepEqual(plan.expected_revisions,{resume:3,opportunities:2,resume_versions:0});
 assert.equal(hasMigratableData(plan),true);
});

test("a revisioned deletion is not overwritten by a stale browser draft",()=>{
 const legacy={resume:sampleResume,opportunities:null,resume_versions:[]};
 const plan=planCommunityMigration(legacy,{
  resume:{value:null,revision:4},opportunities:empty(),resume_versions:empty(),
 });
 assert.equal(plan.resume,null);
 assert.deepEqual(plan.skipped,["currículo"]);
 assert.equal(hasMigratableData(plan),false);
});

test("a fresh SQLite database can import the legacy records together",()=>{
 const legacy={resume:sampleResume,opportunities:[sampleJob],resume_versions:[sampleVersion]};
 const plan=planCommunityMigration(legacy,{
  resume:empty(),opportunities:empty(),resume_versions:empty(),
 });
 assert.deepEqual(plan.resume,sampleResume);
 assert.deepEqual(plan.opportunities,[sampleJob]);
 assert.deepEqual(plan.resume_versions,[sampleVersion]);
 assert.deepEqual(plan.skipped,[]);
 assert.equal(hasMigratableData(plan),true);
});

test("malformed revisions fail closed before building the import plan",()=>{
 assert.throws(()=>planCommunityMigration(
  {resume:sampleResume,opportunities:null,resume_versions:[]},
  {resume:{value:null,revision:-1},opportunities:empty(),resume_versions:empty()},
 ),/Revisão SQLite inválida/);
});
