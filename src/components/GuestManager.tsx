"use client";

import { useEffect, useState } from "react";
import type { AirtableRecord, ContactFields } from "@/lib/airtable";
import { contactFullName } from "@/lib/airtable";
import {
  createAirtableRecord,
  deleteAirtableRecord,
  fetchRecords,
  updateAirtableRecord,
} from "@/lib/airtableClient";
import AttioZoeker, { type AttioContact } from "@/components/AttioZoeker";

type Contact = AirtableRecord<ContactFields>;

const EMPTY_FORM: ContactFields = {
  Voornaam: "",
  Achternaam: "",
  Email: "",
  Telefoon: "",
  Bedrijf: "",
  Notities: "",
};

export default function GuestManager() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ContactFields>(EMPTY_FORM);
  const [search, setSearch] = useState("");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const records = await fetchRecords("Contacten");
      records.sort((a, b) => contactFullName(a.fields).localeCompare(contactFullName(b.fields)));
      setContacts(records);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kon contacten niet laden.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function startEdit(contact: Contact) {
    setEditingId(contact.id);
    setForm({
      Voornaam: contact.fields.Voornaam ?? "",
      Achternaam: contact.fields.Achternaam ?? "",
      Email: contact.fields.Email ?? "",
      Telefoon: contact.fields.Telefoon ?? "",
      Bedrijf: contact.fields.Bedrijf ?? "",
      Notities: contact.fields.Notities ?? "",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  function handleAttioSelect(contact: AttioContact) {
    const [voornaam, ...rest] = contact.naam.trim().split(/\s+/);
    setForm({
      ...form,
      Voornaam: voornaam ?? "",
      Achternaam: rest.join(" "),
      Email: contact.email,
      Telefoon: contact.telefoon,
      Bedrijf: contact.bedrijf,
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.Voornaam.trim() || !form.Achternaam.trim()) {
      setError("Voornaam en achternaam zijn verplicht.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await updateAirtableRecord("Contacten", editingId, form);
      } else {
        await createAirtableRecord("Contacten", form);
      }
      cancelEdit();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Opslaan mislukt.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Weet je zeker dat je dit contact wilt verwijderen?")) return;
    setError(null);
    try {
      await deleteAirtableRecord("Contacten", id);
      if (editingId === id) cancelEdit();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verwijderen mislukt.");
    }
  }

  const filtered = contacts.filter((c) => {
    const q = search.toLowerCase();
    return (
      contactFullName(c.fields).toLowerCase().includes(q) ||
      c.fields.Email?.toLowerCase().includes(q) ||
      c.fields.Telefoon?.toLowerCase().includes(q) ||
      c.fields.Bedrijf?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Gasten</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Beheer je contacten voor Cookaholics wedstrijddagen.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="mb-2 text-sm font-medium text-zinc-600 dark:text-zinc-400">
          Zoek contact in Attio
        </h3>
        <AttioZoeker onSelect={handleAttioSelect} />
      </div>

      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 gap-3 rounded-xl border border-zinc-200 bg-white p-4 sm:grid-cols-2 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Voornaam *</label>
          <input
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950"
            value={form.Voornaam}
            onChange={(e) => setForm({ ...form, Voornaam: e.target.value })}
            placeholder="Bijv. Jan"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Achternaam *</label>
          <input
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950"
            value={form.Achternaam}
            onChange={(e) => setForm({ ...form, Achternaam: e.target.value })}
            placeholder="Bijv. Jansen"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Email</label>
          <input
            type="email"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950"
            value={form.Email}
            onChange={(e) => setForm({ ...form, Email: e.target.value })}
            placeholder="jan@voorbeeld.nl"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Telefoon</label>
          <input
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950"
            value={form.Telefoon}
            onChange={(e) => setForm({ ...form, Telefoon: e.target.value })}
            placeholder="06 12345678"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Bedrijf</label>
          <input
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950"
            value={form.Bedrijf}
            onChange={(e) => setForm({ ...form, Bedrijf: e.target.value })}
            placeholder="Bijv. Cookaholics BV"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Notities</label>
          <input
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950"
            value={form.Notities}
            onChange={(e) => setForm({ ...form, Notities: e.target.value })}
            placeholder="Allergieën, opmerkingen..."
          />
        </div>

        <div className="flex items-center gap-2 sm:col-span-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {saving ? "Bezig..." : editingId ? "Wijzigingen opslaan" : "Contact toevoegen"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={cancelEdit}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Annuleren
            </button>
          )}
        </div>
      </form>

      <input
        className="w-full max-w-sm rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950"
        placeholder="Zoek op naam, email of telefoon..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {loading ? (
        <p className="text-sm text-zinc-500">Contacten laden...</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-zinc-500">Geen contacten gevonden.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
          {filtered.map((contact) => (
            <li key={contact.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="font-medium text-zinc-900 dark:text-zinc-50">{contactFullName(contact.fields)}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {[contact.fields.Email, contact.fields.Telefoon, contact.fields.Bedrijf]
                    .filter(Boolean)
                    .join(" · ") || "Geen contactgegevens"}
                </p>
                {contact.fields.Notities && (
                  <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">{contact.fields.Notities}</p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => startEdit(contact)}
                  className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  Bewerken
                </button>
                <button
                  onClick={() => handleDelete(contact.id)}
                  className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
                >
                  Verwijderen
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
