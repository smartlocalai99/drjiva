import type { DoseSlot } from './medicineSchedule';

export const DOSE_SLOT_THEME: Record<
  DoseSlot,
  {
    accent: string;
    icon: 'moon-outline' | 'partly-sunny-outline' | 'sunny-outline';
    tint: string;
  }
> = {
  morning: {
    accent: '#D68B12',
    icon: 'sunny-outline',
    tint: '#FFF4D6',
  },
  afternoon: {
    accent: '#D94F55',
    icon: 'partly-sunny-outline',
    tint: '#FDEBEC',
  },
  night: {
    accent: '#376ED0',
    icon: 'moon-outline',
    tint: '#E8F0FF',
  },
};
