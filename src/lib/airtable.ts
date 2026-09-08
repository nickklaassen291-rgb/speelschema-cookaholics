/**
 * Airtable API helpers voor het Cookaholics gast-management systeem.
 *
 * Verwacht base schema (pas namen in Airtable aan of update de types hieronder):
 *
 * Contacten
 *   - Voornaam (text)
 *   - Achternaam (text)
 *   - Email (email)
 *   - Telefoon (phone/text)
 *   - Bedrijf (text)
 *   - Notities (long text)
 *
 * Wedstrijden
 *   - Naam (text)
 *   - Datum (date)
 *   - Locatie (text)
 *   - Notities (long text)
 *   - Terugkoppeling (long text)
 *   - Terugkoppeling door (single select: "Gijs" | "Steffan" | "Lotte" | "Nick" | "Lynn")
 *
 * Events
 *   - Naam (text)
 *   - Datum (date)
 *   - Type (text, bv. "Training", "Feest", "Overig")
 *   - Locatie (text)
 *   - Notities (long text)
 *   - Uitnodigingen (link naar Uitnodigingen)
 *   - Terugkoppeling (long text)
 *   - Terugkoppeling door (single select: "Gijs" | "Steffan" | "Lotte" | "Nick" | "Lynn")
 *
 * Uitnodigingen
 *   - Contact (link naar Contacten)
 *   - Wedstrijd (link naar Wedstrijden)
 *   - Event (link naar Events)
 *   - RSVP (single select: "Ja" | "Nee" | "Wacht op antwoord")
 *   - Verstuurd op (date)
 *   - Notities (long text)
 *
 * Dit bestand draait alleen server-side (gebruikt AIRTABLE_API_TOKEN, geen
 * NEXT_PUBLIC_ prefix). Client components praten met /api/airtable.
 */

const AIRTABLE_API_URL = "https://api.airtable.com/v0";

export type TableName = "Contacten" | "Wedstrijden" | "Uitnodigingen" | "Events";

export const TABLES: TableName[] = [
  "Contacten",
  "Wedstrijden",
  "Uitnodigingen",
  "Events",
];

export type RSVPStatus = "Ja" | "Nee" | "Wacht op antwoord";

export const RSVP_STATUSSEN: RSVPStatus[] = ["Ja", "Nee", "Wacht op antwoord"];

export type TerugkoppelingDoor = "Gijs" | "Steffan" | "Lotte" | "Nick" | "Lynn";

export const TERUGKOPPELING_DOOR: TerugkoppelingDoor[] = [
  "Gijs",
  "Steffan",
  "Lotte",
  "Nick",
  "Lynn",
];

export interface AirtableRecord<T> {
  id: string;
  createdTime: string;
  fields: T;
}

export interface ContactFields {
  Voornaam: string;
  Achternaam: string;
  Email?: string;
  Telefoon?: string;
  Bedrijf?: string;
  Notities?: string;
}

export function contactFullName(fields: Pick<ContactFields, "Voornaam" | "Achternaam">): string {
  return [fields.Voornaam, fields.Achternaam].filter(Boolean).join(" ").trim();
}

export interface WedstrijdFields {
  Naam: string;
  Datum: string;
  Locatie?: string;
  Notities?: string;
  Terugkoppeling?: string;
  "Terugkoppeling door"?: TerugkoppelingDoor;
}

export interface EventFields {
  Naam: string;
  Datum: string;
  Type?: string;
  Locatie?: string;
  Notities?: string;
  Uitnodigingen?: string[];
  Terugkoppeling?: string;
  "Terugkoppeling door"?: TerugkoppelingDoor;
}

export interface UitnodigingFields {
  Contact?: string[];
  Wedstrijd?: string[];
  Event?: string[];
  RSVP?: RSVPStatus;
  "Verstuurd op"?: string;
  Notities?: string;
}

export type FieldsFor<T extends TableName> = T extends "Contacten"
  ? ContactFields
  : T extends "Wedstrijden"
    ? WedstrijdFields
    : T extends "Events"
      ? EventFields
      : UitnodigingFields;

interface ListParams {
  filterByFormula?: string;
  sort?: { field: string; direction?: "asc" | "desc" }[];
  maxRecords?: number;
  view?: string;
}

function getConfig() {
  const baseId = process.env.NEXT_PUBLIC_AIRTABLE_BASE_ID;
  const token = process.env.AIRTABLE_API_TOKEN;

  if (!baseId || !token) {
    throw new Error(
      "Airtable environment variables ontbreken. Zet NEXT_PUBLIC_AIRTABLE_BASE_ID en AIRTABLE_API_TOKEN in .env.local.",
    );
  }

  return { baseId, token };
}

async function airtableFetch(path: string, init?: RequestInit) {
  const { baseId, token } = getConfig();

  const res = await fetch(`${AIRTABLE_API_URL}/${baseId}/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Airtable API fout (${res.status}): ${body}`);
  }

  if (res.status === 204) return null;
  return res.json();
}

export async function listRecords<T extends TableName>(
  table: T,
  params?: ListParams,
): Promise<AirtableRecord<FieldsFor<T>>[]> {
  const search = new URLSearchParams();
  if (params?.filterByFormula) search.set("filterByFormula", params.filterByFormula);
  if (params?.maxRecords) search.set("maxRecords", String(params.maxRecords));
  if (params?.view) search.set("view", params.view);
  params?.sort?.forEach((s, i) => {
    search.set(`sort[${i}][field]`, s.field);
    search.set(`sort[${i}][direction]`, s.direction ?? "asc");
  });

  const records: AirtableRecord<FieldsFor<T>>[] = [];
  let offset: string | undefined;

  do {
    if (offset) search.set("offset", offset);
    else search.delete("offset");
    const data = await airtableFetch(`${encodeURIComponent(table)}?${search.toString()}`);
    records.push(...data.records);
    offset = data.offset;
  } while (offset);

  return records;
}

export async function getRecord<T extends TableName>(
  table: T,
  id: string,
): Promise<AirtableRecord<FieldsFor<T>>> {
  return airtableFetch(`${encodeURIComponent(table)}/${id}`);
}

export async function createRecord<T extends TableName>(
  table: T,
  fields: Partial<FieldsFor<T>>,
): Promise<AirtableRecord<FieldsFor<T>>> {
  return airtableFetch(encodeURIComponent(table), {
    method: "POST",
    body: JSON.stringify({ fields, typecast: true }),
  });
}

export async function updateRecord<T extends TableName>(
  table: T,
  id: string,
  fields: Partial<FieldsFor<T>>,
): Promise<AirtableRecord<FieldsFor<T>>> {
  return airtableFetch(`${encodeURIComponent(table)}/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ fields, typecast: true }),
  });
}

export async function updateTerugkoppeling(
  table: "Wedstrijden" | "Events",
  id: string,
  values: { Terugkoppeling: string; "Terugkoppeling door"?: TerugkoppelingDoor },
): Promise<AirtableRecord<FieldsFor<typeof table>>> {
  return updateRecord(table, id, values as Partial<FieldsFor<typeof table>>);
}

export async function deleteRecord<T extends TableName>(
  table: T,
  id: string,
): Promise<{ id: string; deleted: boolean }> {
  return airtableFetch(`${encodeURIComponent(table)}/${id}`, { method: "DELETE" });
}

export function isTableName(value: string): value is TableName {
  return (TABLES as string[]).includes(value);
}
