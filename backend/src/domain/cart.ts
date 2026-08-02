import type { Db, ObjectId } from "mongodb";
import type { CartDto, CartLineDto } from "@bazaar/shared";
import { serializeProduct, type ProductDocument } from "./catalog.js";

export type CartDocument = {
  _id: ObjectId;
  ownerKey: string;
  revision: number;
  lines: { variantId: ObjectId; quantity: number }[];
  updatedAt: Date;
  createdAt: Date;
};

export async function serializeCart(db: Db, cart: CartDocument): Promise<CartDto> {
  const variants = await db.collection("variants").find({ _id: { $in: cart.lines.map((line) => line.variantId) } }).toArray();
  const products = await db.collection<ProductDocument>("products").find({ _id: { $in: variants.map((variant) => variant.productId as ObjectId) } }).toArray();
  const productById = new Map(products.map((item) => [item._id.toHexString(), item]));
  const variantById = new Map(variants.map((item) => [item._id.toHexString(), item]));
  const lines: CartLineDto[] = cart.lines.flatMap((line) => {
    const variant = variantById.get(line.variantId.toHexString());
    const product = variant ? productById.get((variant.productId as ObjectId).toHexString()) : undefined;
    if (!variant || !product) return [];
    const unitPrice = Number(variant.priceMinor ?? product.priceMinor);
    return [{ lineId: line.variantId.toHexString(), variantId: line.variantId.toHexString() as CartLineDto["variantId"], quantity: line.quantity, product: serializeProduct(product, 1), unitPrice: { amountMinor: unitPrice, currency: "USD" }, lineTotal: { amountMinor: unitPrice * line.quantity, currency: "USD" } }];
  });
  return { id: cart._id.toString() as CartDto["id"], revision: cart.revision, lines, subtotal: { amountMinor: lines.reduce((sum, line) => sum + line.lineTotal.amountMinor, 0), currency: "USD" }, itemCount: lines.reduce((sum, line) => sum + line.quantity, 0) };
}
