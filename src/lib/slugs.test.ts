import { describe, expect, it } from "vitest";
import { RESERVED_SLUGS, slugify, validateSlug } from "./slugs";

describe("slugify", () => {
  it.each([
    ["Mehmet Berber", "mehmet-berber"],
    ["Güzellik & Bakım Merkezi", "guzellik-bakim-merkezi"],
    ["  Çiçek  Kuaför  ", "cicek-kuafor"],
    ["İstanbul Oto Yıkama", "istanbul-oto-yikama"],
    ["Şahin'in Yeri!!", "sahin-in-yeri"],
  ])("%s → %s", (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });

  it("40 karakterden uzunu keser ve sonda tire bırakmaz", () => {
    const slug = slugify("a".repeat(39) + " b cdef");
    expect(slug.length).toBeLessThanOrEqual(40);
    expect(slug.endsWith("-")).toBe(false);
  });
});

describe("validateSlug", () => {
  it("geçerli adresi kabul eder", () => {
    expect(validateSlug("mehmet-berber")).toEqual({ ok: true, slug: "mehmet-berber" });
    expect(validateSlug("abc")).toEqual({ ok: true, slug: "abc" });
  });

  it.each(["ab", "", "Mehmet", "mehmet_berber", "-mehmet", "mehmet-", "meh--met", "mehmet berber", "çiçek"])(
    "geçersiz biçimi reddeder: %j",
    (input) => {
      expect(validateSlug(input).ok).toBe(false);
    },
  );

  it("41 karakteri reddeder", () => {
    expect(validateSlug("a".repeat(41)).ok).toBe(false);
  });

  it("sitenin kendi sayfa adlarını reddeder", () => {
    for (const reserved of RESERVED_SLUGS) {
      expect(validateSlug(reserved).ok).toBe(false);
    }
  });

  it("slugify çıktısı ayrılmış ad değilse doğrulamadan geçer", () => {
    const result = validateSlug(slugify("Demo Güzellik Merkezi"));
    expect(result.ok).toBe(true);
  });
});
