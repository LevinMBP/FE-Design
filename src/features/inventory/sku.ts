/**
 * Fallback SKU derived from an item name for clients who don't track SKUs:
 * lowercased and with whitespace collapsed to underscores.
 * e.g. "Product A" → "product_a".
 */
export function skuFromName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, '_')
}
