"use client";

import React, { useState } from "react";
import { LogOut, RefreshCw, ShieldAlert } from "lucide-react";
import { DiffDocsUser } from "../lib/auth";

interface AccessDeniedScreenProps {
  user: DiffDocsUser;
  onSignOut: () => void;
  onRetry: () => Promise<void>;
}

export default function AccessDeniedScreen({ user, onSignOut, onRetry }: AccessDeniedScreenProps) {
  const [checking, setChecking] = useState(false);

  const githubAppSlug = process.env.NEXT_PUBLIC_GITHUB_APP_SLUG;
  const installHref = githubAppSlug ? `https://github.com/apps/${githubAppSlug}/installations/new` : undefined;

  const handleCheckAgain = async () => {
    setChecking(true);
    try {
      await onRetry();
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-zinc-950 text-zinc-100 px-6">
      <div className="w-full max-w-sm text-center space-y-6">
        <div className="mx-auto h-12 w-12 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center justify-center text-rose-400">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <div className="space-y-2">
          <h1 className="text-lg font-bold tracking-tight text-white">No repositories connected</h1>
          <p className="text-sm text-zinc-500">
            You&apos;re signed in as <span className="font-mono text-zinc-300">@{user.login}</span>, but this
            DiffDocs instance&apos;s data belongs to whichever GitHub account installed the App. Install it on
            your own repositories to see your own data here.
          </p>
        </div>

        <div className="space-y-2.5">
          {installHref ? (
            <a
              href={installHref}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2.5 px-4 py-3 bg-white hover:bg-zinc-200 text-zinc-900 font-semibold rounded-xl transition-all shadow-md cursor-pointer"
            >
              <svg className="h-4 w-4 fill-zinc-900" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              Install GitHub App on my repos
            </a>
          ) : (
            <p className="text-xs text-rose-400/80 border border-rose-500/20 bg-rose-500/5 rounded-xl p-3">
              The GitHub App isn&apos;t configured for direct install yet — ask the instance owner to set
              NEXT_PUBLIC_GITHUB_APP_SLUG.
            </p>
          )}

          <button
            onClick={handleCheckAgain}
            disabled={checking}
            className="w-full flex items-center justify-center gap-2.5 px-4 py-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 font-semibold rounded-xl transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`h-4 w-4 ${checking ? "animate-spin" : ""}`} />
            I&apos;ve installed it — check again
          </button>

          <button
            onClick={onSignOut}
            className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 text-zinc-500 hover:text-zinc-300 font-semibold text-xs transition-all cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
