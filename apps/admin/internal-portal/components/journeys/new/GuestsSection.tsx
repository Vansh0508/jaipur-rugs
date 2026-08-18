"use client";

import { useEffect, useState } from "react";
import { Button, TextField, PhoneInput } from "@jaipur-rugs/ui-kit";
import { getBrowserSupabaseClient } from "@/lib/supabaseClient.browser";
import { searchGuestCandidates, type GuestCandidate } from "@/lib/queries/guests";
import type { GuestEntry } from "./formState";

interface GuestsSectionProps {
  guests: GuestEntry[];
  onAdd: () => void;
  onChange: (clientId: string, guest: Partial<Omit<GuestEntry, "clientId">>) => void;
  onRemove: (clientId: string) => void;
}

export function GuestsSection({ guests, onAdd, onChange, onRemove }: GuestsSectionProps) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Guests</h2>
        <Button size="sm" variant="secondary" onPress={onAdd}>
          Add guest
        </Button>
      </div>
      {guests.length === 0 ? (
        <p className="text-sm text-muted">No guests added yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {guests.map((guest) => (
            <GuestRow key={guest.clientId} guest={guest} onChange={onChange} onRemove={onRemove} />
          ))}
        </div>
      )}
    </section>
  );
}

function GuestRow({
  guest,
  onChange,
  onRemove,
}: {
  guest: GuestEntry;
  onChange: GuestsSectionProps["onChange"];
  onRemove: GuestsSectionProps["onRemove"];
}) {
  const [query, setQuery] = useState(guest.guestId ? guest.fullName : "");
  const [matches, setMatches] = useState<GuestCandidate[]>([]);
  const [showMatches, setShowMatches] = useState(false);

  useEffect(() => {
    if (guest.guestId || query.trim().length < 2) {
      setMatches([]);
      return;
    }
    const supabase = getBrowserSupabaseClient();
    const timeout = setTimeout(async () => {
      const results = await searchGuestCandidates(supabase, query);
      setMatches(results);
    }, 250);
    return () => clearTimeout(timeout);
  }, [query, guest.guestId]);

  function selectMatch(match: GuestCandidate) {
    onChange(guest.clientId, { guestId: match.id, fullName: match.fullName, phone: match.phone });
    setQuery(match.fullName);
    setShowMatches(false);
  }

  function clearMatch() {
    onChange(guest.clientId, { guestId: null, fullName: "", phone: "" });
    setQuery("");
  }

  return (
    <div className="flex items-start gap-2 rounded-lg border-2 border-border p-3">
      <div className="flex flex-1 flex-col gap-2">
        {guest.guestId ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{guest.fullName}</p>
              <p className="text-sm text-muted">{guest.phone}</p>
            </div>
            <Button size="sm" variant="tertiary" onPress={clearMatch}>
              Not this guest
            </Button>
          </div>
        ) : (
          <>
            <div className="relative">
              <TextField
                label="Search existing guest, or enter a new name"
                value={query}
                onChange={(v) => {
                  setQuery(v);
                  setShowMatches(true);
                  onChange(guest.clientId, { fullName: v });
                }}
                fullWidth
              />
              {showMatches && matches.length > 0 ? (
                <ul className="absolute z-10 mt-1 w-full rounded-lg border-2 border-border bg-background shadow-lg">
                  {matches.map((m) => (
                    <li key={m.id}>
                      <button
                        type="button"
                        onClick={() => selectMatch(m)}
                        className="block w-full px-3 py-2 text-left text-sm hover:bg-surface-secondary"
                      >
                        {m.fullName} — {m.phone}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <PhoneInput
              label="Phone number"
              value={guest.phone}
              onChange={(phone) => onChange(guest.clientId, { phone })}
              isRequired
            />
          </>
        )}
      </div>
      <Button size="sm" variant="tertiary" isIconOnly aria-label="Remove guest" onPress={() => onRemove(guest.clientId)}>
        ✕
      </Button>
    </div>
  );
}
