import type { Cosmetics } from '@ootmm/generator';
import type { SettingsSlice } from './settings';
import type { RandomSettingsSlice } from './randomSettings';
import type { CosmeticsSlice } from './cosmetics';
import type { ConfigSlice } from './config';
import type { GeneratorSlice } from './generator';

import { create } from 'zustand';
import { isEqual } from 'lodash-es';
import { COSMETICS, makeSettings } from '@ootmm/generator';

import { createSettingsSlice } from './settings';
import * as API from '../api';
import { localStoragePrefixedSet } from '../util';
import { createRandomSettingsSlice } from './randomSettings';
import { createCosmeticsSlice } from './cosmetics';
import { loadFile, loadFileLocal, loadFilesLocal, saveFileLocal, saveFilesLocal } from '../db';
import { createConfigSlice } from './config';
import { createGeneratorSlice } from './generator';

export type Store = SettingsSlice & RandomSettingsSlice & CosmeticsSlice & ConfigSlice & GeneratorSlice;

export const useStore = create<Store>((...a) => ({
  ...createSettingsSlice(...a),
  ...createRandomSettingsSlice(...a),
  ...createCosmeticsSlice(...a),
  ...createConfigSlice(...a),
  ...createGeneratorSlice(...a),
}));

let settingsUpdateTicket = 0;
let cosmeticFilesLoaded = false;

function onSettingsUpdate() {
  localStoragePrefixedSet('settings', useStore.getState().settings);
  const currentTicket = ++settingsUpdateTicket;
  let state = useStore.getState();
  Promise.all([
    API.itemPool(state.settings),
    API.locationList(state.settings),
  ]).then(([newItemPool, newLocations]) => {
    if (settingsUpdateTicket !== currentTicket) return;

    state = useStore.getState();
    useStore.setState({
      itemPool: newItemPool,
      locations: newLocations,
    });

    const startingItems = API.restrictItemsByPool(state.settings.startingItems, newItemPool);
    if (isEqual(state.settings.startingItems, startingItems)) return;
    state.setSettings(state => makeSettings({ ...state, startingItems }));
  });
}

function onRandomSettingsUpdate() {
  localStoragePrefixedSet('randomSettings', useStore.getState().randomSettings);
}

const EQUIPMENT_FILE_KEYS = ['equipmentOot', 'equipmentMm'] as const;
const EQUIPMENT_KEY_SET = new Set<string>(['equipment', ...EQUIPMENT_FILE_KEYS]);
const COSMETICS_FILE_KEYS = COSMETICS
  .filter(c => c.type === 'file' && !EQUIPMENT_KEY_SET.has(c.key))
  .map(c => c.key);

function onCosmeticsUpdate(prev: Cosmetics, curr: Cosmetics) {
  const state = useStore.getState();
  const savedCosmetics = { ...state.cosmetics } as Partial<Cosmetics>;

  for (const c of COSMETICS_FILE_KEYS) delete (savedCosmetics as any)[c];
  for (const c of EQUIPMENT_FILE_KEYS) delete savedCosmetics[c];
  delete (savedCosmetics as any).equipment;
  localStoragePrefixedSet('cosmetics', savedCosmetics);

  if (!cosmeticFilesLoaded) return;

  for (const c of COSMETICS_FILE_KEYS) {
    const data = curr[c];
    const prevData = prev[c];
    if (prevData !== data) {
      saveFileLocal(`cosmetics:${c}`, data as File | null).catch(console.error);
    }
  }

  for (const c of EQUIPMENT_FILE_KEYS) {
    if (prev[c] !== curr[c]) {
      saveFilesLocal(`cosmetics:${c}`, curr[c].filter((entry): entry is File => entry instanceof File)).catch(console.error);
    }
  }
}

useStore.subscribe((state, prevState) => {
  if (state.settings !== prevState.settings) onSettingsUpdate();
  if (state.randomSettings !== prevState.randomSettings) onRandomSettingsUpdate();
  if (state.cosmetics !== prevState.cosmetics) onCosmeticsUpdate(prevState.cosmetics, state.cosmetics);
});

onSettingsUpdate();
onRandomSettingsUpdate();
onCosmeticsUpdate(useStore.getState().cosmetics, useStore.getState().cosmetics);

/* Initial load of cosmetic files. */
const cosmeticFiles = COSMETICS_FILE_KEYS.map(c =>
  loadFileLocal(`cosmetics:${c}`)
    .then(x => useStore.getState().setCosmetic(c, x))
    .catch(console.error)
);

const equipmentFiles = EQUIPMENT_FILE_KEYS.map(c =>
  loadFilesLocal(`cosmetics:${c}`)
    .then(x => useStore.getState().setCosmetic(c, x))
    .catch(console.error)
);

Promise.allSettled([...cosmeticFiles, ...equipmentFiles]).finally(() => cosmeticFilesLoaded = true);

/* Initial load of config */
loadFile('oot').then(x => useStore.getState().setRomConfigFile('oot', x)).catch(console.error);
loadFile('mm').then(x => useStore.getState().setRomConfigFile('mm', x)).catch(console.error);
