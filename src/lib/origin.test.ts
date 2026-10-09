import { describe, expect, it } from "vitest";
import { isSameOrigin } from "./origin";

const req = (headers: Record<string, string>) => new Request("https://site.example/auth/demo", { method: "POST", headers });

describe("isSameOrigin", () => {
  it("aynı site isteklerini kabul eder", () => {
    expect(isSameOrigin(req({ "sec-fetch-site": "same-origin" }))).toBe(true);
    expect(isSameOrigin(req({ "sec-fetch-site": "none" }))).toBe(true);
    expect(isSameOrigin(req({ origin: "https://site.example" }))).toBe(true);
  });

  it("başka siteden gelen isteği reddeder", () => {
    expect(isSameOrigin(req({ "sec-fetch-site": "cross-site" }))).toBe(false);
    expect(isSameOrigin(req({ "sec-fetch-site": "same-site" }))).toBe(false);
    expect(isSameOrigin(req({ origin: "https://evil.example" }))).toBe(false);
    expect(isSameOrigin(req({ origin: "https://site.example.evil.example" }))).toBe(false);
  });

  it("Sec-Fetch-Site Origin'den önceliklidir", () => {
    expect(isSameOrigin(req({ "sec-fetch-site": "cross-site", origin: "https://site.example" }))).toBe(false);
  });

  it("başlık yoksa (sunucudan sunucuya) kabul eder, bozuk Origin'i reddeder", () => {
    expect(isSameOrigin(req({}))).toBe(true);
    expect(isSameOrigin(req({ origin: "not a url" }))).toBe(false);
  });
});
