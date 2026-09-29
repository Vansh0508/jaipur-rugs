#!/usr/bin/env python3
"""Create or update Sketch Challan logins on the server's own Supabase, one per employee code.

Run on the server from apps/sketch-challan:
    python3 scripts/create_accounts.py data/people.csv                  # new people get a random password
    python3 scripts/create_accounts.py data/people.csv --name-passwords # everyone gets firstname@dnd (also existing)

people.csv (no header): employee_code,name,role[,sketcherName]
    role = admin | rack | manager | sketcher; sketcherName is the name used on challans.

For each person it creates the Supabase user <code>@<SKETCH_CHALLAN_AUTH_EMAIL_DOMAIN> (existing users keep their
password unless --name-passwords), writes their line in data/demo-accounts.json (no passwords there), rebuilds the
sketcher roster in .env.local and data/roster.env from the sketcher/manager lines (rebuild the app afterwards), and
prints code + password. Nothing is deleted. The service key comes from SERVICE_ROLE_KEY or the Supabase docker .env.
"""
import csv, json, os, pathlib, re, secrets, subprocess, sys, urllib.error, urllib.request

ROLES = {"admin", "rack", "manager", "sketcher"}


def env_local(key):
    text = pathlib.Path(".env.local").read_text(encoding="utf8") if pathlib.Path(".env.local").exists() else ""
    match = re.search(rf"^{key}=\"?([^\"\n]*)", text, re.M)
    return (match.group(1) if match else "").strip()


def set_env_line(path, key, value):
    file = pathlib.Path(path)
    lines = [line for line in (file.read_text(encoding="utf8").splitlines() if file.exists() else []) if not line.startswith(f"{key}=")]
    file.write_text("\n".join([*lines, f'{key}="{value}"']) + "\n", encoding="utf8")
    file.chmod(0o600)


def service_key():
    if os.environ.get("SERVICE_ROLE_KEY"):
        return os.environ["SERVICE_ROLE_KEY"]
    try:
        folder = subprocess.run(["docker", "inspect", "supabase-db", "--format", '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}'],
                                capture_output=True, text=True, check=True).stdout.strip()
        match = re.search(r'^SERVICE_ROLE_KEY="?([^"\n]+)', pathlib.Path(folder, ".env").read_text(encoding="utf8"), re.M)
        return match.group(1).strip() if match else ""
    except Exception:
        return ""


def call(url, key, method, path, body=None):
    request = urllib.request.Request(f"{url}{path}", json.dumps(body).encode() if body is not None else None, method=method, headers={
        "apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"})
    with urllib.request.urlopen(request, timeout=20) as response:
        return json.loads(response.read() or b"{}")


def user_id(url, key, email):
    for page in range(1, 50):
        users = call(url, key, "GET", f"/auth/v1/admin/users?page={page}&per_page=200").get("users", [])
        found = next((user["id"] for user in users if user.get("email", "").lower() == email), None)
        if found or len(users) < 200:
            return found
    return None


def main():
    args = [arg for arg in sys.argv[1:] if not arg.startswith("--")]
    name_passwords = "--name-passwords" in sys.argv
    if len(args) != 1:
        sys.exit(__doc__)
    url = (os.environ.get("SUPABASE_URL") or env_local("SKETCH_CHALLAN_AUTH_URL") or "http://127.0.0.1:8000").rstrip("/")
    key = service_key()
    domain = env_local("SKETCH_CHALLAN_AUTH_EMAIL_DOMAIN").lstrip("@").lower()
    if not key or not domain:
        sys.exit("Need SKETCH_CHALLAN_AUTH_EMAIL_DOMAIN in .env.local and the Supabase service key (SERVICE_ROLE_KEY or the docker .env).")

    people = []
    for row in csv.reader(open(args[0], encoding="utf8")):
        if not row or not row[0].strip():
            continue
        code, name, role = (cell.strip() for cell in row[:3])
        sketcher = row[3].strip() if len(row) > 3 else ""
        if role not in ROLES:
            sys.exit(f"{code}: role must be one of {sorted(ROLES)}")
        if role in ("manager", "sketcher") and not sketcher:
            sys.exit(f"{code}: a {role} needs a sketcherName (their name as used on challans)")
        people.append((code.lower(), name, role, sketcher))

    file = pathlib.Path("data/demo-accounts.json")
    accounts = {a["username"].lower(): a for a in (json.loads(file.read_text(encoding="utf8")) if file.exists() else [])}
    for code, name, role, sketcher in people:
        # Temporary rule (user, 2026-09-29): first name in lowercase + "@dnd"; rackmgmt -> rackmgmt@dnd.
        password = f"{(name.split() or [code])[0].lower() if code != 'rackmgmt' else 'rackmgmt'}@dnd" if name_passwords else secrets.token_urlsafe(8)
        email = f"{code}@{domain}"
        try:
            call(url, key, "POST", "/auth/v1/admin/users", {"email": email, "password": password, "email_confirm": True,
                                                            "user_metadata": {"employee_code": code, "name": name}})
            shown = f"created, password {password}"
        except urllib.error.HTTPError as error:
            if error.code != 422:  # 422 = that user already exists
                sys.exit(f"{code}: Supabase said {error.code} {error.read().decode()[:200]}")
            if name_passwords:
                found = user_id(url, key, email)
                if not found:
                    sys.exit(f"{code}: Supabase says {email} exists but it wasn't found in the user list")
                call(url, key, "PUT", f"/auth/v1/admin/users/{found}", {"password": password})
                shown = f"updated, password {password}"
            else:
                shown = "already had a login: password unchanged"
        entry = {"username": code, "name": name, "role": role}
        if sketcher:
            entry["sketcherName"] = sketcher
        accounts[code] = entry
        print(f"{code:10} {name:18} {role:9} {shown}")

    file.parent.mkdir(exist_ok=True)
    file.write_text(json.dumps(list(accounts.values()), indent=2), encoding="utf8")
    file.chmod(0o600)
    roster = ",".join(f"{sketcher}:{code}" for code, _, role, sketcher in people if role in ("sketcher", "manager"))
    set_env_line(".env.local", "NEXT_PUBLIC_SKETCH_CHALLAN_ROSTER", roster)
    set_env_line("data/roster.env", "NEXT_PUBLIC_SKETCH_CHALLAN_ROSTER", roster)
    print(f"\n{file}: {len(accounts)} people. Roster: {roster.count(':')} names.")
    print("Now rebuild so the roster shows: pnpm build && pm2 restart sketch-challan")


if __name__ == "__main__":
    main()
