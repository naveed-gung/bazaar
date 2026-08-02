import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bot, LoaderCircle, Send, X } from "lucide-react";
import { api } from "@/lib/api";

type AssistantReply = { answer: string; actions: { label: string; href: string }[] };

export function ShopAssistant() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState<AssistantReply | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!message.trim()) return;
    setPending(true);
    setError("");
    try {
      setReply(
        await api<AssistantReply>("/assistant", {
          method: "POST",
          body: JSON.stringify({ message }),
        }),
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Assistant unavailable.");
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="fixed bottom-5 right-5 z-50">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="bazaar-assistant"
        className="grid h-12 w-12 place-items-center rounded-full bg-signal text-signal-foreground shadow-lift transition-transform active:scale-95"
      >
        {open ? <X className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
        <span className="sr-only">{open ? "Close" : "Open"} shopping assistant</span>
      </button>
      {open && (
        <section
          id="bazaar-assistant"
          aria-label="Shopping assistant"
          className="absolute bottom-16 right-0 w-[min(88vw,360px)] rounded-2xl border border-border bg-background p-5 shadow-lift"
        >
          <div className="flex items-center gap-3">
            <Bot className="h-5 w-5 text-glow" />
            <h2 className="font-bold">Bazaar assistant</h2>
          </div>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            Deterministic, zero-cost help using live catalog and cart services.
          </p>
          {reply && (
            <div className="mt-5 rounded-xl bg-surface p-4 text-sm leading-6" aria-live="polite">
              <p>{reply.answer}</p>
              {reply.actions.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {reply.actions.map((action) => (
                    <Link
                      key={`${action.href}-${action.label}`}
                      to={action.href}
                      className="rounded-lg border border-border px-3 py-2 text-xs font-semibold"
                    >
                      {action.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
          {error && (
            <p role="alert" className="mt-4 text-sm text-destructive">
              {error}
            </p>
          )}
          <form onSubmit={submit} className="mt-5 flex gap-2">
            <label className="sr-only" htmlFor="assistant-message">
              Ask the assistant
            </label>
            <input
              id="assistant-message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              maxLength={500}
              placeholder="Find audio under $300…"
              className="min-h-11 min-w-0 flex-1 rounded-xl border border-border bg-surface px-3 text-sm"
            />
            <button
              disabled={pending}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-signal text-signal-foreground disabled:opacity-50"
            >
              {pending ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              <span className="sr-only">Send</span>
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
