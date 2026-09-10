import type { Cosmetics } from './type';
import { COSMETICS } from './data';

export const DEFAULT_COSMETICS: Cosmetics = {
  ...COSMETICS.map(c => {
    return c.type === 'boolean' ? {[c.key]: c.default} : c.type === 'file' ? {[c.key]: null} : {[c.key]: 'default'} as any;
  }).reduce((a, b) => ({...a, ...b} as any), {}),
  equipmentOot: [],
  equipmentMm: [],
} as Cosmetics;

export function makeCosmetics(data: Partial<Cosmetics>) {
  const cleanData = { ...data } as Partial<Cosmetics> & { equipment?: unknown };
  delete cleanData.equipment;

  const equipmentOot = Array.isArray(cleanData.equipmentOot) ? cleanData.equipmentOot : DEFAULT_COSMETICS.equipmentOot;
  const equipmentMm = Array.isArray(cleanData.equipmentMm) ? cleanData.equipmentMm : DEFAULT_COSMETICS.equipmentMm;

  return {
    ...DEFAULT_COSMETICS,
    ...cleanData,
    equipmentOot: [...equipmentOot],
    equipmentMm: [...equipmentMm],
  };
}
