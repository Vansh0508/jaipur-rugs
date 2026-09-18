import { redirect } from "next/navigation";

// proxy.ts is the real auth gate; this is just the landing redirect.
export default function RootPage() {
  redirect("/new");
}
