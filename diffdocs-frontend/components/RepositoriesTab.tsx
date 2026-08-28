"use client";

import React, { useEffect, useState } from "react";
import { FolderGit2, Lock, Globe, RefreshCw, CheckCircle2 } from "lucide-react";
import { authorizedFetch } from "../lib/auth";

interface Repository {
  full_name: string;
  name: string;
  owner: string;
  private: boolean;
  html_url: string;
  default_branch: string | null;
  commits_analyzed: number;
}

interface RepositoriesTabProps {
  sessionToken: string;
}

export default function RepositoriesTab({ sessionToken }: RepositoriesTabProps) {
  const [repos, setRepos] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Per-repo "sync" button state: "idle" | "syncing" | "done"
  const [syncState, setSyncState] = useState<Record<string, "idle" | "syncing" | "done">>({});

  const githubAppSlug = process.env.NEXT_PUBLIC_GITHUB_APP_SLUG;
  const installHref = githubAppSlug ? `https://github.com/apps/${githubAppSlug}/installations/new` : undefined;

  const fetchRepositories = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await authorizedFetch("/api/repositories", sessionToken);
      const result = await response.json();
      if (result.status === "success") {
        setRepos(result.data);
      } else {
        setError("Could not load connected repositories.");
      }
    } catch {
      setError("Could not reach the backend to list connected repositories.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRepositories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionToken]);

  const handleSync = async (repo: Repository) => {
    setSyncState((prev) => ({ ...prev, [repo.full_name]: "syncing" }));
    try {
      await authorizedFetch(`/api/repositories/${repo.owner}/${repo.name}/sync`, sessionToken, { method: "POST" });
      setSyncState((prev) => ({ ...prev, [repo.full_name]: "done" }));
      // Backfill runs in the background on the server; give it a few seconds
      // then refresh commit counts so newly-analyzed PRs show up.
      setTimeout(fetchRepositories, 8000);
    } catch {
      setSyncState((prev) => ({ ...prev, [repo.full_name]: "idle" }));
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="border-b border-zinc-800 pb-5 flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Connected Code Registries</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Every repository the GitHub App is actually installed on — not just the ones with existing analysis.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchRepositories}
            className="flex items-center gap-2 px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-xs font-semibold text-zinc-300 tracking-wide transition-all shadow-md cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-indigo-400" : "text-zinc-500"}`} />
            Refresh
          </button>

          <a
            href={installHref ?? "#"}
            target={installHref ? "_blank" : undefined}
            rel={installHref ? "noopener noreferrer" : undefined}
            aria-disabled={!installHref}
            title={installHref ? undefined : "GitHub App not configured yet — set NEXT_PUBLIC_GITHUB_APP_SLUG"}
            onClick={(e) => { if (!installHref) e.preventDefault(); }}
            className={`flex items-center gap-2 px-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs font-semibold text-white tracking-wide transition-all shadow-md group ${
              installHref ? "hover:bg-zinc-800 cursor-pointer" : "opacity-40 cursor-not-allowed"
            }`}
          >
            <svg className="h-4 w-4 fill-zinc-400 group-hover:fill-white transition-colors" viewBox="0 0 24 24">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
            Install on another repo
          </a>
        </div>
      </div>

      {error && (
        <div className="border border-rose-500/20 bg-rose-500/5 text-rose-400 text-xs rounded-xl p-4">{error}</div>
      )}

      {!loading && !error && repos.length === 0 && (
        <div className="border border-dashed border-zinc-800 rounded-2xl py-16 flex flex-col items-center justify-center text-center gap-3">
          <FolderGit2 className="h-6 w-6 text-zinc-600" />
          <div>
            <p className="text-sm font-semibold text-zinc-300">No repositories connected yet</p>
            <p className="text-xs text-zinc-500 mt-1 max-w-sm">
              Install the GitHub App on a repository to see it here — real repos only, no placeholders.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {repos.map((repo) => {
          const state = syncState[repo.full_name] ?? "idle";
          return (
            <div key={repo.full_name} className="bg-zinc-900/20 backdrop-blur-md border border-zinc-800 p-6 rounded-2xl flex items-start justify-between shadow-sm hover:border-zinc-700/60 transition-all group duration-200">
              <div className="space-y-4 flex-1">
                <div className="h-10 w-10 bg-indigo-500/5 border border-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-400">
                  <FolderGit2 className="h-5 w-5" />
                </div>
                <div>
                  <a href={repo.html_url} target="_blank" rel="noopener noreferrer" className="text-base font-bold text-white font-mono hover:text-indigo-400 transition-colors">
                    {repo.name}
                  </a>
                  <p className="text-xs text-zinc-500 mt-0.5 font-mono flex items-center gap-1.5">
                    {repo.private ? <Lock className="h-3 w-3" /> : <Globe className="h-3 w-3" />}
                    {repo.full_name}
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs font-semibold text-zinc-400 pt-2">
                  <span className="flex items-center gap-1.5 text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Active Sync
                  </span>
                  <span className="text-zinc-500 font-normal">|</span>
                  <span>{repo.commits_analyzed} Commit{repo.commits_analyzed === 1 ? "" : "s"} Analyzed</span>
                </div>

                <button
                  onClick={() => handleSync(repo)}
                  disabled={state !== "idle"}
                  className="flex items-center gap-1.5 text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 disabled:text-zinc-600 disabled:cursor-not-allowed cursor-pointer transition-colors"
                >
                  {state === "syncing" && <RefreshCw className="h-3 w-3 animate-spin" />}
                  {state === "done" && <CheckCircle2 className="h-3 w-3 text-emerald-400" />}
                  {state === "idle" && "Backfill recent pull requests →"}
                  {state === "syncing" && "Analyzing recent PRs..."}
                  {state === "done" && "Backfill started — refreshing shortly"}
                </button>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-md shadow-sm shrink-0">GitHub App</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
