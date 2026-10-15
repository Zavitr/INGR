/**
 * Tier 1: Feature F8 - Supabase Email/Password Auth
 * Authoritative source: ORIGINAL_REQUEST.md (R2), MASTER_PLAN.md (Part 7 Phase 1), PROJECT.md (Feature F8)
 */

import fs from 'node:fs';
import path from 'node:path';
import { assert, assertEqual, assertIncludes } from '../helpers/assertions.mjs';
import { WEB_ROOT, registry } from '../helpers/test_context.mjs';

registry.setSuite('Tier 1 - F8 Supabase Email/Password Auth', 'Tier 1', 'F8');

export async function runF8Tests() {
  const signUpFormPath = path.join(WEB_ROOT, 'components/sign-up-form.tsx');
  const loginFormPath = path.join(WEB_ROOT, 'components/login-form.tsx');
  const forgotPasswordPath = path.join(WEB_ROOT, 'components/forgot-password-form.tsx');
  const updatePasswordPath = path.join(WEB_ROOT, 'components/update-password-form.tsx');
  const confirmRoutePath = path.join(WEB_ROOT, 'app/auth/confirm/route.ts');

  await registry.runTest('F8-01: Sign-up form contains email, password, and repeat password fields', async () => {
    assert(fs.existsSync(signUpFormPath), 'components/sign-up-form.tsx must exist');
    const content = fs.readFileSync(signUpFormPath, 'utf-8');
    assertIncludes(content, 'type="email"', 'Sign-up form must contain email input');
    assertIncludes(content, 'type="password"', 'Sign-up form must contain password input');
    assertIncludes(content, 'repeatPassword', 'Sign-up form must handle password repetition/confirmation');
    assertIncludes(content, 'signUp(', 'Sign-up form must call Supabase signUp');
  });

  await registry.runTest('F8-02: Login form contains email and password inputs with validation', async () => {
    assert(fs.existsSync(loginFormPath), 'components/login-form.tsx must exist');
    const content = fs.readFileSync(loginFormPath, 'utf-8');
    assertIncludes(content, 'type="email"', 'Login form must contain email input');
    assertIncludes(content, 'type="password"', 'Login form must contain password input');
    assertIncludes(content, 'signInWithPassword(', 'Login form must call Supabase signInWithPassword');
    assertIncludes(content, 'href="/auth/forgot-password"', 'Login form must link to forgot-password');
  });

  await registry.runTest('F8-03: Forgot-password form contains email input and calls resetPasswordForEmail', async () => {
    assert(fs.existsSync(forgotPasswordPath), 'components/forgot-password-form.tsx must exist');
    const content = fs.readFileSync(forgotPasswordPath, 'utf-8');
    assertIncludes(content, 'type="email"', 'Forgot password form must have email input');
    assertIncludes(content, 'resetPasswordForEmail(', 'Form must invoke Supabase resetPasswordForEmail');
  });

  await registry.runTest('F8-04: Update-password form permits setting new password via updateUser', async () => {
    assert(fs.existsSync(updatePasswordPath), 'components/update-password-form.tsx must exist');
    const content = fs.readFileSync(updatePasswordPath, 'utf-8');
    assertIncludes(content, 'type="password"', 'Update password form must have password input');
    assertIncludes(content, 'updateUser(', 'Form must call Supabase updateUser');
  });

  await registry.runTest('F8-05: Auth confirm route handles email OTP token verification', async () => {
    assert(fs.existsSync(confirmRoutePath), 'app/auth/confirm/route.ts must exist');
    const content = fs.readFileSync(confirmRoutePath, 'utf-8');
    assertIncludes(content, 'token_hash', 'Confirm route must extract token_hash query param');
    assertIncludes(content, 'verifyOtp(', 'Confirm route must call Supabase verifyOtp');
  });
}

if (process.argv[1]?.endsWith('test_f8_auth.mjs')) {
  runF8Tests().then(() => {
    const summary = registry.getSummary();
    console.log(JSON.stringify(summary, null, 2));
    process.exit(summary.failed > 0 ? 1 : 0);
  });
}
