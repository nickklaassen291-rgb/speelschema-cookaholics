"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  AirtableRecord,
  ContactFields,
  RSVPStatus,
  TerugkoppelingDoor,
  UitnodigingFields,
} from "@/lib/airtable";
import { fetchRecords } from "@/lib/airtableClient";

export type OccasionTable = "Wedstrijden" | "Events";

export type Occasion = {
  id: string;
  table: OccasionTable;
  type: "Wedstrijd" | "Event";
  naam: string;
  datum: string;
  tijd?: string;
  locatie?: string;
  aanwezig?: string[];
  terugkoppeling?: string;
  terugkoppelingDoor?: TerugkoppelingDoor;
};

export type Uitnodiging = AirtableRecord<UitnodigingFields>;
export type Contact = AirtableRecord<ContactFields>;

export function useOccasions() {
  const [occasions, setOccasions] = useState<Occasion[]>([]);
  const [uitnodigingen, setUitnodigingen] = useState<Uitnodiging[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [wedstrijden, events, invites, contactRecords] = await Promise.all([
        fetchRecords("Wedstrijden"),
        fetchRecords("Events"),
        fetchRecords("Uitnodigingen"),
        fetchRecords("Contacten"),
      ]);

      const combined: Occasion[] = [
        ...wedstrijden
          .filter((w) => w.fields.Datum)
          .map<Occasion>((w) => ({
            id: w.id,
            table: "Wedstrijden",
            type: "Wedstrijd",
            naam: w.fields.Naam,
            datum: w.fields.Datum,
            tijd: w.fields.Tijd,
            locatie: w.fields.Locatie,
            aanwezig: w.fields.Aanwezig,
            terugkoppeling: w.fields.Terugkoppeling,
            terugkoppelingDoor: w.fields["Terugkoppeling door"],
          })),
        ...events
          .filter((ev) => ev.fields.Datum)
          .map<Occasion>((ev) => ({
            id: ev.id,
            table: "Events",
            type: "Event",
            naam: ev.fields.Naam,
            datum: ev.fields.Datum,
            tijd: ev.fields.Tijd,
            locatie: ev.fields.Locatie,
            aanwezig: ev.fields.Aanwezig,
            terugkoppeling: ev.fields.Terugkoppeling,
            terugkoppelingDoor: ev.fields["Terugkoppeling door"],
          })),
      ];

      setOccasions(combined);
      setUitnodigingen(invites);
      setContacts(contactRecords);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kon gegevens niet laden.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const contactsById = useMemo(() => {
    const map = new Map<string, Contact>();
    for (const c of contacts) map.set(c.id, c);
    return map;
  }, [contacts]);

  const invitesFor = useCallback(
    (occasion: Occasion): Uitnodiging[] => {
      return uitnodigingen.filter((u) => {
        const ids = occasion.type === "Wedstrijd" ? u.fields.Wedstrijd : u.fields.Events;
        return ids?.includes(occasion.id);
      });
    },
    [uitnodigingen],
  );

  const rsvpCounts = useCallback(
    (occasion: Occasion) => {
      const invites = invitesFor(occasion);
      const counts: Record<RSVPStatus, number> = { Ja: 0, Nee: 0, "Wacht op antwoord": 0 };
      for (const inv of invites) {
        const status = inv.fields["RSVP Status"];
        if (status) counts[status] += 1;
      }
      return counts;
    },
    [invitesFor],
  );

  return {
    occasions,
    contacts,
    contactsById,
    loading,
    error,
    invitesFor,
    rsvpCounts,
    reload: load,
  };
}
