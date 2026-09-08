// src/app/api/attio/search/route.ts
//
// Zoekt personen in Attio en geeft naam, email, telefoon en bedrijf terug.
// Vereist env var: ATTIO_API_KEY

import { NextRequest, NextResponse } from 'next/server';

const ATTIO_API = 'https://api.attio.com/v2';

type AttioPerson = {
  id: { record_id: string };
  values: {
    name?: Array<{ full_name?: string; first_name?: string; last_name?: string }>;
    email_addresses?: Array<{ email_address?: string }>;
    phone_numbers?: Array<{ original_phone_number?: string; phone_number?: string }>;
    company?: Array<{ target_record_id?: string }>;
  };
};

type Result = {
  id: string;
  naam: string;
  email: string;
  telefoon: string;
  bedrijf: string;
};

async function attioFetch(path: string, body: unknown) {
  const res = await fetch(`${ATTIO_API}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.ATTIO_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Attio ${res.status}: ${text}`);
  }

  return res.json();
}

// Haalt bedrijfsnamen op voor een set company record ids, in één call per id.
async function resolveCompanies(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids)].filter(Boolean);
  const map = new Map<string, string>();

  await Promise.all(
    unique.map(async (id) => {
      try {
        const res = await fetch(`${ATTIO_API}/objects/companies/records/${id}`, {
          headers: { Authorization: `Bearer ${process.env.ATTIO_API_KEY}` },
        });
        if (!res.ok) return;
        const json = await res.json();
        const naam = json?.data?.values?.name?.[0]?.value ?? '';
        if (naam) map.set(id, naam);
      } catch {
        // bedrijf niet kunnen ophalen is niet fataal
      }
    })
  );

  return map;
}

export async function POST(request: NextRequest) {
  if (!process.env.ATTIO_API_KEY) {
    return NextResponse.json(
      { error: 'ATTIO_API_KEY ontbreekt in de environment variables' },
      { status: 500 }
    );
  }

  let zoekterm = '';
  try {
    const body = await request.json();
    zoekterm = (body?.zoekterm ?? body?.searchTerm ?? '').toString().trim();
  } catch {
    return NextResponse.json({ error: 'Ongeldige request body' }, { status: 400 });
  }

  if (zoekterm.length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    const json = await attioFetch('/objects/people/records/query', {
      filter: {
        $or: [
          { name: { full_name: { $contains: zoekterm } } },
          { email_addresses: { email_address: { $contains: zoekterm } } },
        ],
      },
      limit: 10,
    });

    const records: AttioPerson[] = json?.data ?? [];

    const companyIds = records
      .map((r) => r.values?.company?.[0]?.target_record_id)
      .filter((id): id is string => Boolean(id));

    const companyNames = await resolveCompanies(companyIds);

    const results: Result[] = records.map((r) => {
      const n = r.values?.name?.[0];
      const naam =
        n?.full_name ??
        [n?.first_name, n?.last_name].filter(Boolean).join(' ') ??
        '';

      const companyId = r.values?.company?.[0]?.target_record_id ?? '';

      return {
        id: r.id.record_id,
        naam,
        email: r.values?.email_addresses?.[0]?.email_address ?? '',
        telefoon:
          r.values?.phone_numbers?.[0]?.original_phone_number ??
          r.values?.phone_numbers?.[0]?.phone_number ??
          '',
        bedrijf: companyNames.get(companyId) ?? '',
      };
    });

    return NextResponse.json({ results });
  } catch (err) {
    console.error('Attio search mislukt:', err);
    return NextResponse.json(
      { error: 'Zoeken in Attio mislukt', details: String(err) },
      { status: 502 }
    );
  }
}
