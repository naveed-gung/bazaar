import { useState, useRef, useEffect, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { Bot, LoaderCircle, Send, X, RotateCcw, Sparkles } from "lucide-react";

type Message = {
  id: string;
  sender: "user" | "assistant";
  text: string;
};

const SUGGESTIONS = [
  "Mechanical keyboards under $200",
  "Studio headphones in stock",
  "Best audio gear for focus",
];

const STORAGE_KEY = "bazaar.assistant.conversation_id";

/**
 * Parses assistant markdown links like [Product Name](/p/slug) or [Name](https://.../p/slug)
 * and turns them into clickable TanStack Link components.
 */
function FormattedAssistantMessage({ text }: { text: string }) {
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const parts: (string | { label: string; href: string })[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const label = match[1] ?? "";
    let href = match[2] ?? "";
    try {
      if (href.startsWith("http://") || href.startsWith("https://")) {
        const url = new URL(href);
        href = url.pathname + url.search;
      }
    } catch {
      // keep original href if invalid URL
    }
    if (href.startsWith("/p/")) {
      href = `/product/${href.slice(3)}`;
    }
    parts.push({ label, href });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return (
    <div className="space-y-2 whitespace-pre-wrap text-sm leading-relaxed">
      {parts.map((part, index) => {
        if (typeof part === "string") {
          return <span key={index}>{part}</span>;
        }
        return (
          <a
            key={index}
            href={part.href}
            className="inline-flex items-center gap-1 font-semibold text-accent underline underline-offset-2 transition-colors hover:text-foreground"
          >
            {part.label}
          </a>
        );
      })}
    </div>
  );
}

/**
 * Conversational shopping assistant powered by Loom by Auvia.
 * Swiss editorial aesthetic: crisp borders, structured typography, zero clutter.
 */
export function ShopAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [error, setError] = useState("");

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Restore conversation_id from sessionStorage on client mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) setConversationId(stored);
    }
  }, []);

  // Auto-scroll on new messages or streaming chunks
  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, pending, open]);

  // Focus input on open
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Reset conversation
  function handleReset() {
    setMessages([]);
    setError("");
    setConversationId(undefined);
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(STORAGE_KEY);
    }
    inputRef.current?.focus();
  }

  async function sendMessage(textToSend: string) {
    const trimmed = textToSend.trim();
    if (!trimmed || pending) return;

    const userMsgId = `user-${Date.now()}`;
    const assistantMsgId = `asst-${Date.now()}`;

    setMessages((prev) => [
      ...prev,
      { id: userMsgId, sender: "user", text: trimmed },
      { id: assistantMsgId, sender: "assistant", text: "" },
    ]);
    setInput("");
    setPending(true);
    setError("");

    try {
      const response = await fetch("/api/v1/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          conversation_id: conversationId,
        }),
      });

      if (!response.ok) {
        throw new Error(`Assistant request failed (${response.status})`);
      }

      if (!response.body) {
        throw new Error("No response stream available.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine.startsWith("data:")) continue;

          const dataStr = trimmedLine.slice(5).trim();
          if (!dataStr) continue;

          try {
            const data = JSON.parse(dataStr);

            if (data.conversation_id && typeof window !== "undefined") {
              setConversationId(data.conversation_id);
              sessionStorage.setItem(STORAGE_KEY, data.conversation_id);
            }

            if (data.answer) {
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMsgId ? { ...msg, text: msg.text + data.answer } : msg,
                ),
              );
            }
          } catch {
            // Ignore non-JSON ping/keep-alive SSE lines
          }
        }
      }
    } catch (caught) {
      const errMessage =
        caught instanceof Error ? caught.message : "Assistant temporarily unavailable.";
      setError(errMessage);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId && !msg.text
            ? { ...msg, text: "Sorry, I couldn't process that request right now." }
            : msg,
        ),
      );
    } finally {
      setPending(false);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    sendMessage(input);
  }

  return (
    <div className="fixed bottom-5 right-5 z-50">
      {/* Floating launcher */}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="bazaar-assistant"
        className="grid h-12 w-12 cursor-pointer place-items-center border border-signal bg-signal text-signal-foreground transition-colors hover:bg-background hover:text-foreground"
      >
        {open ? <X className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
        <span className="sr-only">{open ? "Close" : "Open"} shopping assistant</span>
      </button>

      {/* Floating Chat Modal */}
      {open && (
        <section
          id="bazaar-assistant"
          aria-label="Shopping assistant"
          role="dialog"
          aria-modal="false"
          className="panel absolute bottom-16 right-0 flex h-[540px] max-h-[82vh] w-[min(92vw,400px)] flex-col overflow-hidden border border-border bg-background p-0 shadow-2xl"
        >
          {/* Header */}
          <header className="flex items-center justify-between border-b border-border bg-surface px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="grid h-7 w-7 place-items-center border border-signal bg-signal text-signal-foreground">
                <Bot className="h-4 w-4" />
              </div>
              <div>
                <h2 className="font-display text-xs font-bold uppercase tracking-wider text-foreground">
                  Bazaar Assistant
                </h2>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Powered by Loom by Auvia
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleReset}
                title="New conversation"
                aria-label="Start new conversation"
                className="grid h-8 w-8 cursor-pointer place-items-center text-muted-foreground transition-colors hover:text-foreground"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                title="Close"
                aria-label="Close assistant"
                className="grid h-8 w-8 cursor-pointer place-items-center text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </header>

          {/* Conversation history */}
          <div
            ref={scrollRef}
            className="flex-1 space-y-4 overflow-y-auto p-4"
            aria-live="polite"
            role="log"
          >
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <div className="grid h-10 w-10 place-items-center border border-border bg-surface text-signal">
                  <Sparkles className="h-5 w-5" />
                </div>
                <h3 className="font-display mt-3 text-sm font-bold uppercase tracking-tight text-foreground">
                  Everyday Tech Concierge
                </h3>
                <p className="mt-1.5 max-w-[280px] text-xs leading-relaxed text-muted-foreground">
                  Ask about live inventory, specifications, prices, or product recommendations.
                </p>

                <div className="mt-6 flex flex-col gap-2 w-full">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-left">
                    Suggested queries
                  </span>
                  {SUGGESTIONS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => sendMessage(prompt)}
                      className="text-left text-xs p-2.5 border border-border bg-surface transition-colors hover:border-signal hover:text-foreground cursor-pointer"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`max-w-[88%] p-3 text-sm ${
                      msg.sender === "user"
                        ? "border border-signal bg-signal text-signal-foreground"
                        : "border border-border bg-surface text-foreground"
                    }`}
                  >
                    {msg.sender === "assistant" ? (
                      msg.text ? (
                        <FormattedAssistantMessage text={msg.text} />
                      ) : (
                        <div className="flex items-center gap-1 py-1 text-muted-foreground">
                          <span className="h-1.5 w-1.5 animate-bounce bg-current rounded-full" />
                          <span className="h-1.5 w-1.5 animate-bounce bg-current rounded-full [animation-delay:0.2s]" />
                          <span className="h-1.5 w-1.5 animate-bounce bg-current rounded-full [animation-delay:0.4s]" />
                        </div>
                      )
                    ) : (
                      <p className="whitespace-pre-wrap">{msg.text}</p>
                    )}
                  </div>
                </div>
              ))
            )}

            {error && (
              <p
                role="alert"
                className="text-center text-xs text-destructive p-2 border border-destructive/20 bg-destructive/10"
              >
                {error}
              </p>
            )}
          </div>

          {/* Input form */}
          <form onSubmit={handleSubmit} className="border-t border-border bg-surface p-3">
            <div className="flex items-center gap-2">
              <label className="sr-only" htmlFor="assistant-message-input">
                Ask the assistant
              </label>
              <input
                ref={inputRef}
                id="assistant-message-input"
                type="text"
                autoComplete="off"
                enterKeyHint="send"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                maxLength={1000}
                placeholder="Ask about products, stock, prices..."
                className="field min-w-0 flex-1 bg-background text-sm py-2 px-3"
                disabled={pending}
              />
              <button
                type="submit"
                disabled={pending || !input.trim()}
                className="btn btn-primary btn-icon shrink-0 h-9 w-9 cursor-pointer disabled:opacity-50"
                aria-label="Send message"
              >
                {pending ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </div>
            <p className="mt-2 text-[10px] text-center text-muted-foreground uppercase tracking-wider">
              Catalog Assistant · Live Inventory & Pricing
            </p>
          </form>
        </section>
      )}
    </div>
  );
}
