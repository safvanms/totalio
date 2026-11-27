import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("password hashing", () => {
  it("verifies the right password and rejects others", async () => {
    const h = await hashPassword("correct horse 42");
    expect(h).toMatch(/^scrypt\$16384\$8\$1\$/);
    expect(await verifyPassword("correct horse 42", h)).toBe(true);
    expect(await verifyPassword("correct horse 43", h)).toBe(false);
    expect(await verifyPassword("", h)).toBe(false);
  });

  it("salts every hash", async () => {
    expect(await hashPassword("same-pass1")).not.toBe(await hashPassword("same-pass1"));
  });

  it("rejects malformed stored hashes instead of throwing", async () => {
    expect(await verifyPassword("x", "not-a-hash")).toBe(false);
    expect(await verifyPassword("x", "bcrypt$1$2$3$4$5")).toBe(false);
  });

  it("treats unicode-equivalent passwords the same (NFKC)", async () => {
    const h = await hashPassword("ｐａｓｓword1"); // full-width letters
    expect(await verifyPassword("password1", h)).toBe(true);
  });
});
