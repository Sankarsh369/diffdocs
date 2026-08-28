"use client";

import React, { useEffect, useState } from "react";
import { AlertTriangle, Users } from "lucide-react";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend
} from "recharts";
import { authorizedFetch } from "../lib/auth";

interface RiskCounts {
  High: number;
  Medium: number;
  Low: number;
}

interface Contributor {
  login: string;
  avatarUrl: string | null;
  authored: RiskCounts;
  reviewed: RiskCounts;
  loadScore: number;
}

interface RepoOption {
  full_name: string;
  commits_analyzed: number;
}

interface TeamViewProps {
  sessionToken: string;
}

export default function TeamView({ sessionToken }: TeamViewProps) {
  const [workload, setWorkload] = useState<Contributor[]>([]);
  const [repoOptions, setRepoOptions] = useState<RepoOption[]>([]);
  // "" means "All connected repositories" (blended view)
  const [selectedRepo, setSelectedRepo] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authorizedFetch("/api/repositories", sessionToken)
      .then((res) => res.json())
      .then((result) => {
        if (result.status === "success") setRepoOptions(result.data);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionToken]);

  useEffect(() => {
    setLoading(true);
    const query = selectedRepo ? `?repo=${encodeURIComponent(selectedRepo)}` : "";
    authorizedFetch(`/api/team${query}`, sessionToken)
      .then((res) => res.json())
      .then((result) => {
        if (result.status === "success") setWorkload(result.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionToken, selectedRepo]);

  const chartData = workload.map((c) => ({
    name: c.login,
    highRiskPrs: c.authored.High + c.reviewed.High,
    mediumRiskPrs: c.authored.Medium + c.reviewed.Medium,
  }));

  const topLoad = workload[0]; // API already sorts by loadScore descending
  const totalHighRiskTouches = workload.reduce((sum, c) => sum + c.authored.High + c.reviewed.High, 0);
  const isSinglePointOfFailure =
    workload.length > 0 &&
    totalHighRiskTouches > 0 &&
    (topLoad.authored.High + topLoad.reviewed.High) === totalHighRiskTouches;

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="border-b border-zinc-800 pb-5 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Team Cognitive Load Analytics</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Real commit authors and PR reviewers from GitHub — isolating reviewer distribution vulnerabilities and
            tracking workload saturation lines.
          </p>
        </div>

        {repoOptions.length > 0 && (
          <select
            value={selectedRepo}
            onChange={(e) => setSelectedRepo(e.target.value)}
            className="bg-zinc-900 border border-zinc-800 text-xs font-semibold text-zinc-300 rounded-xl px-3 py-2.5 focus:outline-none focus:border-indigo-500/40 cursor-pointer"
          >
            <option value="">All connected repositories</option>
            {repoOptions.map((repo) => (
              <option key={repo.full_name} value={repo.full_name}>
                {repo.full_name} ({repo.commits_analyzed})
              </option>
            ))}
          </select>
        )}
      </div>

      {!loading && workload.length === 0 ? (
        <div className="border border-dashed border-zinc-800 rounded-2xl py-16 flex flex-col items-center justify-center text-center gap-3">
          <Users className="h-6 w-6 text-zinc-600" />
          <div>
            <p className="text-sm font-semibold text-zinc-300">No contributor data yet{selectedRepo ? ` for ${selectedRepo}` : ""}</p>
            <p className="text-xs text-zinc-500 mt-1 max-w-sm">
              This fills in automatically once the GitHub App analyzes real pushes and pull requests —
              authored commits show up immediately, reviewer data appears once a PR is merged.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* SINGLE POINT OF FAILURE ALERT — only shown when it's actually true */}
          {isSinglePointOfFailure && (
            <div className="bg-rose-500/5 border border-rose-500/20 p-5 rounded-2xl flex items-start gap-4 shadow-sm">
              <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-rose-400">Single Point of Failure (SPOF) Detected</h4>
                <p className="text-sm text-zinc-300 mt-1 leading-relaxed">
                  <span className="font-semibold">@{topLoad.login}</span> is currently authoring or reviewing{" "}
                  <span className="font-semibold">100% of all high-complexity changes</span>
                  {selectedRepo ? ` in ${selectedRepo}` : ""}. This concentration introduces burnout vectors and
                  structural bottleneck risks to active deployment cadences.
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* RECHARTS BAR METRIC */}
            <div className="lg:col-span-2 bg-zinc-900/20 border border-zinc-800 p-6 rounded-2xl space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-white">Review Allocation Density</h3>
                <p className="text-xs text-zinc-500 mt-0.5">Real High vs Medium risk touches (authored + reviewed) per real GitHub contributor.</p>
              </div>
              <div className="h-64 w-full text-xs pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f1f23" vertical={false} />
                    <XAxis dataKey="name" stroke="#52525b" tickLine={false} />
                    <YAxis stroke="#52525b" tickLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={{ backgroundColor: "#09090b", borderColor: "#27272a", borderRadius: "12px", color: "#f4f4f5" }} />
                    <Legend />
                    <Bar name="High Risk Touches" dataKey="highRiskPrs" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={32} />
                    <Bar name="Medium Risk Touches" dataKey="mediumRiskPrs" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={32} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* COGNITIVE LOAD METERS */}
            <div className="bg-zinc-900/20 border border-zinc-800 p-6 rounded-2xl space-y-4">
              <h3 className="text-sm font-semibold text-white">Workload Saturation Indices</h3>
              <div className="space-y-5 pt-2">
                {workload.map((contributor) => (
                  <div key={contributor.login} className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-zinc-300 flex items-center gap-2">
                        {contributor.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={contributor.avatarUrl} alt={contributor.login} className="h-4 w-4 rounded-full" />
                        ) : null}
                        @{contributor.login}
                      </span>
                      <span className={`font-bold ${contributor.loadScore >= 75 ? "text-rose-400" : contributor.loadScore >= 40 ? "text-amber-400" : "text-emerald-400"}`}>
                        {contributor.loadScore}%
                      </span>
                    </div>
                    <div className="w-full h-2 bg-zinc-900 border border-zinc-800/80 rounded-full overflow-hidden p-[1px]">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ease-out ${contributor.loadScore >= 75 ? "bg-gradient-to-r from-rose-500 to-red-500" : contributor.loadScore >= 40 ? "bg-gradient-to-r from-amber-500 to-orange-400" : "bg-gradient-to-r from-emerald-500 to-teal-400"}`}
                        style={{ width: `${Math.max(contributor.loadScore, 4)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
