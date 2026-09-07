import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { config } from "../src/config.js";

const app = createApp();

describe("Assistant Chat SSE Proxy (/api/v1/assistant/chat)", () => {
  it("rejects an empty message with 422", async () => {
    const res = await request(app)
      .post("/api/v1/assistant/chat")
      .set("origin", config.webOrigin)
      .send({ message: "" });

    expect(res.status).toBe(422);
    expect(res.body).toEqual({
      error: {
        code: "validation_failed",
        message: "A non-empty 'message' string is required.",
      },
    });
  });

  it("rejects a message exceeding 1000 characters with 422", async () => {
    const res = await request(app)
      .post("/api/v1/assistant/chat")
      .set("origin", config.webOrigin)
      .send({ message: "a".repeat(1001) });

    expect(res.status).toBe(422);
    expect(res.body).toEqual({
      error: {
        code: "validation_failed",
        message: "Message exceeds maximum length of 1000 characters.",
      },
    });
  });

  it("streams SSE response with text/event-stream content-type", async () => {
    const res = await request(app)
      .post("/api/v1/assistant/chat")
      .set("origin", config.webOrigin)
      .send({ message: "Hello, recommend a mechanical keyboard" });

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/event-stream");
    expect(res.text).toContain("data: ");
    expect(res.text).toContain("message_end");
  });
});
