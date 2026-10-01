import { NextResponse } from "next/server";
import { currentEmployee, supabaseServer } from "@/lib/supabaseClient.server";

export const dynamic = "force-dynamic";

/**
 * A user's pinned cards. RLS on jrgpt_pins already restricts every row to the signed-in
 * employee, so these handlers do not filter by employee themselves — the database is the
 * boundary, not this code. Signed-out callers get an empty list rather than an error, so
 * the home screen still renders while the auth gate is off in dev.
 */
export async function GET() {
  const employee = await currentEmployee();
  if (!employee) return NextResponse.json({ pins: [], signedIn: false });

  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("jrgpt_pins")
    .select("id, kind, entry_id, label, position")
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ pins: data ?? [], signedIn: true });
}

export async function POST(request: Request) {
  const employee = await currentEmployee();
  if (!employee) return NextResponse.json({ error: "not-signed-in" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    kind?: "tile" | "answer";
    entryId?: string;
    label?: string;
  };
  if (!body.kind || !body.entryId || !body.label) {
    return NextResponse.json({ error: "kind, entryId and label are required" }, { status: 400 });
  }

  const supabase = await supabaseServer();
  // Pinning the same card twice is a no-op, not an error — the unique constraint says so
  // and the UI treats Pin as idempotent.
  const { data, error } = await supabase
    .from("jrgpt_pins")
    .upsert(
      { employee_id: employee.id, kind: body.kind, entry_id: body.entryId, label: body.label },
      { onConflict: "employee_id,kind,entry_id", ignoreDuplicates: false },
    )
    .select("id, kind, entry_id, label, position")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ pin: data });
}

export async function DELETE(request: Request) {
  const employee = await currentEmployee();
  if (!employee) return NextResponse.json({ error: "not-signed-in" }, { status: 401 });

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const supabase = await supabaseServer();
  const { error } = await supabase.from("jrgpt_pins").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
