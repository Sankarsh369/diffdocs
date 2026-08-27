"use client";

import React, { useState } from "react";
import { FolderGit2, Plus, Terminal, X, ShieldCheck, ArrowRight } from "lucide-react";

interface RepositoriesTabProps {
  dynamicRepos: any[];
}

export default function RepositoriesTab({ dynamicRepos }: RepositoriesTabProps) {
  // 🔥 RESTORED: The component now safely manages its own modal overlay state natively!
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="border-b border-zinc-800 pb-5 flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Connected Code Registries</h1>
          <p className="text-sm text-zinc-400 mt-1">Active systems linked directly to your secure or isolated infrastructure clusters.</p>
        </div>
        
        <a 
          href="https://github.com/apps/diffdocs-intelligence" 
          target="_blank"
          className="flex items-center gap-2 px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-xs font-semibold text-white tracking-wide transition-all shadow-md group cursor-pointer"
        >
          <svg className="h-4 w-4 fill-zinc-400 group-hover:fill-white transition-colors" viewBox="0 0 24 24">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
          </svg>
          Install GitHub Application Link
        </a>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {dynamicRepos.map((repo, i) => (
          <div key={i} className="bg-zinc-900/20 backdrop-blur-md border border-zinc-800 p-6 rounded-2xl flex items-start justify-between shadow-sm hover:border-zinc-700/60 transition-all group duration-200">
            <div className="space-y-4">
              <div className="h-10 w-10 bg-indigo-500/5 border border-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-400">
                <FolderGit2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white font-mono">{repo.name}</h3>
                <p className="text-xs text-zinc-500 mt-0.5 font-mono">{repo.fullName}</p>
              </div>
              <div className="flex items-center gap-4 text-xs font-semibold text-zinc-400 pt-2">
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Active Sync
                </span>
                <span className="text-zinc-500 font-normal">|</span>
                <span>{repo.commitsCount} Commits Logged</span>
              </div>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-md shadow-sm">GitHub App</span>
          </div>
        ))}
        
        <button 
          onClick={() => setIsModalOpen(true)}
          className="border border-dashed border-zinc-800 bg-zinc-900/5 hover:bg-zinc-900/20 rounded-2xl p-6 flex flex-col items-center justify-center text-center space-y-3 hover:border-zinc-700/60 active:scale-[0.99] transition-all group cursor-pointer h-full min-h-[180px]"
        >
          <div className="h-10 w-10 bg-zinc-900/50 border border-zinc-800 group-hover:border-zinc-700/80 rounded-xl flex items-center justify-center text-zinc-400 font-bold text-lg transition-colors">
            <Plus className="h-4 w-4 text-zinc-500 group-hover:text-zinc-300 transition-colors" />
          </div>
          <div>
            <p className="text-xs font-semibold text-zinc-300 group-hover:text-zinc-200 transition-colors">Hook Manual Namespace</p>
            <p className="text-[11px] text-zinc-500 max-w-xs mt-1 leading-relaxed">Generate a customized signature runner link for alternative VCS network vectors.</p>
          </div>
        </button>
      </div>

      {/* 🔮 ULTRA-PREMIUM GLASSMORPHIC HUD INSTALLATION OVERLAY */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-zinc-900/80 backdrop-blur-xl border border-zinc-800 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
            
            <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/40">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-lg flex items-center justify-center">
                  <Terminal className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Connect New Workspace Namespace</h3>
                  <p className="text-[11px] text-zinc-500 mt-0.5">Integrate isolated repository hooks into the core engine.</p>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-1.5 hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 rounded-lg transition-colors cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 space-y-5 flex-1 text-xs text-left">
              <div className="space-y-2">
                <label className="font-semibold text-zinc-300">VCS Repository Path Namespace</label>
                <input 
                  type="text" 
                  placeholder="e.g., Sankarsh369/production-api-service" 
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-zinc-300 placeholder-zinc-600 font-mono focus:outline-none"
                />
              </div>

              <div className="bg-zinc-950/60 border border-zinc-800 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2 text-indigo-400 font-semibold mb-1">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>Automated Setup Token Instructions</span>
                </div>
                <p className="text-[11px] text-zinc-500 leading-relaxed">
                  To complete orchestration, map the webhook cryptography keys inside your repository workflow variables as a secret named <code className="text-zinc-300 bg-zinc-900 px-1 py-0.5 rounded border border-zinc-800 font-mono">WEBHOOK_SECRET</code>.
                </p>
              </div>
            </div>

            <div className="p-4 bg-zinc-900/40 border-t border-zinc-800 flex items-center justify-end gap-3">
              <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 font-semibold rounded-xl transition-all cursor-pointer">Cancel</button>
              <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 font-semibold rounded-xl text-white shadow-lg shadow-indigo-600/10 flex items-center gap-1.5 group transition-all cursor-pointer">
                Initialize Pipeline 
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}