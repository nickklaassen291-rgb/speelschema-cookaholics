"use client";

import { useEffect, useMemo, useState } from "react";
import type { AirtableRecord, OccasionSelectOptions, RSVPStatus, TerugkoppelingDoor, UitnodigingFields } from "@/lib/airtable";
import { contactFullName, TERUGKOPPELING_DOOR } from "@/lib/airtable";
import {
  createAirtableRecord,
  createOccasion,
  deleteAirtableRecord,
  fetchOccasionSelectOptions,
  updateAirtableRecord,
  updateOccasion,
} from "@/lib/airtableClient";
import { useOccasions } from "@/lib/useOccasions";
import OccasionsTable, { daysUntil } from "@/components/OccasionsTable";
import OccasionForm, { EMPTY_OCCASION_FORM_VALUES, type OccasionFormValues } from "@/components/OccasionForm";
import InviteList, { RSVP_STYLES } from "@/components/InviteList";
import type { Occasion } from "@/lib/useOccasions";

type OccasionFilterKey = "wedstrijdenFcDb" | "businessclubFcDb" | "rkc" | "overigeEvents";

const OCCASION_FILTERS: { key: OccasionFilterKey; label: string }[] = [
  { key: "wedstrijdenFcDb", label: "Wedstrijden FC Den Bosch" },
  { key: "businessclubFcDb", label: "Businessclub events FC Den Bosch" },
  { key: "rkc", label: "RKC Waalwijk" },
  { key: "overigeEvents", label: "Overige events" },
];

function matchesFilter(o: Occasion, key: OccasionFilterKey): boolean {
  switch (key) {
    case "wedstrijdenFcDb":
      return o.type === "Wedstrijd" && o.club === "FC Den Bosch";
    case "businessclubFcDb":
      return o.type === "Event" && o.club === "FC Den Bosch" && !!o.businessclubEvent;
    case "rkc":
      return o.club === "RKC Waalwijk";
    case "overigeEvents":
      return o.type === "Event" && o.club !== "RKC Waalwijk" && !(o.club === "FC Den Bosch" && o.businessclubEvent);
  }
}

function matchesAnyFilter(o: Occasion, keys: Set<OccasionFilterKey>): boolean {
  for (const key of keys) {
    if (matchesFilter(o, key)) return true;
  }
  return false;
}

export default function Calendar() {
  const { occasions, contacts, contactsById, loading, error, invitesFor, rsvpCounts, gastenCount, reload } =
    useOccasions();
  const [selectedOccasionId, setSelectedOccasionId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const [uitgenodigdDoor, setUitgenodigdDoor] = useState<TerugkoppelingDoor | "">("");
  const [gastZoekterm, setGastZoekterm] = useState("");
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  const [busyInviteId, setBusyInviteId] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const [selectOptions, setSelectOptions] = useState<OccasionSelectOptions | null>(null);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [createFormKey, setCreateFormKey] = useState(0);

  useEffect(() => {
    fetchOccasionSelectOptions()
      .then(setSelectOptions)
      .catch((err) => setOptionsError(err instanceof Error ? err.message : "Kon opties niet laden."));
  }, []);

  const aanwezigOpties = {
    wedstrijd: selectOptions?.wedstrijdAanwezig ?? [],
    event: selectOptions?.eventAanwezig ?? [],
  };
  const rsvpOpties = selectOptions?.rsvpStatussen ?? [];

  async function handleCreate(values: OccasionFormValues) {
    await createOccasion(values.soort, {
      Naam: values.naam,
      Datum: values.datum,
      Tijd: values.tijd,
      Locatie: values.locatie,
      Aanwezig: values.aanwezig,
      ...(values.club ? { Club: values.club } : {}),
      ...(values.soort === "Event" ? { "Businessclub event": values.businessclubEvent } : {}),
      ...(values.beschikbarePlaatsen.trim() ? { "Beschikbare plaatsen": Number(values.beschikbarePlaatsen) } : {}),
    });
    setCreateFormKey((k) => k + 1);
    await reload();
  }

  const [activeFilters, setActiveFilters] = useState<Set<OccasionFilterKey>>(new Set());

  function toggleFilter(key: OccasionFilterKey) {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const upcoming = useMemo(() => {
    const todayKey = new Date().toISOString().slice(0, 10);
    return occasions
      .filter((o) => o.datum.slice(0, 10) >= todayKey)
      .filter((o) => activeFilters.size === 0 || matchesAnyFilter(o, activeFilters))
      .sort((a, b) => a.datum.localeCompare(b.datum));
  }, [occasions, activeFilters]);

  const rows = useMemo(
    () =>
      upcoming.map((occasion) => ({
        occasion,
        gasten: gastenCount(occasion),
        ja: rsvpCounts(occasion).Ja,
      })),
    [upcoming, gastenCount, rsvpCounts],
  );

  const selectedOccasion = upcoming.find((o) => o.id === selectedOccasionId) ?? null;
  const selectedInvites = selectedOccasion ? invitesFor(selectedOccasion) : [];

  const alreadyInvitedIds = new Set(selectedInvites.map((inv) => inv.fields.Contact?.[0]).filter(Boolean));
  const matchingContacts =
    gastZoekterm.trim().length < 2
      ? []
      : contacts
          .filter((c) => !alreadyInvitedIds.has(c.id))
          .filter((c) => {
            const q = gastZoekterm.toLowerCase();
            return (
              contactFullName(c.fields).toLowerCase().includes(q) ||
              c.fields.Email?.toLowerCase().includes(q) ||
              c.fields.Bedrijf?.toLowerCase().includes(q)
            );
          });

  async function handleLinkGuest(contactId: string) {
    if (!selectedOccasion) return;
    setLinking(true);
    setLinkError(null);
    try {
      await createAirtableRecord("Uitnodigingen", {
        Contact: [contactId],
        ...(selectedOccasion.type === "Wedstrijd" ? { Wedstrijd: [selectedOccasion.id] } : {}),
        ...(selectedOccasion.type === "Event" ? { Events: [selectedOccasion.id] } : {}),
        "RSVP Status": "Wacht op antwoord",
        "Aantal personen": 1,
        ...(uitgenodigdDoor ? { "Uitgenodigd door": uitgenodigdDoor } : {}),
      });
      setGastZoekterm("");
      await reload();
    } catch (err) {
      setLinkError(err instanceof Error ? err.message : "Koppelen mislukt.");
    } finally {
      setLinking(false);
    }
  }

  async function handleRsvpChange(invite: AirtableRecord<UitnodigingFields>, status: RSVPStatus) {
    setBusyInviteId(invite.id);
    setInviteError(null);
    try {
      await updateAirtableRecord("Uitnodigingen", invite.id, { "RSVP Status": status }, { typecast: false });
      await reload();
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : "Bijwerken van RSVP mislukt.");
    } finally {
      setBusyInviteId(null);
    }
  }

  async function handleAantalChange(invite: AirtableRecord<UitnodigingFields>, aantal: number) {
    setBusyInviteId(invite.id);
    setInviteError(null);
    try {
      await updateAirtableRecord("Uitnodigingen", invite.id, { "Aantal personen": aantal }, { typecast: false });
      await reload();
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : "Bijwerken van aantal personen mislukt.");
    } finally {
      setBusyInviteId(null);
    }
  }

  async function handleRemoveInvite(invite: AirtableRecord<UitnodigingFields>) {
    if (!confirm("Weet je zeker dat je deze uitnodiging wilt verwijderen?")) return;
    setBusyInviteId(invite.id);
    setInviteError(null);
    try {
      await deleteAirtableRecord("Uitnodigingen", invite.id);
      await reload();
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : "Verwijderen van uitnodiging mislukt.");
    } finally {
      setBusyInviteId(null);
    }
  }

  async function handleUpdate(values: OccasionFormValues) {
    if (!selectedOccasion) return;
    await updateOccasion(selectedOccasion.table, selectedOccasion.id, {
      Naam: values.naam,
      Datum: values.datum,
      Tijd: values.tijd,
      Locatie: values.locatie,
      Aanwezig: values.aanwezig,
      ...(values.club ? { Club: values.club } : {}),
      ...(values.soort === "Event" ? { "Businessclub event": values.businessclubEvent } : {}),
      "Beschikbare plaatsen": values.beschikbarePlaatsen.trim() ? Number(values.beschikbarePlaatsen) : null,
    });
    setEditing(false);
    await reload();
  }

  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDeleteOccasion() {
    if (!selectedOccasion) return;
    if (
      !confirm(
        `Weet je zeker dat je "${selectedOccasion.naam}" wilt verwijderen? Alle bijbehorende uitnodigingen blijven bestaan maar verliezen de koppeling.`,
      )
    )
      return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteAirtableRecord(selectedOccasion.table, selectedOccasion.id);
      setSelectedOccasionId(null);
      setEditing(false);
      await reload();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Verwijderen mislukt.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Kalender</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Wedstrijden, events en RSVP-status.</p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      {optionsError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {optionsError}
        </div>
      )}

      <OccasionForm
        key={createFormKey}
        initialValues={EMPTY_OCCASION_FORM_VALUES}
        aanwezigOpties={aanwezigOpties}
        onSubmit={handleCreate}
        submitLabel="Toevoegen"
        submittingLabel="Toevoegen..."
      />

      <div className="flex flex-wrap gap-2">
        {OCCASION_FILTERS.map(({ key, label }) => {
          const active = activeFilters.has(key);
          return (
            <button
              key={key}
              type="button"
              onClick={() => toggleFilter(key)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                  : "border-zinc-300 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
              }`}
            >
              {label}
            </button>
          );
        })}
        {activeFilters.size > 0 && (
          <button
            type="button"
            onClick={() => setActiveFilters(new Set())}
            className="rounded-full px-3 py-1.5 text-xs font-medium text-zinc-500 underline hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            Filters wissen
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">Kalender laden...</p>
      ) : (
        <>
          <OccasionsTable
            rows={rows}
            selectedId={selectedOccasionId}
            onSelect={(id) => {
              setSelectedOccasionId((current) => (current === id ? null : id));
              setEditing(false);
              setGastZoekterm("");
              setLinkError(null);
              setInviteError(null);
            }}
            emptyLabel="Geen toekomstige wedstrijden of events."
            renderDetail={() =>
              !selectedOccasion ? null : (
              <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              {editing ? (
                <>
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                      {selectedOccasion.type} bewerken
                    </p>
                  </div>
                  {deleteError && (
                    <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
                      {deleteError}
                    </div>
                  )}
                  <OccasionForm
                    initialValues={{
                      soort: selectedOccasion.type,
                      naam: selectedOccasion.naam,
                      datum: selectedOccasion.datum.slice(0, 10),
                      tijd: selectedOccasion.tijd ?? "",
                      locatie: selectedOccasion.locatie ?? "",
                      aanwezig: selectedOccasion.aanwezig ?? [],
                      club: selectedOccasion.club ?? "",
                      businessclubEvent: selectedOccasion.businessclubEvent ?? false,
                      beschikbarePlaatsen:
                        selectedOccasion.beschikbarePlaatsen != null
                          ? String(selectedOccasion.beschikbarePlaatsen)
                          : "",
                    }}
                    soortLocked
                    aanwezigOpties={aanwezigOpties}
                    onSubmit={handleUpdate}
                    onCancel={() => setEditing(false)}
                    submitLabel="Wijzigingen opslaan"
                    submittingLabel="Opslaan..."
                  />
                  <div className="mt-3 border-t border-zinc-200 pt-3 dark:border-zinc-800">
                    <button
                      type="button"
                      onClick={handleDeleteOccasion}
                      disabled={deleting}
                      className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950"
                    >
                      {deleting ? "Verwijderen..." : `${selectedOccasion.type} verwijderen`}
                    </button>
                  </div>
                </>
              ) : (
                <>
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
                        {selectedOccasion.tijd ? ` · ${selectedOccasion.tijd}` : ""}
                        {selectedOccasion.locatie ? ` · ${selectedOccasion.locatie}` : ""}
                      </p>
                      {selectedOccasion.aanwezig && selectedOccasion.aanwezig.length > 0 ? (
                        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                          Aanwezig: {selectedOccasion.aanwezig.join(", ")}
                        </p>
                      ) : (
                        daysUntil(selectedOccasion.datum) >= 0 &&
                        daysUntil(selectedOccasion.datum) <= 30 && (
                          <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
                            Nog niemand namens Cookaholics toegewezen
                          </p>
                        )
                      )}
                      {selectedOccasion.beschikbarePlaatsen != null && (
                        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                          Beschikbare plaatsen: {selectedOccasion.beschikbarePlaatsen}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditing(true)}
                        className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                      >
                        Bewerken
                      </button>
                      <button
                        onClick={() => setSelectedOccasionId(null)}
                        className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                      >
                        Sluiten
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 flex gap-2 text-xs">
                    {(Object.entries(rsvpCounts(selectedOccasion)) as [RSVPStatus, number][]).map(
                      ([status, count]) => (
                        <span
                          key={status}
                          className={`rounded-full px-2.5 py-1 font-medium ${RSVP_STYLES[status]}`}
                        >
                          {status}: {count}
                        </span>
                      ),
                    )}
                  </div>

                  {inviteError && (
                    <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
                      {inviteError}
                    </div>
                  )}

                  <div className="mt-4">
                    <InviteList
                      invites={selectedInvites}
                      contactsById={contactsById}
                      rsvpOpties={rsvpOpties}
                      onRsvpChange={handleRsvpChange}
                      onAantalChange={handleAantalChange}
                      onRemove={handleRemoveInvite}
                      busyId={busyInviteId}
                      emptyLabel="Nog geen uitnodigingen verstuurd."
                    />
                  </div>

                  <div className="mt-4 flex flex-col gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
                    <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Gast koppelen</p>
                    {linkError && (
                      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
                        {linkError}
                      </div>
                    )}
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <select
                        className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950"
                        value={uitgenodigdDoor}
                        onChange={(e) => setUitgenodigdDoor(e.target.value as TerugkoppelingDoor | "")}
                      >
                        <option value="">Uitgenodigd door...</option>
                        {TERUGKOPPELING_DOOR.map((persoon) => (
                          <option key={persoon} value={persoon}>
                            {persoon}
                          </option>
                        ))}
                      </select>
                      <input
                        className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950"
                        value={gastZoekterm}
                        onChange={(e) => setGastZoekterm(e.target.value)}
                        placeholder="Zoek een contact op naam, email of bedrijf"
                      />
                    </div>

                    {gastZoekterm.trim().length >= 2 && (
                      <ul className="flex flex-col divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
                        {matchingContacts.length === 0 && (
                          <li className="px-3 py-2 text-sm text-zinc-500 dark:text-zinc-400">
                            Geen contacten gevonden.
                          </li>
                        )}
                        {matchingContacts.map((c) => (
                          <li key={c.id}>
                            <button
                              type="button"
                              disabled={linking}
                              onClick={() => handleLinkGuest(c.id)}
                              className="w-full px-3 py-2 text-left text-sm hover:bg-zinc-50 disabled:opacity-50 dark:hover:bg-zinc-800"
                            >
                              <span className="font-medium text-zinc-900 dark:text-zinc-50">
                                {contactFullName(c.fields)}
                              </span>
                              {c.fields.Bedrijf && (
                                <span className="text-zinc-500 dark:text-zinc-400"> · {c.fields.Bedrijf}</span>
                              )}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </>
              )}
              </div>
              )
            }
          />
          {!selectedOccasion && (
            <p className="text-sm text-zinc-500">Klik op een wedstrijd of event in de tabel voor details.</p>
          )}
        </>
      )}
    </div>
  );
}
