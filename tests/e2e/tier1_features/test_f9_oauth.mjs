/**
 * Tier 1: Feature F9 - Supabase Google OAuth & Callback
 * Authoritative source: ORIGINAL_REQUEST.md (R2), MASTER_PLAN.md (Part 2 Principle 1, Part 7 Phase 1), PROJECT.md (Feature F9)
 */

import fs from 'node:fs';
import path from 'node:path';
import { assert, assertEqual, assertIncludes } from '../helpers/assertions.mjs';
import { WEB_ROOT, registry } from '../helpers/test_context.mjs';

registry.setSuite('Tier 1 - F9 Google OAuth & Callback', 'Tier 1', 'F9');

export async function runF9Tests() {
  const loginFormPath = path.join(WEB_ROOT, 'components/login-form.tsx');
  const signUpFormPath = path.join(WEB_ROOT, 'components/sign-up-form.tsx');
  const callbackRoutePath = path.join(WEB_ROOT, 'app/auth/callback/route.ts');

  await registry.runTest('F9-01: Login form renders Google OAuth button', async () => {
    assert(fs.existsSync(loginFormPath), 'components/login-form.tsx must exist');
    const content = fs.readFileSync(loginFormPath, 'utf-8');
    assert(
      content.includes('Google') || content.includes('google'),
      'Login form must render a Google sign-in option'
    );
  });

  await registry.runTest('F9-02: Sign-up form renders Google OAuth button', async () => {
    assert(fs.existsSync(signUpFormPath), 'components/sign-up-form.tsx must exist');
    const content = fs.readFileSync(signUpFormPath, 'utf-8');
    assert(
      content.includes('Google') || content.includes('google'),
      'Sign-up form must render a Google sign-up option'
    );
  });

  await registry.runTest('F9-03: Google OAuth buttons invoke signInWithOAuth with google provider', async () => {
    const loginContent = fs.readFileSync(loginFormPath, 'utf-8');
    const signUpContent = fs.readFileSync(signUpFormPath, 'utf-8');
    const hasOAuthInLogin = loginContent.includes('signInWithOAuth') && (loginContent.includes('"google"') || loginContent.includes("'google'"));
    const hasOAuthInSignUp = signUpContent.includes('signInWithOAuth') && (signUpContent.includes('"google"') || signUpContent.includes("'google'"));
    assert(hasOAuthInLogin || hasOAuthInSignUp, 'Forms must invoke signInWithOAuth({ provider: "google" })');
  });

  await registry.runTest('F9-04: web/app/auth/callback/route.ts route handler exists', async () => {
    assert(fs.existsSync(callbackRoutePath), 'web/app/auth/callback/route.ts must exist for OAuth code exchange');
  });

  await registry.runTest('F9-05: OAuth callback exchanges code for session and redirects', async () => {
    assert(fs.existsSync(callbackRoutePath), 'Callback route must exist');
    const content = fs.readFileSync(callbackRoutePath, 'utf-8');
    assertIncludes(content, 'exchangeCodeForSession', 'Callback route must call exchangeCodeForSession');
    assert(
      content.includes('redirect(') || content.includes('NextResponse.redirect('),
      'Callback route must redirect user upon session creation'
    );
  });
}

if (process.argv[1]?.endsWith('test_f9_oauth.mjs')) {
  runF9Tests().then(() => {
    const summary = registry.getSummary();
    console.log(JSON.stringify(summary, null, 2));
    process.exit(summary.failed > 0 ? 1 : 0);
  });
}
