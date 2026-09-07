"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  AirtableRecord,
  ContactFields,
  RSVPStatus,
  UitnodigingFields,
} from "@/lib/airtable";
import { contactFullName } from "@/lib/airtable";
import { fetchRecords } from "@/lib/airtableClient";

type Occasion = {
  id: string;
  type: "Wedstrijd" | "Event";
  naam: string;
  datum: string;
  locatie?: string;
  notities?: string;
};

type Uitnodiging = AirtableRecord<UitnodigingFields>;
type Contact = AirtableRecord<ContactFields>;

const RSVP_STYLES: Record<RSVPStatus, string> = {
  Ja: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  Nee: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  "Wacht op antwoord": "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
};

const WEEKDAYS = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];

function toDateKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

function buildMonthGrid(year: number, month: number) {
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7; // maandag = 0
  const gridStart = new Date(year, month, 1 - startOffset);

  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    days.push(new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i));
  }
  return days;
}

export default function Calendar() {
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [occasions, setOccasions] = useState<Occasion[]>([]);
  const [uitnodigingen, setUitnodigingen] = useState<Uitnodiging[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOccasionId, setSelectedOccasionId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [wedstrijden, events, invites, contactRecords] = await Promise.all([
          fetchRecords("Wedstrijden"),
          fetchRecords("Events"),
          fetchRecords("Uitnodigingen"),
          fetchRecords("Contacten"),
        ]);

        const combined: Occasion[] = [
          ...wedstrijden
            .filter((w) => w.fields.Datum)
            .map<Occasion>((w) => ({
              id: w.id,
              type: "Wedstrijd",
              naam: w.fields.Naam,
              datum: w.fields.Datum,
              locatie: w.fields.Locatie,
              notities: w.fields.Notities,
            })),
          ...events
            .filter((ev) => ev.fields.Datum)
            .map<Occasion>((ev) => ({
              id: ev.id,
              type: "Event",
              naam: ev.fields.Naam,
              datum: ev.fields.Datum,
              locatie: ev.fields.Locatie,
              notities: ev.fields.Notities,
            })),
        ];

        setOccasions(combined);
        setUitnodigingen(invites);
        setContacts(contactRecords);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Kon kalendergegevens niet laden.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const occasionsByDate = useMemo(() => {
    const map = new Map<string, Occasion[]>();
    for (const o of occasions) {
      const key = o.datum.slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(o);
    }
    return map;
  }, [occasions]);

  const contactsById = useMemo(() => {
    const map = new Map<string, Contact>();
    for (const c of contacts) map.set(c.id, c);
    return map;
  }, [contacts]);

  function invitesFor(occasion: Occasion): Uitnodiging[] {
    return uitnodigingen.filter((u) => {
      const ids = occasion.type === "Wedstrijd" ? u.fields.Wedstrijd : u.fields.Event;
      return ids?.includes(occasion.id);
    });
  }

  function rsvpCounts(occasion: Occasion) {
    const invites = invitesFor(occasion);
    const counts: Record<RSVPStatus, number> = { Ja: 0, Nee: 0, "Wacht op antwoord": 0 };
    for (const inv of invites) {
      if (inv.fields.RSVP) counts[inv.fields.RSVP] += 1;
    }
    return counts;
  }

  const days = buildMonthGrid(cursor.getFullYear(), cursor.getMonth());
  const monthLabel = cursor.toLocaleDateString("nl-NL", { month: "long", year: "numeric" });
  const todayKey = toDateKey(today);

  const selectedOccasion = occasions.find((o) => o.id === selectedOccasionId) ?? null;
  const selectedInvites = selectedOccasion ? invitesFor(selectedOccasion) : [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Kalender</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Wedstrijden, events en RSVP-status.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            ←
          </button>
          <span className="min-w-32 text-center text-sm font-medium capitalize text-zinc-900 dark:text-zinc-50">
            {monthLabel}
          </span>
          <button
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            →
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-zinc-500">Kalender laden...</p>
      ) : (
        <>
          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-zinc-200 bg-zinc-200 text-xs dark:border-zinc-800 dark:bg-zinc-800">
            {WEEKDAYS.map((wd) => (
              <div
                key={wd}
                className="bg-zinc-50 px-2 py-1.5 text-center font-medium text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400"
              >
                {wd}
              </div>
            ))}
            {days.map((day) => {
              const key = toDateKey(day);
              const inMonth = day.getMonth() === cursor.getMonth();
              const dayOccasions = occasionsByDate.get(key) ?? [];
              return (
                <div
                  key={key}
                  className={`min-h-24 bg-white p-1.5 dark:bg-zinc-950 ${
                    inMonth ? "" : "opacity-40"
                  }`}
                >
                  <div
                    className={`mb-1 inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
                      key === todayKey
                        ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                        : "text-zinc-500 dark:text-zinc-400"
                    }`}
                  >
                    {day.getDate()}
                  </div>
                  <div className="flex flex-col gap-1">
                    {dayOccasions.map((o) => (
                      <button
                        key={o.id}
                        onClick={() => setSelectedOccasionId(o.id)}
                        className={`truncate rounded px-1.5 py-0.5 text-left text-[11px] font-medium ${
                          o.type === "Wedstrijd"
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                            : "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300"
                        }`}
                        title={o.naam}
                      >
                        {o.naam}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {selectedOccasion ? (
            <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                    {selectedOccasion.type}
                  </p>
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                    {selectedOccasion.naam}
                  </h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {new Date(selectedOccasion.datum).toLocaleDateString("nl-NL", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                    {selectedOccasion.locatie ? ` · ${selectedOccasion.locatie}` : ""}
                  </p>
                  {selectedOccasion.notities && (
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{selectedOccasion.notities}</p>
                  )}
                </div>
                <button
                  onClick={() => setSelectedOccasionId(null)}
                  className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                  Sluiten
                </button>
              </div>

              <div className="mt-4 flex gap-2 text-xs">
                {(Object.entries(rsvpCounts(selectedOccasion)) as [RSVPStatus, number][]).map(
                  ([status, count]) => (
                    <span key={status} className={`rounded-full px-2.5 py-1 font-medium ${RSVP_STYLES[status]}`}>
                      {status}: {count}
                    </span>
                  ),
                )}
              </div>

              <ul className="mt-4 flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800">
                {selectedInvites.length === 0 && (
                  <li className="py-2 text-sm text-zinc-500">Nog geen uitnodigingen verstuurd.</li>
                )}
                {selectedInvites.map((inv) => {
                  const contactId = inv.fields.Contact?.[0];
                  const contact = contactId ? contactsById.get(contactId) : undefined;
                  const status = inv.fields.RSVP ?? "Wacht op antwoord";
                  return (
                    <li key={inv.id} className="flex items-center justify-between py-2 text-sm">
                      <span className="text-zinc-900 dark:text-zinc-50">
                        {contact ? contactFullName(contact.fields) : "Onbekend contact"}
                      </span>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${RSVP_STYLES[status]}`}>
                        {status}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-zinc-500">Klik op een wedstrijd of event in de kalender voor details.</p>
          )}
        </>
      )}
    </div>
  );
}
