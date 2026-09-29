import { afterEach, describe, expect, it, vi } from "vitest";
import { newId } from "../lib/newId";

describe("newId", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("works on a plain-http page, where crypto.randomUUID is missing", () => {
    vi.stubGlobal("crypto", { getRandomValues: (a: Uint8Array) => a.map((_, i) => i * 17) });
    const id = newId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("uses crypto.randomUUID when the page has it", () => {
    expect(newId()).toMatch(/^[0-9a-f-]{36}$/);
    expect(newId()).not.toBe(newId());
  });
});
