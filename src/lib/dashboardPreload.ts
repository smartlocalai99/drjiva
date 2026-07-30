import {
  fetchMedicinesForDate,
  type Medicine,
} from '../data/medicines';
import { formatDateOnly } from './medicineCalendar';
import { getPatientByPhone } from './patients';
import { normalizeRoutePhone } from './routePhone';
import { getSessionPhone } from './session';

export type DashboardSnapshot = {
  dateKey: string;
  medicines: Medicine[];
  patientId: string;
  patientName: string;
  phone: string;
};

export type DashboardBootstrap =
  | { phone: null; status: 'signed-out' }
  | { phone: string; status: 'needs-onboarding' }
  | {
      phone: string;
      snapshot: DashboardSnapshot;
      status: 'ready';
    }
  | { phone: string | null; status: 'unavailable' };

let bootstrapResult: DashboardBootstrap | null = null;
let preloadPromise: Promise<DashboardBootstrap> | null = null;

export function getDashboardBootstrap(): DashboardBootstrap | null {
  return bootstrapResult;
}

export function getDashboardSnapshot(
  phone: string,
  date: Date,
): DashboardSnapshot | null {
  const normalizedPhone = normalizeRoutePhone(phone);
  if (
    bootstrapResult?.status !== 'ready' ||
    bootstrapResult.phone !== normalizedPhone ||
    bootstrapResult.snapshot.dateKey !== formatDateOnly(date)
  ) {
    return null;
  }

  return bootstrapResult.snapshot;
}

export function setDashboardSnapshot(
  snapshot: DashboardSnapshot,
): void {
  bootstrapResult = {
    phone: snapshot.phone,
    snapshot,
    status: 'ready',
  };
}

export function clearDashboardPreload(): void {
  bootstrapResult = null;
  preloadPromise = null;
}

export function preloadDashboardForSession(
  date = new Date(),
): Promise<DashboardBootstrap> {
  if (bootstrapResult) {
    return Promise.resolve(bootstrapResult);
  }
  if (preloadPromise) {
    return preloadPromise;
  }

  const task = (async (): Promise<DashboardBootstrap> => {
    try {
      const phone = normalizeRoutePhone(
        (await getSessionPhone().catch(() => null)) ?? undefined,
      );
      if (!phone) {
        return { phone: null, status: 'signed-out' };
      }

      const patient = await getPatientByPhone(phone);
      if (!patient) {
        return { phone, status: 'needs-onboarding' };
      }

      const medicines = await fetchMedicinesForDate(patient.patientId, date);
      return {
        phone,
        snapshot: {
          dateKey: formatDateOnly(date),
          medicines,
          patientId: patient.patientId,
          patientName: patient.name,
          phone,
        },
        status: 'ready',
      };
    } catch {
      const phone = normalizeRoutePhone(
        (await getSessionPhone().catch(() => null)) ?? undefined,
      );
      return { phone: phone || null, status: 'unavailable' };
    }
  })();

  preloadPromise = task.then((result) => {
    bootstrapResult = result;
    preloadPromise = null;
    return result;
  });

  return preloadPromise;
}
