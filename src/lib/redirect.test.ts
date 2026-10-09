import { describe, expect, it } from "vitest";
import { safeNext } from "./redirect";

describe("safeNext", () => {
  it.each(["/", "/randevularim", "/demo-berber/randevu?tamamla=1", "/a/b#x"])("site içi yolu kabul eder: %s", (p) => {
    expect(safeNext(p)).toBe(p);
  });

  it.each([
    "//evil.com",
    "/\\evil.com",
    "https://evil.com",
    "http://evil.com/x",
    "javascript:alert(1)",
    "evil.com",
    "/ok\nSet-Cookie: x=1",
  ])("başka siteye götürebilecek adresi reddeder: %j", (p) => {
    expect(safeNext(p)).toBe("/");
  });

  it("boşsa varsayılanı döner", () => {
    expect(safeNext(null)).toBe("/");
    expect(safeNext(undefined, "/randevularim")).toBe("/randevularim");
    expect(safeNext("")).toBe("/");
  });
});
