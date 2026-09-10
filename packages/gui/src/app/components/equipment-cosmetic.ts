
export type EquipmentGame = 'oot' | 'mm';
export type EquipmentFamily = 'sword' | 'shield' | 'equipment';
export type EquipmentRule = { sourceId: string; targetId: string | null };
export type EquipmentFileConfig = { version: 1; game: EquipmentGame; rules: EquipmentRule[] };
export type EquipmentDetectedItem = {
  sourceId: string;
  label: string;
  family: EquipmentFamily;
  semantic: string;
  nativeGame: EquipmentGame | null;
};
export type EquipmentInspection = { items: EquipmentDetectedItem[]; config: EquipmentFileConfig | null };
export type EquipmentTarget = { id: string; game: EquipmentGame; label: string; family: EquipmentFamily; semantic: string };

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const PAK_MAGIC = encoder.encode('ModLoader64\0');
const PLAYAS_MAGIC = encoder.encode('!PlayAsManifest0');
const EQUIP_MAGIC = encoder.encode('EQUIPMANIFEST');
const EQUIP_CATEGORY_MAGIC = encoder.encode('EQUIPMENTCAT');
const CONFIG_MAGIC = encoder.encode('OOTMMEQCFG1');

export const EQUIPMENT_TARGETS: EquipmentTarget[] = [
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

function readU32(data: Uint8Array, off: number) {
  return (((data[off] << 24) >>> 0) | (data[off + 1] << 16) | (data[off + 2] << 8) | data[off + 3]) >>> 0;
}
function writeU32(data: Uint8Array, off: number, value: number) {
  data[off] = value >>> 24; data[off + 1] = value >>> 16; data[off + 2] = value >>> 8; data[off + 3] = value;
}
function bytesEqual(data: Uint8Array, off: number, value: Uint8Array) {
  if (off < 0 || off + value.length > data.length) return false;
  for (let i = 0; i < value.length; ++i) if (data[off + i] !== value[i]) return false;
  return true;
}
function findBytes(data: Uint8Array, value: Uint8Array, start = 0) {
  for (let i = Math.max(0, start); i + value.length <= data.length; ++i) if (bytesEqual(data, i, value)) return i;
  return -1;
}
function cstring(data: Uint8Array, off: number, max = data.length) {
  let end = off; while (end < max && data[end] !== 0 && data[end] !== 0xff) ++end;
  return decoder.decode(data.subarray(off, end)).trim();
}
function norm(value: string) { return value.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' '); }

function stripConfig(data: Uint8Array) {
  if (data.length < CONFIG_MAGIC.length + 4) return { raw: data, config: null as EquipmentFileConfig | null };
  const magic = data.length - CONFIG_MAGIC.length;
  if (!bytesEqual(data, magic, CONFIG_MAGIC)) return { raw: data, config: null as EquipmentFileConfig | null };
  const lenOff = magic - 4;
  const len = readU32(data, lenOff);
  const jsonOff = lenOff - len;
  if (jsonOff < 0) throw new Error('Invalid equipment configuration trailer');
  const config = JSON.parse(decoder.decode(data.subarray(jsonOff, lenOff))) as EquipmentFileConfig;
  if (config.version !== 1 || !['oot', 'mm'].includes(config.game) || !Array.isArray(config.rules)) throw new Error('Unsupported equipment configuration');
  return { raw: data.subarray(0, jsonOff), config };
}

function classifyPlayAs(names: Set<string>): EquipmentGame | null {
  if (names.has('Sword.4') || names.has('Sheath.3') || names.has('Shield.2.Face')) return 'mm';
  if (names.has('Hammer') || names.has('Boomerang') || names.has('Foot.2.L') || names.has('Broken.Blade.3')) return 'oot';
  if (names.has('Slingshot') || names.has('DekuStick') || names.has('Mask.Bunny')) return 'oot';
  return null;
}

function parsePlayAsNames(data: Uint8Array) {
  const start = findBytes(data, PLAYAS_MAGIC);
  if (start === -1) return null;
  const header = start + PLAYAS_MAGIC.length;
  if (header + 2 > data.length || data[header] !== 0) throw new Error('Invalid PlayAs manifest');
  const count = data[header + 1];
  const names = new Set<string>();
  let off = header + 2;
  for (let i = 0; i < count; ++i) {
    let end = off; while (end < data.length && data[end] !== 0) ++end;
    if (end >= data.length || end + 5 > data.length) throw new Error('Invalid PlayAs manifest entry');
    names.add(decoder.decode(data.subarray(off, end)));
    off = end + 5;
  }
  return names;
}

function item(out: EquipmentDetectedItem[], part: string, names: Set<string>, game: EquipmentGame | null,
              local: string, label: string, family: EquipmentFamily, semantic: string, required: string) {
  if (!names.has(required)) return;
  out.push({ sourceId: `${part}::${local}`, label, family, semantic, nativeGame: game });
}

function inspectPlayAs(data: Uint8Array, part: string) {
  const names = parsePlayAsNames(data);
  if (!names) return [];
  const game = classifyPlayAs(names);
  const out: EquipmentDetectedItem[] = [];
  if (game !== 'mm') {
    item(out, part, names, 'oot', 'oot-kokiri-sword', 'Kokiri Sword', 'sword', 'kokiri-sword', 'Blade.1');
    item(out, part, names, 'oot', 'oot-master-sword', 'Master Sword', 'sword', 'master-sword', 'Blade.2');
    item(out, part, names, 'oot', 'oot-biggoron-sword', 'Biggoron Sword', 'sword', 'biggoron-sword', 'Blade.3');
    item(out, part, names, 'oot', 'oot-biggoron-broken', 'Broken Biggoron Sword', 'sword', 'biggoron-broken', 'Broken.Blade.3');
    item(out, part, names, 'oot', 'oot-deku-shield', 'Deku Shield', 'shield', 'deku-shield', 'Shield.1');
    item(out, part, names, 'oot', 'oot-hylian-shield', 'Hylian Shield', 'shield', 'hylian-shield', 'Shield.2');
    item(out, part, names, 'oot', 'oot-mirror-shield', 'Mirror Shield', 'shield', 'mirror-shield', 'Shield.3');
    item(out, part, names, 'oot', 'oot-hammer', 'Megaton Hammer', 'equipment', 'hammer', 'Hammer');
    item(out, part, names, 'oot', 'oot-bow', 'Fairy Bow', 'equipment', 'bow', 'Bow');
    item(out, part, names, 'oot', 'oot-hookshot', 'Hookshot', 'equipment', 'hookshot', 'Hookshot');
    item(out, part, names, 'oot', 'oot-slingshot', 'Fairy Slingshot', 'equipment', 'slingshot', 'Slingshot');
    item(out, part, names, 'oot', 'oot-boomerang', 'Boomerang', 'equipment', 'boomerang', 'Boomerang');
    item(out, part, names, 'oot', 'oot-ocarina-fairy', 'Fairy Ocarina', 'equipment', 'ocarina-fairy', 'Ocarina.1');
    item(out, part, names, 'oot', 'oot-ocarina-time', 'Ocarina of Time', 'equipment', 'ocarina-time', 'Ocarina.2');
    item(out, part, names, 'oot', 'oot-deku-stick', 'Deku Stick', 'equipment', 'deku-stick', 'DekuStick');
    item(out, part, names, 'oot', 'oot-iron-boots', 'Iron Boots', 'equipment', 'boots-iron', 'Foot.2.L');
    item(out, part, names, 'oot', 'oot-hover-boots', 'Hover Boots', 'equipment', 'boots-hover', 'Foot.3.L');
    item(out, part, names, 'oot', 'oot-gauntlets', 'Gauntlets', 'equipment', 'gauntlets', 'Gauntlet.Forearm.L');
    for (const [n, label, semantic] of [
      ['Bunny', 'Bunny Hood', 'mask-bunny'], ['Skull', 'Skull Mask', 'mask-skull'], ['Spooky', 'Spooky Mask', 'mask-spooky'],
      ['Gerudo', 'Gerudo Mask', 'mask-gerudo'], ['Goron', 'Goron Mask', 'mask-goron'], ['Keaton', 'Keaton Mask', 'mask-keaton'],
      ['Truth', 'Mask of Truth', 'mask-truth'], ['Zora', 'Zora Mask', 'mask-zora'],
    ]) item(out, part, names, 'oot', `oot-${semantic}`, label, 'equipment', semantic, `Mask.${n}`);
  }
  if (game === 'mm') {
    item(out, part, names, 'mm', 'mm-kokiri-sword', 'Kokiri Sword', 'sword', 'kokiri-sword', 'Blade.1');
    item(out, part, names, 'mm', 'mm-razor-sword', 'Razor Sword', 'sword', 'razor-sword', 'Blade.2');
    item(out, part, names, 'mm', 'mm-gilded-sword', 'Gilded Sword', 'sword', 'gilded-sword', 'Blade.3');
    item(out, part, names, 'mm', 'mm-great-fairy-sword', 'Great Fairy Sword', 'sword', 'great-fairy-sword', 'Sword.4');
    item(out, part, names, 'mm', 'mm-hero-shield', 'Hero\'s Shield', 'shield', 'hero-shield', 'Shield.1');
    item(out, part, names, 'mm', 'mm-mirror-shield', 'Mirror Shield', 'shield', 'mirror-shield', 'Shield.2');
    item(out, part, names, 'mm', 'mm-bow', 'Hero\'s Bow', 'equipment', 'bow', 'Bow');
    item(out, part, names, 'mm', 'mm-hookshot', 'Hookshot', 'equipment', 'hookshot', 'Hookshot');
    item(out, part, names, 'mm', 'mm-ocarina-time', 'Ocarina of Time', 'equipment', 'ocarina-time', 'Ocarina.2');
  }
  return out;
}

function inspectDedicated(data: Uint8Array, part: string) {
  const off = findBytes(data, EQUIP_MAGIC);
  if (off === -1) return [];
  const jsonStart = findBytes(data, encoder.encode('{'), off + EQUIP_MAGIC.length);
  let json: any = null;
  if (jsonStart !== -1) {
    let end = jsonStart; while (end < data.length && data[end] !== 0 && data[end] !== 0xff) ++end;
    try { json = JSON.parse(decoder.decode(data.subarray(jsonStart, end))); } catch { /* backend will report exact error */ }
  }
  const catOff = findBytes(data, EQUIP_CATEGORY_MAGIC, Math.max(off, jsonStart));
  const category = catOff === -1 ? '' : cstring(data, catOff + 0x10, Math.min(data.length, catOff + 0x100));
  const text = norm(`${category} ${json ? JSON.stringify(json) : ''}`);
  const tests: [RegExp, EquipmentFamily, string, string][] = [
    [/broken.*(biggoron|giant)|broken.*sword/, 'sword', 'biggoron-broken', 'Broken Biggoron Sword'],
    [/biggoron|giant.*knife|sword2/, 'sword', 'biggoron-sword', 'Biggoron Sword'], [/master.*sword|sword1/, 'sword', 'master-sword', 'Master Sword'],
    [/kokiri.*sword/, 'sword', 'kokiri-sword', 'Kokiri Sword'], [/razor.*sword/, 'sword', 'razor-sword', 'Razor Sword'],
    [/gilded.*sword/, 'sword', 'gilded-sword', 'Gilded Sword'], [/great.*fairy.*sword|gfsword/, 'sword', 'great-fairy-sword', 'Great Fairy Sword'],
    [/deku.*shield/, 'shield', 'deku-shield', 'Deku Shield'], [/hylian.*shield/, 'shield', 'hylian-shield', 'Hylian Shield'],
    [/hero.*shield/, 'shield', 'hero-shield', 'Hero\'s Shield'], [/mirror.*shield|shield.*mirror/, 'shield', 'mirror-shield', 'Mirror Shield'],
    [/hammer/, 'equipment', 'hammer', 'Megaton Hammer'], [/boomerang/, 'equipment', 'boomerang', 'Boomerang'], [/slingshot/, 'equipment', 'slingshot', 'Fairy Slingshot'],
    [/hookshot|longshot/, 'equipment', 'hookshot', 'Hookshot'], [/bow/, 'equipment', 'bow', 'Bow'], [/fairy.*ocarina/, 'equipment', 'ocarina-fairy', 'Fairy Ocarina'],
    [/ocarina/, 'equipment', 'ocarina-time', 'Ocarina of Time'], [/deku.*stick/, 'equipment', 'deku-stick', 'Deku Stick'],
    [/iron.*boot/, 'equipment', 'boots-iron', 'Iron Boots'], [/hover.*boot/, 'equipment', 'boots-hover', 'Hover Boots'], [/gauntlet/, 'equipment', 'gauntlets', 'Gauntlets'],
  ];
  const hit = tests.find(([re]) => re.test(text));
  if (!hit) return [];
  const hasLeaf = (value: unknown): boolean => {
    if (!value || typeof value !== 'object') return false;
    if (Array.isArray(value)) return value.some(hasLeaf);
    return Object.entries(value as Record<string, unknown>).some(([key, child]) => (/^\d+$/.test(key) && typeof child === 'string') || hasLeaf(child));
  };
  const root = (json && typeof json === 'object') ? json as Record<string, unknown> : {};
  const ootValue = root.OOT ?? root.OcarinaOfTime ?? root.OcarinaofTime;
  const mmValue = root.MM ?? root.MajorasMask;
  const oot = hasLeaf(ootValue);
  const mm = hasLeaf(mmValue);
  const nativeGame: EquipmentGame | null = oot && !mm ? 'oot' : mm && !oot ? 'mm' : null;
  return [{ sourceId: `${part}::dedicated-${hit[2]}`, label: category || hit[3], family: hit[1], semantic: hit[2], nativeGame } satisfies EquipmentDetectedItem];
}

async function pakZobjs(data: Uint8Array) {
  if (!bytesEqual(data, 0, PAK_MAGIC)) return null;
  const packed = readU32(data, 0x0c); const version = packed & 0xff; const count = packed >>> 8;
  if (version !== 3 || count > 0x10000 || 0x10 + count * 0x10 > data.length) throw new Error('Unsupported/invalid ModLoader64 pak');
  const entries: { name: string; compression: string; start: number; end: number }[] = [];
  for (let i = 0; i < count; ++i) {
    const off = 0x10 + i * 0x10; const nameOff = readU32(data, off + 4); const start = readU32(data, off + 8); const end = readU32(data, off + 12);
    if (nameOff >= data.length || start > end || end > data.length) throw new Error('Invalid pak table');
    entries.push({ name: cstring(data, nameOff), compression: decoder.decode(data.subarray(off, off + 4)), start, end });
  }
  const out: { name: string; data: Uint8Array }[] = [];
  for (const entry of entries.filter((e) => e.name.toLowerCase().endsWith('.zobj'))) {
    const input = data.subarray(entry.start, entry.end);
    if (entry.compression === 'DEFL') {
      const stream = new Blob([new Uint8Array(input)]).stream().pipeThrough(new DecompressionStream('deflate'));
      out.push({ name: entry.name, data: new Uint8Array(await new Response(stream).arrayBuffer()) });
    } else if (['UNCO', 'NONE', 'RAW ', '\0\0\0\0'].includes(entry.compression)) out.push({ name: entry.name, data: new Uint8Array(input) });
    else throw new Error(`Unsupported pak compression ${entry.compression}`);
  }
  return out;
}

async function inspectRaw(data: Uint8Array) {
  const entries = await pakZobjs(data);
  if (entries) {
    const out: EquipmentDetectedItem[] = [];
    for (const zobj of entries) {
      const dedicated = inspectDedicated(zobj.data, zobj.name);
      out.push(...(dedicated.length ? dedicated : inspectPlayAs(zobj.data, zobj.name)));
    }
    return out;
  }
  const dedicated = inspectDedicated(data, 'asset');
  return dedicated.length ? dedicated : inspectPlayAs(data, 'asset');
}

export function targetsForItem(item: Pick<EquipmentDetectedItem, 'family' | 'semantic'>, game: EquipmentGame) {
  if (item.family === 'sword' || item.family === 'shield') return EQUIPMENT_TARGETS.filter((t) => t.game === game && t.family === item.family);
  return EQUIPMENT_TARGETS.filter((t) => t.game === game && t.family === 'equipment' && t.semantic === item.semantic);
}
export function defaultTarget(item: Pick<EquipmentDetectedItem, 'family' | 'semantic'>, game: EquipmentGame) {
  const targets = targetsForItem(item, game);
  return targets.find((t) => t.semantic === item.semantic)?.id ?? targets[0]?.id ?? null;
}

export async function inspectEquipmentFile(file: File): Promise<EquipmentInspection> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const stripped = stripConfig(bytes);
  return { items: await inspectRaw(stripped.raw), config: stripped.config };
}

export async function configureEquipmentFile(file: File, game: EquipmentGame, rules?: EquipmentRule[]) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const stripped = stripConfig(bytes);
  const items = await inspectRaw(stripped.raw);
  if (!items.length) throw new Error(`${file.name} contains no supported equipment`);
  const oldRules = new Map((rules ?? stripped.config?.rules ?? []).map((r) => [r.sourceId, r.targetId]));
  const config: EquipmentFileConfig = {
    version: 1,
    game,
    rules: items.map((item) => ({ sourceId: item.sourceId, targetId: oldRules.has(item.sourceId) ? oldRules.get(item.sourceId)! : defaultTarget(item, game) })),
  };
  const json = encoder.encode(JSON.stringify(config));
  const out = new Uint8Array(stripped.raw.length + json.length + 4 + CONFIG_MAGIC.length);
  out.set(stripped.raw, 0); out.set(json, stripped.raw.length); writeU32(out, stripped.raw.length + json.length, json.length);
  out.set(CONFIG_MAGIC, stripped.raw.length + json.length + 4);
  return new File([out], file.name, { type: file.type, lastModified: file.lastModified });
}
