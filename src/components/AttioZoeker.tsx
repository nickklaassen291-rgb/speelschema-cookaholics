// src/components/AttioZoeker.tsx
//
// Zoekveld dat personen in Attio ophaalt. Bij selectie krijgt de parent
// naam, email, telefoon en bedrijf terug om het gastformulier te vullen.

'use client';

import { useState } from 'react';

export type AttioContact = {
  id: string;
  naam: string;
  email: string;
  telefoon: string;
  bedrijf: string;
};

type Props = {
  onSelect: (contact: AttioContact) => void;
};

export default function AttioZoeker({ onSelect }: Props) {
  const [zoekterm, setZoekterm] = useState('');
  const [resultaten, setResultaten] = useState<AttioContact[]>([]);
  const [bezig, setBezig] = useState(false);
  const [gezocht, setGezocht] = useState(false);
  const [fout, setFout] = useState('');

  async function zoek() {
    if (zoekterm.trim().length < 2) return;

    setBezig(true);
    setFout('');

    try {
      const res = await fetch('/api/attio/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zoekterm }),
      });

      const data = await res.json();

      if (!res.ok) {
        setFout(data.error ?? 'Zoeken mislukt');
        setResultaten([]);
      } else {
        setResultaten(data.results ?? []);
      }
    } catch {
      setFout('Kon Attio niet bereiken');
      setResultaten([]);
    } finally {
      setBezig(false);
      setGezocht(true);
    }
  }

  function kies(contact: AttioContact) {
    onSelect(contact);
    setZoekterm('');
    setResultaten([]);
    setGezocht(false);
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          type="text"
          value={zoekterm}
          onChange={(e) => setZoekterm(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && zoek()}
          placeholder="Zoek een contact in Attio"
          className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950"
        />
        <button
          onClick={zoek}
          disabled={bezig || zoekterm.trim().length < 2}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {bezig ? 'Zoeken' : 'Zoek'}
        </button>
      </div>

      {fout && <p className="text-sm text-red-600 dark:text-red-400">{fout}</p>}

      {resultaten.length > 0 && (
        <ul className="flex flex-col divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
          {resultaten.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => kies(c)}
                className="w-full px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                <p className="font-medium text-zinc-900 dark:text-zinc-50">{c.naam}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {[c.bedrijf, c.email, c.telefoon].filter(Boolean).join(' · ')}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}

      {gezocht && !bezig && resultaten.length === 0 && !fout && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Geen contacten gevonden</p>
      )}
    </div>
  );
}
