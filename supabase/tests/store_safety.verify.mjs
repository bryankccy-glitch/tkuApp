// Runs every migration on an in-memory Postgres (with stubs for Supabase's auth and storage) and checks the store-safety rules.
// Usage: npm i --no-save @electric-sql/pglite@0.3.15 && node supabase/tests/store_safety.verify.mjs supabase/migrations
import {PGlite} from '@electric-sql/pglite';
import {vector} from '@electric-sql/pglite/vector';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
import fs from 'fs';import path from 'path';
const dir=process.argv[2];
const db=new PGlite({extensions:{vector,pgcrypto}});
await db.exec(`
create schema auth; create schema storage; create schema extensions; create schema cron; create schema net; create schema vault;
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create table auth.users(id uuid primary key default gen_random_uuid(), aud text, role text, email text, encrypted_password text, raw_app_meta_data jsonb default '{}', raw_user_meta_data jsonb default '{}', created_at timestamptz default now(), updated_at timestamptz default now());
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.uid',true),'')::uuid $$;
create function auth.role() returns text language sql stable as $$ select current_user::text $$;
create function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb $$;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner uuid);
alter table storage.objects enable row level security;
create function storage.foldername(n text) returns text[] language sql immutable as $$ select (string_to_array(n,'/'))[1:array_length(string_to_array(n,'/'),1)-1] $$;
create function cron.schedule(a text,b text,c text) returns bigint language sql as $$ select 1::bigint $$;
create table vault.decrypted_secrets(name text,decrypted_secret text);
grant usage on schema public,auth,storage,extensions to anon,authenticated,service_role;
grant select,insert,update,delete on storage.objects to authenticated;
alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
alter default privileges in schema public grant all on functions to anon,authenticated,service_role;
do $$ begin create publication supabase_realtime; exception when others then null; end $$;
`);
for(const f of fs.readdirSync(dir).sort()){
  let sql=fs.readFileSync(path.join(dir,f),'utf8').replace(/create extension[^;]*(pg_net|pg_cron|pgcrypto|vector)[^;]*;/g,'');
  if(f.includes('vector')||true) await db.exec(`create extension if not exists vector with schema extensions; create extension if not exists pgcrypto with schema extensions;`).catch(()=>{});
  try{await db.exec(sql);console.log('ok',f)}catch(e){console.log('FAIL',f,e.message,e.position);console.log(sql.slice(Math.max(0,e.position-150),+e.position+100));process.exit(1)}
}
let pass=0,fail=0;
const ids={};for(const k of 'abcdefm'){const r=await db.query(`insert into auth.users(email) values($1) returning id`,[k+'@x']);ids[k]=r.rows[0].id}
async function as(u,role,fn){await db.exec(`reset role; select set_config('request.uid','${u||''}',false); set role ${role};`);try{return await fn()}finally{await db.exec('reset role')}}
const U=(k,fn)=>as(ids[k],'authenticated',fn);
const q=(s,p)=>db.query(s,p);
async function ok(name,fn){try{await fn();pass++;console.log('PASS',name)}catch(e){fail++;console.log('FAIL',name,'->',e.message)}}
async function bad(name,re,fn){try{await fn();fail++;console.log('FAIL',name,'-> no error')}catch(e){if(re.test(e.message)){pass++;console.log('PASS',name)}else{fail++;console.log('FAIL',name,'-> wrong error:',e.message)}}}
const eq=(a,b,m='')=>{if(JSON.stringify(a)!==JSON.stringify(b))throw new Error(`${m} got ${JSON.stringify(a)} want ${JSON.stringify(b)}`)};
const newPost=(t='二手課本')=>q(`insert into public.market_posts(kind,category,title,description) values('sell','book',$1,'好書') returning id`,[t]).then(r=>r.rows[0].id);
await bad('post needs accepted rules',/rules required/,()=>U('a',()=>newPost()));
for(const k of 'abcdef') await U(k,()=>q(`select public.accept_market_rules(1)`));
let P;await ok('post insert works',async()=>{P=await U('a',()=>newPost())});
let C;await ok('comment insert works',async()=>{C=(await U('b',()=>q(`insert into public.market_comments(post_id,body) values($1,'還在嗎') returning id`,[P]))).rows[0].id});
await ok('owner status update works',()=>U('a',()=>q(`update public.market_posts set status='reserved' where id=$1`,[P])));
await ok('owner edits text',()=>U('a',async()=>{await q(`update public.market_posts set title='二手課本二' where id=$1`,[P])}));
await bad('term blocked on post',/blocked term/,()=>U('a',()=>newPost('賣大麻喔')));
await bad('term blocked on comment',/blocked term/,()=>U('b',()=>q(`insert into public.market_comments(post_id,body) values($1,'代寫報告')`,[P])));
await bad('term blocked on edit',/blocked term/,()=>U('a',()=>q(`update public.market_posts set title='代考服務' where id=$1`,[P])));
await bad('author cannot set hidden_at',/permission denied/,()=>U('a',()=>q(`update public.market_posts set hidden_at=null where id=$1`,[P])));
await bad('author cannot change user_id column',/permission denied/,()=>U('a',()=>q(`update public.market_posts set user_id=$2 where id=$1`,[P,ids.b])));
await bad('reporter cannot preset status',/permission denied/,()=>U('b',()=>q(`insert into public.market_reports(post_id,reason,status) values($1,'spam','dismissed')`,[P])));
await bad('reporter cannot preset status (content)',/permission denied/,()=>U('b',()=>q(`insert into public.content_reports(target_type,target_id,reason,status) values('comment',$1,'spam','dismissed')`,[C])));
// legacy term row can still be reported and hidden
await q(`alter table public.market_posts disable trigger market_posts_stamp`);
const L=(await q(`insert into public.market_posts(user_id,kind,category,title,description) values($1,'sell','book','代寫舊文','') returning id`,[ids.a])).rows[0].id;
await q(`alter table public.market_posts enable trigger market_posts_stamp`);
await ok('legacy bad-term post can change status',()=>U('a',()=>q(`update public.market_posts set status='closed' where id=$1`,[L])));
for(const k of 'bcd') await ok('report post '+k,()=>U(k,()=>q(`insert into public.market_reports(post_id,reason) values($1,'prohibited')`,[L])));
await ok('three reports hid legacy post',async()=>{eq((await q(`select hidden_at is not null h from public.market_posts where id=$1`,[L])).rows[0].h,true)});
for(const k of 'cde') await ok('report comment '+k,()=>U(k,()=>q(`insert into public.content_reports(target_type,target_id,reason) values('comment',$1,'spam')`,[C])));
await ok('three reports hid comment',async()=>{eq((await q(`select hidden_at is not null h from public.market_comments where id=$1`,[C])).rows[0].h,true)});
await ok('hidden comment invisible to others, visible to author',async()=>{eq((await U('c',()=>q(`select 1 from public.market_comments where id=$1`,[C]))).rows.length,0);eq((await U('b',()=>q(`select 1 from public.market_comments where id=$1`,[C]))).rows.length,1)});
for(const k of 'bcd') await ok('report P '+k,()=>U(k,()=>q(`insert into public.market_reports(post_id,reason) values($1,'scam')`,[P])));
await ok('hidden post invisible to others, visible to owner',async()=>{eq((await U('c',()=>q(`select 1 from public.market_posts where id=$1`,[P]))).rows.length,0);eq((await U('a',()=>q(`select 1 from public.market_posts where id=$1`,[P]))).rows.length,1)});
await bad('no comment on hidden post',/post unavailable/,()=>U('e',()=>q(`insert into public.market_comments(post_id,body) values($1,'hi')`,[P])));
await ok('service role can read queue and unhide',()=>as('','service_role',async()=>{if(!(await q(`select * from public.moderation_queue`)).rows.length)throw new Error('empty');await q(`update public.market_posts set hidden_at=null where id=$1`,[P]);await q(`update public.market_reports set status='dismissed' where post_id=$1`,[P])}));
await bad('client cannot read queue',/permission denied/,()=>U('a',()=>q(`select * from public.moderation_queue`)));
await ok('comments on a blocked author post disappear',async()=>{const c2=(await U('e',()=>q(`insert into public.market_comments(post_id,body) values($1,'問一下') returning id`,[P]))).rows[0].id;
 await U('a',()=>q(`select public.block_user($1)`,[ids.f]));eq((await U('f',()=>q(`select 1 from public.market_comments where id=$1`,[c2]))).rows.length,0);eq((await U('f',()=>q(`select 1 from public.market_posts where id=$1`,[P]))).rows.length,0)});
await bad('blocked user cannot comment',/blocked/,()=>U('f',()=>q(`insert into public.market_comments(post_id,body) values($1,'hi')`,[P])));
await ok('list and unblock',()=>U('a',async()=>{eq((await q(`select * from public.user_blocks`)).rows.length,1);await q(`delete from public.user_blocks where blocked=$1`,[ids.f])}));
await ok('block removes friendship, blocks accept',async()=>{await q(`insert into public.friendships(requester,addressee) values($1,$2)`,[ids.a,ids.b]);const id=(await q(`select id from public.friendships`)).rows[0].id;
 await q(`insert into public.user_blocks(blocker,blocked) values($1,$2)`,[ids.a,ids.b]);
 await U('b',()=>q(`select public.respond_friend_request($1,true)`,[id])).then(()=>{throw new Error('accept passed')},e=>{if(!/blocked/.test(e.message))throw e});
 await U('a',()=>q(`select public.block_user($1)`,[ids.b]));eq((await q(`select 1 from public.friendships`)).rows.length,0);await q(`delete from public.user_blocks`)});
await q(`insert into public.suspended_users(user_id) values($1)`,[ids.e]);
await bad('suspended cannot post',/account suspended/,()=>U('e',()=>newPost()));
await bad('suspended cannot comment',/account suspended/,()=>U('e',()=>q(`insert into public.market_comments(post_id,body) values($1,'hi')`,[P])));
await q(`insert into public.suspended_users(user_id) values($1)`,[ids.a]);
await bad('suspended cannot edit',/account suspended/,()=>U('a',()=>q(`update public.market_posts set status='open' where id=$1`,[P])));
await q(`delete from public.suspended_users where user_id=$1`,[ids.a]);
await bad('suspended cannot upload',/row-level security/,()=>U('e',()=>q(`insert into storage.objects(bucket_id,name) values('market-photos',$1)`,[ids.e+'/a.jpg'])));
await ok('suspended user can still report',()=>U('e',()=>q(`insert into public.market_reports(post_id,reason) values($1,'spam')`,[P])));
await ok('upload to own folder, list own only',async()=>{await U('b',()=>q(`insert into storage.objects(bucket_id,name) values('market-photos',$1)`,[ids.b+'/a.jpg']));await U('c',()=>q(`insert into storage.objects(bucket_id,name) values('market-photos',$1)`,[ids.c+'/a.jpg']));eq((await U('b',()=>q(`select name from storage.objects`))).rows.length,1)});
await bad('cannot upload into another folder',/row-level security/,()=>U('b',()=>q(`insert into storage.objects(bucket_id,name) values('market-photos',$1)`,[ids.c+'/x.jpg'])));
await bad('delete account refused while photos remain',/photos remain/,()=>U('b',()=>q(`select public.delete_my_account()`)));
await ok('delete account after photos removed',async()=>{await U('b',()=>q(`delete from storage.objects`));await U('b',()=>q(`select public.delete_my_account()`));eq((await q(`select 1 from auth.users where id=$1`,[ids.b])).rows.length,0)});
await bad('anon cannot read blocks',/permission denied/,()=>as('','anon',()=>q(`select * from public.user_blocks`)));
await bad('anon cannot see suspensions',/permission denied/,()=>as('','anon',()=>q(`select * from public.suspended_users`)));
await bad('client cannot read suspensions',/permission denied/,()=>U('a',()=>q(`select * from public.suspended_users`)));
console.log(`\n${pass} passed, ${fail} failed`);process.exit(fail?1:0);
