import JSZip from 'jszip';

import { bufReadU32BE } from '../util/buffer';

export type PlayerVoiceAge = 'adult' | 'child';

export type PlayerVoiceClip = {
    name: string;
    data: Uint8Array;
    normalize: boolean;
};

export type PlayerVoiceSet = Map<number, PlayerVoiceClip[]>;

export type PlayerVoicePair = {
    adult: PlayerVoiceSet | null;
    child: PlayerVoiceSet | null;
};

type PakEntry = {
    name: string;
    compression: string;
    dataStart: number;
    dataEnd: number;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const PAK_MAGIC = encoder.encode('ModLoader64\0');
const PAK_VERSION = 3;
const MAX_FILES = 0x10000;
const MAX_AUDIO_SIZE = 0x2000000;

function emptyPair(): PlayerVoicePair {
    return {
        adult: null,
        child: null,
    };
}

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
    return value.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '');
}

function normalizedPathKey(value: string) {
    return normalizePath(value).toLowerCase();
}

function basename(value: string) {
    const normalized = normalizePath(value);
    const index = normalized.lastIndexOf('/');
    return index === -1 ? normalized : normalized.slice(index + 1);
}

function dirname(value: string) {
    const normalized = normalizePath(value);
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
    if (!isPlayerVoicePak(data)) {
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

        entries.push({
            name: decoder.decode(data.subarray(nameOffset, nameEnd)),
            compression,
            dataStart,
            dataEnd,
        });
    }

    return entries;
}

async function decompressPakEntry(entry: PakEntry, pak: Uint8Array) {
    const input = pak.subarray(entry.dataStart, entry.dataEnd);

    if (entry.compression === 'DEFL') {
        const stream = new Blob([new Uint8Array(input)]).stream().pipeThrough(
            new DecompressionStream('deflate')
        );

        const output = new Uint8Array(
            await new Response(stream).arrayBuffer()
        );

        if (output.length > MAX_AUDIO_SIZE) {
            throw new Error(`Pak file ${entry.name} is too large`);
        }

        return output;
    }

    if (
        entry.compression === 'NONE' ||
        entry.compression === 'RAW ' ||
        entry.compression === '\0\0\0\0'
    ) {
        if (input.length > MAX_AUDIO_SIZE) {
            throw new Error(`Pak file ${entry.name} is too large`);
        }

        return new Uint8Array(input);
    }

    throw new Error(
        `Unsupported pak compression ${entry.compression} for ${entry.name}`
    );
}

function classifySfxId(sfxId: number): {
    age: PlayerVoiceAge;
    event: number;
} | null {
    if (sfxId >= 0x6800 && sfxId < 0x6820) {
        return {
            age: 'adult',
            event: sfxId - 0x6800,
        };
    }

    if (sfxId >= 0x6820 && sfxId < 0x6840) {
        return {
            age: 'child',
            event: sfxId - 0x6820,
        };
    }

    return null;
}

function addClip(
    pair: PlayerVoicePair,
    sfxId: number,
    clip: PlayerVoiceClip
) {
    const classified = classifySfxId(sfxId);

    if (!classified) {
        return;
    }

    let set = pair[classified.age];

    if (set === null) {
        set = new Map();
        pair[classified.age] = set;
    }

    const clips = set.get(classified.event) || [];
    clips.push(clip);
    set.set(classified.event, clips);
}

function hasClips(set: PlayerVoiceSet | null) {
    if (set === null) {
        return false;
    }

    for (const clips of set.values()) {
        if (clips.length) {
            return true;
        }
    }

    return false;
}

function parseSfxId(value: string) {
    const trimmed = value.trim();

    if (/^0x[0-9a-f]+$/i.test(trimmed)) {
        return Number.parseInt(trimmed.slice(2), 16);
    }

    if (/^[0-9]+$/.test(trimmed)) {
        return Number.parseInt(trimmed, 10);
    }

    return null;
}

function stripJsonComments(value: string) {
    return value.split(/\r?\n/).map((line) => {
        const index = line.indexOf('#');
        return index === -1 ? line : line.slice(0, index);
    }).join('\n');
}

function objectValue(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }

    return value as Record<string, unknown>;
}

function mapFiles(value: unknown) {
    if (typeof value === 'string') {
        return value ? [value] : [];
    }

    if (Array.isArray(value)) {
        return value.filter(
            (item): item is string => typeof item === 'string' && item !== ''
        );
    }

    return [];
}

async function readPak(data: Uint8Array) {
    const pair = emptyPair();

    for (const entry of readPakEntries(data)) {
        const match = normalizedPathKey(entry.name).match(
            /(?:^|\/)sounds\/([0-9a-f]{4})\/[^/]+$/i
        );

        if (!match) {
            continue;
        }

        const sfxId = Number.parseInt(match[1], 16);

        if (!classifySfxId(sfxId)) {
            continue;
        }

        addClip(pair, sfxId, {
            name: entry.name,
            data: await decompressPakEntry(entry, data),
            normalize: true,
        });
    }

    return pair;
}

async function readZip(data: Uint8Array) {
    const pair = emptyPair();
    const zip = await JSZip.loadAsync(data);
    const entries = Object.values(zip.files).filter((entry) => !entry.dir);

    const maps = entries.filter(
        (entry) => basename(entry.name).toLowerCase() === 'voice_map.json'
    );

    if (maps.length === 0) {
        throw new Error('Voice ZIP does not contain voice_map.json');
    }

    if (maps.length > 1) {
        throw new Error('Voice ZIP contains multiple voice_map.json files');
    }

    const mapEntry = maps[0];
    const root = dirname(mapEntry.name);
    const entryMap = new Map<string, JSZip.JSZipObject>();

    for (const entry of entries) {
        entryMap.set(normalizedPathKey(entry.name), entry);
    }

    const resolveEntry = (name: string) => {
        const normalized = normalizePath(name);

        const candidates = root
            ? [`${root}/${normalized}`, normalized]
            : [normalized];

        for (const candidate of candidates) {
            const entry = entryMap.get(normalizedPathKey(candidate));

            if (entry) {
                return entry;
            }
        }

        return null;
    };

    let json: unknown;

    try {
        json = JSON.parse(
            stripJsonComments(await mapEntry.async('text'))
        );
    } catch (e) {
        throw new Error(`Invalid voice_map.json: ${e}`);
    }

    const rootObject = objectValue(json);
    const sfx = rootObject
        ? objectValue(rootObject.sfx)
        : null;

    if (!sfx) {
        throw new Error('voice_map.json does not contain an sfx map');
    }

    for (const [rawSfxId, rawFiles] of Object.entries(sfx)) {
        const sfxId = parseSfxId(rawSfxId);

        if (sfxId === null || !classifySfxId(sfxId)) {
            continue;
        }

        for (const fileName of mapFiles(rawFiles)) {
            const entry = resolveEntry(fileName);

            if (!entry) {
                throw new Error(`Voice ZIP is missing ${fileName}`);
            }

            const audio = await entry.async('uint8array');

            if (audio.length > MAX_AUDIO_SIZE) {
                throw new Error(`Voice audio file ${entry.name} is too large`);
            }

            addClip(pair, sfxId, {
                name: entry.name,
                data: audio,
                normalize: false,
            });
        }
    }

    return pair;
}

export function isPlayerVoicePak(data: Uint8Array) {
    return bytesEqual(data, 0, PAK_MAGIC);
}

export async function readPlayerVoiceArchive(
    data: Uint8Array
): Promise<PlayerVoicePair> {
    const pair = isPlayerVoicePak(data)
        ? await readPak(data)
        : await readZip(data);

    if (!hasClips(pair.adult) && !hasClips(pair.child)) {
        throw new Error('Voice archive contains no Link voice events');
    }

    return pair;
}

export async function resolvePlayerVoiceInput(
    data: Uint8Array | null,
    slotAge: PlayerVoiceAge,
): Promise<PlayerVoicePair> {
    if (data === null) {
        return emptyPair();
    }

    const pair = await readPlayerVoiceArchive(data);
    const adult = hasClips(pair.adult);
    const child = hasClips(pair.child);

    if (adult && child) {
        return pair;
    }

    if (adult) {
        if (slotAge === 'adult') {
            return pair;
        }

        return {
            adult: null,
            child: pair.adult,
        };
    }

    if (child) {
        if (slotAge === 'child') {
            return pair;
        }

        return {
            adult: pair.child,
            child: null,
        };
    }

    throw new Error('Unable to determine voice archive age');
}

export function mergePlayerVoiceInputs(
    childSlot: PlayerVoicePair,
    adultSlot: PlayerVoicePair,
): PlayerVoicePair {
    return {
        child: childSlot.child ?? adultSlot.child,
        adult: adultSlot.adult ?? childSlot.adult,
    };
}