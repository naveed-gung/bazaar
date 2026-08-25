import { Link } from "@tanstack/react-router";
import { ArrowRight, Minus, Plus, X } from "lucide-react";
import { Drawer } from "@/components/drawer";
import { formatPrice } from "@/lib/products";
import type { CartLineView } from "@/lib/store";
import { cn } from "@/lib/utils";

/** Server hard limit — POST /cart/lines rejects quantities above 10. */
export const CART_QTY_LIMIT = 10;

function optionSummary(line: CartLineView) {
  const values = Object.values(line.optionValues);
  return values.length ? values.join(" · ") : "";
}

/**
 * The ONE cart line renderer (SF-04): the /cart page and the mini-cart drawer
 * both render this row, compact or full, so the two can never drift apart.
 * Swiss: hairline-boxed rows, square thumbs, square quantity stepper.
 */
export function CartLineRow({
  line,
  variant = "full",
  maxQty,
  pending,
  onQty,
  onRemove,
  onSaveForLater,
}: {
  line: CartLineView;
  variant?: "full" | "compact";
  /** Stock ceiling for the stepper; falls back to the server's hard limit. */
  maxQty?: number | null;
  pending?: boolean | undefined;
  onQty: (lineId: string, qty: number) => void;
  onRemove: (lineId: string) => void;
  onSaveForLater?: (lineId: string) => void;
}) {
  const ceiling = Math.max(1, Math.min(maxQty ?? CART_QTY_LIMIT, CART_QTY_LIMIT));
  const atCeiling = line.qty >= ceiling;
  const options = optionSummary(line);

  return (
    <div
      className={cn(
        "grid items-center gap-4 border border-border bg-surface",
        variant === "full"
          ? "grid-cols-[88px_minmax(0,1fr)_auto] p-5"
          : "grid-cols-[64px_minmax(0,1fr)_auto] p-3.5",
      )}
    >
      <Link to="/product/$slug" params={{ slug: line.slug }} className="shrink-0">
        <img
          src={line.img}
          alt={line.name}
          width={variant === "full" ? 88 : 64}
          height={variant === "full" ? 88 : 64}
          loading="lazy"
          className={cn(
            "border border-border object-cover",
            variant === "full" ? "h-22 w-22" : "h-16 w-16",
          )}
        />
      </Link>
      <div className="min-w-0">
        <Link
          to="/product/$slug"
          params={{ slug: line.slug }}
          className="block truncate text-sm font-bold uppercase tracking-[0.02em] hover:text-accent lg:text-base"
        >
          {line.name}
        </Link>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {line.brand}
          {options ? ` · ${options}` : ""}
        </p>
        <p className="price mt-1 text-xs text-muted-foreground">
          {formatPrice(line.unitPrice)} each
        </p>
        <div className="mt-2.5 flex flex-wrap items-center gap-3">
          <div className="flex w-fit items-center border border-border p-1">
            <button
              type="button"
              disabled={pending}
              aria-label={`Decrease ${line.name} quantity`}
              onClick={() => onQty(line.lineId, line.qty - 1)}
              className="btn btn-ghost btn-icon btn-sm text-muted-foreground"
            >
              <Minus className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <span className="tabular w-8 text-center text-sm font-semibold">{line.qty}</span>
            <button
              type="button"
              disabled={pending || atCeiling}
              aria-label={`Increase ${line.name} quantity`}
              onClick={() => onQty(line.lineId, line.qty + 1)}
              className="btn btn-ghost btn-icon btn-sm text-muted-foreground"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
          {atCeiling && (
            <span className="text-xs font-medium text-deal">
              {maxQty != null && maxQty <= 0
                ? "No more stock available"
                : `Limited to ${ceiling} per order`}
            </span>
          )}
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2">
        <span className="price tabular font-bold">{formatPrice(line.lineTotal)}</span>
        <div className="flex items-center gap-1">
          {onSaveForLater && (
            <button
              type="button"
              disabled={pending}
              onClick={() => onSaveForLater(line.lineId)}
              className="btn btn-ghost btn-sm text-muted-foreground hover:text-foreground"
            >
              Save for later
            </button>
          )}
          <button
            type="button"
            disabled={pending}
            aria-label={`Remove ${line.name}`}
            onClick={() => onRemove(line.lineId)}
            className="btn btn-ghost btn-icon btn-sm text-muted-foreground hover:text-destructive"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Mini-cart drawer. Mounted once by StoreProvider; quick-add anywhere in the
 * catalogue opens it, and it shares CartLineRow with the /cart page.
 */
export function CartDrawer({
  open,
  onClose,
  lines,
  subtotal,
  itemCount,
  pending,
  onQty,
  onRemove,
}: {
  open: boolean;
  onClose: () => void;
  lines: CartLineView[];
  subtotal: number;
  itemCount: number;
  pending?: boolean;
  onQty: (lineId: string, qty: number) => void;
  onRemove: (lineId: string) => void;
}) {
  return (
    <Drawer open={open} onClose={onClose} title={`Your cart (${itemCount})`}>
      {lines.length === 0 ? (
        <div className="flex flex-col px-4 py-14">
          <p className="text-base font-bold uppercase tracking-tight">Your cart is empty</p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Quick-add anything from the catalogue and it lands here instantly.
          </p>
          <Link to="/shop" onClick={onClose} className="btn btn-primary mt-8 self-start">
            Browse the shop
          </Link>
        </div>
      ) : (
        <>
          <ul className="space-y-3">
            {lines.map((line) => (
              <li key={line.lineId}>
                <CartLineRow
                  line={line}
                  variant="compact"
                  pending={pending}
                  onQty={(lineId, qty) =>
                    qty <= 0 ? onRemove(lineId) : onQty(lineId, Math.min(qty, CART_QTY_LIMIT))
                  }
                  onRemove={onRemove}
                />
              </li>
            ))}
          </ul>
          <div className="mt-6 border-t border-border pt-5">
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="price tabular text-xl font-bold">{formatPrice(subtotal)}</span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Shipping, tax and promotions are quoted by the server at checkout.
            </p>
            <Link to="/cart" onClick={onClose} className="btn btn-quiet mt-4 w-full">
              View full cart
            </Link>
            <Link to="/checkout" onClick={onClose} className="btn btn-primary mt-3 w-full">
              Checkout
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </>
      )}
    </Drawer>
  );
}
