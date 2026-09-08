import { NextResponse } from "next/server";
import { getOccasionSelectOptions } from "@/lib/airtable";

export async function GET() {
  try {
    const options = await getOccasionSelectOptions();
    return NextResponse.json(options);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Onbekende fout";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
