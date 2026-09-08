"use client";

import { useEffect, useMemo, useState } from "react";
import type { AirtableRecord, ContactFields } from "@/lib/airtable";
import { contactFullName } from "@/lib/airtable";
import { createAirtableRecord, fetchRecords } from "@/lib/airtableClient";

type Contact = AirtableRecord<ContactFields>;

type Occasion = {
  key: string;
  id: string;
  type: "Wedstrijd" | "Event";
  naam: string;
  datum?: string;
  tijd?: string;
  locatie?: string;
};

function formatDate(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function defaultTemplate(naam: string, occasion?: Occasion) {
  const wedstrijdNaam = occasion?.naam ?? "[wedstrijd]";
  const datum = occasion ? formatDate(occasion.datum) : "[datum]";
  const tijd = occasion?.tijd ? ` om ${occasion.tijd}` : "";
  const locatie = occasion?.locatie || "[locatie]";
  return `Hoi ${naam || "[naam]"}! 🏆

Je bent uitgenodigd voor ${wedstrijdNaam} op ${datum}${tijd} in ${locatie}.

Laat je ons weten of je erbij bent? 🙌

Groetjes,
Cookaholics`;
}

export default function InviteGenerator() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [occasions, setOccasions] = useState<Occasion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const [contactId, setContactId] = useState("");
  const [manualNaam, setManualNaam] = useState("");
  const [occasionKey, setOccasionKey] = useState("");
  const [message, setMessage] = useState("");
  const [autoUpdated, setAutoUpdated] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [contactRecords, wedstrijden, events] = await Promise.all([
          fetchRecords("Contacten"),
          fetchRecords("Wedstrijden"),
          fetchRecords("Events"),
        ]);

        contactRecords.sort((a, b) => contactFullName(a.fields).localeCompare(contactFullName(b.fields)));
        setContacts(contactRecords);

        const combined: Occasion[] = [
          ...wedstrijden.map<Occasion>((w) => ({
            key: `Wedstrijd:${w.id}`,
            id: w.id,
            type: "Wedstrijd",
            naam: w.fields.Naam,
            datum: w.fields.Datum,
            tijd: w.fields.Tijd,
            locatie: w.fields.Locatie,
          })),
          ...events.map<Occasion>((ev) => ({
            key: `Event:${ev.id}`,
            id: ev.id,
            type: "Event",
            naam: ev.fields.Naam,
            datum: ev.fields.Datum,
            tijd: ev.fields.Tijd,
            locatie: ev.fields.Locatie,
          })),
        ].sort((a, b) => (a.datum ?? "").localeCompare(b.datum ?? ""));

        setOccasions(combined);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Kon gegevens niet laden.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const selectedOccasion = useMemo(
    () => occasions.find((o) => o.key === occasionKey),
    [occasions, occasionKey],
  );

  const selectedContact = useMemo(
    () => contacts.find((c) => c.id === contactId),
    [contacts, contactId],
  );

  const gastNaam = selectedContact ? contactFullName(selectedContact.fields) : manualNaam;

  useEffect(() => {
    if (autoUpdated) {
      setMessage(defaultTemplate(gastNaam, selectedOccasion));
    }
  }, [gastNaam, selectedOccasion, autoUpdated]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Kopiëren naar klembord mislukt. Selecteer en kopieer de tekst handmatig.");
    }
  }

  async function handleSaveInvite() {
    if (!selectedOccasion) {
      setError("Kies eerst een wedstrijd of event.");
      return;
    }
    if (!contactId) {
      setError("Selecteer een bestaand contact om de uitnodiging op te slaan in Airtable.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await createAirtableRecord("Uitnodigingen", {
        Contact: [contactId],
        ...(selectedOccasion.type === "Wedstrijd" ? { Wedstrijd: [selectedOccasion.id] } : {}),
        ...(selectedOccasion.type === "Event" ? { Events: [selectedOccasion.id] } : {}),
        "RSVP Status": "Wacht op antwoord",
        "Verstuurd op": new Date().toISOString().slice(0, 10),
      });
      setCopied(false);
      alert("Uitnodiging opgeslagen in Airtable met status 'Wacht op antwoord'.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Opslaan van uitnodiging mislukt.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Uitnodiging maken</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Genereer een kant-en-klare tekst voor WhatsApp of mail.
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Wedstrijd / Event
            </label>
            <select
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950"
              value={occasionKey}
              onChange={(e) => setOccasionKey(e.target.value)}
            >
              <option value="">Kies...</option>
              {occasions.map((o) => (
                <option key={o.key} value={o.key}>
                  [{o.type}] {o.naam} {o.datum ? `– ${formatDate(o.datum)}` : ""}
                  {o.tijd ? ` ${o.tijd}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Gast (uit contacten)</label>
            <select
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950"
              value={contactId}
              onChange={(e) => {
                setContactId(e.target.value);
                if (e.target.value) setManualNaam("");
              }}
            >
              <option value="">Geen (typ handmatig)</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {contactFullName(c.fields)}
                </option>
              ))}
            </select>
          </div>

          {!contactId && (
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Naam gast (handmatig, niet opgeslagen in Airtable)
              </label>
              <input
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950"
                value={manualNaam}
                onChange={(e) => setManualNaam(e.target.value)}
                placeholder="Bijv. Piet"
              />
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Bericht</label>
          <button
            type="button"
            onClick={() => setAutoUpdated(true)}
            className="text-xs text-zinc-500 underline hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            Reset naar standaardtekst
          </button>
        </div>
        <textarea
          className="min-h-48 rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950"
          value={message}
          onChange={(e) => {
            setMessage(e.target.value);
            setAutoUpdated(false);
          }}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleCopy}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {copied ? "Gekopieerd!" : "Kopieer tekst"}
        </button>
        <button
          onClick={handleSaveInvite}
          disabled={saving}
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          {saving ? "Opslaan..." : "Opslaan als uitnodiging (RSVP: wacht op antwoord)"}
        </button>
      </div>
    </div>
  );
}
