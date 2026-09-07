"use client";

import { useState } from "react";
import Calendar from "@/components/Calendar";
import GuestManager from "@/components/GuestManager";
import InviteGenerator from "@/components/InviteGenerator";

const TABS = [
  { key: "kalender", label: "Kalender" },
  { key: "gasten", label: "Gasten" },
  { key: "uitnodiging", label: "Uitnodiging" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function Home() {
  const [tab, setTab] = useState<TabKey>("kalender");

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <header className="border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-950">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Speelschema Cookaholics
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Wedstrijden, gasten en uitnodigingen op één plek.
        </p>
      </header>

      <nav className="flex gap-1 border-b border-zinc-200 bg-white px-6 dark:border-zinc-800 dark:bg-zinc-950">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
              tab === t.key
                ? "border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-50"
                : "border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
        {tab === "kalender" && <Calendar />}
        {tab === "gasten" && <GuestManager />}
        {tab === "uitnodiging" && <InviteGenerator />}
      </main>
    </div>
  );
}
