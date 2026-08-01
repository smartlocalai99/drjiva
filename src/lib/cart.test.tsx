import TestRenderer, { act } from 'react-test-renderer';
import { afterEach, describe, expect, it } from 'vitest';

import type { ShopProduct } from '../data/shopProducts';
import { CartProvider, useCart } from './cart';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

const product: ShopProduct = {
  category: 'Pain relief',
  commonUses: null,
  composition: 'Paracetamol',
  fullDescription: 'Pain relief medicine.',
  hasUniqueCatalogueName: true,
  hospitalName: 'ASIAN MULTI SPECIALITY HOSPITALS',
  id: 'medicine-1',
  imageUrl: 'https://example.com/medicine.jpg',
  informationReviewedAt: null,
  informationSourceName: null,
  informationSourceUrl: null,
  name: 'Paracetamol 500 mg',
  packSize: 'Tablet',
  price: 49,
  safetyNote: 'Use as directed.',
  sectionRanks: {},
  shortDescription: 'Pain relief.',
};

describe('CartProvider', () => {
  let renderer: TestRenderer.ReactTestRenderer | undefined;

  afterEach(() => {
    renderer?.unmount();
    renderer = undefined;
  });

  it('clears quantities and product snapshots only when clear is called', () => {
    let cart: ReturnType<typeof useCart> | undefined;
    function Consumer() {
      cart = useCart();
      return null;
    }

    act(() => {
      renderer = TestRenderer.create(
        <CartProvider>
          <Consumer />
        </CartProvider>,
      );
    });
    act(() => cart?.add(product));
    expect(cart?.totalItems).toBe(1);
    expect(cart?.products['medicine-1']).toEqual(product);

    act(() => cart?.clear());

    expect(cart?.totalItems).toBe(0);
    expect(cart?.products).toEqual({});
    expect(cart?.quantities).toEqual({});
  });
});
