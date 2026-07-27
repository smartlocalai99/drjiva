import { Ionicons } from '@expo/vector-icons';

export type ShopTint = 'primary' | 'success' | 'warning' | 'error';

export type ShopProduct = {
  icon: keyof typeof Ionicons.glyphMap;
  id: string;
  name: string;
  packSize: string;
  price: number;
  tint: ShopTint;
};

export const SHOP_PRODUCTS: ShopProduct[] = [
  {
    icon: 'medkit-outline',
    id: 'dolo-650',
    name: 'Dolo 650',
    packSize: '15 tablets',
    price: 32,
    tint: 'primary',
  },
  {
    icon: 'thermometer-outline',
    id: 'crocin-advance',
    name: 'Crocin Advance',
    packSize: '15 tablets',
    price: 28,
    tint: 'warning',
  },
  {
    icon: 'bandage-outline',
    id: 'combiflam',
    name: 'Combiflam',
    packSize: '20 tablets',
    price: 35,
    tint: 'error',
  },
  {
    icon: 'fitness-outline',
    id: 'volini-gel',
    name: 'Volini Gel',
    packSize: '30g tube',
    price: 110,
    tint: 'success',
  },
  {
    icon: 'water-outline',
    id: 'ors-powder',
    name: 'ORS Powder',
    packSize: '1 sachet',
    price: 20,
    tint: 'primary',
  },
  {
    icon: 'leaf-outline',
    id: 'cetirizine',
    name: 'Cetirizine',
    packSize: '10 tablets',
    price: 18,
    tint: 'success',
  },
];
