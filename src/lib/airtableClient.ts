/**
 * Client-side helpers voor /api/airtable. Gebruikt in components ("use client").
 */
import type {
  AirtableRecord,
  FieldsFor,
  TableName,
} from "@/lib/airtable";

async function handle<T>(res: Response): Promise<T> {
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error ?? `Verzoek mislukt (${res.status})`);
  }
  return data as T;
}

export async function fetchRecords<T extends TableName>(
  table: T,
  filterByFormula?: string,
): Promise<AirtableRecord<FieldsFor<T>>[]> {
  const search = new URLSearchParams({ table });
  if (filterByFormula) search.set("filterByFormula", filterByFormula);
  const res = await fetch(`/api/airtable?${search.toString()}`);
  const data = await handle<{ records: AirtableRecord<FieldsFor<T>>[] }>(res);
  return data.records;
}

export async function createAirtableRecord<T extends TableName>(
  table: T,
  fields: Partial<FieldsFor<T>>,
): Promise<AirtableRecord<FieldsFor<T>>> {
  const res = await fetch("/api/airtable", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ table, fields }),
  });
  const data = await handle<{ record: AirtableRecord<FieldsFor<T>> }>(res);
  return data.record;
}

export async function updateAirtableRecord<T extends TableName>(
  table: T,
  id: string,
  fields: Partial<FieldsFor<T>>,
): Promise<AirtableRecord<FieldsFor<T>>> {
  const res = await fetch("/api/airtable", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ table, id, fields }),
  });
  const data = await handle<{ record: AirtableRecord<FieldsFor<T>> }>(res);
  return data.record;
}

export async function deleteAirtableRecord(table: TableName, id: string): Promise<void> {
  const search = new URLSearchParams({ table, id });
  const res = await fetch(`/api/airtable?${search.toString()}`, { method: "DELETE" });
  await handle(res);
}
