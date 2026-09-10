import { ObjectEditor } from '../custom/object-editor';
import { bufReadU32BE, bufWriteU32BE } from '../util/buffer';
import { OOT_LINK_ADULT_OFFSETS, OOT_LINK_CHILD_OFFSETS } from './model';
import { MM_LINK_OFFSETS } from './mm-model-loader';
import { classifyPlayerModel, isPlayerModelPak, readPakZobjs } from './model-pak';

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const PLAYAS_MAGIC = encoder.encode('!PlayAsManifest0');
const MODEL_MAGIC = encoder.encode('MODLOADER64');
const PREPARED_OOT_MAGIC = encoder.encode('HEYLOOKHERE');
const EQUIP_MAGIC = encoder.encode('EQUIPMANIFEST');
const EQUIP_CATEGORY_MAGIC = encoder.encode('EQUIPMENTCAT');
const CONFIG_MAGIC = encoder.encode('OOTMMEQCFG1');
const SEG_SOURCE = 0x06;
const SEG_PLAYER = 0x06;
const SEG_MM_KEEP = 0x04;
const BASE = 0x06000000;

export type EquipmentGame = 'oot' | 'mm';
export type EquipmentFamily = 'sword' | 'shield' | 'equipment';
export type EquipmentAge = 'child' | 'adult';

export type EquipmentRule = {
  sourceId: string;
  targetId: string | null;
};

export type EquipmentFileConfig = {
  version: 1;
  game: EquipmentGame;
  rules: EquipmentRule[];
};

export type EquipmentSourceItem = {
  sourceId: string;
  label: string;
  family: EquipmentFamily;
  semantic: string;
  nativeGame: EquipmentGame | null;
  sourceData: Uint8Array;
  roles: Record<string, number[]>;
};

export type EquipmentResolvedOverride = EquipmentSourceItem & {
  targetId: string;
  sourceName: string;
  stackOrder?: number;
};

export type EquipmentTargetInfo = {
  id: string;
  game: EquipmentGame;
  label: string;
  family: EquipmentFamily;
  semantic: string;
};

export const EQUIPMENT_TARGETS: EquipmentTargetInfo[] = [
  { id: 'oot:sword:kokiri', game: 'oot', label: 'Kokiri Sword', family: 'sword', semantic: 'kokiri-sword' },
  { id: 'oot:sword:master', game: 'oot', label: 'Master Sword', family: 'sword', semantic: 'master-sword' },
  { id: 'oot:sword:biggoron', game: 'oot', label: 'Biggoron Sword / Giant\'s Knife', family: 'sword', semantic: 'biggoron-sword' },
  { id: 'oot:sword:biggoron-broken', game: 'oot', label: 'Broken Giant\'s Knife', family: 'sword', semantic: 'biggoron-broken' },
  { id: 'oot:shield:deku', game: 'oot', label: 'Deku Shield', family: 'shield', semantic: 'deku-shield' },
  { id: 'oot:shield:hylian', game: 'oot', label: 'Hylian Shield', family: 'shield', semantic: 'hylian-shield' },
  { id: 'oot:shield:mirror', game: 'oot', label: 'Mirror Shield', family: 'shield', semantic: 'mirror-shield' },
  { id: 'oot:hammer', game: 'oot', label: 'Megaton Hammer', family: 'equipment', semantic: 'hammer' },
  { id: 'oot:bow', game: 'oot', label: 'Fairy Bow', family: 'equipment', semantic: 'bow' },
  { id: 'oot:hookshot', game: 'oot', label: 'Hookshot / Longshot', family: 'equipment', semantic: 'hookshot' },
  { id: 'oot:slingshot', game: 'oot', label: 'Fairy Slingshot', family: 'equipment', semantic: 'slingshot' },
  { id: 'oot:boomerang', game: 'oot', label: 'Boomerang', family: 'equipment', semantic: 'boomerang' },
  { id: 'oot:ocarina-fairy', game: 'oot', label: 'Fairy Ocarina', family: 'equipment', semantic: 'ocarina-fairy' },
  { id: 'oot:ocarina-time', game: 'oot', label: 'Ocarina of Time', family: 'equipment', semantic: 'ocarina-time' },
  { id: 'oot:deku-stick', game: 'oot', label: 'Deku Stick', family: 'equipment', semantic: 'deku-stick' },
  { id: 'oot:boots-iron', game: 'oot', label: 'Iron Boots', family: 'equipment', semantic: 'boots-iron' },
  { id: 'oot:boots-hover', game: 'oot', label: 'Hover Boots', family: 'equipment', semantic: 'boots-hover' },
  { id: 'oot:gauntlets', game: 'oot', label: 'Silver / Golden Gauntlets', family: 'equipment', semantic: 'gauntlets' },
  { id: 'oot:mask-bunny', game: 'oot', label: 'Bunny Hood', family: 'equipment', semantic: 'mask-bunny' },
  { id: 'oot:mask-skull', game: 'oot', label: 'Skull Mask', family: 'equipment', semantic: 'mask-skull' },
  { id: 'oot:mask-spooky', game: 'oot', label: 'Spooky Mask', family: 'equipment', semantic: 'mask-spooky' },
  { id: 'oot:mask-gerudo', game: 'oot', label: 'Gerudo Mask', family: 'equipment', semantic: 'mask-gerudo' },
  { id: 'oot:mask-goron', game: 'oot', label: 'Goron Mask', family: 'equipment', semantic: 'mask-goron' },
  { id: 'oot:mask-keaton', game: 'oot', label: 'Keaton Mask', family: 'equipment', semantic: 'mask-keaton' },
  { id: 'oot:mask-truth', game: 'oot', label: 'Mask of Truth', family: 'equipment', semantic: 'mask-truth' },
  { id: 'oot:mask-zora', game: 'oot', label: 'Zora Mask', family: 'equipment', semantic: 'mask-zora' },

  { id: 'mm:sword:kokiri', game: 'mm', label: 'Kokiri Sword', family: 'sword', semantic: 'kokiri-sword' },
  { id: 'mm:sword:razor', game: 'mm', label: 'Razor Sword', family: 'sword', semantic: 'razor-sword' },
  { id: 'mm:sword:gilded', game: 'mm', label: 'Gilded Sword', family: 'sword', semantic: 'gilded-sword' },
  { id: 'mm:sword:great-fairy', game: 'mm', label: 'Great Fairy Sword', family: 'sword', semantic: 'great-fairy-sword' },
  { id: 'mm:shield:hero', game: 'mm', label: 'Hero\'s Shield', family: 'shield', semantic: 'hero-shield' },
  { id: 'mm:shield:mirror', game: 'mm', label: 'Mirror Shield', family: 'shield', semantic: 'mirror-shield' },
  { id: 'mm:bow', game: 'mm', label: 'Hero\'s Bow', family: 'equipment', semantic: 'bow' },
  { id: 'mm:hookshot', game: 'mm', label: 'Hookshot', family: 'equipment', semantic: 'hookshot' },
  { id: 'mm:ocarina-time', game: 'mm', label: 'Ocarina of Time', family: 'equipment', semantic: 'ocarina-time' },
];

const TARGET_BY_ID = new Map(EQUIPMENT_TARGETS.map((target) => [target.id, target]));

function bytesEqual(data: Uint8Array, offset: number, value: Uint8Array) {
  if (offset < 0 || offset + value.length > data.length) return false;
  for (let i = 0; i < value.length; ++i) if (data[offset + i] !== value[i]) return false;
  return true;
}

function findBytes(data: Uint8Array, value: Uint8Array, start = 0) {
  for (let i = Math.max(0, start); i + value.length <= data.length; ++i) {
    if (bytesEqual(data, i, value)) return i;
  }
  return -1;
}

function readCString(data: Uint8Array, offset: number, max = data.length) {
  let end = offset;
  while (end < max && data[end] !== 0 && data[end] !== 0xff) ++end;
  return decoder.decode(data.subarray(offset, end)).trim();
}

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
}

function componentKey(value: string) {
  return value.trim().toLowerCase().replace(/[ .-]+/g, '_');
}

function stripEquipmentConfig(data: Uint8Array): { data: Uint8Array; config: EquipmentFileConfig | null } {
  if (data.length < CONFIG_MAGIC.length + 4) return { data, config: null };
  const magicOffset = data.length - CONFIG_MAGIC.length;
  if (!bytesEqual(data, magicOffset, CONFIG_MAGIC)) return { data, config: null };
  const lenOffset = magicOffset - 4;
  if (lenOffset < 0) return { data, config: null };
  const jsonLength = bufReadU32BE(data, lenOffset);
  const jsonOffset = lenOffset - jsonLength;
  if (jsonOffset < 0) throw new Error('Invalid equipment cosmetic configuration trailer');
  let parsed: unknown;
  try {
    parsed = JSON.parse(decoder.decode(data.subarray(jsonOffset, lenOffset)));
  } catch {
    throw new Error('Invalid equipment cosmetic configuration JSON');
  }
  if (!parsed || typeof parsed !== 'object') throw new Error('Invalid equipment cosmetic configuration');
  const obj = parsed as Partial<EquipmentFileConfig>;
  if (obj.version !== 1 || (obj.game !== 'oot' && obj.game !== 'mm') || !Array.isArray(obj.rules)) {
    throw new Error('Unsupported equipment cosmetic configuration');
  }
  const rules: EquipmentRule[] = obj.rules.filter((rule): rule is EquipmentRule => {
    return !!rule && typeof rule === 'object' && typeof (rule as EquipmentRule).sourceId === 'string' &&
      ((rule as EquipmentRule).targetId === null || typeof (rule as EquipmentRule).targetId === 'string');
  });
  return { data: data.subarray(0, jsonOffset), config: { version: 1, game: obj.game, rules } };
}

function parsePlayAsManifest(data: Uint8Array) {
  const start = findBytes(data, PLAYAS_MAGIC);
  if (start === -1) return null;
  const header = start + PLAYAS_MAGIC.length;
  if (header + 2 > data.length || data[header] !== 0) throw new Error('Invalid PlayAs manifest');
  const count = data[header + 1];
  const entries = new Map<string, number>();
  let offset = header + 2;
  for (let i = 0; i < count; ++i) {
    let end = offset;
    while (end < data.length && data[end] !== 0) ++end;
    if (end >= data.length || end + 5 > data.length) throw new Error('Invalid PlayAs manifest entry');
    const name = decoder.decode(data.subarray(offset, end));
    const pointer = bufReadU32BE(data, end + 1) & 0x00ffffff;
    if (pointer < data.length) entries.set(name, (SEG_SOURCE << 24) | pointer);
    offset = end + 5;
  }
  return { entries, game: classifyPlayerModel(data).game as EquipmentGame | null };
}

function roots(entries: Map<string, number>, ...names: string[]) {
  return names.flatMap((name) => {
    const value = entries.get(name);
    return value === undefined ? [] : [value];
  });
}

function addItem(out: EquipmentSourceItem[], part: string, data: Uint8Array, game: EquipmentGame | null,
                 localId: string, label: string, family: EquipmentFamily, semantic: string,
                 roles: Record<string, number[]>, required: string) {
  if (!(roles[required]?.length)) return;
  out.push({
    sourceId: `${part}::${localId}`,
    label,
    family,
    semantic,
    nativeGame: game,
    sourceData: data,
    roles,
  });
}

function detectPlayAs(data: Uint8Array, part: string): EquipmentSourceItem[] {
  const manifest = parsePlayAsManifest(data);
  if (!manifest) return [];
  const e = manifest.entries;
  const g = manifest.game;
  const out: EquipmentSourceItem[] = [];

  if (g !== 'mm') {
    addItem(out, part, data, 'oot', 'oot-kokiri-sword', 'Kokiri Sword', 'sword', 'kokiri-sword', { hilt: roots(e, 'Hilt.1'), blade: roots(e, 'Blade.1') }, 'blade');
    addItem(out, part, data, 'oot', 'oot-master-sword', 'Master Sword', 'sword', 'master-sword', { hilt: roots(e, 'Hilt.2'), blade: roots(e, 'Blade.2') }, 'blade');
    addItem(out, part, data, 'oot', 'oot-biggoron-sword', 'Biggoron Sword', 'sword', 'biggoron-sword', { hilt: roots(e, 'Hilt.3'), blade: roots(e, 'Blade.3') }, 'blade');
    addItem(out, part, data, 'oot', 'oot-biggoron-broken', 'Broken Biggoron Sword', 'sword', 'biggoron-broken', { hilt: roots(e, 'Hilt.3'), blade: roots(e, 'Broken.Blade.3') }, 'blade');
    addItem(out, part, data, 'oot', 'oot-deku-shield', 'Deku Shield', 'shield', 'deku-shield', { main: roots(e, 'Shield.1') }, 'main');
    addItem(out, part, data, 'oot', 'oot-hylian-shield', 'Hylian Shield', 'shield', 'hylian-shield', { main: roots(e, 'Shield.2') }, 'main');
    addItem(out, part, data, 'oot', 'oot-mirror-shield', 'Mirror Shield', 'shield', 'mirror-shield', { main: roots(e, 'Shield.3') }, 'main');
    addItem(out, part, data, 'oot', 'oot-hammer', 'Megaton Hammer', 'equipment', 'hammer', { main: roots(e, 'Hammer') }, 'main');
    addItem(out, part, data, 'oot', 'oot-bow', 'Fairy Bow', 'equipment', 'bow', { main: roots(e, 'Bow'), string: roots(e, 'Bow.String') }, 'main');
    addItem(out, part, data, 'oot', 'oot-hookshot', 'Hookshot', 'equipment', 'hookshot', { main: roots(e, 'Hookshot'), spike: roots(e, 'Hookshot.Spike'), chain: roots(e, 'Hookshot.Chain'), reticle: roots(e, 'Hookshot.Aiming.Reticule'), fps: roots(e, 'FPS.Hookshot') }, 'main');
    addItem(out, part, data, 'oot', 'oot-slingshot', 'Fairy Slingshot', 'equipment', 'slingshot', { main: roots(e, 'Slingshot'), string: roots(e, 'Slingshot.String'), fps: roots(e, 'FPS.Forearm.R') }, 'main');
    addItem(out, part, data, 'oot', 'oot-boomerang', 'Boomerang', 'equipment', 'boomerang', { main: roots(e, 'Boomerang') }, 'main');
    addItem(out, part, data, 'oot', 'oot-ocarina-fairy', 'Fairy Ocarina', 'equipment', 'ocarina-fairy', { main: roots(e, 'Ocarina.1') }, 'main');
    addItem(out, part, data, 'oot', 'oot-ocarina-time', 'Ocarina of Time', 'equipment', 'ocarina-time', { main: roots(e, 'Ocarina.2') }, 'main');
    addItem(out, part, data, 'oot', 'oot-deku-stick', 'Deku Stick', 'equipment', 'deku-stick', { main: roots(e, 'DekuStick') }, 'main');
    addItem(out, part, data, 'oot', 'oot-iron-boots', 'Iron Boots', 'equipment', 'boots-iron', { left: roots(e, 'Foot.2.L'), right: roots(e, 'Foot.2.R') }, 'left');
    addItem(out, part, data, 'oot', 'oot-hover-boots', 'Hover Boots', 'equipment', 'boots-hover', { left: roots(e, 'Foot.3.L'), right: roots(e, 'Foot.3.R') }, 'left');
    addItem(out, part, data, 'oot', 'oot-gauntlets', 'Gauntlets', 'equipment', 'gauntlets', {
      lforearm: roots(e, 'Gauntlet.Forearm.L'), lhand: roots(e, 'Gauntlet.Hand.L'), lfist: roots(e, 'Gauntlet.Fist.L'),
      rforearm: roots(e, 'Gauntlet.Forearm.R'), rhand: roots(e, 'Gauntlet.Hand.R'), rfist: roots(e, 'Gauntlet.Fist.R'),
    }, 'lforearm');
    const masks: [string, string, string][] = [
      ['Bunny', 'Bunny Hood', 'mask-bunny'], ['Skull', 'Skull Mask', 'mask-skull'], ['Spooky', 'Spooky Mask', 'mask-spooky'],
      ['Gerudo', 'Gerudo Mask', 'mask-gerudo'], ['Goron', 'Goron Mask', 'mask-goron'], ['Keaton', 'Keaton Mask', 'mask-keaton'],
      ['Truth', 'Mask of Truth', 'mask-truth'], ['Zora', 'Zora Mask', 'mask-zora'],
    ];
    for (const [manifestName, label, semantic] of masks) {
      addItem(out, part, data, 'oot', `oot-${semantic}`, label, 'equipment', semantic, { main: roots(e, `Mask.${manifestName}`) }, 'main');
    }
  }

  if (g === 'mm') {
    addItem(out, part, data, 'mm', 'mm-kokiri-sword', 'Kokiri Sword', 'sword', 'kokiri-sword', { hilt: roots(e, 'Hilt.1'), blade: roots(e, 'Blade.1') }, 'blade');
    addItem(out, part, data, 'mm', 'mm-razor-sword', 'Razor Sword', 'sword', 'razor-sword', { hilt: roots(e, 'Hilt.2'), blade: roots(e, 'Blade.2') }, 'blade');
    addItem(out, part, data, 'mm', 'mm-gilded-sword', 'Gilded Sword', 'sword', 'gilded-sword', { hilt: roots(e, 'Hilt.3'), blade: roots(e, 'Blade.3') }, 'blade');
    addItem(out, part, data, 'mm', 'mm-great-fairy-sword', 'Great Fairy Sword', 'sword', 'great-fairy-sword', { main: roots(e, 'Sword.4') }, 'main');
    addItem(out, part, data, 'mm', 'mm-hero-shield', 'Hero\'s Shield', 'shield', 'hero-shield', { main: roots(e, 'Shield.1') }, 'main');
    addItem(out, part, data, 'mm', 'mm-mirror-shield', 'Mirror Shield', 'shield', 'mirror-shield', { body: roots(e, 'Shield.2'), face: roots(e, 'Shield.2.Face') }, 'body');
    addItem(out, part, data, 'mm', 'mm-bow', 'Hero\'s Bow', 'equipment', 'bow', { main: roots(e, 'Bow'), string: roots(e, 'Bow.String') }, 'main');
    addItem(out, part, data, 'mm', 'mm-hookshot', 'Hookshot', 'equipment', 'hookshot', { main: roots(e, 'Hookshot'), spike: roots(e, 'Hookshot.Spike'), fps: roots(e, 'FPS.Forearm.R') }, 'main');
    addItem(out, part, data, 'mm', 'mm-ocarina-time', 'Ocarina of Time', 'equipment', 'ocarina-time', { main: roots(e, 'Ocarina.2') }, 'main');
  }

  return out;
}

type Dedicated = { category: string; game: EquipmentGame | null; components: Map<string, number[]>; roots: number[] };

function collectDedicatedComponents(value: unknown, rootTable: number[]) {
  const components = new Map<string, number[]>();
  let oot = false;
  let mm = false;
  const visit = (item: unknown, path: string[]) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return;
    for (const [key, child] of Object.entries(item as Record<string, unknown>)) {
      const nextPath = [...path, key];
      if (/^\d+$/.test(key) && typeof child === 'string') {
        const index = Number(key);
        if (index >= 0 && index < rootTable.length) {
          const name = componentKey(child);
          const list = components.get(name) ?? [];
          if (!list.includes(rootTable[index])) list.push(rootTable[index]);
          components.set(name, list);
          if (nextPath.some((p) => p.toUpperCase() === 'OOT')) oot = true;
          if (nextPath.some((p) => p.toUpperCase() === 'MM')) mm = true;
        }
      } else visit(child, nextPath);
    }
  };
  visit(value, []);
  return { components, game: oot && !mm ? 'oot' as const : mm && !oot ? 'mm' as const : null };
}

function parseDedicated(data: Uint8Array): Dedicated | null {
  const manifestOffset = findBytes(data, EQUIP_MAGIC);
  if (manifestOffset === -1) return null;
  let modelOffset = -1;
  for (let pos = 0; ;) {
    const next = findBytes(data, MODEL_MAGIC, pos);
    if (next === -1 || next >= manifestOffset) break;
    modelOffset = next;
    pos = next + 1;
  }
  if (modelOffset === -1 || modelOffset + 0x10 > data.length) throw new Error('Equipment zobj has no MODLOADER64 root table');
  const count = bufReadU32BE(data, modelOffset + 0x0c);
  if (count > 0x100 || modelOffset + 0x10 + count * 8 > data.length) throw new Error('Invalid equipment root table');
  const rootTable: number[] = [];
  for (let i = 0; i < count; ++i) {
    const entry = modelOffset + 0x10 + i * 8;
    const pointer = bufReadU32BE(data, entry + 4);
    if (data[entry] !== 0xde || (pointer >>> 24) !== SEG_SOURCE || (pointer & 0xffffff) >= data.length) throw new Error('Invalid equipment root pointer');
    rootTable.push(pointer);
  }
  const jsonStart = findBytes(data, encoder.encode('{'), manifestOffset + EQUIP_MAGIC.length);
  if (jsonStart === -1) throw new Error('Equipment manifest JSON missing');
  let jsonEnd = jsonStart;
  while (jsonEnd < data.length && data[jsonEnd] !== 0 && data[jsonEnd] !== 0xff) ++jsonEnd;
  let json: unknown;
  try { json = JSON.parse(decoder.decode(data.subarray(jsonStart, jsonEnd))); }
  catch { throw new Error('Invalid EQUIPMANIFEST JSON'); }
  const categoryOffset = findBytes(data, EQUIP_CATEGORY_MAGIC, jsonEnd);
  const category = categoryOffset === -1 ? '' : readCString(data, categoryOffset + 0x10, Math.min(data.length, categoryOffset + 0x100));
  const collected = collectDedicatedComponents(json, rootTable);
  return { category, game: collected.game, components: collected.components, roots: rootTable };
}

function dedicatedKind(eq: Dedicated) {
  const text = `${normalize(eq.category)} ${[...eq.components.keys()].join(' ')}`;
  const tests: [RegExp, EquipmentFamily, string, string][] = [
    [/broken.*(biggoron|giant)|broken.*sword/, 'sword', 'biggoron-broken', 'Broken Biggoron Sword'],
    [/biggoron|giant.*knife|sword2/, 'sword', 'biggoron-sword', 'Biggoron Sword'],
    [/master.*sword|sword1/, 'sword', 'master-sword', 'Master Sword'],
    [/kokiri.*sword/, 'sword', 'kokiri-sword', 'Kokiri Sword'],
    [/razor.*sword/, 'sword', 'razor-sword', 'Razor Sword'],
    [/gilded.*sword/, 'sword', 'gilded-sword', 'Gilded Sword'],
    [/great.*fairy.*sword|gfsword/, 'sword', 'great-fairy-sword', 'Great Fairy Sword'],
    [/deku.*shield/, 'shield', 'deku-shield', 'Deku Shield'],
    [/hylian.*shield/, 'shield', 'hylian-shield', 'Hylian Shield'],
    [/hero.*shield/, 'shield', 'hero-shield', 'Hero\'s Shield'],
    [/mirror.*shield|shield.*mirror/, 'shield', 'mirror-shield', 'Mirror Shield'],
    [/hammer/, 'equipment', 'hammer', 'Megaton Hammer'], [/boomerang/, 'equipment', 'boomerang', 'Boomerang'],
    [/slingshot/, 'equipment', 'slingshot', 'Fairy Slingshot'], [/hookshot|longshot/, 'equipment', 'hookshot', 'Hookshot'],
    [/bow/, 'equipment', 'bow', 'Bow'], [/fairy.*ocarina/, 'equipment', 'ocarina-fairy', 'Fairy Ocarina'],
    [/ocarina/, 'equipment', 'ocarina-time', 'Ocarina of Time'], [/deku.*stick/, 'equipment', 'deku-stick', 'Deku Stick'],
    [/iron.*boot/, 'equipment', 'boots-iron', 'Iron Boots'], [/hover.*boot/, 'equipment', 'boots-hover', 'Hover Boots'],
    [/gauntlet/, 'equipment', 'gauntlets', 'Gauntlets'],
  ];
  for (const test of tests) if (test[0].test(text)) return { family: test[1], semantic: test[2], label: test[3] };
  return null;
}

function dedicatedRoles(eq: Dedicated, family: EquipmentFamily) {
  const roles: Record<string, number[]> = {};
  const add = (role: string, root: number) => { (roles[role] ??= []).push(root); };
  for (const [name, values] of eq.components) {
    let role = 'main';
    if (family === 'sword') {
      if (/hilt|handle/.test(name)) role = 'hilt';
      else if (/blade/.test(name)) role = 'blade';
    } else if (family === 'shield') {
      if (/face/.test(name)) role = 'face';
      else role = 'body';
    } else {
      if (/string/.test(name)) role = 'string';
      else if (/spike|hook/.test(name) && !/hookshot$/.test(name)) role = 'spike';
      else if (/chain/.test(name)) role = 'chain';
      else if (/retic/.test(name)) role = 'reticle';
      else if (/fps|first_person|firstperson/.test(name)) role = 'fps';
      else if (/_l$|left/.test(name)) role = 'left';
      else if (/_r$|right/.test(name)) role = 'right';
    }
    for (const root of values) add(role, root);
  }
  if (Object.keys(roles).length === 0 && eq.roots.length) roles.main = [...eq.roots];
  return roles;
}

function detectDedicated(data: Uint8Array, part: string) {
  const eq = parseDedicated(data);
  if (!eq) return [];
  const kind = dedicatedKind(eq);
  if (!kind) return [];
  return [{
    sourceId: `${part}::dedicated-${kind.semantic}`,
    label: eq.category || kind.label,
    family: kind.family,
    semantic: kind.semantic,
    nativeGame: eq.game,
    sourceData: data,
    roles: dedicatedRoles(eq, kind.family),
  } satisfies EquipmentSourceItem];
}

async function detectZobj(data: Uint8Array, part: string) {
  const dedicated = detectDedicated(data, part);
  return dedicated.length ? dedicated : detectPlayAs(data, part);
}

export function targetsForSourceItem(item: Pick<EquipmentSourceItem, 'family' | 'semantic'>, game: EquipmentGame) {
  if (item.family === 'sword' || item.family === 'shield') {
    return EQUIPMENT_TARGETS.filter((target) => target.game === game && target.family === item.family);
  }
  return EQUIPMENT_TARGETS.filter((target) => target.game === game && target.family === 'equipment' && target.semantic === item.semantic);
}

export function defaultTargetForSourceItem(item: Pick<EquipmentSourceItem, 'family' | 'semantic'>, game: EquipmentGame) {
  const options = targetsForSourceItem(item, game);
  return options.find((target) => target.semantic === item.semantic)?.id ?? options[0]?.id ?? null;
}

async function inspectRawEquipment(data: Uint8Array): Promise<EquipmentSourceItem[]> {
  if (!isPlayerModelPak(data)) return detectZobj(data, 'asset');
  const out: EquipmentSourceItem[] = [];
  for (const zobj of await readPakZobjs(data)) out.push(...await detectZobj(zobj.data, zobj.name));
  return out;
}

export async function inspectEquipmentInput(data: Uint8Array) {
  const stripped = stripEquipmentConfig(data);
  return { items: await inspectRawEquipment(stripped.data), config: stripped.config };
}

export async function resolveEquipmentInput(data: Uint8Array, sourceName: string): Promise<EquipmentResolvedOverride[]> {
  const stripped = stripEquipmentConfig(data);
  const items = await inspectRawEquipment(stripped.data);
  if (!items.length) throw new Error(`${sourceName} contains no supported equipment`);
  const config = stripped.config;
  const rules = new Map((config?.rules ?? []).map((rule) => [rule.sourceId, rule.targetId]));
  const game = config?.game ?? items.find((item) => item.nativeGame)?.nativeGame ?? null;
  if (!game) throw new Error(`${sourceName} is game-ambiguous; add it from the OoT or MM equipment section so it gets a game configuration`);

  const out: EquipmentResolvedOverride[] = [];
  for (const item of items) {
    const targetId = rules.has(item.sourceId) ? rules.get(item.sourceId)! : defaultTargetForSourceItem(item, game);
    if (targetId === null) continue;
    const target = TARGET_BY_ID.get(targetId);
    if (!target || target.game !== game) throw new Error(`${sourceName}: invalid equipment target ${targetId}`);
    const allowed = targetsForSourceItem(item, game).some((candidate) => candidate.id === targetId);
    if (!allowed) throw new Error(`${sourceName}: ${item.label} cannot target ${target.label}`);
    out.push({ ...item, targetId, sourceName });
  }
  return out;
}

function align16(value: number) { return (value + 0x0f) & ~0x0f; }
function writeCall(data: Uint8Array, offset: number, target: number) {
  if (offset < 0 || offset + 8 > data.length) throw new Error(`Equipment target offset out of range: 0x${offset.toString(16)}`);
  data[offset] = 0xde; data[offset + 1] = 0x01; data[offset + 2] = 0; data[offset + 3] = 0;
  bufWriteU32BE(data, offset + 4, target);
}
function preparedPlayerModel(data: Uint8Array) {
  return data.length > 0x500b &&
      (bytesEqual(data, 0x5000, MODEL_MAGIC) || bytesEqual(data, 0x5000, PREPARED_OOT_MAGIC));
}

type Slot = { role: string; piece?: string; lut?: number; raw?: number };
type TargetPatch = { id: string; game: EquipmentGame; age?: EquipmentAge; slots: Slot[] };

const OOT_PATCHES: TargetPatch[] = [
  { id: 'oot:sword:kokiri', game: 'oot', age: 'child', slots: [
    { role: 'hilt', piece: 'Hilt.1', lut: OOT_LINK_CHILD_OFFSETS.LUT_DL_SWORD_HILT, raw: 0x14048 },
    { role: 'blade', piece: 'Blade.1', lut: OOT_LINK_CHILD_OFFSETS.LUT_DL_SWORD_BLADE, raw: 0x14110 },
  ] },
  { id: 'oot:sword:master', game: 'oot', age: 'adult', slots: [
    { role: 'hilt', piece: 'Hilt.2', lut: OOT_LINK_ADULT_OFFSETS.LUT_DL_SWORD_HILT, raw: 0x22060 },
    { role: 'blade', piece: 'Blade.2', lut: OOT_LINK_ADULT_OFFSETS.LUT_DL_SWORD_BLADE, raw: 0x21f78 },
  ] },
  { id: 'oot:sword:master', game: 'oot', age: 'child', slots: [
    { role: 'main', piece: 'Blade.2', lut: OOT_LINK_CHILD_OFFSETS.LUT_DL_MASTER_SWORD, raw: 0x15698 },
  ] },
  { id: 'oot:sword:biggoron', game: 'oot', age: 'adult', slots: [
    { role: 'hilt', piece: 'Hilt.3', lut: OOT_LINK_ADULT_OFFSETS.LUT_DL_LONGSWORD_HILT, raw: 0x238c8 },
    { role: 'blade', piece: 'Blade.3', lut: OOT_LINK_ADULT_OFFSETS.LUT_DL_LONGSWORD_BLADE, raw: 0x23a28 },
  ] },
  { id: 'oot:sword:biggoron-broken', game: 'oot', age: 'adult', slots: [
    { role: 'hilt', piece: 'Hilt.3', lut: OOT_LINK_ADULT_OFFSETS.LUT_DL_LONGSWORD_HILT, raw: 0x238c8 },
    { role: 'blade', piece: 'Broken.Blade.3', lut: OOT_LINK_ADULT_OFFSETS.LUT_DL_LONGSWORD_BROKEN, raw: 0x23eb0 },
  ] },
  { id: 'oot:shield:deku', game: 'oot', age: 'child', slots: [
    { role: 'main', piece: 'Shield.1', lut: OOT_LINK_CHILD_OFFSETS.LUT_DL_SHIELD_DEKU, raw: 0x14440 },
  ] },
  { id: 'oot:shield:hylian', game: 'oot', age: 'adult', slots: [
    { role: 'main', piece: 'Shield.2', lut: OOT_LINK_ADULT_OFFSETS.LUT_DL_SHIELD_HYLIAN, raw: 0x22970 },
  ] },
  { id: 'oot:shield:hylian', game: 'oot', age: 'child', slots: [
    { role: 'main', piece: 'Shield.2', lut: OOT_LINK_CHILD_OFFSETS.LUT_DL_SHIELD_HYLIAN_BACK, raw: 0x14c30 },
  ] },
  { id: 'oot:shield:mirror', game: 'oot', age: 'adult', slots: [
    { role: 'main', piece: 'Shield.3', lut: OOT_LINK_ADULT_OFFSETS.LUT_DL_SHIELD_MIRROR, raw: 0x241c0 },
  ] },
  { id: 'oot:hammer', game: 'oot', age: 'adult', slots: [
    { role: 'main', piece: 'Hammer', lut: OOT_LINK_ADULT_OFFSETS.LUT_DL_HAMMER, raw: 0x233e0 },
  ] },
  { id: 'oot:bow', game: 'oot', age: 'adult', slots: [
    { role: 'main', piece: 'Bow', lut: OOT_LINK_ADULT_OFFSETS.LUT_DL_BOW, raw: 0x22da8 },
    { role: 'string', piece: 'Bow.String', lut: OOT_LINK_ADULT_OFFSETS.LUT_DL_BOW_STRING, raw: 0x2b108 },
  ] },
  { id: 'oot:hookshot', game: 'oot', age: 'adult', slots: [
    { role: 'main', piece: 'Hookshot', lut: OOT_LINK_ADULT_OFFSETS.LUT_DL_HOOKSHOT, raw: 0x24d70 },
    { role: 'spike', piece: 'Hookshot.Spike', lut: OOT_LINK_ADULT_OFFSETS.LUT_DL_HOOKSHOT_HOOK, raw: 0x2b288 },
    { role: 'chain', piece: 'Hookshot.Chain', lut: OOT_LINK_ADULT_OFFSETS.LUT_DL_HOOKSHOT_CHAIN, raw: 0x2aff0 },
    { role: 'reticle', piece: 'Hookshot.Aiming.Reticule', lut: OOT_LINK_ADULT_OFFSETS.LUT_DL_HOOKSHOT_AIM, raw: 0x2cb48 },
    { role: 'fps', piece: 'FPS.Hookshot', lut: OOT_LINK_ADULT_OFFSETS.LUT_DL_FPS_HOOKSHOT, raw: 0x2a738 },
  ] },
  { id: 'oot:slingshot', game: 'oot', age: 'child', slots: [
    { role: 'main', piece: 'Slingshot', lut: OOT_LINK_CHILD_OFFSETS.LUT_DL_SLINGSHOT, raw: 0x15f08 },
    { role: 'string', piece: 'Slingshot.String', lut: OOT_LINK_CHILD_OFFSETS.LUT_DL_SLINGSHOT_STRING, raw: 0x221a8 },
  ] },
  { id: 'oot:boomerang', game: 'oot', age: 'child', slots: [
    { role: 'main', piece: 'Boomerang', lut: OOT_LINK_CHILD_OFFSETS.LUT_DL_BOOMERANG, raw: 0x14660 },
  ] },
  { id: 'oot:ocarina-fairy', game: 'oot', age: 'child', slots: [
    { role: 'main', piece: 'Ocarina.1', lut: OOT_LINK_CHILD_OFFSETS.LUT_DL_OCARINA_FAIRY, raw: 0x15ba8 },
  ] },
  { id: 'oot:ocarina-time', game: 'oot', age: 'child', slots: [
    { role: 'main', piece: 'Ocarina.2', lut: OOT_LINK_CHILD_OFFSETS.LUT_DL_OCARINA_TIME, raw: 0x15ab8 },
  ] },
  { id: 'oot:ocarina-time', game: 'oot', age: 'adult', slots: [
    { role: 'main', piece: 'Ocarina.2', lut: OOT_LINK_ADULT_OFFSETS.LUT_DL_OCARINA_TIME, raw: 0x248d8 },
  ] },
  { id: 'oot:deku-stick', game: 'oot', age: 'child', slots: [
    { role: 'main', piece: 'DekuStick', lut: OOT_LINK_CHILD_OFFSETS.LUT_DL_DEKU_STICK, raw: 0x06cc0 },
  ] },
  { id: 'oot:boots-iron', game: 'oot', age: 'adult', slots: [
    { role: 'left', piece: 'Foot.2.L', lut: OOT_LINK_ADULT_OFFSETS.LUT_DL_BOOT_LIRON, raw: 0x25918 },
    { role: 'right', piece: 'Foot.2.R', lut: OOT_LINK_ADULT_OFFSETS.LUT_DL_BOOT_RIRON, raw: 0x25a60 },
  ] },
  { id: 'oot:boots-hover', game: 'oot', age: 'adult', slots: [
    { role: 'left', piece: 'Foot.3.L', lut: OOT_LINK_ADULT_OFFSETS.LUT_DL_BOOT_LHOVER, raw: 0x25ba8 },
    { role: 'right', piece: 'Foot.3.R', lut: OOT_LINK_ADULT_OFFSETS.LUT_DL_BOOT_RHOVER, raw: 0x25db0 },
  ] },
  { id: 'oot:gauntlets', game: 'oot', age: 'adult', slots: [
    { role: 'lforearm', piece: 'Gauntlet.Forearm.L', lut: OOT_LINK_ADULT_OFFSETS.LUT_DL_UPGRADE_LFOREARM, raw: 0x25218 },
    { role: 'lhand', piece: 'Gauntlet.Hand.L', lut: OOT_LINK_ADULT_OFFSETS.LUT_DL_UPGRADE_LHAND, raw: 0x252d8 },
    { role: 'lfist', piece: 'Gauntlet.Fist.L', lut: OOT_LINK_ADULT_OFFSETS.LUT_DL_UPGRADE_LFIST, raw: 0x25438 },
    { role: 'rforearm', piece: 'Gauntlet.Forearm.R', lut: OOT_LINK_ADULT_OFFSETS.LUT_DL_UPGRADE_RFOREARM, raw: 0x25598 },
    { role: 'rhand', piece: 'Gauntlet.Hand.R', lut: OOT_LINK_ADULT_OFFSETS.LUT_DL_UPGRADE_RHAND, raw: 0x25658 },
    { role: 'rfist', piece: 'Gauntlet.Fist.R', lut: OOT_LINK_ADULT_OFFSETS.LUT_DL_UPGRADE_RFIST, raw: 0x257b8 },
  ] },
  ...([
    ['oot:mask-bunny', OOT_LINK_CHILD_OFFSETS.LUT_DL_MASK_BUNNY, 0x2ca38, 'Mask.Bunny'],
    ['oot:mask-skull', OOT_LINK_CHILD_OFFSETS.LUT_DL_MASK_SKULL, 0x2ad40, 'Mask.Skull'],
    ['oot:mask-spooky', OOT_LINK_CHILD_OFFSETS.LUT_DL_MASK_SPOOKY, 0x2af70, 'Mask.Spooky'],
    ['oot:mask-gerudo', OOT_LINK_CHILD_OFFSETS.LUT_DL_MASK_GERUDO, 0x2b788, 'Mask.Gerudo'],
    ['oot:mask-goron', OOT_LINK_CHILD_OFFSETS.LUT_DL_MASK_GORON, 0x2b350, 'Mask.Goron'],
    ['oot:mask-keaton', OOT_LINK_CHILD_OFFSETS.LUT_DL_MASK_KEATON, 0x2b060, 'Mask.Keaton'],
    ['oot:mask-truth', OOT_LINK_CHILD_OFFSETS.LUT_DL_MASK_TRUTH, 0x2b1f0, 'Mask.Truth'],
    ['oot:mask-zora', OOT_LINK_CHILD_OFFSETS.LUT_DL_MASK_ZORA, 0x2b580, 'Mask.Zora'],
  ] as [string, number, number, string][]).map(([id, lut, raw, piece]) => ({
    id, game: 'oot' as const, age: 'child' as const, slots: [{ role: 'main', piece, lut, raw }],
  })),
];

const MM_PLAYER_PATCHES: TargetPatch[] = [
  { id: 'mm:sword:gilded', game: 'mm', slots: [
    { role: 'hilt', piece: 'Hilt.3', lut: MM_LINK_OFFSETS.LUT_DL_HILT_GILDED, raw: 0x017058 },
    { role: 'blade', piece: 'Blade.3', lut: MM_LINK_OFFSETS.LUT_DL_BLADE_GILDED, raw: 0x017310 },
  ] },
  { id: 'mm:sword:great-fairy', game: 'mm', slots: [
    { role: 'main', piece: 'Sword.4', lut: MM_LINK_OFFSETS.LUT_DL_BLADE_GFSWORD_RAW, raw: 0x016898 },
  ] },
  { id: 'mm:shield:hero', game: 'mm', slots: [
    { role: 'main', piece: 'Shield.1', lut: MM_LINK_OFFSETS.LUT_DL_SHIELD_HERO, raw: 0x017458 },
  ] },
  { id: 'mm:shield:mirror', game: 'mm', slots: [
    { role: 'body', piece: 'Shield.2', lut: MM_LINK_OFFSETS.LUT_DL_SHIELD_MIRROR, raw: 0x016480 },
    { role: 'face', piece: 'Shield.2.Face', lut: MM_LINK_OFFSETS.LUT_DL_SHIELD_MIRROR_FACE, raw: 0x015f98 },
  ] },
  { id: 'mm:bow', game: 'mm', slots: [
    { role: 'main', piece: 'Bow', lut: MM_LINK_OFFSETS.LUT_DL_BOW, raw: 0x0181c8 },
    { role: 'string', piece: 'Bow.String', lut: MM_LINK_OFFSETS.LUT_DL_BOW_STRING, raw: 0x017818 },
  ] },
  { id: 'mm:hookshot', game: 'mm', slots: [
    { role: 'main', piece: 'Hookshot', lut: MM_LINK_OFFSETS.LUT_DL_HOOKSHOT, raw: 0x017858 },
    { role: 'spike', piece: 'Hookshot.Spike', lut: MM_LINK_OFFSETS.LUT_DL_HOOKSHOT_SPIKE, raw: 0x01d960 },
  ] },
  { id: 'mm:ocarina-time', game: 'mm', slots: [
    { role: 'main', piece: 'Ocarina.2', lut: MM_LINK_OFFSETS.LUT_DL_OCARINA_TIME, raw: 0x010448 },
  ] },
];

const MM_KEEP_PATCHES: TargetPatch[] = [
  { id: 'mm:sword:kokiri', game: 'mm', slots: [{ role: 'hilt', raw: 0x21a8 }, { role: 'blade', raw: 0x28c0 }] },
  { id: 'mm:sword:razor', game: 'mm', slots: [{ role: 'hilt', raw: 0x1d00 }, { role: 'blade', raw: 0x2168 }] },
];

type RootPlan = number[] | 'empty' | null;
function rootPlan(item: EquipmentSourceItem, role: string): RootPlan {
  const r = item.roles;
  if (r[role]?.length) return r[role];
  if (item.family === 'sword') {
    if (role === 'main') {
      if (r.main?.length) return r.main;
      const pieces = [...(r.hilt ?? []), ...(r.blade ?? [])];
      return pieces.length ? pieces : null;
    }
    if (role === 'hilt') return r.main?.length ? 'empty' : null;
    if (role === 'blade') return r.main?.length ? r.main : null;
  }
  if (item.family === 'shield') {
    if (role === 'main') {
      if (r.main?.length) return r.main;
      const pieces = [...(r.body ?? []), ...(r.face ?? [])];
      return pieces.length ? pieces : null;
    }
    if (role === 'body') return r.body?.length ? r.body : r.main?.length ? r.main : r.face?.length ? r.face : null;
    if (role === 'face') return r.face?.length ? r.face : (r.main?.length || r.body?.length) ? 'empty' : null;
  }
  return null;
}

function sortedOverrides(overrides: Iterable<EquipmentResolvedOverride>) {
  return [...overrides].sort((a, b) => (a.stackOrder ?? 0) - (b.stackOrder ?? 0));
}

type SlotAction = {
  override: EquipmentResolvedOverride;
  target: TargetPatch;
  slot: Slot;
  plan: Exclude<RootPlan, null>;
};

export type PreparedEquipmentApplication = {
  data: Uint8Array;
  preservedPieces: string[];
};

function planKey(plan: Exclude<RootPlan, null>) {
  return plan === 'empty' ? 'empty' : plan.map((x) => x >>> 0).join(',');
}

function applyActionsGrouped(
    data: Uint8Array,
    actions: SlotAction[],
    outSegment: number,
    processed: boolean,
): PreparedEquipmentApplication {
  if (actions.length === 0) return { data, preservedPieces: [] };

  let out = data;
  const preserved = new Set<string>();
  const groups = new Map<Uint8Array, SlotAction[]>();

  for (const action of actions) {
    const source = action.override.sourceData;
    const group = groups.get(source) ?? [];
    group.push(action);
    groups.set(source, group);
    if (processed && action.slot.piece) preserved.add(action.slot.piece);
  }

  for (const [sourceData, group] of groups) {
    const base = align16(out.length);
    const editor = new ObjectEditor(outSegment, base);
    editor.loadSegment(SEG_SOURCE, sourceData);

    const imported = new Map<string, number>();
    const writes: { action: SlotAction; address: number }[] = [];

    for (const action of group) {
      const key = planKey(action.plan);
      let address = imported.get(key);
      if (address === undefined) {
        if (action.plan === 'empty') {
          address = editor.processList(new Uint8Array([0xdf, 0, 0, 0, 0, 0, 0, 0]));
        } else {
          address = action.plan.length === 1
              ? editor.processListAddr(action.plan[0])
              : editor.processList(editor.combineListsAddrs(action.plan));
        }
        imported.set(key, address);
      }
      writes.push({ action, address });
    }

    const built = editor.build().data;
    const expanded = new Uint8Array(base + built.length);
    expanded.set(out);
    expanded.set(built, base);
    out = expanded;

    for (const { action, address } of writes) {
      const slot = action.slot;
      if (processed) {
        if (slot.lut === undefined) {
          throw new Error(`No processed player-model LUT slot for ${action.target.id}/${slot.role}`);
        }
        writeCall(out, slot.lut - BASE, address);
      } else {
        if (slot.raw === undefined) {
          throw new Error(`No vanilla player-model slot for ${action.target.id}/${slot.role}`);
        }
        writeCall(out, slot.raw, address);
      }
    }
  }

  return { data: out, preservedPieces: [...preserved] };
}

function collectActions(
    game: EquipmentGame,
    age: EquipmentAge | undefined,
    overrides: Iterable<EquipmentResolvedOverride>,
    targets: TargetPatch[],
): SlotAction[] {
  const actions: SlotAction[] = [];
  for (const override of sortedOverrides(overrides)) {
    if (!override.targetId.startsWith(`${game}:`)) continue;
    for (const target of targets) {
      if (target.id !== override.targetId) continue;
      if (age !== undefined && target.age !== undefined && target.age !== age) continue;
      for (const slot of target.slots) {
        const plan = rootPlan(override, slot.role);
        if (plan !== null) actions.push({ override, target, slot, plan });
      }
    }
  }
  return actions;
}

export function applyEquipmentOverridesToPreparedOotModel(
    data: Uint8Array,
    age: EquipmentAge,
    overrides: Iterable<EquipmentResolvedOverride>,
): PreparedEquipmentApplication {
  if (!preparedPlayerModel(data)) {
    throw new Error(`OoT ${age} equipment replacement expected a prepared player model`);
  }
  return applyActionsGrouped(data, collectActions('oot', age, overrides, OOT_PATCHES), SEG_PLAYER, true);
}

export function applyEquipmentOverridesToOotModel(
    data: Uint8Array,
    age: EquipmentAge,
    overrides: Iterable<EquipmentResolvedOverride>,
): Uint8Array {
  const processed = preparedPlayerModel(data);
  return applyActionsGrouped(data, collectActions('oot', age, overrides, OOT_PATCHES), SEG_PLAYER, processed).data;
}

export function applyEquipmentOverridesToPreparedMmModel(
    data: Uint8Array,
    overrides: Iterable<EquipmentResolvedOverride>,
): PreparedEquipmentApplication {
  if (!preparedPlayerModel(data)) {
    throw new Error('MM equipment replacement expected a prepared player model');
  }
  return applyActionsGrouped(data, collectActions('mm', undefined, overrides, MM_PLAYER_PATCHES), SEG_PLAYER, true);
}

export function applyEquipmentOverridesToMmModel(
    data: Uint8Array,
    overrides: Iterable<EquipmentResolvedOverride>,
): Uint8Array {
  const processed = preparedPlayerModel(data);
  return applyActionsGrouped(data, collectActions('mm', undefined, overrides, MM_PLAYER_PATCHES), SEG_PLAYER, processed).data;
}

export function applyEquipmentOverridesToMmGameplayKeep(
    data: Uint8Array,
    overrides: Iterable<EquipmentResolvedOverride>,
): Uint8Array {
  const actions = collectActions('mm', undefined, overrides, MM_KEEP_PATCHES);
  return applyActionsGrouped(data, actions, SEG_MM_KEEP, false).data;
}
