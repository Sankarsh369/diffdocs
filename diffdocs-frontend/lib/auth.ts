"use client";

// Thin client-side session layer for "Sign in with GitHub".
//
// The backend issues a signed JWT after the OAuth handshake and redirects
// back to this app with it in a `session_token` query param (see
// diffdocs-backend/auth.py). We store it in localStorage and attach it as a
// Bearer token on every authenticated API call — no cross-domain cookies
// needed, since the frontend (Vercel) and backend (Render) live on
// different top-level domains.

const STORAGE_KEY = "diffdocs_session_token";

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export interface SocialAccount {
  provider: string | null;
  url: string | null;
}

export interface DiffDocsUser {
  login: string;
  name: string;
  avatar_url: string | null;
  // Everything below is genuinely available from GitHub's own profile data —
  // note there is no date of birth, gender, or age in GitHub's data model,
  // so those fields simply don't exist here.
  email?: string | null;
  bio?: string | null;
  company?: string | null;
  location?: string | null;
  blog?: string | null;
  followers?: number | null;
  public_repos?: number | null;
  github_created_at?: string | null;
  social_accounts?: SocialAccount[];
}

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null; // localStorage can throw in privacy-locked browser contexts
  }
}

export function storeToken(token: string) {
  try {
    window.localStorage.setItem(STORAGE_KEY, token);
  } catch {
    // Nothing we can do if storage is blocked — the session just won't persist.
  }
}

export function clearToken() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function redirectToLogin() {
  window.location.href = `${API_BASE_URL}/auth/github/login`;
}

/**
 * Pulls a `session_token` left in the URL by the OAuth callback redirect,
 * stores it, and cleans the URL. Also scrubs `auth_error` (set when the user
 * declines GitHub's consent screen) so it doesn't linger in the address bar.
 */
export function consumeSessionTokenFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const token = params.get("session_token");
  const hadAuthError = params.has("auth_error");

  if (token) storeToken(token);
  params.delete("session_token");
  params.delete("auth_error");

  if (token || hadAuthError) {
    const cleanUrl = `${window.location.pathname}${params.toString() ? `?${params}` : ""}`;
    window.history.replaceState({}, "", cleanUrl);
  }

  return token;
}

export async function fetchCurrentUser(token: string): Promise<DiffDocsUser | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

/** fetch() wrapper that attaches the current session's Authorization header. */
export function authorizedFetch(path: string, token: string, init: RequestInit = {}) {
  return fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${token}` },
  });
}
