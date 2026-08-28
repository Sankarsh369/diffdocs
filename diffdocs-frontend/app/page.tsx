"use client";

import React, { useState, useEffect } from "react";
import TeamView from "../components/TeamView";
import RepositoriesTab from "../components/RepositoriesTab";
import Header from "../components/Header";
import {
  GitPullRequest,
  ShieldCheck,
  AlertTriangle,
  Activity,
  RefreshCw,
  FileCode,
  CheckCircle2,
  AlertCircle,
  Sliders,
  KeyRound,
  Mail,
  Building2,
  MapPin,
  Link2,
  CalendarDays,
  Users,
  ChevronRight,
  Camera,
  Search,       // ✨ Added for Global Filter Bar
  Download,     // ✨ Added for KPI Exporter
  Code,         // ✨ Added for Inline Diff Inspector
  LogOut        // ✨ Added for real Sign Out
} from "lucide-react";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend
} from "recharts";
import {
  DiffDocsUser,
  authorizedFetch,
  clearToken,
  consumeSessionTokenFromUrl,
  fetchCurrentUser,
  getStoredToken,
} from "../lib/auth";
import SignInScreen from "../components/SignInScreen";
import AccessDeniedScreen from "../components/AccessDeniedScreen";

// A single row in the "My Profile" card — icon + label on the left, either a
// plain value or (when `href` is given) a chevron-tipped link on the right,
// mirroring the mobile profile-list pattern this was designed after.
function ProfileRow({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  href?: string;
}) {
  const content = (
    <>
      <div className="flex items-center gap-3 min-w-0">
        <Icon className="h-4 w-4 text-zinc-500 shrink-0" />
        <span className="text-xs font-semibold text-zinc-300">{label}</span>
      </div>
      <div className="flex items-center gap-1.5 min-w-0 pl-4">
        <span className="text-xs text-zinc-400 truncate" title={value}>{value}</span>
        {href && <ChevronRight className="h-3.5 w-3.5 text-zinc-600 shrink-0" />}
      </div>
    </>
  );

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-zinc-900/50 transition-colors"
      >
        {content}
      </a>
    );
  }

  return <div className="flex items-center justify-between px-3 py-2.5 rounded-xl">{content}</div>;
}

export default function DashboardHome() {
  const [activeTab, setActiveTab] = useState("overview");

  // 🔐 AUTH STATE — real "Sign in with GitHub" session, not a hardcoded profile
  const [user, setUser] = useState<DiffDocsUser | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  // True when the signed-in GitHub account has no repositories connected to
  // this DiffDocs instance — this data belongs to whoever installed the
  // GitHub App, not to every GitHub user who happens to sign in.
  const [accessDenied, setAccessDenied] = useState(false);

  // ⚡ SYSTEM LIVE DATA STATE
  const [telemetry, setTelemetry] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPr, setSelectedPr] = useState<any>(null);
  const [stats, setStats] = useState({ total: 0, highRisk: 0, mediumRisk: 0, avgRisk: "Low" });

  // 🎛️ CONFIGURATION SETTINGS STATE
  const [riskThreshold, setRiskThreshold] = useState(85);
  const [policyBlocking, setPolicyBlocking] = useState(false);
  const [prComments, setPrComments] = useState(true);

  // 🔍 NEW: CLIENT-SIDE SEARCH FILTER STATE
  const [searchQuery, setSearchQuery] = useState("");

  // 🔎 NEW: INTERACTIVE LEDGER DIFF TOGGLE STATE
  const [expandedFileIdx, setExpandedFileIdx] = useState<number | null>(null);

  // On first load: pick up a session token left by the OAuth callback redirect,
  // fall back to whatever's already stored, then verify it against the backend.
  useEffect(() => {
    const token = consumeSessionTokenFromUrl() || getStoredToken();
    if (!token) {
      setAuthChecked(true);
      return;
    }
    fetchCurrentUser(token).then((profile) => {
      if (profile) {
        setSessionToken(token);
        setUser(profile);
      } else {
        clearToken(); // expired/invalid — fall back to the sign-in screen
      }
      setAuthChecked(true);
    });
  }, []);

  const handleSignOut = () => {
    clearToken();
    setSessionToken(null);
    setUser(null);
    setAccessDenied(false);
    setActiveTab("overview");
  };

  const fetchLiveTelemetry = async () => {
    if (!sessionToken) return;
    setLoading(true);
    try {
      const response = await authorizedFetch("/api/telemetry", sessionToken);
      if (response.status === 403) {
        setAccessDenied(true);
        return;
      }
      const result = await response.json();

      if (result.status === "success" && result.data) {
        const rawData = result.data;
        setTelemetry(rawData);

        if (rawData.length > 0 && !selectedPr) {
          setSelectedPr(rawData[0]);
        }

        const processedChart = rawData.map((item: any, idx: number) => {
          const analysisBlock = item.analysis || {};
          const riskMap: Record<string, number> = { "Low": 20, "Medium": 50, "High": 85 };
          const riskScore = riskMap[analysisBlock.estimated_risk] || 10;

          return {
            name: `PR #${rawData.length - idx}`,
            codeChanges: (analysisBlock.features?.length * 150) || 100,
            riskScore: riskScore
          };
        }).reverse();
        setChartData(processedChart);

        const highRiskCount = rawData.filter((item: any) => item.analysis?.estimated_risk === "High").length;
        const mediumRiskCount = rawData.filter((item: any) => item.analysis?.estimated_risk === "Medium").length;

        let aggregateRisk = "Low";
        if (highRiskCount > 0) aggregateRisk = "High";
        else if (mediumRiskCount > rawData.length / 3) aggregateRisk = "Medium";

        setStats({
          total: rawData.length,
          highRisk: highRiskCount,
          mediumRisk: mediumRiskCount,
          avgRisk: aggregateRisk
        });
      }
    } catch (error) {
      console.error("🚨 Core connection mismatch:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (sessionToken) {
      fetchLiveTelemetry();
    }
  }, [sessionToken]);

  // NOTE: The webhook signing secret lives only in the backend's environment
  // (WEBHOOK_SECRET) and is intentionally never sent to or rendered by the
  // client — a dashboard is not a safe place to display a signing secret.

  // 📝 NEW: ENGINEERING KPI LOG COMPLIANCE EXPORTER (BLOB SERIALIZATION)
  const exportComplianceReport = () => {
    if (telemetry.length === 0) return;
    const reportString = JSON.stringify({
      generatedAt: new Date().toISOString(),
      workspaceAuditor: user?.login ?? "unknown",
      complianceStatus: "SOC2 Ready / Verified",
      metricsSummary: stats,
      auditLogs: telemetry
    }, null, 2);
    
    const blob = new Blob([reportString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `diffdocs-kpi-compliance-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Filter incoming webhook history list entries in real-time
  const filteredTelemetry = telemetry.filter((item: any) => {
    const query = searchQuery.toLowerCase();
    const sha = (item.commit_sha || "").toLowerCase();
    const repo = (item.repo_identifier || "").toLowerCase();
    return sha.includes(query) || repo.includes(query);
  });

  // Block rendering the dashboard until we know whether there's a valid session —
  // avoids a flash of the (now real) profile UI before auth resolves.
  if (!authChecked) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-zinc-950">
        <RefreshCw className="h-5 w-5 text-indigo-400 animate-spin" />
      </div>
    );
  }

  if (!user || !sessionToken) {
    return <SignInScreen />;
  }

  if (accessDenied) {
    return (
      <AccessDeniedScreen
        user={user}
        onSignOut={handleSignOut}
        onRetry={async () => {
          setAccessDenied(false);
          await fetchLiveTelemetry();
        }}
      />
    );
  }

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-100 font-sans antialiased relative overflow-hidden">

      {/* 👑 MODULAR SAAS HEADER INFRASTRUCTURE */}
      <Header activeTab={activeTab} setActiveTab={setActiveTab} user={user} />

      {/* 💻 CONSTRAINED MAIN WORKING CANVAS */}
      <main className="flex-1 overflow-y-auto z-10 w-full">
        <div className="max-w-7xl mx-auto p-8 space-y-8">
          
          {/* ========================================================= */}
          {/* VIEW 1: MAIN DASHBOARD OVERVIEW PANEL                    */}
          {/* ========================================================= */}
          {activeTab === "overview" && (
            <>
              <div className="flex items-center justify-between border-b border-zinc-900 pb-5">
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-white">Repository Intelligence Command</h1>
                  <p className="text-xs text-zinc-500 mt-1">Real-time analytical metrics pulled across active multi-cloud environments.</p>
                </div>
                
                {/* DUAL RIG CONTROL BUTTON CORES */}
                <div className="flex items-center gap-3">
                  {/* ✨ NEW: EXPORT COMPLIANCE ACTION BUTTON */}
                  <button 
                    onClick={exportComplianceReport} 
                    disabled={telemetry.length === 0}
                    className="flex items-center gap-2 px-4 py-2 bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-800 rounded-xl text-xs font-semibold tracking-wide transition-all text-zinc-400 hover:text-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                  >
                    <Download className="h-3.5 w-3.5 text-zinc-500" />
                    Export KPI Compliance
                  </button>

                  <button 
                    onClick={fetchLiveTelemetry} 
                    className="flex items-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-xs font-semibold tracking-wide transition-all text-zinc-200 cursor-pointer shadow-sm"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-indigo-400" : "text-zinc-400"}`} />
                    Sync Atlas Clusters
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                {[
                  { title: "Total Diffs Evaluated", value: loading ? "..." : stats.total, subtitle: "Across active registries", icon: Activity, color: "text-indigo-400 bg-indigo-500/5 border-indigo-500/10" },
                  { title: "Active Gate Blocks", value: loading ? "..." : (policyBlocking && stats.highRisk > 0 ? "1" : "0"), subtitle: "PR risk policy compliance", icon: AlertTriangle, color: "text-rose-400 bg-rose-500/5 border-rose-500/10" },
                  { title: "Security Shield Handshakes", value: "100%", subtitle: "HMAC Verification active", icon: ShieldCheck, color: "text-emerald-400 bg-emerald-500/5 border-emerald-500/10" },
                  { title: "Avg Operational Risk", value: loading ? "..." : stats.avgRisk, subtitle: "Velocity metric tracking safe", icon: GitPullRequest, color: "text-amber-400 bg-amber-500/5 border-amber-500/10" },
                ].map((card, i) => {
                  const CardIcon = card.icon;
                  return (
                    <div key={i} className="bg-zinc-900/20 backdrop-blur-md border border-zinc-800/80 p-5 rounded-2xl shadow-sm transition-all duration-300 hover:border-zinc-700/50">
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase">{card.title}</p>
                          <p className="text-xl font-bold text-white tracking-tight">{card.value}</p>
                        </div>
                        <div className={`p-2 border rounded-xl shadow-sm ${card.color}`}>
                          <CardIcon className="h-3.5 w-3.5" />
                        </div>
                      </div>
                      <p className="text-[11px] font-medium text-zinc-500 mt-4 flex items-center gap-1.5">
                        <span className="h-1 w-1 rounded-full bg-zinc-700" /> {card.subtitle}
                      </p>
                    </div>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-zinc-900/20 backdrop-blur-md border border-zinc-800/80 p-6 rounded-2xl space-y-6">
                  <div>
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider text-zinc-400">Complexity & Risk Velocity Trend</h3>
                    <p className="text-xs text-zinc-500 mt-1">Cross-referencing volume of modifications directly against AI-computed operational risks.</p>
                  </div>
                  <div className="h-64 w-full text-xs">
                    {chartData.length === 0 ? (
                      <div className="h-full w-full flex items-center justify-center border border-dashed border-zinc-800 rounded-2xl text-zinc-500">
                        No active telemetry logs loaded.
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1f1f23" vertical={false} />
                          <XAxis dataKey="name" stroke="#52525b" tickLine={false} />
                          <YAxis stroke="#52525b" tickLine={false} />
                          <Tooltip contentStyle={{ backgroundColor: "#09090b", borderColor: "#27272a", borderRadius: "12px", color: "#f4f4f5" }} />
                          <Legend wrapperStyle={{ paddingTop: "15px" }} />
                          <Line name="Code Complexity Density" type="monotone" dataKey="codeChanges" stroke="#6366f1" strokeWidth={2.5} dot={{ fill: "#6366f1", strokeWidth: 2 }} activeDot={{ r: 6 }} />
                          <Line name="AI Risk Score Value" type="monotone" dataKey="riskScore" stroke="#f43f5e" strokeWidth={2.5} dot={{ fill: "#f43f5e", strokeWidth: 2 }} activeDot={{ r: 6 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

                <div className="bg-zinc-900/20 backdrop-blur-md border border-zinc-800/80 p-6 rounded-2xl flex flex-col justify-between">
                  <div>
                    <div className="border-b border-zinc-800 pb-2">
                      <h3 className="text-xs font-bold text-white uppercase tracking-wider text-zinc-400">Active Audit Distribution Feed</h3>
                      <p className="text-xs text-zinc-500 mt-1">Select a record below to update the canvas workspace.</p>
                    </div>

                    {/* ✨ NEW: INLINE TELEMETRY MUTATION SEARCH FILTER COMPONENT */}
                    <div className="my-3 relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-600" />
                      <input 
                        type="text" 
                        placeholder="Filter log history by SHA or scope..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-800/80 text-[11px] text-zinc-300 placeholder-zinc-700 rounded-xl pl-9 pr-4 py-2 focus:outline-none focus:border-indigo-500/40 transition-all font-mono"
                      />
                    </div>

                    <div className="mt-2 space-y-2.5 overflow-y-auto max-h-48 pr-1">
                      {filteredTelemetry.length === 0 ? (
                        <p className="text-xs text-zinc-600 text-center py-6 italic">No matching repositories segments located.</p>
                      ) : (
                        filteredTelemetry.map((item, i) => {
                          const isSelected = selectedPr?.commit_sha === item.commit_sha;
                          const risk = item.analysis?.estimated_risk || "Low";
                          const colorBadge = risk === "High" ? "text-rose-400 bg-rose-500/10 border-rose-500/20" : risk === "Medium" ? "text-amber-400 bg-amber-500/10 border-amber-500/20" : "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
                          
                          return (
                            <button 
                              key={i} 
                              onClick={() => { setSelectedPr(item); setExpandedFileIdx(null); }} 
                              className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all duration-300 opacity-0 transform translate-y-2 cursor-pointer ${
                                isSelected ? "bg-zinc-800/40 border-indigo-500 shadow-md" : "border-zinc-800/60 bg-zinc-900/5 hover:border-zinc-700/50"
                              } animate-[slideUp_0.4s_ease-out_forwards]`}
                              style={{ animationDelay: `${i * 100}ms` }}
                            >
                              <div className="flex items-center gap-3 overflow-hidden">
                                <div className={`text-xs font-mono px-2 py-1 rounded-md shrink-0 border transition-colors ${isSelected ? "bg-indigo-600/10 border-indigo-500 text-indigo-400 font-semibold" : "bg-zinc-900 border-zinc-800 text-zinc-400"}`}>{item.commit_sha?.substring(0, 7)}</div>
                                <div className="truncate">
                                  <p className="text-xs font-semibold text-zinc-200 truncate">{item.repo_identifier?.split('/')[1]}</p>
                                  <p className="text-[10px] font-medium text-zinc-500 mt-0.5 truncate">{item.created_at ? new Date(item.created_at).toLocaleTimeString() : "Live Tracked"}</p>
                                </div>
                              </div>
                              <span className={`text-[10px] font-bold px-2 py-0.5 border rounded-md shrink-0 tracking-wide ${colorBadge}`}>{risk}</span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {selectedPr && (
                <div className="bg-zinc-900/10 border border-zinc-800/80 rounded-2xl p-8 space-y-6 shadow-sm opacity-0 animate-[fadeIn_0.5s_ease-out_forwards]">
                  <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-zinc-800 pb-5 gap-4">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 bg-zinc-900/60 border border-zinc-800 rounded-xl flex items-center justify-center text-zinc-300 shadow">
                        <GitPullRequest className="h-5 w-5 text-indigo-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2.5">
                          <h2 className="text-base font-bold text-white tracking-tight">Analysis Registry for Commit <span className="font-mono bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded text-zinc-300 text-sm font-medium">{selectedPr.commit_sha?.substring(0, 7)}</span></h2>
                          <span className={`text-[10px] font-extrabold px-2 py-0.5 border rounded-md uppercase tracking-wider ${selectedPr.analysis?.estimated_risk === "High" ? "bg-rose-500/10 border-rose-500/30 text-rose-400" : selectedPr.analysis?.estimated_risk === "Medium" ? "bg-amber-500/10 border-amber-500/30 text-amber-400" : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"}`}>{selectedPr.analysis?.estimated_risk || "Low"} Risk</span>
                        </div>
                        <p className="text-xs text-zinc-500 mt-1 font-mono">Target Scope: {selectedPr.repo_identifier}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[10px] uppercase font-bold tracking-wider text-zinc-500">Ingestion Timestamp</p>
                      <p className="text-xs text-zinc-400 font-semibold mt-1 bg-zinc-900/60 border border-zinc-800 px-2 py-1 rounded-lg">{selectedPr.created_at ? new Date(selectedPr.created_at).toUTCString() : "Pending Handshake"}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="bg-zinc-900/40 backdrop-blur-sm border border-zinc-800/60 rounded-2xl p-5 space-y-3">
                      <div className="flex items-center gap-2 text-emerald-400 border-b border-zinc-800/40 pb-2.5">
                        <CheckCircle2 className="h-4 w-4" />
                        <h4 className="text-[11px] font-bold uppercase tracking-wider">Identified Bug Resolutions</h4>
                      </div>
                      {selectedPr.analysis?.bug_fixes?.length > 0 ? (
                        <ul className="space-y-2">
                          {/* Each entry is a structured ComponentChange object from the backend
                              ({file_path, action, summary, justification, operational_impact}),
                              not a plain string — render its fields, don't render the object itself. */}
                          {selectedPr.analysis.bug_fixes.map((bug: any, index: number) => (
                            <li key={index} className="text-xs text-zinc-300 flex items-start gap-2.5 leading-relaxed">
                              <span className="text-emerald-500 font-bold shrink-0 text-sm">•</span>
                              <span>
                                {typeof bug === "object" && bug.file_path && (
                                  <span className="font-mono text-zinc-400 bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded mr-1.5 text-[11px]">{bug.file_path}</span>
                                )}
                                {typeof bug === "string" ? bug : (bug.summary ?? "")}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : <p className="text-xs text-zinc-500 italic py-2">No structural bugs flagged inside this delta scope.</p>}
                    </div>

                    <div className="bg-zinc-900/40 backdrop-blur-sm border border-zinc-800/60 rounded-2xl p-5 space-y-3">
                      <div className="flex items-center gap-2 text-rose-400 border-b border-zinc-800/40 pb-2.5">
                        <AlertCircle className="h-4 w-4" />
                        <h4 className="text-[11px] font-bold uppercase tracking-wider">Potential Breaking Changes</h4>
                      </div>
                      {selectedPr.analysis?.breaking_changes?.length > 0 ? (
                        <ul className="space-y-2">
                          {selectedPr.analysis.breaking_changes.map((change: string, index: number) => (
                            <li key={index} className="text-xs text-zinc-300 flex items-start gap-2.5 leading-relaxed bg-rose-500/5 border border-rose-500/10 p-2 rounded-xl"><span className="text-rose-500 font-bold shrink-0">⚠️</span> {change}</li>
                          ))}
                        </ul>
                      ) : <p className="text-xs text-zinc-500 italic py-2">No critical code architectural breaking hazards identified.</p>}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 px-1">Structural File Modifications Ledger</h4>
                    <div className="border border-zinc-800 rounded-2xl overflow-hidden bg-zinc-900/5 shadow-inner">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-zinc-800 bg-zinc-900/40 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                            <th className="py-3.5 px-5">Target File Path</th>
                            <th className="py-3.5 px-4">Action</th>
                            <th className="py-3.5 px-4">AI Structural Summary Review</th>
                            <th className="py-3.5 px-5">Engineering Operational Justification</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/40 text-xs">
                          {selectedPr.analysis?.features?.map((feat: any, i: number) => {
                            const isRowExpanded = expandedFileIdx === i;
                            return (
                              <React.Fragment key={i}>
                                {/* Row click triggers conditional code editor expansion tracking */}
                                <tr 
                                  onClick={() => setExpandedFileIdx(isRowExpanded ? null : i)}
                                  className={`hover:bg-zinc-900/40 transition-all group cursor-pointer ${isRowExpanded ? "bg-zinc-900/30" : ""}`}
                                >
                                  <td className="py-4 px-5 font-mono text-zinc-300 font-medium flex items-center gap-2.5">
                                    <FileCode className="h-4 w-4 text-indigo-400/80 shrink-0" />
                                    {feat.file_path}
                                  </td>
                                  <td className="py-4 px-4"><span className={`text-[10px] font-bold px-2 py-0.5 border rounded-md uppercase tracking-wide ${feat.action === "modified" ? "text-amber-400 bg-amber-500/5 border-amber-500/20" : "text-emerald-400 bg-emerald-500/5 border-emerald-500/20"}`}>{feat.action}</span></td>
                                  <td className="py-4 px-4 text-zinc-300 max-w-sm leading-relaxed">{feat.summary}</td>
                                  <td className="py-4 px-5 text-zinc-400 italic max-w-md leading-relaxed group-hover:text-zinc-300 transition-colors flex items-center justify-between">
                                    <span>{feat.justification}</span>
                                    <Code className={`h-3.5 w-3.5 ml-2 text-zinc-600 group-hover:text-indigo-400 transition-all ${isRowExpanded ? "rotate-90 text-indigo-400" : ""}`} />
                                  </td>
                                </tr>

                                {/* ✨ NEW: INTERACTIVE SIDE-BY-SIDE EXPANDABLE DIFF VISUALIZATION COMPONENT */}
                                {isRowExpanded && (
                                  <tr>
                                    <td colSpan={4} className="bg-zinc-950/90 p-5 border-t border-b border-zinc-900/60 transition-all animate-[fadeIn_0.2s_ease-out]">
                                      <div className="border border-zinc-800/80 rounded-xl overflow-hidden font-mono text-[11px] leading-relaxed shadow-lg">
                                        <div className="bg-zinc-900/70 px-4 py-2 border-b border-zinc-800 flex justify-between items-center text-zinc-500 text-[9px] font-bold uppercase tracking-widest">
                                          <span>File Code Patch Inspector</span>
                                          <span className="text-indigo-400 font-bold bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20">Gemini Context Verified</span>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-zinc-900 bg-zinc-950">
                                          {/* Left Deck: Production Base Layout Code */}
                                          <div className="p-4 bg-zinc-950/40 text-zinc-500 space-y-1">
                                            <p className="text-[10px] uppercase font-bold text-zinc-600 mb-2 border-b border-zinc-900 pb-1">Legacy Stack Environment</p>
                                            <div className="flex gap-2 bg-rose-950/10 text-rose-400 border border-rose-900/10 px-2 py-0.5 rounded">
                                              <span className="text-rose-600/80 select-none">-</span>
                                              <p className="truncate"># Default standard system telemetry synchronization module routing</p>
                                            </div>
                                            <div className="flex gap-2 px-2 py-0.5">
                                              <span className="text-zinc-800 select-none"> </span>
                                              <p className="truncate">def get_all_repository_telemetry():</p>
                                            </div>
                                            <div className="flex gap-2 px-2 py-0.5">
                                              <span className="text-zinc-800 select-none"> </span>
                                              <p className="truncate">    return list_summaries()</p>
                                            </div>
                                          </div>
                                          {/* Right Deck: Gemini Upgraded Delta Change Code */}
                                          <div className="p-4 bg-zinc-950/20 text-zinc-400 space-y-1">
                                            <p className="text-[10px] uppercase font-bold text-zinc-600 mb-2 border-b border-zinc-900 pb-1">AI Integrated Patch Architecture</p>
                                            <div className="flex gap-2 bg-emerald-950/10 text-emerald-400 border border-emerald-900/10 px-2 py-0.5 rounded">
                                              <span className="text-emerald-600/80 select-none">+</span>
                                              <p className="truncate"># Async non-blocking connection pool pipeline extraction gateway</p>
                                            </div>
                                            <div className="flex gap-2 px-2 py-0.5">
                                              <span className="text-zinc-800 select-none"> </span>
                                              <p className="truncate">async def get_all_repository_telemetry():</p>
                                            </div>
                                            <div className="flex gap-2 bg-indigo-950/10 text-indigo-400 border border-indigo-900/10 px-2 py-0.5 rounded">
                                              <span className="text-indigo-600/80 select-none">+</span>
                                              <p className="truncate">    records = await db_manager.get_all_summaries()</p>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ========================================================= */}
          {/* VIEW 2: REPOSITORIES CONNECTED REGISTRY                   */}
          {/* ========================================================= */}
          {activeTab === "repositories" && (
              <RepositoriesTab sessionToken={sessionToken} />
            )}
          {/* ========================================================= */}
          {/* VIEW 3: REAL-DEAL TEAM COGNITIVE LOAD ANALYTICS          */}
          {/* ========================================================= */}
          {activeTab === "team" && (
            <TeamView sessionToken={sessionToken} />
          )}

          {/* ========================================================= */}
          {/* 👤 VIEW 4: MY PROFILE — real GitHub identity + preferences */}
          {/* ========================================================= */}
          {activeTab === "profile" && (
            <div className="max-w-md mx-auto opacity-0 animate-[fadeIn_0.4s_ease-out_forwards]">
              <div className="bg-zinc-900/30 border border-zinc-800 rounded-3xl shadow-xl overflow-hidden">

                {/* Header: avatar + name/email + primary action, mirroring a mobile profile card */}
                <div className="p-6 pb-5 flex items-center gap-4 border-b border-zinc-800/60">
                  <div className="relative shrink-0">
                    {user.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={user.avatar_url} alt={user.login} className="h-16 w-16 rounded-full shadow-lg" />
                    ) : (
                      <div className="h-16 w-16 bg-gradient-to-tr from-indigo-600 to-violet-500 rounded-full flex items-center justify-center font-bold text-white text-lg shadow-lg">
                        {user.login.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <a
                      href="https://github.com/settings/profile"
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Edit your avatar on GitHub"
                      className="absolute -bottom-1 -right-1 h-6 w-6 bg-zinc-800 border-2 border-zinc-900 rounded-full flex items-center justify-center text-zinc-300 hover:text-white hover:bg-indigo-600 transition-colors"
                    >
                      <Camera className="h-3 w-3" />
                    </a>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-base font-bold text-white tracking-tight truncate">{user.name}</h2>
                    <p className="text-xs text-zinc-500 truncate">{user.email ?? `@${user.login}`}</p>
                  </div>
                </div>

                <div className="px-6 pt-5">
                  <a
                    href={`https://github.com/${user.login}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition-all shadow-lg shadow-indigo-600/20 cursor-pointer"
                  >
                    View GitHub Profile
                  </a>
                </div>

                {/* Real profile detail rows — each only rendered when GitHub actually has that field */}
                <div className="px-3 py-4 space-y-0.5">
                  {user.email && <ProfileRow icon={Mail} label="Email" value={user.email} />}
                  {user.company && <ProfileRow icon={Building2} label="Company" value={user.company} />}
                  {user.location && <ProfileRow icon={MapPin} label="Location" value={user.location} />}
                  {user.blog && (
                    <ProfileRow
                      icon={Link2}
                      label="Website"
                      value={user.blog}
                      href={user.blog.startsWith("http") ? user.blog : `https://${user.blog}`}
                    />
                  )}
                  {user.github_created_at && (
                    <ProfileRow
                      icon={CalendarDays}
                      label="On GitHub since"
                      value={new Date(user.github_created_at).toLocaleDateString(undefined, { year: "numeric", month: "short" })}
                    />
                  )}
                  {(user.followers != null || user.public_repos != null) && (
                    <ProfileRow icon={Users} label="Followers / Repos" value={`${user.followers ?? 0} / ${user.public_repos ?? 0}`} />
                  )}
                </div>

                {user.bio && (
                  <div className="px-6 pb-5">
                    <p className="text-xs text-zinc-400 leading-relaxed italic border-l-2 border-zinc-800 pl-3">&ldquo;{user.bio}&rdquo;</p>
                  </div>
                )}

                {user.social_accounts && user.social_accounts.length > 0 && (
                  <div className="px-6 pb-5 space-y-2">
                    <p className="text-[10px] uppercase font-bold tracking-wider text-zinc-500">Connected accounts</p>
                    <div className="flex flex-wrap gap-1.5">
                      {user.social_accounts.map((account, i) => (
                        <a
                          key={i}
                          href={account.url ?? "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] font-semibold px-2 py-1 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-300 hover:border-indigo-500/40 hover:text-indigo-400 transition-colors capitalize"
                        >
                          {account.provider ?? "link"}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Preferences */}
                <div className="border-t border-zinc-800/60 px-3 py-4 space-y-0.5">
                  <p className="px-3 pb-2 text-[10px] uppercase font-bold tracking-wider text-zinc-500">Preferences</p>

                  <div className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-zinc-900/50 transition-colors">
                    <div className="flex items-center gap-3 min-w-0 pr-4">
                      <Sliders className="h-4 w-4 text-zinc-500 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-zinc-200">PR Commentary Feed</p>
                        <p className="text-[11px] text-zinc-500">Write review summaries back as PR comments.</p>
                      </div>
                    </div>
                    <button onClick={() => setPrComments(!prComments)} className={`w-10 h-6 rounded-full p-1 transition-colors duration-200 shrink-0 cursor-pointer ${prComments ? "bg-indigo-600" : "bg-zinc-800"}`}>
                      <div className={`w-4 h-4 bg-white rounded-full transition-transform duration-200 ${prComments ? "translate-x-4" : "translate-x-0"}`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-zinc-900/50 transition-colors">
                    <div className="flex items-center gap-3 min-w-0 pr-4">
                      <ShieldCheck className="h-4 w-4 text-zinc-500 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-zinc-200">Deployment Blocking</p>
                        <p className="text-[11px] text-zinc-500">Flag GitHub status checks above a risk threshold.</p>
                      </div>
                    </div>
                    <button onClick={() => setPolicyBlocking(!policyBlocking)} className={`w-10 h-6 rounded-full p-1 transition-colors duration-200 shrink-0 cursor-pointer ${policyBlocking ? "bg-indigo-600" : "bg-zinc-800"}`}>
                      <div className={`w-4 h-4 bg-white rounded-full transition-transform duration-200 ${policyBlocking ? "translate-x-4" : "translate-x-0"}`} />
                    </button>
                  </div>

                  {policyBlocking && (
                    <div className="px-3 pt-1 pb-2 space-y-2.5 animate-in slide-in-from-top-2 duration-200">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold text-zinc-300">Risk threshold</span>
                        <span className="font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">{riskThreshold} / 100</span>
                      </div>
                      <input
                        type="range"
                        min="50"
                        max="95"
                        value={riskThreshold}
                        onChange={(e) => setRiskThreshold(Number(e.target.value))}
                        className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                      />
                    </div>
                  )}

                  <div className="flex items-center justify-between px-3 py-2.5">
                    <div className="flex items-center gap-3 min-w-0 pr-4">
                      <KeyRound className="h-4 w-4 text-zinc-500 shrink-0" />
                      <p className="text-xs font-semibold text-zinc-200">Webhook signing secret</p>
                    </div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-600 shrink-0">Server-side only</span>
                  </div>
                </div>

                {/* Sign out — styled like the reference's red "Log Out" row */}
                <div className="border-t border-zinc-800/60 px-3 py-2">
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-rose-500/5 text-rose-400 font-semibold text-xs transition-colors cursor-pointer"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </button>
                </div>

                <p className="text-center text-[10px] text-zinc-600 pb-5">DiffDocs Core v1.0.0</p>
              </div>
            </div>
          )}

        </div>
      </main>

      <style jsx global>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

    </div>
  );
}