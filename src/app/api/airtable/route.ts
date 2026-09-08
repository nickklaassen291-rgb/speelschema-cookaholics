import { NextRequest, NextResponse } from "next/server";
import {
  createRecord,
  deleteRecord,
  getRecord,
  isTableName,
  listRecords,
  updateRecord,
} from "@/lib/airtable";

function errorResponse(err: unknown) {
  const message = err instanceof Error ? err.message : "Onbekende fout";
  const status = message.includes("environment variables") ? 500 : 502;
  return NextResponse.json({ error: message }, { status });
}

function requireTable(table: string | null) {
  if (!table || !isTableName(table)) {
    throw new Error(
      `Ongeldige of ontbrekende 'table' parameter. Gebruik: Contacten, Wedstrijden, Uitnodigingen of Events.`,
    );
  }
  return table;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const table = requireTable(searchParams.get("table"));
    const id = searchParams.get("id");

    if (id) {
      const record = await getRecord(table, id);
      return NextResponse.json({ record });
    }

    const filterByFormula = searchParams.get("filterByFormula") ?? undefined;
    const view = searchParams.get("view") ?? undefined;

    const records = await listRecords(table, { filterByFormula, view });
    return NextResponse.json({ records });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const table = requireTable(body.table);

    if (!body.fields || typeof body.fields !== "object") {
      throw new Error("Body moet een 'fields' object bevatten.");
    }

    const record = await createRecord(table, body.fields, { typecast: body.typecast ?? true });
    return NextResponse.json({ record }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const table = requireTable(body.table);

    if (!body.id || typeof body.id !== "string") {
      throw new Error("Body moet een 'id' bevatten.");
    }
    if (!body.fields || typeof body.fields !== "object") {
      throw new Error("Body moet een 'fields' object bevatten.");
    }

    const record = await updateRecord(table, body.id, body.fields, { typecast: body.typecast ?? true });
    return NextResponse.json({ record });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const table = requireTable(searchParams.get("table"));
    const id = searchParams.get("id");

    if (!id) {
      throw new Error("Query parameter 'id' is verplicht.");
    }

    const result = await deleteRecord(table, id);
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
