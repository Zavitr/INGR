/**
 * HTTP Client Helper for Headless Activepieces Engine and Web Server
 */

import { CONFIG } from './test_context.mjs';

export async function fetchFlags(baseUrl = CONFIG.engineUrl) {
  const res = await fetch(`${baseUrl}/api/v1/flags`);
  const status = res.status;
  const data = await res.json().catch(() => null);
  return { status, data };
}

export async function fetchHealth(baseUrl = CONFIG.engineUrl) {
  const res = await fetch(`${baseUrl}/api/v1/health`);
  const status = res.status;
  const data = await res.json().catch(() => null);
  return { status, data };
}

export async function adminSignIn(email = CONFIG.adminEmail, password = CONFIG.adminPassword, baseUrl = CONFIG.engineUrl) {
  const res = await fetch(`${baseUrl}/api/v1/authentication/sign-in`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const status = res.status;
  const data = await res.json().catch(() => null);
  return { status, data };
}

export async function fetchPieces(token, baseUrl = CONFIG.engineUrl) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${baseUrl}/api/v1/pieces`, { headers });
  const status = res.status;
  const data = await res.json().catch(() => null);
  return { status, data };
}

export async function listAppConnections(token, projectId = CONFIG.expectedProjectId, baseUrl = CONFIG.engineUrl) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const url = projectId ? `${baseUrl}/api/v1/app-connections?projectId=${projectId}` : `${baseUrl}/api/v1/app-connections`;
  const res = await fetch(url, { headers });
  const status = res.status;
  const data = await res.json().catch(() => null);
  return { status, data };
}

export async function createAppConnection(token, payload, baseUrl = CONFIG.engineUrl) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${baseUrl}/api/v1/app-connections`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  const status = res.status;
  const data = await res.json().catch(() => null);
  return { status, data };
}

export async function deleteAppConnection(token, connectionId, baseUrl = CONFIG.engineUrl) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${baseUrl}/api/v1/app-connections/${connectionId}`, {
    method: 'DELETE',
    headers,
  });
  const status = res.status;
  const text = await res.text().catch(() => '');
  return { status, text };
}

export async function fetchFlows(token, projectId = CONFIG.expectedProjectId, baseUrl = CONFIG.engineUrl) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${baseUrl}/api/v1/flows?projectId=${projectId}`, { headers });
  const status = res.status;
  const data = await res.json().catch(() => null);
  return { status, data };
}
