import { describe, expect, it } from "vitest";
import { verifyMetaWebhookSignature } from "../lib/whatsapp/graph-client";

describe("lib/whatsapp/graph-client.ts — verifyMetaWebhookSignature", () => {
  const appSecret = "test-app-secret";
  const body = JSON.stringify({ entry: [{ changes: [{ value: { messages: [] } }] }] });

  async function computeValidSignature(rawBody: string, secret: string) {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
    const hex = Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return `sha256=${hex}`;
  }

  it("acepta una firma válida", async () => {
    const signature = await computeValidSignature(body, appSecret);
    const ok = await verifyMetaWebhookSignature(body, signature, appSecret);
    expect(ok).toBe(true);
  });

  it("rechaza una firma con el secret equivocado", async () => {
    const signature = await computeValidSignature(body, "otro-secret");
    const ok = await verifyMetaWebhookSignature(body, signature, appSecret);
    expect(ok).toBe(false);
  });

  it("rechaza si el body fue alterado después de firmar", async () => {
    const signature = await computeValidSignature(body, appSecret);
    const tamperedBody = body.replace("messages", "mesages");
    const ok = await verifyMetaWebhookSignature(tamperedBody, signature, appSecret);
    expect(ok).toBe(false);
  });

  it("rechaza si no hay header de firma", async () => {
    const ok = await verifyMetaWebhookSignature(body, null, appSecret);
    expect(ok).toBe(false);
  });

  it("rechaza un header sin el prefijo sha256=", async () => {
    const ok = await verifyMetaWebhookSignature(body, "deadbeef", appSecret);
    expect(ok).toBe(false);
  });
});
