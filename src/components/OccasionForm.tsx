"use client";

import { useEffect, useState } from "react";
import type { Club, OccasionSoort } from "@/lib/airtable";
import { CLUBS } from "@/lib/airtable";

export type OccasionFormValues = {
  soort: OccasionSoort;
  naam: string;
  datum: string;
  tijd: string;
  locatie: string;
  aanwezig: string[];
  club: Club | "";
  businessclubEvent: boolean;
};

export const EMPTY_OCCASION_FORM_VALUES: OccasionFormValues = {
  soort: "Wedstrijd",
  naam: "",
  datum: "",
  tijd: "",
  locatie: "",
  aanwezig: [],
  club: "",
  businessclubEvent: false,
};

type Props = {
  initialValues: OccasionFormValues;
  soortLocked?: boolean;
  aanwezigOpties: { wedstrijd: string[]; event: string[] };
  onSubmit: (values: OccasionFormValues) => Promise<void>;
  onCancel?: () => void;
  submitLabel: string;
  submittingLabel: string;
};

export default function OccasionForm({
  initialValues,
  soortLocked,
  aanwezigOpties,
  onSubmit,
  onCancel,
  submitLabel,
  submittingLabel,
}: Props) {
  const [values, setValues] = useState(initialValues);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setValues(initialValues);
  }, [initialValues]);

  const opties = values.soort === "Wedstrijd" ? aanwezigOpties.wedstrijd : aanwezigOpties.event;

  function toggleAanwezig(naam: string) {
    setValues((v) => ({
      ...v,
      aanwezig: v.aanwezig.includes(naam) ? v.aanwezig.filter((n) => n !== naam) : [...v.aanwezig, naam],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!values.naam.trim() || !values.datum) {
      setError("Naam en datum zijn verplicht.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSubmit(values);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Opslaan mislukt.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid grid-cols-1 gap-3 rounded-xl border border-zinc-200 bg-white p-4 sm:grid-cols-2 dark:border-zinc-800 dark:bg-zinc-900"
    >
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 sm:col-span-2 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Soort</label>
        <select
          disabled={soortLocked}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950"
          value={values.soort}
          onChange={(e) => setValues({ ...values, soort: e.target.value as OccasionSoort, aanwezig: [] })}
        >
          <option value="Wedstrijd">Wedstrijd</option>
          <option value="Event">Event</option>
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Club</label>
        <select
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950"
          value={values.club}
          onChange={(e) => setValues({ ...values, club: e.target.value as Club | "" })}
        >
          <option value="">Kies een club...</option>
          {CLUBS.map((club) => (
            <option key={club} value={club}>
              {club}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Naam *</label>
        <input
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950"
          value={values.naam}
          onChange={(e) => setValues({ ...values, naam: e.target.value })}
          placeholder="Bijv. Cookaholics Open"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Datum *</label>
        <input
          type="date"
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950"
          value={values.datum}
          onChange={(e) => setValues({ ...values, datum: e.target.value })}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Tijd</label>
        <input
          type="time"
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950"
          value={values.tijd}
          onChange={(e) => setValues({ ...values, tijd: e.target.value })}
        />
      </div>
      <div className="flex flex-col gap-1 sm:col-span-2">
        <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Locatie</label>
        <input
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950"
          value={values.locatie}
          onChange={(e) => setValues({ ...values, locatie: e.target.value })}
          placeholder="Bijv. Sportpark De Lange Weide"
        />
      </div>
      {values.soort === "Event" && (
        <div className="flex flex-col gap-1 sm:col-span-2">
          <label className="flex items-center gap-1.5 text-sm text-zinc-700 dark:text-zinc-300">
            <input
              type="checkbox"
              className="rounded border-zinc-300 dark:border-zinc-700"
              checked={values.businessclubEvent}
              onChange={(e) => setValues({ ...values, businessclubEvent: e.target.checked })}
            />
            Businessclub event
          </label>
        </div>
      )}
      <div className="flex flex-col gap-1 sm:col-span-2">
        <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
          Aanwezig namens Cookaholics
        </label>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {opties.map((naam) => (
            <label key={naam} className="flex items-center gap-1.5 text-sm text-zinc-700 dark:text-zinc-300">
              <input
                type="checkbox"
                className="rounded border-zinc-300 dark:border-zinc-700"
                checked={values.aanwezig.includes(naam)}
                onChange={() => toggleAanwezig(naam)}
              />
              {naam}
            </label>
          ))}
        </div>
      </div>

      <div className="flex gap-2 sm:col-span-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {saving ? submittingLabel : submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Annuleren
          </button>
        )}
      </div>
    </form>
  );
}
