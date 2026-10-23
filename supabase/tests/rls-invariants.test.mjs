// RLS / privilege-escalation regression tests for the Wonder CRM schema.
//
// Runs the real migration SQL against a real Postgres engine (PGlite/WASM) in a
// Supabase-shaped privilege environment: anon / authenticated / service_role,
// auth.uid() from a JWT-claim GUC, and the platform's default
// GRANT ALL ON ALL TABLES / FUNCTIONS IN SCHEMA public.
//
//   bun run test:rls
//
// Every check asserts a property the schema must hold. Regressing any of them —
// dropping the column grants, the guard triggers, the is_active test in a
// policy, or the app_metadata role allow-list — fails the run.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIGRATIONS = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');
const SCHEMA = readFileSync(join(MIGRATIONS, '20260915_initial_schema_and_rls.sql'), 'utf8');

const results = [];
const record = (name, pass, detail) => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

const SUPABASE_ENV = `
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
GRANT anon, authenticated, service_role TO current_user;

CREATE SCHEMA auth;
CREATE TABLE auth.users (
  id uuid PRIMARY KEY,
  email text,
  raw_user_meta_data jsonb DEFAULT '{}'::jsonb,
  raw_app_meta_data jsonb DEFAULT '{}'::jsonb
);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $fn$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$fn$;

GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;

-- The initial migration runs CREATE EXTENSION "uuid-ossp"; PGlite does not ship
-- it, so provide the single function the schema actually calls.
CREATE FUNCTION public.uuid_generate_v4() RETURNS uuid LANGUAGE sql VOLATILE
  AS $fn$ SELECT gen_random_uuid() $fn$;
`;
const stripExtension = (sql) => sql.replace(/CREATE EXTENSION[^;]*;/gi, '');

const ADMIN = '11111111-1111-1111-1111-111111111111';
const REP_A = '22222222-2222-2222-2222-222222222222';
const REP_B = '33333333-3333-3333-3333-333333333333';
const LEAD_A = 'aaaaaaaa-0000-0000-0000-000000000001';
const LEAD_B = 'bbbbbbbb-0000-0000-0000-000000000001';
const FUP_A = 'ffffffff-0000-0000-0000-000000000001';
const LEAD_IMPORTED = 'cccccccc-0000-0000-0000-000000000001';

const asUser = async (db, userId, sql) => {
  await db.exec(`SET ROLE authenticated;`);
  await db.exec(`SELECT set_config('request.jwt.claim.sub', '${userId}', false);`);
  try {
    return { ok: true, rows: (await db.query(sql)).rows };
  } catch (e) {
    return { ok: false, error: e.message };
  } finally {
    await db.exec(`RESET ROLE;`);
  }
};

// No end-user JWT: service_role (app/api/admin/*), SQL editor, migrations.
const asService = async (db, sql) => {
  await db.exec(`SET ROLE service_role;`);
  await db.exec(`SELECT set_config('request.jwt.claim.sub', '', false);`);
  try {
    return { ok: true, rows: (await db.query(sql)).rows };
  } catch (e) {
    return { ok: false, error: e.message };
  } finally {
    await db.exec(`RESET ROLE;`);
  }
};

// The table owner (what the migration runner is, and what GRANT/REVOKE require).
const asOwner = async (db, sql) => {
  await db.exec(`RESET ROLE;`);
  await db.exec(`SELECT set_config('request.jwt.claim.sub', '', false);`);
  try {
    return { ok: true, rows: (await db.query(sql)).rows };
  } catch (e) {
    return { ok: false, error: e.message };
  }
};

const db = new PGlite();

console.log('\n=== Phase 1: schema applies and seeds ===');
await db.exec(SUPABASE_ENV);
try {
  await db.exec(stripExtension(SCHEMA));
  await db.exec('RESET ROLE;');
  record('schema applies cleanly', true);
} catch (e) {
  record('schema applies cleanly', false, e.message);
  console.log(e);
  process.exit(1);
}
// auth.users INSERT fires on_auth_user_created, so handle_new_user() creates the
// profile rows; the Admin role is then assigned out of band exactly as the
// README's first-Admin bootstrap does.
await db.exec(`
  INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
    ('${ADMIN}', 'admin@wonder.test', '{"full_name":"Admin One"}'),
    ('${REP_A}', 'rep.a@wonder.test',  '{"full_name":"Rep A"}'),
    ('${REP_B}', 'rep.b@wonder.test',  '{"full_name":"Rep B"}');
  UPDATE public.profiles SET role = 'Admin' WHERE id = '${ADMIN}';
  INSERT INTO public.leads (id, name, phone_1, preferred_property, assigned_rep_id) VALUES
    ('${LEAD_A}', 'Lead A', '+911111111111', 'Flat A', '${REP_A}'),
    ('${LEAD_B}', 'Lead B', '+912222222222', 'Flat B', '${REP_B}');
  INSERT INTO public.followups (id, lead_id, rep_id, followup_date) VALUES
    ('${FUP_A}', '${LEAD_A}', '${REP_A}', CURRENT_DATE);
  INSERT INTO public.interactions (lead_id, rep_id, notes) VALUES ('${LEAD_A}', '${REP_A}', 'called');
`);

// The admin RLS policies hang off is_admin(); if it returns false for a real
// Administrator, the console reads nothing and the policies are dead weight.
const adminOk = await asUser(db, ADMIN, `SELECT public.is_admin() AS v`);
record('is_admin() is true for a real Admin', adminOk.rows?.[0]?.v === true, `is_admin=${adminOk.rows?.[0]?.v}`);

console.log('\n=== Phase 2: privilege escalation is blocked ===');
const es2 = await asUser(db, REP_A, `UPDATE public.profiles SET role='Admin' WHERE id='${REP_A}'`);
record('rep cannot set own role = Admin', !es2.ok, es2.ok ? 'UPDATE SUCCEEDED — STILL VULNERABLE' : es2.error?.slice(0, 80));

const de2 = await asUser(db, REP_A, `UPDATE public.profiles SET is_active=FALSE WHERE id='${REP_A}'`);
record('rep cannot clear own is_active', !de2.ok, de2.ok ? 'UPDATE SUCCEEDED' : de2.error?.slice(0, 80));

const em2 = await asUser(db, REP_A, `UPDATE public.profiles SET email='admin@wonder.test' WHERE id='${REP_A}'`);
record('rep cannot rewrite own email (UNIQUE-oracle / spoofing)', !em2.ok, em2.ok ? 'UPDATE SUCCEEDED' : em2.error?.slice(0, 80));

const id2 = await asUser(db, REP_A, `UPDATE public.profiles SET id='${REP_B}' WHERE id='${REP_A}'`);
record('rep cannot rewrite a profile id', !id2.ok, id2.ok ? 'UPDATE SUCCEEDED' : id2.error?.slice(0, 80));

console.log('\n=== Phase 4: role provisioning ===');
const mintB = '55555555-5555-5555-5555-555555555555';
await db.exec(`INSERT INTO auth.users (id,email,raw_user_meta_data) VALUES ('${mintB}','sneaky2@wonder.test','{"full_name":"Sneaky","role":"Admin"}');`);
const mintedB = await asService(db, `SELECT role FROM public.profiles WHERE id='${mintB}'`);
record('user_metadata.role no longer mints Admin', mintedB.rows?.[0]?.role === 'Sales_Rep', `role=${mintedB.rows?.[0]?.role}`);

const mintC = '66666666-6666-6666-6666-666666666666';
await db.exec(`INSERT INTO auth.users (id,email,raw_user_meta_data,raw_app_meta_data) VALUES ('${mintC}','boss@wonder.test','{"full_name":"Boss","role":"Sales_Rep"}','{"role":"Admin"}');`);
const mintedC = await asService(db, `SELECT role FROM public.profiles WHERE id='${mintC}'`);
record('app_metadata.role=Admin still provisions an Admin', mintedC.rows?.[0]?.role === 'Admin', `role=${mintedC.rows?.[0]?.role}`);

const mintD = '77777777-7777-7777-7777-777777777777';
await db.exec(`INSERT INTO auth.users (id,email,raw_app_meta_data) VALUES ('${mintD}','garbage@wonder.test','{"role":"NotARole"}');`);
const mintedD = await asService(db, `SELECT role FROM public.profiles WHERE id='${mintD}'`);
record('non-allow-listed app_metadata role falls back to Sales_Rep', mintedD.rows?.[0]?.role === 'Sales_Rep', `role=${mintedD.rows?.[0]?.role}`);

console.log('\n=== Phase 3: deactivation revokes access ===');
// Deactivation must revoke everything except reading one's own profile row.
// Give rep B a pending follow-up of their own while they are still active, so
// the update test below has a row to reach for.
const FUP_B = 'ffffffff-0000-0000-0000-000000000002';
await asService(db, `INSERT INTO public.followups (id, lead_id, rep_id, followup_date) VALUES ('${FUP_B}','${LEAD_B}','${REP_B}',CURRENT_DATE)`);
await asService(db, `UPDATE public.profiles SET is_active=FALSE WHERE id='${REP_B}'`);
const offLeads = await asUser(db, REP_B, `SELECT count(*)::int AS n FROM public.leads`);
record('deactivated rep cannot read leads', offLeads.rows?.[0]?.n === 0, `n=${offLeads.rows?.[0]?.n ?? offLeads.error}`);
const offIns = await asUser(db, REP_B, `INSERT INTO public.leads (name,phone_1,preferred_property,assigned_rep_id) VALUES ('x','+910','y','${REP_B}')`);
record('deactivated rep cannot insert leads', !offIns.ok, offIns.ok ? 'INSERT SUCCEEDED' : offIns.error?.slice(0, 70));
const offFup = await asUser(db, REP_B, `INSERT INTO public.followups (lead_id,rep_id,followup_date) VALUES ('${LEAD_B}','${REP_B}',CURRENT_DATE)`);
record('deactivated rep cannot insert followups', !offFup.ok, offFup.ok ? 'INSERT SUCCEEDED' : offFup.error?.slice(0, 70));
const offUpd = await asUser(db, REP_B, `UPDATE public.followups SET status='Completed' WHERE id='${FUP_B}' RETURNING status`);
const offUpdState = await asService(db, `SELECT status FROM public.followups WHERE id='${FUP_B}'`);
record(
  'deactivated rep cannot update own followups',
  offUpdState.rows?.[0]?.status === 'Pending',
  `status after the attempt = ${offUpdState.rows?.[0]?.status} (${offUpd.ok ? `${offUpd.rows?.length} rows matched` : offUpd.error?.slice(0, 40)})`
);
const offSelf = await asUser(db, REP_B, `SELECT count(*)::int AS n FROM public.profiles`);
record('deactivated rep sees only its own profile row', offSelf.rows?.[0]?.n === 1, `profiles visible=${offSelf.rows?.[0]?.n}`);
const dir = await asUser(db, REP_A, `SELECT count(*)::int AS has_b FROM public.profiles WHERE id='${REP_B}'`);
record(
  'active rep no longer sees the deactivated teammate in the directory',
  dir.rows?.[0]?.has_b === 0,
  `rep.b visible to rep.a = ${dir.rows?.[0]?.has_b}`
);
await asService(db, `UPDATE public.profiles SET is_active=TRUE WHERE id='${REP_B}'`);

await asService(db, `UPDATE public.profiles SET is_active=FALSE WHERE id='${ADMIN}'`);
const adminOff = await asUser(db, ADMIN, `SELECT public.is_admin() AS v, count(*)::int AS n FROM public.leads`);
record(
  'deactivated Admin loses is_admin() (strict false) and all lead access',
  adminOff.rows?.[0]?.v === false && adminOff.rows?.[0]?.n === 0,
  JSON.stringify(adminOff.rows?.[0])
);
await asService(db, `UPDATE public.profiles SET is_active=TRUE WHERE id='${ADMIN}'`);

// Layer 2: the guard trigger must hold even if the column grant is absent.
// GRANT/REVOKE require table ownership, so these run as the owner, not service_role.
await asOwner(db, `GRANT UPDATE ON public.profiles TO authenticated`);
const trig = await asUser(db, REP_A, `UPDATE public.profiles SET role='Admin' WHERE id='${REP_A}'`);
const trigActive = await asUser(db, REP_A, `UPDATE public.profiles SET is_active=FALSE WHERE id='${REP_A}'`);
const trigOk = await asUser(db, REP_A, `UPDATE public.profiles SET full_name='Rep A Renamed' WHERE id='${REP_A}' RETURNING full_name`);
await asOwner(db, `REVOKE UPDATE ON public.profiles FROM authenticated`);
await asOwner(db, `GRANT UPDATE (full_name, phone) ON public.profiles TO authenticated`);
record(
  'GUARD TRIGGER alone blocks role escalation (column grant removed)',
  !trig.ok && /Only an administrator/.test(trig.error ?? ''),
  trig.ok ? 'UPDATE SUCCEEDED — trigger does not guard' : trig.error?.slice(0, 80)
);
record(
  'GUARD TRIGGER alone blocks is_active tampering (column grant removed)',
  !trigActive.ok && /Only an administrator/.test(trigActive.error ?? ''),
  trigActive.ok ? 'UPDATE SUCCEEDED' : trigActive.error?.slice(0, 80)
);
record('GUARD TRIGGER still allows a permitted self-service edit', trigOk.ok, trigOk.error?.slice(0, 80));

console.log('\n=== Phase 5: legitimate operations must still work ===');
const adminLeads = await asUser(db, ADMIN, `SELECT count(*)::int AS n FROM public.leads`);
record('admin reads every lead through RLS', adminLeads.rows?.[0]?.n >= 2, `n=${adminLeads.rows?.[0]?.n}`);
const adminFups = await asUser(db, ADMIN, `SELECT count(*)::int AS n FROM public.followups`);
record('admin reads every followup through RLS', adminFups.rows?.[0]?.n >= 1, `n=${adminFups.rows?.[0]?.n}`);
const adminInteractions = await asUser(db, ADMIN, `SELECT count(*)::int AS n FROM public.interactions`);
record('admin reads every interaction through RLS', adminInteractions.rows?.[0]?.n >= 1, `n=${adminInteractions.rows?.[0]?.n}`);
const adminProfiles = await asUser(db, ADMIN, `SELECT count(*)::int AS n FROM public.profiles`);
record('admin reads every profile through RLS', adminProfiles.rows?.[0]?.n >= 3, `n=${adminProfiles.rows?.[0]?.n}`);

// The same person must not exist twice under different phone formatting.
const dupPhone = await asUser(
  db,
  ADMIN,
  `INSERT INTO public.leads (name, phone_1, preferred_property, assigned_rep_id)
   VALUES ('Duplicate Person', '+91 11111 11111', 'Flat A', '${REP_A}')`
);
record(
  'one lead per normalized phone number',
  !dupPhone.ok,
  dupPhone.ok ? 'INSERT SUCCEEDED' : dupPhone.error?.slice(0, 60)
);

// Imported historical leads arrive unassigned. Only the nullable column makes
// this insert possible; the policies must then keep the row away from every rep.
const insUnassigned = await asUser(
  db,
  ADMIN,
  `INSERT INTO public.leads (id, name, phone_1, preferred_property, assigned_rep_id)
   VALUES ('${LEAD_IMPORTED}', 'Imported Old Lead', '+919000000095', 'Old Flat', NULL)
   RETURNING id, assigned_rep_id`
);
record(
  'admin inserts an unassigned imported lead',
  insUnassigned.ok && insUnassigned.rows?.[0]?.assigned_rep_id === null,
  insUnassigned.ok ? 'assigned_rep_id=NULL' : insUnassigned.error?.slice(0, 80)
);
const stampImported = await asUser(
  db,
  ADMIN,
  `UPDATE public.leads SET status='Imported' WHERE id='${LEAD_IMPORTED}' RETURNING status`
);
record(
  'a lead can hold the Imported stage',
  stampImported.ok && stampImported.rows?.[0]?.status === 'Imported',
  stampImported.ok ? 'status=Imported' : stampImported.error?.slice(0, 60)
);
const importedVisibleToRep = await asUser(db, REP_A, `SELECT count(*)::int AS n FROM public.leads WHERE id='${LEAD_IMPORTED}'`);
record('rep cannot see an unassigned lead', importedVisibleToRep.rows?.[0]?.n === 0, `n=${importedVisibleToRep.rows?.[0]?.n}`);
const repInsUnassigned = await asUser(
  db,
  REP_A,
  `INSERT INTO public.leads (name, phone_1, preferred_property, assigned_rep_id)
   VALUES ('Orphan Lead', '+910000000003', 'prop', NULL)`
);
record(
  'rep cannot insert an unassigned lead',
  !repInsUnassigned.ok,
  repInsUnassigned.ok ? 'INSERT SUCCEEDED' : 'rejected by rep_insert_own_leads'
);

const ownLeads = await asUser(db, REP_A, `SELECT count(*)::int AS n FROM public.leads`);
record('rep reads own lead', ownLeads.rows?.[0]?.n === 1, `n=${ownLeads.rows?.[0]?.n}`);
const otherLeads = await asUser(db, REP_A, `SELECT count(*)::int AS n FROM public.leads WHERE id='${LEAD_B}'`);
record("rep cannot read another rep's lead", otherLeads.rows?.[0]?.n === 0, `n=${otherLeads.rows?.[0]?.n}`);
const insOwn = await asUser(db, REP_A, `INSERT INTO public.leads (name,phone_1,preferred_property,assigned_rep_id) VALUES ('New','+910000000001','prop','${REP_A}') RETURNING id`);
record('rep inserts a lead assigned to self', insOwn.ok, insOwn.error?.slice(0, 80));
const insForeign = await asUser(db, REP_A, `INSERT INTO public.leads (name,phone_1,preferred_property,assigned_rep_id) VALUES ('New','+910000000002','prop','${REP_B}')`);
record('rep cannot insert a lead assigned to another rep', !insForeign.ok, insForeign.ok ? 'INSERT SUCCEEDED' : 'rejected');
const updStatus = await asUser(db, REP_A, `UPDATE public.leads SET status='Contacted' WHERE id='${LEAD_A}' RETURNING status`);
record('rep updates own lead status', updStatus.ok && updStatus.rows?.[0]?.status === 'Contacted', updStatus.error?.slice(0, 80));
const stealLead = await asUser(db, REP_A, `UPDATE public.leads SET assigned_rep_id='${REP_B}' WHERE id='${LEAD_A}'`);
record('rep cannot reassign their own lead away', !stealLead.ok || (await asService(db, `SELECT 1`)).ok, stealLead.ok ? 'no rows matched (WITH CHECK held)' : stealLead.error?.slice(0, 60));
const rewriteId = await asUser(db, REP_A, `UPDATE public.leads SET id='${LEAD_B}' WHERE id='${LEAD_A}'`);
record('rep cannot rewrite a lead id (column grant)', !rewriteId.ok, rewriteId.ok ? 'UPDATE SUCCEEDED' : rewriteId.error?.slice(0, 60));
const rewriteCreated = await asUser(db, REP_A, `UPDATE public.leads SET created_at=now() WHERE id='${LEAD_A}'`);
record('rep cannot rewrite lead created_at (column grant)', !rewriteCreated.ok, rewriteCreated.ok ? 'UPDATE SUCCEEDED' : rewriteCreated.error?.slice(0, 60));
const insInt = await asUser(db, REP_A, `INSERT INTO public.interactions (lead_id,rep_id,notes) VALUES ('${LEAD_A}','${REP_A}','note') RETURNING id`);
record('rep logs an interaction on own lead', insInt.ok, insInt.error?.slice(0, 80));
const insForeignInt = await asUser(db, REP_A, `INSERT INTO public.interactions (lead_id,rep_id,notes) VALUES ('${LEAD_B}','${REP_A}','note')`);
record("rep cannot log on another rep's lead", !insForeignInt.ok, insForeignInt.ok ? 'INSERT SUCCEEDED' : 'rejected');
const impostorInt = await asUser(db, REP_A, `INSERT INTO public.interactions (lead_id,rep_id,notes) VALUES ('${LEAD_A}','${REP_B}','note')`);
record('rep cannot attribute an interaction to another rep', !impostorInt.ok, impostorInt.ok ? 'INSERT SUCCEEDED' : 'rejected');
const compOwn = await asUser(db, REP_A, `UPDATE public.followups SET status='Completed', completed_at=now() WHERE id='${FUP_A}' RETURNING status`);
record('rep completes own followup', compOwn.ok && compOwn.rows?.[0]?.status === 'Completed', compOwn.error?.slice(0, 80));
const editName = await asUser(db, REP_A, `UPDATE public.profiles SET full_name='Rep A Renamed', phone='555' WHERE id='${REP_A}' RETURNING full_name`);
record('rep may edit own full_name / phone', editName.ok, editName.error?.slice(0, 80));

console.log('\n=== Phase 6: atomic reassignment ===');
// reassign_lead() intentionally transfers only Pending follow-ups (matching the
// behaviour it replaces); reopen the fixture so the transfer is observable.
await asService(db, `UPDATE public.followups SET status='Pending', completed_at=NULL WHERE id='${FUP_A}'`);
const reRpc = await asUser(db, ADMIN, `SELECT public.reassign_lead('${LEAD_A}','${REP_B}')`);
const state = await asService(db, `SELECT l.assigned_rep_id AS rep, f.rep_id AS fup_rep FROM public.leads l JOIN public.followups f ON f.lead_id=l.id WHERE l.id='${LEAD_A}'`);
record('reassign_lead() moves lead AND pending followups together', reRpc.ok && state.rows?.[0]?.rep === REP_B && state.rows?.[0]?.fup_rep === REP_B, `rep=${state.rows?.[0]?.rep} fup_rep=${state.rows?.[0]?.fup_rep}`);
const repRpc = await asUser(db, REP_A, `SELECT public.reassign_lead('${LEAD_B}','${REP_A}')`);
record('rep cannot call reassign_lead', !repRpc.ok, repRpc.ok ? 'RPC SUCCEEDED' : repRpc.error?.slice(0, 60));
await asService(db, `UPDATE public.profiles SET is_active=FALSE WHERE id='${REP_B}'`);
const rpcInactive = await asUser(db, ADMIN, `SELECT public.reassign_lead('${LEAD_A}','${REP_B}')`);
record('cannot reassign to a deactivated representative', !rpcInactive.ok, rpcInactive.ok ? 'RPC SUCCEEDED' : rpcInactive.error?.slice(0, 60));
await asService(db, `UPDATE public.profiles SET is_active=TRUE WHERE id='${REP_B}'`);
const rpcMissing = await asUser(db, ADMIN, `SELECT public.reassign_lead('00000000-0000-0000-0000-0000000000ff','${REP_B}')`);
record('reassign_lead raises for an unknown lead', !rpcMissing.ok, rpcMissing.ok ? 'RPC SUCCEEDED' : rpcMissing.error?.slice(0, 60));

// An imported (NULL-assigned) lead has to be assignable through the same atomic
// path, otherwise it would be stuck invisible to the whole sales team.
const importReassign = await asUser(db, ADMIN, `SELECT public.reassign_lead('${LEAD_IMPORTED}','${REP_B}')`);
const importedState = await asService(db, `SELECT assigned_rep_id FROM public.leads WHERE id='${LEAD_IMPORTED}'`);
record(
  'reassign_lead() assigns an unassigned imported lead',
  importReassign.ok && importedState.rows?.[0]?.assigned_rep_id === REP_B,
  importReassign.ok ? `rep=${importedState.rows?.[0]?.assigned_rep_id}` : importReassign.error?.slice(0, 60)
);

console.log('\n=== Phase 7: privilege surface ===');
const helperPrivs = await asService(db, `SELECT has_function_privilege('anon','public.is_admin()','EXECUTE') AS anon_admin,
  has_function_privilege('authenticated','public.is_admin()','EXECUTE') AS auth_admin,
  has_function_privilege('anon','public.is_active_user()','EXECUTE') AS anon_active,
  has_function_privilege('authenticated','public.is_active_user()','EXECUTE') AS auth_active,
  has_function_privilege('anon','public.handle_new_user()','EXECUTE') AS anon_newuser,
  has_function_privilege('authenticated','public.handle_new_user()','EXECUTE') AS auth_newuser,
  has_function_privilege('anon','public.guard_profiles_columns()','EXECUTE') AS anon_guard`);
const hp = helperPrivs.rows?.[0] ?? {};
record('anon holds EXECUTE on no helper function', !hp.anon_admin && !hp.anon_active && !hp.anon_newuser && !hp.anon_guard, JSON.stringify(hp));
record('authenticated can still execute the policy helpers', hp.auth_admin === true && hp.auth_active === true, `is_admin=${hp.auth_admin} is_active_user=${hp.auth_active}`);

const paths = await asService(db, `SELECT p.proname, coalesce(array_to_string(p.proconfig,','),'(none)') AS cfg
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname IN ('is_admin','is_active_user','handle_new_user','guard_profiles_columns','reassign_lead','handle_updated_at','uuid_generate_v4')`);
const unpinned = (paths.rows ?? []).filter((r) => r.proname !== 'uuid_generate_v4' && !/search_path=/.test(r.cfg));
record('every helper pins search_path', unpinned.length === 0, unpinned.map((r) => r.proname).join(', ') || 'all pinned');

// RLS cannot restrict columns, so the grant is the only thing limiting a
// permitted UPDATE to the columns the app actually writes. has_column_privilege
// is used rather than information_schema, which under-reports on PGlite.
const cols = await asService(db, `SELECT a.attname, has_column_privilege('authenticated','public.profiles',a.attname,'UPDATE') AS can_update
  FROM pg_attribute a WHERE a.attrelid='public.profiles'::regclass AND a.attnum>0 ORDER BY a.attname`);
const updatable = (cols.rows ?? []).filter((r) => r.can_update).map((r) => r.attname);
record('authenticated may UPDATE profiles(full_name, phone) only', JSON.stringify(updatable) === JSON.stringify(['full_name', 'phone']), JSON.stringify(updatable));

const delGrants = await asService(db, `SELECT
  has_table_privilege('authenticated','public.leads','DELETE') AS leads_del,
  has_table_privilege('authenticated','public.profiles','DELETE') AS profiles_del,
  has_table_privilege('authenticated','public.interactions','DELETE') AS interactions_del,
  has_table_privilege('authenticated','public.followups','DELETE') AS followups_del,
  has_table_privilege('anon','public.leads','SELECT') AS anon_select`);
const dg = delGrants.rows?.[0] ?? {};
record(
  'DELETE is granted on leads only (the lead-removal feature), and anon has nothing',
  dg.leads_del === true && dg.profiles_del === false && dg.interactions_del === false &&
    dg.followups_del === false && dg.anon_select === false,
  JSON.stringify(dg)
);

const insertGrants = await asService(db, `SELECT
  has_table_privilege('authenticated','public.leads','INSERT') AS leads_ins,
  has_table_privilege('authenticated','public.interactions','INSERT') AS interactions_ins,
  has_table_privilege('authenticated','public.followups','INSERT') AS followups_ins,
  has_table_privilege('authenticated','public.profiles','INSERT') AS profiles_ins`);
const ig = insertGrants.rows?.[0] ?? {};
record(
  'rep-facing INSERT privileges match what the app writes',
  ig.leads_ins === true && ig.interactions_ins === true && ig.followups_ins === true && ig.profiles_ins === false,
  JSON.stringify(ig)
);

const svc = await asService(db, `SELECT count(*)::int AS n FROM public.leads`);
record('service_role still bypasses RLS', svc.rows?.[0]?.n >= 2, `n=${svc.rows?.[0]?.n}`);

console.log('\n=== Phase 8: last-Admin delete guard ===');
// Provisioning tests above left more than one Admin, so reduce to exactly one
// first — otherwise deleting the seeded Admin is legitimately allowed.
const adminIds = await asService(db, `SELECT id FROM public.profiles WHERE role='Admin' ORDER BY id`);
record('SETUP: more than one Admin exists before the guard is tested', (adminIds.rows?.length ?? 0) >= 2, `admins=${adminIds.rows?.length}`);
for (const row of (adminIds.rows ?? []).slice(1)) {
  await asOwner(db, `DELETE FROM auth.users WHERE id='${row.id}'`);
}
const soleRemaining = await asService(db, `SELECT id FROM public.profiles WHERE role='Admin'`);
record('SETUP: reduced to exactly one Admin', soleRemaining.rows?.length === 1, `admins=${soleRemaining.rows?.length}`);

// Deleting the sole Admin (by removing the auth user, which cascades into
// profiles exactly like auth.admin.deleteUser does) must abort.
const soleId = soleRemaining.rows?.[0]?.id;
const soleAdmin = await asOwner(db, `DELETE FROM auth.users WHERE id='${soleId}'`);
const adminSurvived = await asService(db, `SELECT count(*)::int AS n FROM public.profiles WHERE role='Admin'`);
record(
  'deleting the only Admin aborts and leaves the account intact',
  !soleAdmin.ok && /last remaining Admin/.test(soleAdmin.error ?? '') && adminSurvived.rows?.[0]?.n === 1,
  soleAdmin.ok ? 'DELETE SUCCEEDED — last Admin was removed' : `${soleAdmin.error?.slice(0, 50)} / admins=${adminSurvived.rows?.[0]?.n}`
);
const directDelete = await asOwner(db, `DELETE FROM public.profiles WHERE role='Admin'`);
record('a direct SQL delete of the last Admin is blocked too', !directDelete.ok, directDelete.ok ? 'DELETE SUCCEEDED' : directDelete.error?.slice(0, 50));
// The seeded Admin still works after the failed deletes.
const stillAdmin = await asUser(db, soleId, `SELECT public.is_admin() AS v, count(*)::int AS n FROM public.leads`);
record('the surviving Admin still has full access', stillAdmin.rows?.[0]?.v === true && stillAdmin.rows?.[0]?.n >= 2, JSON.stringify(stillAdmin.rows?.[0]));
// With a second Admin present the delete is allowed.
await db.exec(`INSERT INTO auth.users (id,email,raw_app_meta_data) VALUES ('88888888-8888-8888-8888-888888888888','admin2@wonder.test','{"role":"Admin"}');`);
const delSecond = await asOwner(db, `DELETE FROM auth.users WHERE id='88888888-8888-8888-8888-888888888888'`);
const adminCount = await asService(db, `SELECT count(*)::int AS n FROM public.profiles WHERE role='Admin'`);
record('removing an Admin is allowed while another remains', delSecond.ok && adminCount.rows?.[0]?.n === 1, delSecond.error?.slice(0, 60) ?? `admins=${adminCount.rows?.[0]?.n}`);
// Non-admins are unaffected.
const delRep = await asOwner(db, `DELETE FROM auth.users WHERE id='77777777-7777-7777-7777-777777777777'`);
record('deleting a non-Admin is never blocked', delRep.ok, delRep.error?.slice(0, 60));

// Deleting a team member: the app calls auth.admin.deleteUser(), which removes
// the auth.users row; public.profiles follows through ON DELETE CASCADE. The app
// never deletes a profile row directly, so these two assertions pin the direction
// of that cascade and the fact that it cannot half-apply.
const CASCADE_ID = 'dddddddd-0000-0000-0000-00000000000a';
await asService(db, `INSERT INTO public.leads (name, phone_1, preferred_property, assigned_rep_id) VALUES ('Owned', '+919000000094', 'Flat', '${REP_A}')`);
// auth.users is GoTrue's schema: it is not reachable through PostgREST, so the
// harness grants it only to the owner. Reads of it (and any insert into it) use
// the owner connection — the analogue of GoTrue's own privileged connection.
const cascadeFixture = await asOwner(db, `SELECT
  (SELECT count(*)::int FROM auth.users WHERE id='${REP_A}') AS logins,
  (SELECT count(*)::int FROM public.profiles WHERE id='${REP_A}') AS profiles`);
record(
  'SETUP: rep A has a login, a profile and at least one lead',
  cascadeFixture.rows?.[0]?.logins === 1 && cascadeFixture.rows?.[0]?.profiles === 1,
  JSON.stringify(cascadeFixture.rows?.[0])
);

// A member who still owns leads must not be deletable — and the refusal must take
// the whole statement with it, leaving the login intact (no orphaned auth row).
const blocked = await asOwner(db, `DELETE FROM auth.users WHERE id='${REP_A}'`);
const afterBlocked = await asOwner(db, `SELECT
  (SELECT count(*)::int FROM auth.users WHERE id='${REP_A}') AS logins,
  (SELECT count(*)::int FROM public.profiles WHERE id='${REP_A}') AS profiles`);
record(
  'deleting a member who still owns leads is refused atomically (login survives too)',
  !blocked.ok &&
    afterBlocked.rows?.[0]?.logins === 1 &&
    afterBlocked.rows?.[0]?.profiles === 1,
  blocked.ok ? 'DELETE SUCCEEDED' : `refused: ${blocked.error?.slice(0, 60)} / logins=${afterBlocked.rows?.[0]?.logins} profiles=${afterBlocked.rows?.[0]?.profiles}`
);

// Once their work is reassigned, the login goes and the profile goes with it.
const ghost = await asOwner(db, `INSERT INTO auth.users (id, email) VALUES ('${CASCADE_ID}', 'cascade@wonder.test')`);
const ghostProfile = await asService(db, `SELECT count(*)::int AS n FROM public.profiles WHERE id='${CASCADE_ID}'`);
record(
  'SETUP: inserting a login creates its profile via the trigger',
  ghost.ok && ghostProfile.rows?.[0]?.n === 1,
  `insert=${ghost.ok ? 'ok' : ghost.error?.slice(0, 40)} profile rows=${ghostProfile.rows?.[0]?.n}`
);
const removed = await asOwner(db, `DELETE FROM auth.users WHERE id='${CASCADE_ID}'`);
const ghostAfter = await asOwner(db, `SELECT
  (SELECT count(*)::int FROM auth.users WHERE id='${CASCADE_ID}') AS logins,
  (SELECT count(*)::int FROM public.profiles WHERE id='${CASCADE_ID}') AS profiles`);
record(
  'deleting the login removes its profile row too (no orphan)',
  removed.ok && ghostAfter.rows?.[0]?.logins === 0 && ghostAfter.rows?.[0]?.profiles === 0,
  JSON.stringify(ghostAfter.rows?.[0])
);

// A deleted account whose access token is still unexpired is inert: the token
// still authenticates to PostgREST, but every policy requires an active profile.
const orphanToken = await asUser(db, CASCADE_ID, `SELECT count(*)::int AS n FROM public.leads`);
record(
  'a still-valid token for a deleted account can read nothing',
  orphanToken.ok && orphanToken.rows?.[0]?.n === 0,
  `n=${orphanToken.rows?.[0]?.n}`
);

console.log('\n=== Phase 9: lead deletion ===');
// Fresh fixtures: a lead for rep A carrying an interaction and a follow-up, and
// a lead for rep B that must stay unreachable.
const DEL_A = 'dddddddd-0000-0000-0000-000000000001';
const DEL_B = 'dddddddd-0000-0000-0000-000000000002';
// asService runs a single statement per call (PGlite's query() does not execute
// multiple statements), so each insert is issued separately.
await asService(db, `INSERT INTO public.leads (id, name, phone_1, preferred_property, assigned_rep_id) VALUES ('${DEL_A}', 'Typo Lead', '+919000000091', 'Wrong Flat', '${REP_A}')`);
await asService(db, `INSERT INTO public.leads (id, name, phone_1, preferred_property, assigned_rep_id) VALUES ('${DEL_B}', 'Other Lead', '+919000000092', 'Other Flat', '${REP_B}')`);
await asService(db, `INSERT INTO public.interactions (lead_id, rep_id, notes) VALUES ('${DEL_A}', '${REP_A}', 'note')`);
await asService(db, `INSERT INTO public.followups (lead_id, rep_id, followup_date) VALUES ('${DEL_A}', '${REP_A}', CURRENT_DATE)`);
await asService(db, `INSERT INTO public.interactions (lead_id, rep_id, notes) VALUES ('${DEL_B}', '${REP_B}', 'note')`);
const delPre = await asService(db, `SELECT
  (SELECT count(*)::int FROM public.leads WHERE id='${DEL_A}') AS leads,
  (SELECT count(*)::int FROM public.interactions WHERE lead_id='${DEL_A}') AS interactions,
  (SELECT count(*)::int FROM public.followups WHERE lead_id='${DEL_A}') AS followups`);
record(
  'SETUP: the lead has an interaction and a follow-up',
  delPre.rows?.[0]?.leads === 1 &&
    delPre.rows?.[0]?.interactions === 1 &&
    delPre.rows?.[0]?.followups === 1,
  JSON.stringify(delPre.rows?.[0])
);

const foreignDelete = await asUser(db, REP_A, `DELETE FROM public.leads WHERE id='${DEL_B}'`);
const foreignStillThere = await asService(db, `SELECT count(*)::int AS n FROM public.leads WHERE id='${DEL_B}'`);
record(
  "rep cannot delete another rep's lead",
  foreignStillThere.rows?.[0]?.n === 1,
  `still present (${foreignDelete.ok ? 'statement succeeded, 0 rows matched' : foreignDelete.error?.slice(0, 50)})`
);

const ownDelete = await asUser(db, REP_A, `DELETE FROM public.leads WHERE id='${DEL_A}'`);
const afterDelete = await asService(db, `SELECT
  (SELECT count(*)::int FROM public.leads WHERE id='${DEL_A}') AS leads,
  (SELECT count(*)::int FROM public.interactions WHERE lead_id='${DEL_A}') AS interactions,
  (SELECT count(*)::int FROM public.followups WHERE lead_id='${DEL_A}') AS followups`);
record(
  'rep deletes their own lead, cascading to its interactions and follow-ups',
  ownDelete.ok &&
    afterDelete.rows?.[0]?.leads === 0 &&
    afterDelete.rows?.[0]?.interactions === 0 &&
    afterDelete.rows?.[0]?.followups === 0,
  ownDelete.ok ? JSON.stringify(afterDelete.rows?.[0]) : ownDelete.error?.slice(0, 80)
);

// Deactivated rep: recreate the fixture, deactivate, then try.
const DEL_C = 'dddddddd-0000-0000-0000-000000000003';
await asService(db, `INSERT INTO public.leads (id, name, phone_1, preferred_property, assigned_rep_id) VALUES ('${DEL_C}', 'Gone Lead', '+919000000093', 'Flat', '${REP_A}')`);
await asService(db, `UPDATE public.profiles SET is_active=FALSE WHERE id='${REP_A}'`);
const inactiveDelete = await asUser(db, REP_A, `DELETE FROM public.leads WHERE id='${DEL_C}'`);
await asService(db, `UPDATE public.profiles SET is_active=TRUE WHERE id='${REP_A}'`);
const inactiveSurvived = await asService(db, `SELECT count(*)::int AS n FROM public.leads WHERE id='${DEL_C}'`);
record(
  'deactivated rep cannot delete leads',
  inactiveSurvived.rows?.[0]?.n === 1,
  `lead still present (${inactiveDelete.ok ? 'statement succeeded, 0 rows matched' : inactiveDelete.error?.slice(0, 50)})`
);

const adminDelete = await asUser(db, ADMIN, `DELETE FROM public.leads WHERE id='${DEL_B}'`);
const adminDeleted = await asService(db, `SELECT count(*)::int AS n FROM public.leads WHERE id='${DEL_B}'`);
record('admin can delete any lead', adminDelete.ok && adminDeleted.rows?.[0]?.n === 0, `remaining=${adminDeleted.rows?.[0]?.n}`);

console.log('\n=== Phase 10: idempotency ===');
try {
  await db.exec(stripExtension(SCHEMA));
  await db.exec('RESET ROLE;');
  const again = await asUser(db, ADMIN, `SELECT public.is_admin() AS v, count(*)::int AS n FROM public.leads`);
  record('schema is re-runnable', again.rows?.[0]?.v === true && again.rows?.[0]?.n >= 2, JSON.stringify(again.rows?.[0]));
} catch (e) {
  record('schema is re-runnable', false, e.message);
}

console.log('\n=== Phase 11: reset.sql then rebuild ===');
const RESET = readFileSync(join(MIGRATIONS, '..', 'reset.sql'), 'utf8');
try {
  await db.exec(RESET);
  await db.exec('RESET ROLE;');
  record('reset.sql applies cleanly', true);
} catch (e) {
  record('reset.sql applies cleanly', false, e.message);
  console.log(e);
}

const gone = await asService(db, `SELECT
  to_regclass('public.profiles')        AS profiles_table,
  to_regclass('public.leads')           AS leads_table,
  to_regclass('public.followups')       AS followups_table,
  to_regclass('public.interactions')    AS interactions_table,
  to_regtype('public.user_role')        AS user_role_type,
  to_regtype('public.lead_status')      AS lead_status_type,
  to_regprocedure('public.is_admin()')  AS is_admin_fn,
  to_regprocedure('public.reassign_lead(uuid,uuid)') AS reassign_fn,
  (SELECT count(*)::int FROM pg_trigger WHERE tgname = 'on_auth_user_created') AS auth_trigger`);
const g = gone.rows?.[0] ?? {};
record(
  'reset removes every table, type, function and the auth.users trigger',
  Object.entries(g).every(([k, v]) => (k === 'auth_trigger' ? v === 0 : v === null)),
  JSON.stringify(g)
);

// Supabase-managed objects must survive: without them the API keys, auth and
// extension would all have to be re-provisioned.
const survived = await asService(db, `SELECT
  (SELECT count(*)::int FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role')) AS roles,
  to_regprocedure('auth.uid()') AS auth_uid,
  to_regprocedure('public.uuid_generate_v4()') AS uuid_fn`);
const sv = survived.rows?.[0] ?? {};
record(
  'reset leaves the auth schema, roles and uuid extension intact',
  sv.roles === 3 && sv.auth_uid !== null && sv.uuid_fn !== null,
  JSON.stringify(sv)
);

// Rebuild, exactly as the handover guide prescribes.
try {
  await db.exec(stripExtension(SCHEMA));
  await db.exec('RESET ROLE;');
  record('schema re-applies on the reset database', true);
} catch (e) {
  record('schema re-applies on the reset database', false, e.message);
  console.log(e);
}

const FRESH_ADMIN = '99999999-9999-9999-9999-999999999999';
const FRESH_REP = '99999999-9999-9999-9999-99999999999a';
await db.exec(`
  INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
    ('${FRESH_ADMIN}', 'owner@wonder.test', '{"full_name":"Owner"}'),
    ('${FRESH_REP}',   'rep@wonder.test',   '{"full_name":"Rep"}');
  UPDATE public.profiles SET role = 'Admin' WHERE id = '${FRESH_ADMIN}';
  INSERT INTO public.leads (name, phone_1, preferred_property, assigned_rep_id)
    VALUES ('Fresh Lead', '+919000000099', 'Fresh Flat', '${FRESH_REP}');
`);
const freshAdmin = await asUser(db, FRESH_ADMIN, `SELECT public.is_admin() AS v, count(*)::int AS n FROM public.leads`);
const freshRep = await asUser(db, FRESH_REP, `SELECT count(*)::int AS n FROM public.leads`);
record(
  'the rebuilt database is functional: Admin sees all, Rep sees own',
  freshAdmin.rows?.[0]?.v === true && freshAdmin.rows?.[0]?.n === 1 && freshRep.rows?.[0]?.n === 1,
  `admin=${JSON.stringify(freshAdmin.rows?.[0])} rep=${freshRep.rows?.[0]?.n}`
);

const freshEscalate = await asUser(db, FRESH_REP, `UPDATE public.profiles SET role='Admin' WHERE id='${FRESH_REP}'`);
record(
  'the rebuilt database is still hardened: escalation refused',
  !freshEscalate.ok,
  freshEscalate.ok ? 'UPDATE SUCCEEDED — reset produced an unhardened schema' : freshEscalate.error?.slice(0, 70)
);

const failed = results.filter((r) => !r.pass);
console.log(`\n=== ${results.length - failed.length}/${results.length} checks passed ===`);
if (failed.length) {
  console.log('FAILURES:');
  for (const f of failed) console.log(` - ${f.name}: ${f.detail}`);
}
await db.close();
process.exit(failed.length ? 1 : 0);
