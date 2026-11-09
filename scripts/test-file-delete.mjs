import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source = fs.readFileSync('app/api/files/[assetId]/route.ts', 'utf8');
assert.match(source, /requireApiUser\(request\)/);
assert.match(source, /eq\(courses.ownerId, auth.user.userId\)/);
assert.match(source, /isNull\(courses.deletedAt\)/);
const compiled = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
let denial, rows, calls, failStorage, failDb;
const chain = {select(){return this},from(){return this},innerJoin(){return this},where(){return this},limit:async()=>rows,
  delete(){calls.push('db');if(failDb)throw Error('db');return {where:async()=>{}}}};
const bucket = {delete:async(key)=>{calls.push(`r2:${key}`);if(failStorage)throw Error('r2')}};
const auth = {requireApiUser:async(request)=>{assert.equal(request.method,'DELETE');return denial ? {response:Response.json({}, {status:denial})} : {user:{userId:'owner'}}},json:(data,status=200)=>Response.json(data,{status})};
const exports = {};
new Function('require','exports',compiled)((name)=>({
  'cloudflare:workers':{env:{BUCKET:bucket}},'drizzle-orm':{and:()=>{},eq:()=>{},isNull:()=>{}},
  '@/db':{getDb:()=>chain},'@/db/schema':{assets:{},chapters:{},courses:{}},'@/lib/auth':auth,
})[name],exports);
async function run(status,{deny=0,found=true,storage=false,db=false}={}) {
  denial=deny;rows=found?[{asset:{id:'asset',r2Key:'private/asset'}}]:[];calls=[];failStorage=storage;failDb=db;
  const response=await exports.DELETE(new Request('https://example.test/api/files/asset',{method:'DELETE'}),{params:Promise.resolve({assetId:'asset'})});
  assert.equal(response.status,status);return response;
}
await run(401,{deny:401});assert.deepEqual(calls,[]);
await run(403,{deny:403});assert.deepEqual(calls,[]);
await run(404,{found:false});assert.deepEqual(calls,[]);
await run(503,{storage:true});assert.deepEqual(calls,['r2:private/asset']);
await run(503,{db:true});assert.deepEqual(calls,['r2:private/asset','db']);
assert.deepEqual(await (await run(200)).json(),{deleted:'asset'});assert.deepEqual(calls,['r2:private/asset','db']);
console.log('File deletion: auth/origin guard, ownership query, missing asset, storage/DB failures and deletion order passed.');
