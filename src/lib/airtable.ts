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
 *   - Tijd (text)
 *   - Locatie (single select, opties via getOccasionSelectOptions())
 *   - Type (single select, opties via getOccasionSelectOptions())
 *   - Notities (long text)
 *   - Terugkoppeling (long text)
 *   - Terugkoppeling door (single select: "Gijs" | "Steffan" | "Lotte" | "Nick" | "Lynn")
 *
 * Events
 *   - Naam (text)
 *   - Datum (date)
 *   - Tijd (text)
 *   - Type (single select, opties via getOccasionSelectOptions())
 *   - Locatie (text)
 *   - Notities (long text)
 *   - Uitnodigingen (link naar Uitnodigingen)
 *   - Terugkoppeling (long text)
 *   - Terugkoppeling door (single select: "Gijs" | "Steffan" | "Lotte" | "Nick" | "Lynn")
 *
 * Uitnodigingen
 *   - Contact (link naar Contacten)
 *   - Wedstrijd (link naar Wedstrijden)
 *   - Events (link naar Events)
 *   - RSVP Status (single select: "Ja" | "Nee" | "Wacht op antwoord")
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
  Tijd?: string;
  Locatie?: string;
  Type?: string;
  Notities?: string;
  Terugkoppeling?: string;
  "Terugkoppeling door"?: TerugkoppelingDoor;
}

export interface EventFields {
  Naam: string;
  Datum: string;
  Tijd?: string;
  Type?: string;
  Locatie?: string;
  Notities?: string;
  Uitnodigingen?: string[];
  Terugkoppeling?: string;
  "Terugkoppeling door"?: TerugkoppelingDoor;
}

export type OccasionSoort = "Wedstrijd" | "Event";

export interface UitnodigingFields {
  Contact?: string[];
  Wedstrijd?: string[];
  Events?: string[];
  "RSVP Status"?: RSVPStatus;
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
  options?: { typecast?: boolean },
): Promise<AirtableRecord<FieldsFor<T>>> {
  return airtableFetch(encodeURIComponent(table), {
    method: "POST",
    body: JSON.stringify({ fields, typecast: options?.typecast ?? true }),
  });
}

export async function updateRecord<T extends TableName>(
  table: T,
  id: string,
  fields: Partial<FieldsFor<T>>,
  options?: { typecast?: boolean },
): Promise<AirtableRecord<FieldsFor<T>>> {
  return airtableFetch(`${encodeURIComponent(table)}/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ fields, typecast: options?.typecast ?? true }),
  });
}

export async function updateTerugkoppeling(
  table: "Wedstrijden" | "Events",
  id: string,
  values: { Terugkoppeling: string; "Terugkoppeling door"?: TerugkoppelingDoor },
): Promise<AirtableRecord<FieldsFor<typeof table>>> {
  // typecast uit: "Terugkoppeling door" is single select, mag geen nieuwe optie aanmaken.
  return updateRecord(table, id, values as Partial<FieldsFor<typeof table>>, { typecast: false });
}

export async function createOccasion(
  soort: OccasionSoort,
  fields: Partial<WedstrijdFields> | Partial<EventFields>,
): Promise<AirtableRecord<WedstrijdFields> | AirtableRecord<EventFields>> {
  // typecast uit: Locatie en Type zijn single select, mogen geen nieuwe optie aanmaken.
  return soort === "Wedstrijd"
    ? createRecord("Wedstrijden", fields as Partial<WedstrijdFields>, { typecast: false })
    : createRecord("Events", fields as Partial<EventFields>, { typecast: false });
}

export interface OccasionSelectOptions {
  wedstrijdLocaties: string[];
  wedstrijdTypes: string[];
  eventTypes: string[];
}

export async function getOccasionSelectOptions(): Promise<OccasionSelectOptions> {
  const { baseId, token } = getConfig();

  const res = await fetch(`https://api.airtable.com/v0/meta/bases/${baseId}/tables`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Airtable Meta API fout (${res.status}): ${body}`);
  }

  const data: {
    tables: Array<{
      name: string;
      fields: Array<{ name: string; options?: { choices?: Array<{ name: string }> } }>;
    }>;
  } = await res.json();

  function choicesFor(tableName: string, fieldName: string): string[] {
    const table = data.tables.find((t) => t.name === tableName);
    const field = table?.fields.find((f) => f.name === fieldName);
    return field?.options?.choices?.map((c) => c.name) ?? [];
  }

  return {
    wedstrijdLocaties: choicesFor("Wedstrijden", "Locatie"),
    wedstrijdTypes: choicesFor("Wedstrijden", "Type"),
    eventTypes: choicesFor("Events", "Type"),
  };
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
