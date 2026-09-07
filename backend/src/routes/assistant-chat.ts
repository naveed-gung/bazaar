import { Router, type Request, type Response } from "express";
import { asyncHandler, ownerKey } from "../lib/http.js";
import { config } from "../config.js";
import { logger } from "../logger.js";

export const assistantChatRouter = Router();

/**
 * POST /api/v1/assistant/chat
 * Same-origin streaming proxy to Loom by Auvia.
 *
 * Security:
 * - LOOM_API_KEY is kept strictly server-side.
 * - User identity is server-authoritative via ownerKey(req) (guest or user session).
 * - Multi-turn conversation_id is passed back and forth securely.
 */
assistantChatRouter.post(
  "/chat",
  asyncHandler(async (req: Request, res: Response) => {
    const rawMessage = req.body?.message ?? req.body?.query;
    const message = typeof rawMessage === "string" ? rawMessage.trim() : "";
    const conversationId =
      typeof req.body?.conversation_id === "string" && req.body.conversation_id.trim()
        ? req.body.conversation_id.trim()
        : undefined;

    if (!message) {
      res.status(422).json({
        error: {
          code: "validation_failed",
          message: "A non-empty 'message' string is required.",
        },
      });
      return;
    }

    if (message.length > 1000) {
      res.status(422).json({
        error: {
          code: "validation_failed",
          message: "Message exceeds maximum length of 1000 characters.",
        },
      });
      return;
    }

    // Set up SSE headers
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    // If Loom by Auvia credentials are not yet configured, provide a graceful mock SSE stream
    if (!config.loomApiUrl || !config.loomApiKey) {
      const fallbackMsg =
        "The Bazaar shopping assistant is powered by Loom by Auvia. Once your LOOM_API_KEY and LOOM_API_URL are set, I can search live inventory, compare prices, and answer questions across our catalogue!";

      res.write(`data: ${JSON.stringify({ event: "message", answer: fallbackMsg, conversation_id: conversationId || "loom-standby" })}\n\n`);
      res.write(`data: ${JSON.stringify({ event: "message_end", conversation_id: conversationId || "loom-standby" })}\n\n`);
      res.end();
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25_000);

    req.on("close", () => {
      clearTimeout(timeout);
      controller.abort();
    });

    try {
      const loomEndpoint = `${config.loomApiUrl}/chat-messages`;
      const response = await fetch(loomEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.loomApiKey}`,
        },
        body: JSON.stringify({
          inputs: {},
          query: message,
          user: ownerKey(req),
          conversation_id: conversationId,
          response_mode: "streaming",
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorBody = await response.text().catch(() => "");
        logger.error({ status: response.status, body: errorBody }, "Loom by Auvia chat upstream returned error");
        res.write(
          `data: ${JSON.stringify({
            event: "message",
            answer: "Assistant temporarily unavailable. Please try again shortly.",
            conversation_id: conversationId,
          })}\n\n`,
        );
        res.write(`data: ${JSON.stringify({ event: "message_end", conversation_id: conversationId })}\n\n`);
        res.end();
        return;
      }

      if (!response.body) {
        res.write(`data: ${JSON.stringify({ event: "message_end", conversation_id: conversationId })}\n\n`);
        res.end();
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        res.write(chunk);
      }

      res.end();
    } catch (err) {
      clearTimeout(timeout);
      logger.error({ err }, "Error relaying chat to Loom by Auvia");
      if (!res.writableEnded) {
        res.write(
          `data: ${JSON.stringify({
            event: "message",
            answer: "An error occurred while contacting the assistant. Please try again.",
            conversation_id: conversationId,
          })}\n\n`,
        );
        res.write(`data: ${JSON.stringify({ event: "message_end", conversation_id: conversationId })}\n\n`);
        res.end();
      }
    }
  }),
);
