import { ensureSecureReportSession } from '../lib/reportAuth';
import { supabase } from '../lib/supabase';
import {
  ASIAN_HOSPITAL_NAME,
  mapMedicineRowsToShopProducts,
  type ShopMedicineRow,
  type ShopProduct,
} from './shopProductModel';

export type { ShopProduct } from './shopProductModel';

const SHOP_MEDICINE_COLUMNS =
  'id, name, image_url, hospital_name, category, composition, dosage_form, price, shop_short_description, shop_full_description, shop_common_uses, shop_safety_note, shop_information_source_name, shop_information_source_url, shop_information_reviewed_at, shop_product_section_items(section_code, sort_order)' as const;

const DATABASE_PAGE_SIZE = 1000;
const CATALOGUE_CACHE_TTL_MS = 5 * 60 * 1000;

let catalogueCache:
  | { expiresAt: number; products: ShopProduct[] }
  | undefined;

export function findCachedShopProduct(
  products: readonly ShopProduct[],
  id: string,
): ShopProduct | null {
  return products.find((product) => product.id === id) ?? null;
}

export async function fetchShopProductById(
  id: string,
  signal?: AbortSignal,
): Promise<ShopProduct | null> {
  if (catalogueCache && catalogueCache.expiresAt > Date.now()) {
    const cached = findCachedShopProduct(catalogueCache.products, id);
    if (cached) {
      return cached;
    }
  }

  await ensureSecureReportSession();
  let request = supabase
    .from('medicines')
    .select(SHOP_MEDICINE_COLUMNS)
    .eq('id', id);

  if (signal) {
    request = request.abortSignal(signal);
  }

  const { data, error } = await request.maybeSingle();
  if (error) {
    if (signal?.aborted) {
      throw new DOMException('Shop request cancelled', 'AbortError');
    }
    throw error;
  }
  if (!data) {
    return null;
  }

  const [product] = mapMedicineRowsToShopProducts([data as ShopMedicineRow]);
  return product ?? null;
}

export async function fetchShopProducts(
  query = '',
  signal?: AbortSignal,
): Promise<ShopProduct[]> {
  await ensureSecureReportSession();
  const rows: ShopMedicineRow[] = [];
  const search = query.trim().replace(/[%_]/g, '');
  if (
    !search &&
    catalogueCache &&
    catalogueCache.expiresAt > Date.now()
  ) {
    return catalogueCache.products;
  }

  for (let from = 0; ; from += DATABASE_PAGE_SIZE) {
    let request = supabase
      .from('medicines')
      .select(SHOP_MEDICINE_COLUMNS)
      .ilike('hospital_name', ASIAN_HOSPITAL_NAME)
      .not('image_url', 'is', null)
      .neq('image_url', '')
      .order('name')
      .order('id')
      .range(from, from + DATABASE_PAGE_SIZE - 1);

    if (search) {
      request = request.ilike('name', `%${search}%`);
    }
    if (signal) {
      request = request.abortSignal(signal);
    }

    const { data, error } = await request;
    if (error) {
      if (signal?.aborted) {
        throw new DOMException('Shop request cancelled', 'AbortError');
      }
      throw error;
    }

    const page = (data ?? []) as ShopMedicineRow[];
    rows.push(...page);
    if (page.length < DATABASE_PAGE_SIZE) {
      break;
    }
  }

  const products = mapMedicineRowsToShopProducts(rows);
  if (!search) {
    catalogueCache = {
      expiresAt: Date.now() + CATALOGUE_CACHE_TTL_MS,
      products,
    };
  }
  return products;
}
