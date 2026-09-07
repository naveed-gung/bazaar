import { Router, type Request, type Response, type NextFunction } from "express";
import { timingSafeEqual } from "node:crypto";
import { getDb } from "../database/client.js";
import { asyncHandler } from "../lib/http.js";
import { config } from "../config.js";
import { logger } from "../logger.js";

export const assistantTelegramRouter = Router();

export function verifyTelegramWebhook(req: Request, res: Response, next: NextFunction): void {
  const configuredSecret = config.telegramWebhookSecret;
  if (!configuredSecret) {
    res.status(401).json({
      error: {
        code: "unauthorized",
        message: "Telegram webhook secret is not configured on the server.",
      },
    });
    return;
  }

  const secretHeader = req.header("x-telegram-bot-api-secret-token") || "";
  const secretBuffer = Buffer.from(secretHeader);
  const expectedBuffer = Buffer.from(configuredSecret);

  if (
    secretBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(secretBuffer, expectedBuffer)
  ) {
    res.status(401).json({
      error: {
        code: "unauthorized",
        message: "Invalid Telegram webhook secret token.",
      },
    });
    return;
  }

  next();
}

/**
 * Split large responses to respect Telegram's 4096-character limit per message.
 */
export function chunkTelegramMessage(text: string, maxLen = 4000): string[] {
  if (text.length <= maxLen) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining);
      break;
    }
    let sliceIndex = remaining.lastIndexOf("\n", maxLen);
    if (sliceIndex <= 0) {
      sliceIndex = remaining.lastIndexOf(" ", maxLen);
    }
    if (sliceIndex <= 0) {
      sliceIndex = maxLen;
    }
    chunks.push(remaining.slice(0, sliceIndex).trim());
    remaining = remaining.slice(sliceIndex).trim();
  }
  return chunks.filter(Boolean);
}

/**
 * Send a message to Telegram chat via Bot API.
 */
export async function sendTelegramMessage(chatId: string | number, text: string): Promise<boolean> {
  if (!config.telegramBotToken) {
    logger.warn({ chatId }, "TELEGRAM_BOT_TOKEN not configured; skipping Telegram sendMessage");
    return false;
  }

  const chunks = chunkTelegramMessage(text);
  let allOk = true;

  for (const chunk of chunks) {
    if (!chunk) continue;
    try {
      const url = `https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: chunk,
        }),
      });

      if (!response.ok) {
        allOk = false;
        const errText = await response.text().catch(() => "");
        logger.error({ status: response.status, body: errText, chatId }, "Telegram sendMessage failed");
      }
    } catch (err) {
      allOk = false;
      logger.error({ err, chatId }, "Failed to reach Telegram API");
    }
  }

  return allOk;
}

/**
 * POST /api/v1/assistant/telegram
 * Telegram bot webhook handler.
 */
assistantTelegramRouter.post(
  "/telegram",
  verifyTelegramWebhook,
  asyncHandler(async (req: Request, res: Response) => {
    const update = req.body as {
      update_id?: number;
      message?: {
        message_id: number;
        chat?: { id: number | string };
        text?: string;
        from?: { id?: number; first_name?: string };
      };
    };

    const message = update?.message;
    if (!message || typeof message.text !== "string") {
      // Non-text update or event we don't process (e.g. status change, reaction)
      res.status(200).json({ ok: true });
      return;
    }

    const chatId = message.chat?.id ? String(message.chat.id) : "";
    if (!chatId) {
      res.status(200).json({ ok: true });
      return;
    }

    const text = message.text.trim();

    if (text.startsWith("/start")) {
      const welcome =
        "Welcome to Bazaar! I'm your shopping assistant. I can help you find products, check live availability, and compare prices across our catalogue. What are you looking for today?";
      await sendTelegramMessage(chatId, welcome);
      res.status(200).json({ ok: true });
      return;
    }

    // Retrieve previous conversation_id from Mongo if available
    let conversationId: string | undefined;
    try {
      const db = await getDb();
      const existing = await db
        .collection("assistantConversations")
        .findOne({ chatId: `tg:${chatId}` });
      if (existing && typeof existing["conversationId"] === "string") {
        conversationId = existing["conversationId"];
      }
    } catch (err) {
      logger.warn({ err }, "Could not fetch existing assistant conversation from database");
    }

    let answer = "";
    let nextConversationId = conversationId;

    if (!config.loomApiUrl || !config.loomApiKey) {
      answer =
        "The Bazaar shopping assistant is powered by Loom by Auvia. Once LOOM_API_KEY and LOOM_API_URL are set, I can search live inventory, compare prices, and answer questions across our catalogue!";
    } else {
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
            query: text,
            user: `tg:${chatId}`,
            conversation_id: conversationId,
            response_mode: "blocking",
          }),
        });

        if (!response.ok) {
          const errorBody = await response.text().catch(() => "");
          logger.error({ status: response.status, body: errorBody }, "Loom upstream error in Telegram relay");
          answer = "Assistant temporarily unavailable. Please try again shortly.";
        } else {
          const contentType = response.headers.get("content-type") || "";
          if (contentType.includes("application/json")) {
            const data = (await response.json()) as { answer?: string; conversation_id?: string };
            answer = data.answer || "I could not find an answer for that.";
            if (data.conversation_id) {
              nextConversationId = data.conversation_id;
            }
          } else {
            // Fallback for streaming chunk parsing if upstream only streams
            const raw = await response.text();
            const lines = raw.split("\n");
            let accumulated = "";
            for (const line of lines) {
              if (line.startsWith("data: ")) {
                try {
                  const parsed = JSON.parse(line.slice(6));
                  if (parsed.answer) accumulated += parsed.answer;
                  if (parsed.conversation_id) nextConversationId = parsed.conversation_id;
                } catch {
                  // ignore malformed lines
                }
              }
            }
            answer = accumulated || "I could not find an answer for that.";
          }
        }
      } catch (err) {
        logger.error({ err }, "Failed contacting Loom upstream from Telegram relay");
        answer = "An error occurred while contacting the assistant. Please try again.";
      }
    }

    // Persist conversation ID in Mongo for multi-turn chat
    if (nextConversationId) {
      try {
        const db = await getDb();
        await db.collection("assistantConversations").updateOne(
          { chatId: `tg:${chatId}` },
          {
            $set: {
              chatId: `tg:${chatId}`,
              conversationId: nextConversationId,
              updatedAt: new Date(),
            },
          },
          { upsert: true },
        );
      } catch (err) {
        logger.warn({ err }, "Failed to update assistant conversation in database");
      }
    }

    await sendTelegramMessage(chatId, answer);
    res.status(200).json({ ok: true });
  }),
);

