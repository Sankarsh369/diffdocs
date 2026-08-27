"use client";

import React from "react";
import { BarChart3, FolderGit2, Users } from "lucide-react";
import { DiffDocsUser } from "../lib/auth";

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  user: DiffDocsUser;
}

export default function Header({ activeTab, setActiveTab, user }: HeaderProps) {
  return (
    <header className="w-full border-b border-zinc-800/80 bg-zinc-900/30 backdrop-blur-xl px-8 py-4 flex items-center justify-between shrink-0 z-20 shadow-sm">
      <div className="flex items-center gap-8">
        
        {/* Logo Branding (Resets back to Dashboard overview workspace) */}
        <button 
          onClick={() => setActiveTab("overview")}
          className="flex items-center gap-3 active:scale-98 transition-transform text-left group cursor-pointer"
        >
          <div className="h-8 w-8 bg-gradient-to-tr from-indigo-600 to-violet-500 rounded-xl flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-600/20 group-hover:rotate-6 transition-transform duration-300">
            🧬
          </div>
          {/* NAME ENTRY ANIMATION */}
          <span className="font-bold text-base tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent opacity-0 animate-[fadeIn_0.6s_ease-out_forwards]">
            DiffDocs Core
          </span>
        </button>

        {/* Horizontal Desktop Navbar Links */}
        <nav className="flex items-center gap-1">
          {[
            { id: "overview", label: "Dashboard", icon: BarChart3 },
            { id: "repositories", label: "Repositories", icon: FolderGit2 },
            { id: "team", label: "Cognitive Load", icon: Users },
          ].map((item) => {
            const Icon = item.icon;
            const isSelected = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 relative cursor-pointer ${
                  isSelected ? "text-white bg-zinc-900/40" : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <Icon className={`h-3.5 w-3.5 ${isSelected ? "text-indigo-400" : "text-zinc-500"}`} />
                {item.label}
                {isSelected && (
                  <div className="absolute bottom-[-17px] left-2 right-2 h-[2px] bg-indigo-500 shadow-md shadow-indigo-500/50" />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Profile Navigation Action Toggle */}
      <button 
        onClick={() => setActiveTab("profile")}
        className={`px-3 py-1.5 rounded-xl flex items-center gap-2.5 max-w-[200px] border transition-all active:scale-95 text-left cursor-pointer ${
          activeTab === "profile" 
            ? "bg-zinc-900 border-indigo-500/80 ring-1 ring-indigo-500/20 shadow-md" 
            : "bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900"
      }`}
      >
        {user.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.avatar_url} alt={user.login} className="h-6 w-6 rounded-md border border-indigo-400/20 shrink-0 shadow" />
        ) : (
          <div className="h-6 w-6 bg-gradient-to-br from-indigo-500 to-violet-500 rounded-md border border-indigo-400/20 flex items-center justify-center font-bold text-white text-[10px] shrink-0 shadow">
            {user.login.slice(0, 2).toUpperCase()}
          </div>
        )}
        <div className="truncate flex-1">
          <p className="text-[11px] font-bold text-zinc-200 truncate">{user.name}</p>
        </div>
      </button>
    </header>
  );
}