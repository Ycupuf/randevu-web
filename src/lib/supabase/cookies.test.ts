import { describe, expect, it } from "vitest";
import { BROWSER_COOKIE_OPTIONS, hardenSessionCookie } from "./cookies";

describe("hardenSessionCookie", () => {
  it("sunucu oturum çerezini HttpOnly ve SameSite=Lax yapar, gelen seçenekleri korur", () => {
    const out = hardenSessionCookie({ path: "/", maxAge: 60, httpOnly: false, sameSite: "none" });
    expect(out).toMatchObject({ path: "/", maxAge: 60, httpOnly: true, sameSite: "lax" });
  });

  it("seçenek verilmese de HttpOnly koyar", () => {
    expect(hardenSessionCookie(undefined)).toMatchObject({ httpOnly: true, sameSite: "lax" });
  });
});

describe("BROWSER_COOKIE_OPTIONS", () => {
  it("tarayıcı çerezi HttpOnly içermez (tarayıcı istemcisi yazabilsin)", () => {
    expect(BROWSER_COOKIE_OPTIONS).not.toHaveProperty("httpOnly");
    expect(BROWSER_COOKIE_OPTIONS.sameSite).toBe("lax");
  });
});
