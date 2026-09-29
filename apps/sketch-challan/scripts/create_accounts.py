#!/usr/bin/env python3
"""Create Sketch Challan logins on the server's own Supabase, one per employee code.

Run on the server from apps/sketch-challan:
    SERVICE_ROLE_KEY=... python3 scripts/create_accounts.py people.csv

people.csv (no header): employee_code,name,role[,sketcherName]
    role = admin | rack | manager | sketcher; sketcherName must match the roster in .env.local exactly.

For each person it creates the Supabase user <code>@<SKETCH_CHALLAN_AUTH_EMAIL_DOMAIN> with a random password
(or leaves an existing one alone), adds or updates their line in data/demo-accounts.json (no passwords there),
and prints code + password once so you can hand them out. Nothing is deleted.
"""
import csv, json, os, pathlib, re, secrets, sys, urllib.error, urllib.request

ROLES = {"admin", "rack", "manager", "sketcher"}


def env_local(key):
    text = pathlib.Path(".env.local").read_text(encoding="utf8") if pathlib.Path(".env.local").exists() else ""
    match = re.search(rf"^{key}=\"?([^\"\n]*)", text, re.M)
    return (match.group(1) if match else "").strip()


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    url = (os.environ.get("SUPABASE_URL") or env_local("SKETCH_CHALLAN_AUTH_URL") or "http://localhost:8000").rstrip("/")
    key = os.environ.get("SERVICE_ROLE_KEY", "")
    domain = env_local("SKETCH_CHALLAN_AUTH_EMAIL_DOMAIN").lstrip("@").lower()
    if not key or not domain:
        sys.exit("Set SERVICE_ROLE_KEY (Supabase docker .env) and SKETCH_CHALLAN_AUTH_EMAIL_DOMAIN in .env.local first.")

    people = []
    for row in csv.reader(open(sys.argv[1], encoding="utf8")):
        if not row or not row[0].strip():
            continue
        code, name, role = (cell.strip() for cell in row[:3])
        sketcher = row[3].strip() if len(row) > 3 else ""
        if role not in ROLES:
            sys.exit(f"{code}: role must be one of {sorted(ROLES)}")
        if role in ("manager", "sketcher") and not sketcher:
            sys.exit(f"{code}: a {role} needs a sketcherName (their name as in the roster)")
        people.append((code.lower(), name, role, sketcher))

    file = pathlib.Path("data/demo-accounts.json")
    accounts = {a["username"].lower(): a for a in (json.loads(file.read_text(encoding="utf8")) if file.exists() else [])}
    for code, name, role, sketcher in people:
        password = secrets.token_urlsafe(8)
        body = json.dumps({"email": f"{code}@{domain}", "password": password, "email_confirm": True,
                           "user_metadata": {"employee_code": code, "name": name}}).encode()
        request = urllib.request.Request(f"{url}/auth/v1/admin/users", body, method="POST", headers={
            "apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"})
        try:
            urllib.request.urlopen(request, timeout=20)
            shown = password
        except urllib.error.HTTPError as error:
            if error.code != 422:  # 422 = that user already exists: keep their password
                sys.exit(f"{code}: Supabase said {error.code} {error.read().decode()[:200]}")
            shown = "(already had a login: password unchanged)"
        entry = {"username": code, "name": name, "role": role}
        if sketcher:
            entry["sketcherName"] = sketcher
        accounts[code] = entry
        print(f"{code:12} {shown:44} {role}")

    file.parent.mkdir(exist_ok=True)
    file.write_text(json.dumps(list(accounts.values()), indent=2), encoding="utf8")
    file.chmod(0o600)
    print(f"\n{file}: {len(accounts)} people. Hand each person their code and password privately.")


if __name__ == "__main__":
    main()
