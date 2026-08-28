"use client";

import React from "react";
import { LogOut, ShieldAlert } from "lucide-react";
import { DiffDocsUser } from "../lib/auth";

interface AccessDeniedScreenProps {
  user: DiffDocsUser;
  onSignOut: () => void;
}

export default function AccessDeniedScreen({ user, onSignOut }: AccessDeniedScreenProps) {
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
            DiffDocs instance&apos;s data belongs to whichever GitHub account installed the App. Install the
            GitHub App on your own repositories to see your own data here.
          </p>
        </div>

        <button
          onClick={onSignOut}
          className="w-full flex items-center justify-center gap-2.5 px-4 py-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 font-semibold rounded-xl transition-all cursor-pointer"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </div>
  );
}
