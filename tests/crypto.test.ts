import { describe, expect, it } from "vitest";
import { decrypt, encrypt } from "../lib/crypto";

describe("lib/crypto.ts (Web Crypto AES-GCM)", () => {
  const secretHex = "a".repeat(64); // 32 bytes, mismo formato que `openssl rand -hex 32`

  it("hace round-trip de un texto plano", async () => {
    const cipherText = await encrypt("mi-token-super-secreto", secretHex);
    expect(cipherText).not.toBe("mi-token-super-secreto");

    const plainText = await decrypt(cipherText, secretHex);
    expect(plainText).toBe("mi-token-super-secreto");
  });

  it("genera un cifrado distinto cada vez (IV aleatorio)", async () => {
    const a = await encrypt("mismo-texto", secretHex);
    const b = await encrypt("mismo-texto", secretHex);
    expect(a).not.toBe(b);
  });

  it("falla al descifrar con la clave equivocada", async () => {
    const cipherText = await encrypt("secreto", secretHex);
    const wrongKey = "b".repeat(64);
    await expect(decrypt(cipherText, wrongKey)).rejects.toThrow();
  });
});
