import { bufReadU32BE } from '../util/buffer';

export type PlayerModelGame = 'oot' | 'mm';
export type PlayerModelAge = 'adult' | 'child';

export type PakPlayerModel = {
  name: string;
  data: Uint8Array;
  game: PlayerModelGame | null;
  age: PlayerModelAge | null;
};

type PakEntry = {
  name: string;
  compression: string;
  dataStart: number;
  dataEnd: number;
};

type ModelHint = {
  file: string;
  game: PlayerModelGame;
  age: PlayerModelAge | null;
  order: number;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const PAK_MAGIC = encoder.encode('ModLoader64\0');
const MODEL_MAGIC = encoder.encode('MODLOADER64');
const PAK_VERSION = 3;
const MAX_FILES = 0x10000;
const MAX_MODEL_SIZE = 0x400000;
const MAX_JSON_SIZE = 0x100000;

function bytesEqual(data: Uint8Array, offset: number, value: Uint8Array) {
  if (offset < 0 || offset + value.length > data.length) {
    return false;
  }

  for (let i = 0; i < value.length; ++i) {
    if (data[offset + i] !== value[i]) {
      return false;
    }
  }

  return true;
}

function normalizePath(value: string) {
  return value.replace(/\\/g, '/').replace(/^\.\//, '').toLowerCase();
}

function basename(value: string) {
  const normalized = value.replace(/\\/g, '/');
  const index = normalized.lastIndexOf('/');
  return index === -1 ? normalized : normalized.slice(index + 1);
}

function dirname(value: string) {
  const normalized = value.replace(/\\/g, '/');
  const index = normalized.lastIndexOf('/');
  return index === -1 ? '' : normalized.slice(0, index);
}

function findFilenameEnd(data: Uint8Array, start: number) {
  if (start < 0 || start >= data.length) {
    throw new Error('Invalid pak filename offset');
  }

  for (let i = start; i < data.length; ++i) {
    if (data[i] === 0xff || data[i] === 0x00) {
      return i;
    }
  }

  throw new Error('Unterminated pak filename');
}

function readPakEntries(data: Uint8Array) {
  if (!isPlayerModelPak(data)) {
    throw new Error('Invalid ModLoader64 pak');
  }

  if (data.length < 0x10) {
    throw new Error('Invalid ModLoader64 pak header');
  }

  const packed = bufReadU32BE(data, 0x0c);
  const version = packed & 0xff;
  const count = packed >>> 8;

  if (version !== PAK_VERSION) {
    throw new Error(`Unsupported ModLoader64 pak version ${version}`);
  }

  if (count > MAX_FILES) {
    throw new Error(`ModLoader64 pak contains too many files: ${count}`);
  }

  const tableEnd = 0x10 + count * 0x10;
  if (tableEnd > data.length) {
    throw new Error('Invalid ModLoader64 pak file table');
  }

  const entries: PakEntry[] = [];

  for (let i = 0; i < count; ++i) {
    const offset = 0x10 + i * 0x10;
    const compression = decoder.decode(data.subarray(offset, offset + 4));
    const nameOffset = bufReadU32BE(data, offset + 4);
    const dataStart = bufReadU32BE(data, offset + 8);
    const dataEnd = bufReadU32BE(data, offset + 0x0c);

    if (nameOffset < tableEnd || nameOffset >= data.length) {
      throw new Error(`Invalid pak filename offset for file ${i}`);
    }

    if (dataStart > dataEnd || dataEnd > data.length) {
      throw new Error(`Invalid pak data range for file ${i}`);
    }

    const nameEnd = findFilenameEnd(data, nameOffset);
    const name = decoder.decode(data.subarray(nameOffset, nameEnd));

    entries.push({
      name,
      compression,
      dataStart,
      dataEnd,
    });
  }

  return entries;
}

async function decompress(entry: PakEntry, pak: Uint8Array, maxSize: number) {
  const input = pak.subarray(entry.dataStart, entry.dataEnd);

  if (entry.compression === 'DEFL') {
    const blobInput = new Uint8Array(input);
    const stream = new Blob([blobInput])
        .stream()
        .pipeThrough(new DecompressionStream('deflate'));

    const output = new Uint8Array(await new Response(stream).arrayBuffer());

    if (output.length > maxSize) {
      throw new Error(`Pak file ${entry.name} is too large after decompression`);
    }

    return output;
  }

  if (
      entry.compression === 'UNCO' ||
      entry.compression === 'NONE' ||
      entry.compression === 'RAW ' ||
      entry.compression === '\0\0\0\0'
  ) {
    if (input.length > maxSize) {
      throw new Error(`Pak file ${entry.name} is too large`);
    }

    return new Uint8Array(input);
  }

  throw new Error(
      `Unsupported pak compression ${entry.compression} for ${entry.name}`
  );
}

function readModelReference(value: unknown) {
  if (typeof value === 'string') {
    return value.toLowerCase().endsWith('.zobj') && value !== '' ? [value] : [];
  }

  if (Array.isArray(value)) {
    const out: string[] = [];
    for (const item of value) {
      if (typeof item === 'string') {
        if (item.toLowerCase().endsWith('.zobj')) {
          out.push(item);
        }
      } else if (item && typeof item === 'object') {
        const file = (item as Record<string, unknown>).file;
        if (typeof file === 'string' && file.toLowerCase().endsWith('.zobj') && file !== '') {
          out.push(file);
        }
      }
    }
    return out;
  }

  if (value && typeof value === 'object') {
    const file = (value as Record<string, unknown>).file;
    if (typeof file === 'string' && file.toLowerCase().endsWith('.zobj') && file !== '') {
      return [file];
    }
  }

  return [];
}

function findProperty(value: Record<string, unknown>, names: string[]) {
  const lowered = new Map<string, unknown>();
  for (const [key, item] of Object.entries(value)) {
    lowered.set(key.toLowerCase(), item);
  }

  for (const name of names) {
    const item = lowered.get(name.toLowerCase());
    if (item !== undefined) {
      return item;
    }
  }

  return undefined;
}

function getObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function packageHints(value: unknown) {
  const root = getObject(value);
  if (!root) {
    return [];
  }

  const zzplayas = getObject(findProperty(root, ['zzplayas']));
  if (!zzplayas) {
    return [];
  }

  const hints: Omit<ModelHint, 'order'>[] = [];
  const oot = getObject(findProperty(zzplayas, ['OOT', 'OcarinaOfTime', 'OcarinaofTime']));
  const mm = getObject(findProperty(zzplayas, ['MM', 'MajorasMask']));

  if (oot) {
    for (const file of readModelReference(findProperty(oot, ['adult_model']))) {
      hints.push({ file, game: 'oot', age: 'adult' });
    }
    for (const file of readModelReference(findProperty(oot, ['child_model']))) {
      hints.push({ file, game: 'oot', age: 'child' });
    }
  }

  if (mm) {
    for (const file of readModelReference(findProperty(mm, ['adult_model']))) {
      hints.push({ file, game: 'mm', age: 'adult' });
    }
    for (const file of readModelReference(findProperty(mm, ['child_model']))) {
      hints.push({ file, game: 'mm', age: null });
    }
  }

  return hints;
}

export function isProcessedPlayerModel(data: Uint8Array) {
  return data.length >= 0x5010 && bytesEqual(data, 0x5000, MODEL_MAGIC);
}

export function classifyPlayerModel(data: Uint8Array): { game: PlayerModelGame | null, age: PlayerModelAge | null } {
  if (isProcessedPlayerModel(data)) {
    const type = data[0x500b];
    const hierarchy = bufReadU32BE(data, 0x500c);

    switch (type) {
    case 0x00:
      return { game: 'oot', age: 'adult' };
    case 0x01:
      return { game: 'oot', age: 'child' };
    case 0x04:
      return { game: 'mm', age: 'child' };
    case 0x68:
      return { game: 'mm', age: 'adult' };
    }

    if (hierarchy === 0x06005380) {
      return { game: 'oot', age: 'adult' };
    }
    if (hierarchy === 0x060053a8) {
      return { game: 'oot', age: 'child' };
    }
    if (hierarchy === 0x06005420) {
      return { game: 'mm', age: null };
    }
  }

  const manifest = decoder.decode(data.subarray(Math.max(0, data.length - 0x4000)));
  if (!manifest.includes('!PlayAsManifest0')) {
    return { game: null, age: null };
  }

  if (
    manifest.includes('Shield.2.Face') ||
    manifest.includes('Sword.4') ||
    manifest.includes('Sheath.3')
  ) {
    return { game: 'mm', age: null };
  }

  if (
    manifest.includes('Hammer') ||
    manifest.includes('Shield.3') ||
    manifest.includes('Gauntlet.') ||
    manifest.includes('Foot.3.L')
  ) {
    return { game: 'oot', age: 'adult' };
  }

  if (
    manifest.includes('Slingshot') ||
    manifest.includes('Boomerang') ||
    manifest.includes('Mask.Bunny') ||
    manifest.includes('DekuStick') ||
    manifest.includes('GoronBracelet') ||
    manifest.includes('Ocarina.1') ||
    manifest.includes('Blade.1') ||
    manifest.includes('Hilt.1')
  ) {
    return { game: 'oot', age: 'child' };
  }

  if (
    manifest.includes('Limb 1') &&
    manifest.includes('Limb 10') &&
    manifest.includes('Limb 19') &&
    manifest.includes('Limb 20') &&
    manifest.includes('Fist.L') &&
    manifest.includes('Fist.R')
  ) {
    return { game: 'mm', age: null };
  }

  return { game: null, age: null };
}

function matchHint(entryName: string, hints: ModelHint[]) {
  const normalized = normalizePath(entryName);
  const base = basename(normalized);

  for (const hint of hints) {
    const file = normalizePath(hint.file);
    if (normalized === file || normalized.endsWith('/' + file)) {
      return hint;
    }
  }

  for (const hint of hints) {
    if (basename(normalizePath(hint.file)) === base) {
      return hint;
    }
  }

  return null;
}

export function isPlayerModelPak(data: Uint8Array) {
  return bytesEqual(data, 0, PAK_MAGIC);
}

export async function readPakPlayerModels(data: Uint8Array): Promise<PakPlayerModel[]> {
  const entries = readPakEntries(data);
  const jsonEntries = entries.filter((entry) => basename(entry.name).toLowerCase() === 'package.json');
  const hints: ModelHint[] = [];
  let order = 0;

  for (const entry of jsonEntries) {
    const jsonData = await decompress(entry, data, MAX_JSON_SIZE);
    let json: unknown;

    try {
      json = JSON.parse(decoder.decode(jsonData));
    } catch {
      continue;
    }

    for (const hint of packageHints(json)) {
      const root = dirname(entry.name);
      hints.push({
        ...hint,
        file: root ? `${root}/${hint.file}` : hint.file,
        order: order++,
      });
    }
  }

  const zobjEntries = entries.filter((entry) => entry.name.toLowerCase().endsWith('.zobj'));
  const orderedEntries = zobjEntries.map((entry, index) => {
    const hint = matchHint(entry.name, hints);
    return {
      entry,
      hint,
      index,
      priority: hint ? hint.order : 0x100000 + index,
    };
  }).sort((a, b) => a.priority - b.priority);

  const models: PakPlayerModel[] = [];

  for (const { entry, hint } of orderedEntries) {
    const model = await decompress(entry, data, MAX_MODEL_SIZE);
    const classified = classifyPlayerModel(model);

    models.push({
      name: entry.name,
      data: model,
      game: classified.game ?? hint?.game ?? null,
      age: classified.age ?? hint?.age ?? null,
    });
  }

  if (models.length === 0) {
    throw new Error('ModLoader64 pak contains no player model zobj files');
  }

  return models;
}



export type PakZobj = {
  name: string;
  data: Uint8Array;
};

export async function readPakZobjs(data: Uint8Array): Promise<PakZobj[]> {
  const entries = readPakEntries(data);
  const zobjEntries = entries.filter((entry) => entry.name.toLowerCase().endsWith('.zobj'));
  const out: PakZobj[] = [];

  for (const entry of zobjEntries) {
    out.push({
      name: entry.name,
      data: await decompress(entry, data, MAX_MODEL_SIZE),
    });
  }

  return out;
}
