// db-management endpoint: employee_code + phone match against the existing `employees`
// row — NOT Supabase Auth. No password, no auth.users row, no session created. Mirrors
// the guest-signup redesign exactly (see guest-signup/index.ts) — the app remembers
// "this browser is employee X" with a plain cookie afterward, not a session token.
//
// When employee_code matches zero rows, this cascades through a recovery sequence rather
// than failing outright — a code that EXISTS but has the wrong phone/status is still a
// hard failure (that's a real account's wrong credentials, not a recovery case):
//
//   1. Try to recognize the person by phone instead (ignoring the mismatched code).
//      Found  -> 409 "phone_match_pending" (frontend shows a plain Confirm/Cancel popup,
//                no new fields — this is just "sign in as this record?"). Confirming calls
//                back with action: "confirmPhoneMatch", which patches only genuinely
//                MISSING fields (a null status defaulting to active — phone is already the
//                match key, so it's never "missing" here) and logs in. It never overwrites
//                anything already set, and it never touches employee_code.
//      Not found -> 404 "not_found" — frontend now needs an email to keep looking.
//   2. Look up by email (action: "lookupEmail", email supplied by the frontend's popup).
//      Found  -> 409 "email_match_pending" (again, confirm-only, no new fields). Confirming
//                (action: "confirmEmailMatch") patches only what's missing — typically
//                `phone`, which can legitimately be null on a row created via
//                invite-employee before the person ever set one.
//      Not found -> 404 "email_not_found" — this is genuinely a brand-new person. The
//                frontend collects a Full Name (email already known) and calls back with
//                action: "createNew".
//   3. Create a new row. employee_code is NEVER accepted from the client here — it's
//      always allocated via next_employee_code(), the same race-free sequence
//      invite-employee and create-driver (driver_code) use. Whatever the caller originally
//      typed to sign in with is discarded; the newly-issued code comes back in the
//      response. Created with status: 'active' (not the usual 'invited') — there's no
//      follow-up "claim this invite" step here, so 'invited' would lock the same person
//      out on their very next visit.
//
// Phone matching throughout is digit-normalized, comparing the last 10 digits only —
// unlike guests (mandatory E.164, multi-country), employees.phone has no enforced format
// (seeded data has bare 10-digit domestic numbers, no country code at all).

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Action = "confirmPhoneMatch" | "lookupEmail" | "confirmEmailMatch" | "createNew";

interface EmployeeSignInBody {
  employeeCode: string;
  phone: string;
  action?: Action;
  email?: string;
  fullName?: string;
}

interface EmployeeRow {
  id: string;
  status: string;
  phone: string | null;
}

function last10Digits(phone: string): string {
  return phone.replace(/\D/g, "").slice(-10);
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as Partial<EmployeeSignInBody>;
    const employeeCode = body.employeeCode?.trim();
    const phone = body.phone?.trim();

    if (!employeeCode || !phone) {
      return jsonResponse({ error: "employeeCode and phone are required" }, 400);
    }

    const inputDigits = last10Digits(phone);
    if (inputDigits.length !== 10) {
      return jsonResponse({ error: "Enter a valid 10-digit phone number." }, 400);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Employee codes are stored uppercase (matches the DRV-XXX/driver_code convention) —
    // normalize the input rather than requiring exact-case entry.
    const normalizedCode = employeeCode.toUpperCase();
    const { data: employee, error } = await supabaseAdmin
      .from("employees")
      .select("id, status, phone")
      .eq("employee_code", normalizedCode)
      .maybeSingle();

    if (error) {
      return jsonResponse({ error: error.message }, 500);
    }

    if (employee) {
      // The code is real — a wrong phone or inactive status here is a genuine credentials
      // failure, not a recovery case. No cascade for an existing, claimed code.
      const invalidMessage = "No active employee matches that employee code and phone number.";
      if (employee.status !== "active") {
        return jsonResponse({ error: invalidMessage }, 401);
      }
      if (last10Digits(employee.phone ?? "") !== inputDigits) {
        return jsonResponse({ error: invalidMessage }, 401);
      }
      return jsonResponse({ employeeId: employee.id });
    }

    // employee_code matched nothing — run the recovery cascade.
    switch (body.action) {
      case "confirmPhoneMatch": {
        const match = await findEmployeeByPhone(supabaseAdmin, inputDigits);
        if (!match) {
          return jsonResponse({ error: "not_found" }, 404);
        }
        return await patchAndReturn(supabaseAdmin, match, {});
      }

      case "lookupEmail": {
        const email = body.email?.trim().toLowerCase();
        if (!email) {
          return jsonResponse({ error: "email is required" }, 400);
        }
        if (!EMAIL_PATTERN.test(email)) {
          return jsonResponse({ error: "Enter a valid email address." }, 400);
        }
        const match = await findEmployeeByEmail(supabaseAdmin, email);
        return jsonResponse({ error: match ? "email_match_pending" : "email_not_found" }, match ? 409 : 404);
      }

      case "confirmEmailMatch": {
        const email = body.email?.trim().toLowerCase();
        if (!email) {
          return jsonResponse({ error: "email is required" }, 400);
        }
        const match = await findEmployeeByEmail(supabaseAdmin, email);
        if (!match) {
          return jsonResponse({ error: "email_not_found" }, 404);
        }
        return await patchAndReturn(supabaseAdmin, match, { phone });
      }

      case "createNew":
        return await createEmployee(supabaseAdmin, { phone, fullName: body.fullName, email: body.email });

      default: {
        // First time seeing this unrecognized code — try phone before giving up entirely.
        const match = await findEmployeeByPhone(supabaseAdmin, inputDigits);
        if (match) {
          return jsonResponse({ error: "phone_match_pending" }, 409);
        }
        return jsonResponse({ error: "not_found" }, 404);
      }
    }
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : "unexpected error" }, 500);
  }
});

// deno-lint-ignore no-explicit-any
async function findEmployeeByPhone(supabaseAdmin: any, inputDigits: string): Promise<EmployeeRow | null> {
  const { data, error } = await supabaseAdmin
    .from("employees")
    .select("id, status, phone")
    .not("phone", "is", null);
  if (error) throw error;
  return (data ?? []).find((row: EmployeeRow) => last10Digits(row.phone ?? "") === inputDigits) ?? null;
}

// deno-lint-ignore no-explicit-any
async function findEmployeeByEmail(supabaseAdmin: any, email: string): Promise<EmployeeRow | null> {
  const { data, error } = await supabaseAdmin
    .from("employees")
    .select("id, status, phone")
    .ilike("email", email)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

/**
 * Patches ONLY genuinely missing/blocking fields on a matched row — never overwrites
 * anything already set, and never touches employee_code. `status` is treated as
 * "missing" whenever it isn't already active, since without that the same person would be
 * locked out on their very next visit; `phone` is only set if the row doesn't have one yet.
 */
async function patchAndReturn(
  // deno-lint-ignore no-explicit-any
  supabaseAdmin: any,
  employee: EmployeeRow,
  opts: { phone?: string },
) {
  const updates: Record<string, unknown> = {};
  if (employee.status !== "active") {
    updates.status = "active";
  }
  if (opts.phone && !employee.phone) {
    updates.phone = opts.phone;
  }

  if (Object.keys(updates).length > 0) {
    const { error } = await supabaseAdmin.from("employees").update(updates).eq("id", employee.id);
    if (error) {
      return jsonResponse({ error: error.message }, 500);
    }
  }

  return jsonResponse({ employeeId: employee.id });
}

async function createEmployee(
  // deno-lint-ignore no-explicit-any
  supabaseAdmin: any,
  input: { phone: string; fullName?: string; email?: string },
) {
  const fullName = input.fullName?.trim();
  const email = input.email?.trim().toLowerCase();

  if (!fullName || !email) {
    return jsonResponse({ error: "fullName and email are required to create a new employee record." }, 400);
  }
  if (!EMAIL_PATTERN.test(email)) {
    return jsonResponse({ error: "Enter a valid email address." }, 400);
  }

  const existing = await findEmployeeByEmail(supabaseAdmin, email);
  if (existing) {
    return jsonResponse({ error: "An employee with this email already exists." }, 409);
  }

  const { data: employeeCode, error: codeError } = await supabaseAdmin.rpc("next_employee_code");
  if (codeError || !employeeCode) {
    return jsonResponse({ error: codeError?.message ?? "failed to allocate employee_code" }, 500);
  }

  const { data: created, error: insertError } = await supabaseAdmin
    .from("employees")
    .insert({
      employee_code: employeeCode,
      full_name: fullName,
      email,
      phone: input.phone,
      status: "active",
    })
    .select("id, employee_code")
    .single();

  if (insertError || !created) {
    return jsonResponse({ error: insertError?.message ?? "insert failed" }, 500);
  }

  return jsonResponse({ employeeId: created.id, employeeCode: created.employee_code, created: true }, 201);
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
