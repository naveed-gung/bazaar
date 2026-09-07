import request from "supertest";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { createApp } from "../src/app.js";
import { config } from "../src/config.js";
import { chunkTelegramMessage } from "../src/routes/assistant-telegram.js";

const app = createApp();

describe("Assistant Telegram Bridge (/api/v1/assistant/telegram)", () => {
  const testSecret = config.telegramWebhookSecret;

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Webhook Security & Secret Verification", () => {
    it("rejects request with 401 when x-telegram-bot-api-secret-token header is missing", async () => {
      const res = await request(app)
        .post("/api/v1/assistant/telegram")
        .send({ update_id: 1, message: { text: "hello" } });

      expect(res.status).toBe(401);
      expect(res.body).toEqual({
        error: {
          code: "unauthorized",
          message: "Invalid Telegram webhook secret token.",
        },
      });
    });

    it("rejects request with 401 when secret token is wrong", async () => {
      const res = await request(app)
        .post("/api/v1/assistant/telegram")
        .set("x-telegram-bot-api-secret-token", "wrong-secret-value")
        .send({ update_id: 1, message: { text: "hello" } });

      expect(res.status).toBe(401);
      expect(res.body).toEqual({
        error: {
          code: "unauthorized",
          message: "Invalid Telegram webhook secret token.",
        },
      });
    });

    it("accepts request with 200 when secret token matches exactly", async () => {
      const res = await request(app)
        .post("/api/v1/assistant/telegram")
        .set("x-telegram-bot-api-secret-token", testSecret)
        .send({ update_id: 1 });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true });
    });
  });

  describe("Message Handling & Routing", () => {
    it("safely ignores non-text updates and returns 200", async () => {
      const res = await request(app)
        .post("/api/v1/assistant/telegram")
        .set("x-telegram-bot-api-secret-token", testSecret)
        .send({ update_id: 2, message: { chat: { id: 12345 } } });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true });
    });

    it("handles /start command with welcome greeting", async () => {
      const res = await request(app)
        .post("/api/v1/assistant/telegram")
        .set("x-telegram-bot-api-secret-token", testSecret)
        .send({
          update_id: 3,
          message: {
            message_id: 10,
            chat: { id: 123456 },
            text: "/start",
          },
        });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true });
    });

    it("relays catalog inquiry and returns 200", async () => {
      const res = await request(app)
        .post("/api/v1/assistant/telegram")
        .set("x-telegram-bot-api-secret-token", testSecret)
        .send({
          update_id: 4,
          message: {
            message_id: 11,
            chat: { id: 987654 },
            text: "What wireless headphones do you sell?",
          },
        });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true });
    });
  });

  describe("chunkTelegramMessage utility", () => {
    it("returns single item if text is within limit", () => {
      const text = "Short response from shopping assistant";
      expect(chunkTelegramMessage(text, 100)).toEqual([text]);
    });

    it("splits long messages at line breaks when available", () => {
      const text = "First line of catalog items.\nSecond line with specs.\nThird line with pricing.";
      const chunks = chunkTelegramMessage(text, 35);
      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks.join(" ")).toContain("First line of catalog items.");
      expect(chunks.join(" ")).toContain("Third line with pricing.");
    });

    it("hard splits without breaking if no whitespace exists", () => {
      const text = "a".repeat(150);
      const chunks = chunkTelegramMessage(text, 50);
      expect(chunks).toEqual(["a".repeat(50), "a".repeat(50), "a".repeat(50)]);
    });
  });
});
