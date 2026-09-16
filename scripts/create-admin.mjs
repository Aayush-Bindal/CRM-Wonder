// Provision a team member — normally used once, for the first Administrator.
//
//   bun run create-admin
//   bun run create-admin -- --email owner@example.com --name "Owner Name"
//   bun run create-admin -- --email rep@example.com --name "Rep" --role Sales_Rep
//
// The password is prompted for and never echoed, so it does not end up in your
// shell history. Pipe it instead if you are scripting:
//
//   echo 'TheirPassword9' | bun run create-admin -- --email x@y.com --name "X"
//
// This is the same call the app's User Management screen makes, and the same one
// documented in supabase/README.md §4: the role travels in app_metadata because
// that is the only metadata a user cannot write themselves. The matching
// public.profiles row is created by the on_auth_user_created trigger.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const readEnvFile = () => {
  const out = {};
  let text = '';
  try {
    text = readFileSync(join(ROOT, '.env'), 'utf8');
  } catch {
    return out;
  }
  for (const line of text.split('\n')) {
    if (line.trim().startsWith('#') || !line.includes('=')) continue;
    const i = line.indexOf('=');
    out[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
  return out;
};

const env = { ...readEnvFile(), ...process.env };
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.');
  process.exit(1);
}

const argv = process.argv.slice(2);
const flag = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? undefined : argv[i + 1];
};

const ask = (question) =>
  new Promise((resolve) => {
    process.stdout.write(question);
    let value = '';
    const stdin = process.stdin;
    const isTty = stdin.isTTY === true;
    if (isTty && typeof stdin.setRawMode === 'function') {
      stdin.setRawMode(true);
      stdin.resume();
      stdin.setEncoding('utf8');
      const onData = (chunk) => {
        for (const ch of chunk) {
          if (ch === '\r' || ch === '\n') {
            stdin.setRawMode(false);
            stdin.pause();
            stdin.off('data', onData);
            process.stdout.write('\n');
            return resolve(value);
          }
          if (ch === '\u0003') {
            stdin.setRawMode(false);
            process.stdout.write('\n');
            process.exit(130);
          }
          if (ch === '\u007f' || ch === '\b') {
            value = value.slice(0, -1);
            continue;
          }
          value += ch;
        }
      };
      stdin.on('data', onData);
      return;
    }
    // Not a TTY: read one line (supports piping).
    stdin.setEncoding('utf8');
    stdin.once('data', (chunk) => resolve(String(chunk).split('\n')[0].trim()));
  });

const email = (flag('email') ?? (await ask('Email: '))).trim();
const fullName = (flag('name') ?? (await ask('Full name: '))).trim();
const role = flag('role') === 'Sales_Rep' ? 'Sales_Rep' : 'Admin';
const password = flag('password') ?? (await ask(`Password for ${email} (min 8 chars): `));

if (!email || !fullName) {
  console.error('An email and a full name are required.');
  process.exit(1);
}
if (password.length < 8) {
  console.error('The password must be at least 8 characters (the app enforces this too).');
  process.exit(1);
}

if (flag('password')) {
  console.warn('Note: --password puts the value in your shell history and process list.');
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: created, error } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  app_metadata: { role },
  user_metadata: { full_name: fullName },
});

if (error || !created.user) {
  console.error(`\nCould not create ${email}: ${error?.message ?? 'unknown error'}`);
  if (error?.code === 'email_exists' || /already been registered/i.test(error?.message ?? '')) {
    console.error(`\nThat login already exists, so no profile was created for it. To use it, promote it:`);
    console.error(`  UPDATE public.profiles SET role = '${role}' WHERE email = '${email}';`);
    console.error(`If no profile row exists either, create it:`);
    console.error(
      `  INSERT INTO public.profiles (id, full_name, email, role)\n` +
        `  SELECT id, '${fullName}', email, '${role}' FROM auth.users WHERE email = '${email}'\n` +
        `  ON CONFLICT (id) DO NOTHING;`
    );
  }
  process.exit(1);
}

// Confirm the sync trigger did its job.
const { data: profile, error: profileError } = await supabase
  .from('profiles')
  .select('id, full_name, email, role, is_active')
  .eq('id', created.user.id)
  .single();

if (profileError || !profile) {
  console.error(`\nLogin created, but no profile row was found for it.`);
  console.error(`The on_auth_user_created trigger may be missing — check that`);
  console.error(`supabase/migrations/20260915_initial_schema_and_rls.sql has been applied.`);
  process.exit(1);
}

console.log(`\nCreated:`);
console.log(`  ${profile.full_name} <${profile.email}>`);
console.log(`  role: ${profile.role}   active: ${profile.is_active}`);
console.log(`\nSign in with that email and password.`);
if (profile.role === 'Admin') {
  console.log(`Everyone else is created from User Management once you are in.`);
}
