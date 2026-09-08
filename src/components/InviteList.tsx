"use client";

import { useEffect, useState } from "react";
import type { AirtableRecord, ContactFields, RSVPStatus, UitnodigingFields } from "@/lib/airtable";
import { contactFullName } from "@/lib/airtable";

export const RSVP_STYLES: Record<RSVPStatus, string> = {
  Ja: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  Nee: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  "Wacht op antwoord": "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
};

type Invite = AirtableRecord<UitnodigingFields>;
type Contact = AirtableRecord<ContactFields>;

type Props = {
  invites: Invite[];
  contactsById: Map<string, Contact>;
  rsvpOpties: string[];
  onRsvpChange: (invite: Invite, status: RSVPStatus) => void;
  onAantalChange: (invite: Invite, aantal: number) => void;
  onRemove: (invite: Invite) => void;
  busyId?: string | null;
  emptyLabel: string;
};

function AantalPersonenInput({
  invite,
  disabled,
  onChange,
}: {
  invite: Invite;
  disabled: boolean;
  onChange: (aantal: number) => void;
}) {
  const huidig = invite.fields["Aantal personen"] ?? 1;
  const [value, setValue] = useState(String(huidig));

  useEffect(() => {
    setValue(String(huidig));
  }, [huidig]);

  function commit() {
    const parsed = parseInt(value, 10);
    const aantal = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
    setValue(String(aantal));
    if (aantal !== huidig) onChange(aantal);
  }

  return (
    <input
      type="number"
      min={1}
      disabled={disabled}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
      className="w-14 rounded-lg border border-zinc-300 px-2 py-1 text-sm outline-none focus:border-zinc-500 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950"
    />
  );
}

export default function InviteList({
  invites,
  contactsById,
  rsvpOpties,
  onRsvpChange,
  onAantalChange,
  onRemove,
  busyId,
  emptyLabel,
}: Props) {
  if (invites.length === 0) {
    return <p className="py-2 text-sm text-zinc-500">{emptyLabel}</p>;
  }

  return (
    <ul className="flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800">
      {invites.map((inv) => {
        const contactId = inv.fields.Contact?.[0];
        const contact = contactId ? contactsById.get(contactId) : undefined;
        const status = inv.fields["RSVP Status"] ?? "Wacht op antwoord";
        const busy = busyId === inv.id;
        return (
          <li key={inv.id} className="flex items-center justify-between gap-3 py-2 text-sm">
            <span className="text-zinc-900 dark:text-zinc-50">
              {contact ? contactFullName(contact.fields) : "Onbekend contact"}
            </span>
            <div className="flex items-center gap-2">
              <AantalPersonenInput
                invite={inv}
                disabled={busy}
                onChange={(aantal) => onAantalChange(inv, aantal)}
              />
              <select
                disabled={busy}
                className={`rounded-full border-none px-2.5 py-1 text-xs font-medium outline-none disabled:opacity-50 ${
                  RSVP_STYLES[status] ?? ""
                }`}
                value={status}
                onChange={(e) => onRsvpChange(inv, e.target.value as RSVPStatus)}
              >
                {rsvpOpties.map((optie) => (
                  <option key={optie} value={optie}>
                    {optie}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={busy}
                onClick={() => onRemove(inv)}
                className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
              >
                Verwijderen
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
