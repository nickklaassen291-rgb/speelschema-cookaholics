"use client";

import { useEffect, useMemo, useState } from "react";
import type { RSVPStatus, TerugkoppelingDoor } from "@/lib/airtable";
import { contactFullName, TERUGKOPPELING_DOOR } from "@/lib/airtable";
import { updateTerugkoppeling } from "@/lib/airtableClient";
import { useOccasions } from "@/lib/useOccasions";
import OccasionsTable from "@/components/OccasionsTable";

const RSVP_STYLES: Record<RSVPStatus, string> = {
  Ja: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  Nee: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  "Wacht op antwoord": "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
};

export default function Geweest() {
  const { occasions, contactsById, loading, error, invitesFor, rsvpCounts, reload } = useOccasions();
  const [selectedOccasionId, setSelectedOccasionId] = useState<string | null>(null);
  const [terugkoppeling, setTerugkoppeling] = useState("");
  const [terugkoppelingDoor, setTerugkoppelingDoor] = useState<TerugkoppelingDoor | "">("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const past = useMemo(() => {
    const todayKey = new Date().toISOString().slice(0, 10);
    return occasions
      .filter((o) => o.datum.slice(0, 10) < todayKey)
      .sort((a, b) => b.datum.localeCompare(a.datum));
  }, [occasions]);

  const rows = useMemo(
    () =>
      past.map((occasion) => ({
        occasion,
        gasten: invitesFor(occasion).length,
        ja: rsvpCounts(occasion).Ja,
        terugkoppelingPreview: (occasion.terugkoppeling ?? "").split("\n")[0],
      })),
    [past, invitesFor, rsvpCounts],
  );

  const selectedOccasion = past.find((o) => o.id === selectedOccasionId) ?? null;
  const selectedInvites = selectedOccasion ? invitesFor(selectedOccasion) : [];

  useEffect(() => {
    setTerugkoppeling(selectedOccasion?.terugkoppeling ?? "");
    setTerugkoppelingDoor(selectedOccasion?.terugkoppelingDoor ?? "");
    setSaveError(null);
  }, [selectedOccasion]);

  async function handleSave() {
    if (!selectedOccasion) return;
    setSaving(true);
    setSaveError(null);
    try {
      await updateTerugkoppeling(selectedOccasion.table, selectedOccasion.id, {
        Terugkoppeling: terugkoppeling,
        ...(terugkoppelingDoor ? { "Terugkoppeling door": terugkoppelingDoor } : {}),
      });
      await reload();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Opslaan van terugkoppeling mislukt.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Geweest</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Afgelopen wedstrijden en events met terugkoppeling.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-zinc-500">Gegevens laden...</p>
      ) : (
        <>
          <OccasionsTable
            rows={rows}
            showTerugkoppeling
            onSelect={setSelectedOccasionId}
            emptyLabel="Geen afgelopen wedstrijden of events."
          />

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
                  <li className="py-2 text-sm text-zinc-500">Geen uitnodigingen verstuurd.</li>
                )}
                {selectedInvites.map((inv) => {
                  const contactId = inv.fields.Contact?.[0];
                  const contact = contactId ? contactsById.get(contactId) : undefined;
                  const status = inv.fields["RSVP Status"] ?? "Wacht op antwoord";
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

              <div className="mt-4 flex flex-col gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
                {saveError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
                    {saveError}
                  </div>
                )}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Terugkoppeling</label>
                  <textarea
                    className="min-h-32 rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950"
                    value={terugkoppeling}
                    onChange={(e) => setTerugkoppeling(e.target.value)}
                    placeholder="Hoe is het gegaan?"
                  />
                </div>
                <div className="flex flex-col gap-1 sm:max-w-xs">
                  <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    Terugkoppeling door
                  </label>
                  <select
                    className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950"
                    value={terugkoppelingDoor}
                    onChange={(e) => setTerugkoppelingDoor(e.target.value as TerugkoppelingDoor | "")}
                  >
                    <option value="">Kies...</option>
                    {TERUGKOPPELING_DOOR.map((persoon) => (
                      <option key={persoon} value={persoon}>
                        {persoon}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                  >
                    {saving ? "Opslaan..." : "Opslaan"}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-zinc-500">Klik op een wedstrijd of event in de tabel voor details.</p>
          )}
        </>
      )}
    </div>
  );
}
