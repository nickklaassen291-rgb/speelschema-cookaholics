"use client";

import type { Occasion } from "@/lib/useOccasions";

function formatShortDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short" });
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function daysUntil(iso: string): number {
  const todayKey = new Date().toISOString().slice(0, 10);
  const today = new Date(`${todayKey}T00:00:00`);
  const target = new Date(`${iso.slice(0, 10)}T00:00:00`);
  return Math.round((target.getTime() - today.getTime()) / DAY_MS);
}

function needsAanwezigWaarschuwing(occasion: Occasion): boolean {
  const days = daysUntil(occasion.datum);
  return days >= 0 && days <= 30 && (!occasion.aanwezig || occasion.aanwezig.length === 0);
}

export type OccasionRow = {
  occasion: Occasion;
  gasten: number;
  ja: number;
  terugkoppelingPreview?: string;
};

type Props = {
  rows: OccasionRow[];
  showTerugkoppeling?: boolean;
  onSelect: (id: string) => void;
  emptyLabel: string;
};

export default function OccasionsTable({ rows, showTerugkoppeling, onSelect, emptyLabel }: Props) {
  if (rows.length === 0) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">{emptyLabel}</p>;
  }

  return (
    <div className="min-w-0 overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-200 text-xs font-medium text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            <th className="px-4 py-2">Datum</th>
            <th className="px-4 py-2">Naam</th>
            <th className="px-4 py-2">Locatie</th>
            <th className="px-4 py-2">Type</th>
            <th className="px-4 py-2">Aanwezig namens Cookaholics</th>
            <th className="px-4 py-2">Gasten</th>
            <th className="px-4 py-2">Ja</th>
            {showTerugkoppeling && <th className="px-4 py-2">Terugkoppeling</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {rows.map(({ occasion, gasten, ja, terugkoppelingPreview }) => {
            const waarschuwing = needsAanwezigWaarschuwing(occasion);
            return (
            <tr
              key={occasion.id}
              onClick={() => onSelect(occasion.id)}
              className="cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              <td className="px-4 py-3 text-zinc-900 dark:text-zinc-50">{formatShortDate(occasion.datum)}</td>
              <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-50">{occasion.naam}</td>
              <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">{occasion.locatie || "–"}</td>
              <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">{occasion.type}</td>
              <td className="px-4 py-3">
                {occasion.aanwezig && occasion.aanwezig.length > 0 ? (
                  <span className="text-zinc-700 dark:text-zinc-300">{occasion.aanwezig.join(", ")}</span>
                ) : waarschuwing ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
                    Nog niemand toegewezen
                  </span>
                ) : (
                  <span className="text-zinc-400 dark:text-zinc-500">–</span>
                )}
              </td>
              <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">{gasten}</td>
              <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">{ja}</td>
              {showTerugkoppeling && (
                <td className="max-w-xs truncate px-4 py-3 text-zinc-500 dark:text-zinc-400">
                  {terugkoppelingPreview || "–"}
                </td>
              )}
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
