import crypto from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import YAML from 'yaml';

import { FILES as GAME_FILES, Monitor } from '@ootmm/core';

import { decompressGames, DecompressedRoms } from '../decompress.ts';
import { DmaData } from '../dma.ts';
import { Patchfile } from '../patch-build/patchfile.ts';
import { arrayToIndexMap } from '../util.ts';

export type Game = 'oot' | 'mm';

type AnimationDef = {
    name: string;
    home_game: Game;
    frame_data_offset: number | string;
    header_offset: number | string;
    frame_data_size?: number | string;
    frame_count?: number | string;
};

type AnimationsYaml = {
    animations?: AnimationDef[];
};

type SourcePlayerAnimHeader = {
    frameCount: number;
    frameDataSegmented: number;
};

type PortedAnimationData = {
    def: AnimationDef;
    srcGame: Game;
    dstGame: Game;
    sourceHeader: SourcePlayerAnimHeader;
    runtimeFrameCount: number;
    sourceFrameDataOffset: number;
    sourceFrameDataSize: number;
    frameData: Uint8Array;
    frameSize: number;
};

type PackedImportedAnimation = PortedAnimationData & {
    customFrameDataOffset: number;
    customHeaderOffset: number;
};

type ImportedAnimationPack = {
    entries: PackedImportedAnimation[];
    payloads: Record<Game, Uint8Array>;
    unpaddedPayloadSizes: Record<Game, number>;
    vroms: Record<Game, number>;
};

type DmaEntryDebug = {
    virtStart: number;
    virtEnd: number;
};

type ImportedAnimationArtifactManifest = {
    version: number;
    defsSha256: string;
    games: Record<Game, {
        fileName: string;
        payloadFile: string;
        vromFile: string;
        payloadSha256: string;
        payloadSize: number;
        unpaddedPayloadSize: number;
        vrom: number;
    }>;
};

type GameplayKeepAppendPlan = {
    game: Game;
    baseData: Uint8Array;
    parts: Uint8Array[];
    size: number;
    xmlUpdates: Array<{
        name: string;
        offset: number;
    }>;
};

const GENERATOR_ROOT = path.resolve(__dirname, '../../..');
const PROJECT_ROOT = path.resolve(GENERATOR_ROOT, '../..');

const DEFS_FILE = path.join(PROJECT_ROOT, 'data/defs/linkanimations.yml');
const SETUP_DIR = path.join(GENERATOR_ROOT, 'data/setup');
const BUILD_ASSETS_DIR = path.join(GENERATOR_ROOT, 'build/assets');
const BUILD_INCLUDE_DIR = path.join(GENERATOR_ROOT, 'build/include/combo');

const PLAYER_LIMB_COUNT = 0x16;
const VEC3S_SIZE = 6;
const PLAYER_ANIM_FRAME_SIZE = PLAYER_LIMB_COUNT * VEC3S_SIZE + 2;
const IMPORTED_LINK_ANIM_SEGMENT = 0x08;
const DMA_ALIGNMENT = 0x10;
const GENERATED_ARTIFACT_VERSION = 1;

const IMPORTED_LINK_ANIM_PREFERRED_VROM: Record<Game, number> = {
    oot: 0x08400000,
    mm: 0x08500000,
};

const IMPORTED_LINK_ANIM_FILE: Record<Game, string> = {
    oot: 'custom/imported_link_anim_oot',
    mm: 'custom/imported_link_anim_mm',
};

const IMPORTED_LINK_ANIM_EXPECTED_PAYLOAD_FILE: Record<Game, string> = {
    oot: path.join(BUILD_ASSETS_DIR, 'oot/custom/imported_link_anim_oot.expected.bin'),
    mm: path.join(BUILD_ASSETS_DIR, 'mm/custom/imported_link_anim_mm.expected.bin'),
};

const IMPORTED_LINK_ANIM_EXPECTED_VROM_FILE: Record<Game, string> = {
    oot: path.join(BUILD_ASSETS_DIR, 'oot/custom/imported_link_anim_oot.expected.vrom.txt'),
    mm: path.join(BUILD_ASSETS_DIR, 'mm/custom/imported_link_anim_mm.expected.vrom.txt'),
};

const IMPORTED_LINK_ANIM_EXPECTED_MANIFEST_FILE = path.join(
    BUILD_ASSETS_DIR,
    'imported_link_anim.manifest.json'
);

const FILES_TO_INDEX = {
    oot: arrayToIndexMap(GAME_FILES.oot),
    mm: arrayToIndexMap(GAME_FILES.mm),
};

const FILES = {
    oot: {
        gameplayKeepXml: path.join(SETUP_DIR, 'oot/objects/gameplay_keep.xml'),
        gameplayKeepBin: path.join(BUILD_ASSETS_DIR, 'oot/objects/gameplay_keep.zobj'),
    },
    mm: {
        gameplayKeepXml: path.join(SETUP_DIR, 'mm/objects/gameplay_keep.xml'),
        gameplayKeepBin: path.join(BUILD_ASSETS_DIR, 'mm/objects/gameplay_keep.zobj'),
    },
} as const;

function assertGame(game: string, label: string): asserts game is Game {
    if (game !== 'oot' && game !== 'mm') {
        throw new Error(`${label}: invalid game "${game}", expected "oot" or "mm"`);
    }
}

function assertRange(file: string, buf: Uint8Array, off: number, size: number) {
    if (off < 0 || size < 0 || off + size > buf.length) {
        throw new Error(
            `${file}: range ${hex(off)}..${hex(off + size)} exceeds file size ${hex(buf.length)}`
        );
    }
}

function parseNum(value: number | string | undefined, label: string): number {
    if (value === undefined || value === null) {
        throw new Error(`Missing required animation field: ${label}`);
    }

    if (typeof value === 'number') {
        if (!Number.isFinite(value)) {
            throw new Error(`Invalid ${label}: ${value}`);
        }
        return value;
    }

    const text = value.trim();
    const isHex = text.startsWith('0x') || text.startsWith('0X');

    if (isHex && !/^0x[0-9a-fA-F]+$/.test(text)) {
        throw new Error(`Invalid ${label}: ${value}`);
    }

    if (!isHex && !/^[0-9]+$/.test(text)) {
        throw new Error(`Invalid ${label}: ${value}`);
    }

    const parsed = Number.parseInt(text, isHex ? 16 : 10);

    if (!Number.isFinite(parsed)) {
        throw new Error(`Invalid ${label}: ${value}`);
    }

    return parsed;
}

function otherGame(game: Game): Game {
    return game === 'oot' ? 'mm' : 'oot';
}

function align(n: number, alignment: number): number {
    return (n + alignment - 1) & ~(alignment - 1);
}

function padToAlign(data: Uint8Array, alignment = DMA_ALIGNMENT): Uint8Array {
    const paddedSize = align(data.length, alignment);

    if (paddedSize === data.length) {
        return data;
    }

    const out = new Uint8Array(paddedSize);
    out.set(data);
    return out;
}

function hex(n: number, width = 0): string {
    const s = (n >>> 0).toString(16).toUpperCase();
    return `0x${width ? s.padStart(width, '0') : s}`;
}

function sha256Bytes(data: Uint8Array): string {
    return crypto.createHash('sha256').update(data).digest('hex');
}

function sha256Text(text: string): string {
    return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
    return aStart < bEnd && bStart < aEnd;
}

function rangeContains(containerStart: number, containerEnd: number, start: number, end: number): boolean {
    return containerStart <= start && end <= containerEnd;
}

function readU16BE(buf: Uint8Array, off: number): number {
    return (buf[off] << 8) | buf[off + 1];
}

function readU32BE(buf: Uint8Array, off: number): number {
    return (
        ((buf[off] << 24) |
            (buf[off + 1] << 16) |
            (buf[off + 2] << 8) |
            buf[off + 3]) >>> 0
    );
}

function writeU16BE(buf: Uint8Array, off: number, v: number) {
    buf[off] = (v >>> 8) & 0xff;
    buf[off + 1] = v & 0xff;
}

function writeU32BE(buf: Uint8Array, off: number, v: number) {
    buf[off] = (v >>> 24) & 0xff;
    buf[off + 1] = (v >>> 16) & 0xff;
    buf[off + 2] = (v >>> 8) & 0xff;
    buf[off + 3] = v & 0xff;
}

function concatBuffers(...parts: Uint8Array[]): Uint8Array {
    const size = parts.reduce((sum, part) => sum + part.length, 0);
    const out = new Uint8Array(size);

    let off = 0;

    for (const part of parts) {
        out.set(part, off);
        off += part.length;
    }

    return out;
}

function copyBytes(src: Uint8Array): Uint8Array {
    const out = new Uint8Array(src.length);
    out.set(src);
    return out;
}

async function readFileUint8(file: string): Promise<Uint8Array> {
    const data = await fs.readFile(file);
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
}

async function atomicWriteFile(file: string, data: string | Uint8Array) {
    await fs.mkdir(path.dirname(file), { recursive: true });

    const tmp = `${file}.tmp-${process.pid}-${Date.now()}`;

    await fs.writeFile(tmp, data);
    await fs.rename(tmp, file);
}

async function removeFileIfExists(file: string) {
    await fs.unlink(file).catch((err: any) => {
        if (err.code !== 'ENOENT') {
            throw err;
        }
    });
}

async function readDefsFileTextForHash(): Promise<string> {
    return fs.readFile(DEFS_FILE, 'utf8').catch((err: any) => {
        if (err.code === 'ENOENT') {
            return '';
        }

        throw err;
    });
}

async function readYaml(): Promise<AnimationDef[]> {
    let raw: string;

    try {
        raw = await fs.readFile(DEFS_FILE, 'utf8');
    } catch (err: any) {
        if (err.code === 'ENOENT') {
            return [];
        }

        throw err;
    }

    const parsed = YAML.parse(raw) as AnimationsYaml | null;
    const defs = parsed?.animations || [];

    for (const def of defs) {
        assertGame(def.home_game, `${def.name}.home_game`);
    }

    return defs;
}

async function removeGeneratedImportedAnimationArtifacts() {
    for (const game of ['oot', 'mm'] as const) {
        await removeFileIfExists(IMPORTED_LINK_ANIM_EXPECTED_PAYLOAD_FILE[game]);
        await removeFileIfExists(IMPORTED_LINK_ANIM_EXPECTED_VROM_FILE[game]);
    }

    await removeFileIfExists(IMPORTED_LINK_ANIM_EXPECTED_MANIFEST_FILE);
    await removeFileIfExists(path.join(BUILD_INCLUDE_DIR, 'imported_animations.h'));
}

function findFileKey(game: Game, wanted: string): string {
    const keys = Object.keys(FILES_TO_INDEX[game]);
    const exact = keys.find((key) => key === wanted);

    if (exact) {
        return exact;
    }

    const basename = wanted.split('/').pop();
    const byBasename = keys.find((key) => key.split('/').pop() === basename);

    if (byBasename) {
        return byBasename;
    }

    const candidates = keys.filter((key) => key.toLowerCase().includes('anim'));

    throw new Error(
        `${game}: file not found in file table: ${wanted}\n` +
        `Animation-ish file keys:\n${candidates.join('\n')}`
    );
}

function getFileFromRom(roms: DecompressedRoms, game: Game, file: string): Uint8Array {
    const key = findFileKey(game, file);
    const index = FILES_TO_INDEX[game][key];
    const dma = new DmaData(roms[game].dma);
    const entry = dma.read(index);

    return roms[game].rom.slice(entry.virtStart, entry.virtEnd);
}

function getDmaEntries(roms: DecompressedRoms, game: Game): DmaEntryDebug[] {
    const dma = new DmaData(roms[game].dma);
    const files = GAME_FILES[game];
    const out: DmaEntryDebug[] = [];

    for (let i = 0; i < files.length; i++) {
        const entry = dma.read(i) as any;

        if (entry.virtStart === undefined || entry.virtEnd === undefined) {
            continue;
        }

        out.push({
            virtStart: entry.virtStart,
            virtEnd: entry.virtEnd,
        });
    }

    return out;
}

function findDmaOverlaps(
    roms: DecompressedRoms,
    game: Game,
    start: number,
    size: number
): DmaEntryDebug[] {
    const end = start + size;

    return getDmaEntries(roms, game).filter((entry) =>
        rangesOverlap(start, end, entry.virtStart, entry.virtEnd)
    );
}

function debugDmaOverlaps(
    roms: DecompressedRoms,
    game: Game,
    start: number,
    size: number
): string {
    const end = start + size;
    const overlaps = findDmaOverlaps(roms, game, start, size);

    return overlaps.map((entry) =>
        `${hex(entry.virtStart)}..${hex(entry.virtEnd)} overlaps ${hex(start)}..${hex(end)}`
    ).join('\n');
}

function findFreeVromGap(
    roms: DecompressedRoms,
    game: Game,
    size: number,
    preferredStart = IMPORTED_LINK_ANIM_PREFERRED_VROM[game],
    alignment = DMA_ALIGNMENT
): number {
    if (size <= 0) {
        return 0;
    }

    if ((size & (alignment - 1)) !== 0) {
        throw new Error(
            `[animations:dma] ${game}: requested imported animation size ${hex(size)} ` +
            `is not ${hex(alignment)}-aligned`
        );
    }

    const entries = getDmaEntries(roms, game)
        .filter((entry) => entry.virtEnd > entry.virtStart)
        .sort((a, b) => a.virtStart - b.virtStart);

    let cursor = align(preferredStart, alignment);

    for (const entry of entries) {
        if (entry.virtEnd <= cursor) {
            continue;
        }

        if (cursor + size <= entry.virtStart) {
            return cursor;
        }

        cursor = align(entry.virtEnd, alignment);
    }

    return cursor;
}

function selectImportedLinkAnimVroms(
    roms: DecompressedRoms,
    payloads: Record<Game, Uint8Array>
): Record<Game, number> {
    return {
        oot: findFreeVromGap(
            roms,
            'oot',
            payloads.oot.length,
            IMPORTED_LINK_ANIM_PREFERRED_VROM.oot
        ),
        mm: findFreeVromGap(
            roms,
            'mm',
            payloads.mm.length,
            IMPORTED_LINK_ANIM_PREFERRED_VROM.mm
        ),
    };
}

function assertNewFileVromIsDmaFriendly(
    roms: DecompressedRoms,
    game: Game,
    fileName: string,
    vrom: number,
    size: number
) {
    const end = vrom + size;

    if (size <= 0) {
        throw new Error(`[animations:dma] ${game}: ${fileName} has empty payload`);
    }

    if ((vrom & (DMA_ALIGNMENT - 1)) !== 0) {
        throw new Error(
            `[animations:dma] ${game}: ${fileName} VROM ${hex(vrom)} is not ${hex(DMA_ALIGNMENT)}-aligned`
        );
    }

    if ((size & (DMA_ALIGNMENT - 1)) !== 0) {
        throw new Error(
            `[animations:dma] ${game}: ${fileName} size ${hex(size)} is not ${hex(DMA_ALIGNMENT)}-aligned`
        );
    }

    const overlaps = findDmaOverlaps(roms, game, vrom, size);

    if (overlaps.length !== 0) {
        throw new Error(
            `[animations:dma] ${game}: ${fileName} VROM ${hex(vrom)}..${hex(end)} is not free\n` +
            debugDmaOverlaps(roms, game, vrom, size)
        );
    }
}

function parseSourcePlayerAnimHeader(buf: Uint8Array, off: number): SourcePlayerAnimHeader {
    assertRange('gameplay_keep', buf, off, 8);

    return {
        frameCount: readU16BE(buf, off + 0x00),
        frameDataSegmented: readU32BE(buf, off + 0x04),
    };
}

function resamplePlayerFrameData(
    src: Uint8Array,
    srcFrameCount: number,
    dstFrameCount: number,
    frameSize: number,
    animName: string
): Uint8Array {
    if (srcFrameCount <= 0) {
        throw new Error(`${animName}: invalid source frame count ${srcFrameCount}`);
    }

    if (dstFrameCount <= 0 || dstFrameCount > 0xffff) {
        throw new Error(`${animName}: invalid output frame count ${dstFrameCount}`);
    }

    const requiredSourceSize = srcFrameCount * frameSize;

    if (src.length < requiredSourceSize) {
        throw new Error(
            `${animName}: source frame data too small: got ${hex(src.length)}, need ${hex(requiredSourceSize)}`
        );
    }

    const out = new Uint8Array(dstFrameCount * frameSize);

    for (let dstFrame = 0; dstFrame < dstFrameCount; dstFrame++) {
        const srcFrame =
            dstFrameCount === 1
                ? 0
                : Math.round((dstFrame * (srcFrameCount - 1)) / (dstFrameCount - 1));

        const srcOff = srcFrame * frameSize;
        const dstOff = dstFrame * frameSize;

        out.set(src.subarray(srcOff, srcOff + frameSize), dstOff);
    }

    return out;
}

function buildImportedLinkAnimHeader(
    dstGame: Game,
    frameCount: number,
    customFrameDataOffset: number,
    frameSize: number
): Uint8Array {
    if (customFrameDataOffset < 0 || customFrameDataOffset > 0x00ffffff) {
        throw new Error(
            `Imported animation offset does not fit segmented pointer: ${hex(customFrameDataOffset)}`
        );
    }

    if (frameCount <= 0 || frameCount > 0xffff) {
        throw new Error(`Imported animation frame count does not fit u16: ${frameCount}`);
    }

    if (frameSize <= 0 || frameSize > 0xffff) {
        throw new Error(`Imported animation frame size does not fit u16: ${hex(frameSize)}`);
    }

    const out = new Uint8Array(8);

    writeU16BE(out, 0x00, frameCount);

    if (dstGame === 'mm') {
        writeU16BE(out, 0x02, frameSize);
    } else {
        out[0x02] = 0;
        out[0x03] = 0;
    }

    writeU32BE(out, 0x04, (IMPORTED_LINK_ANIM_SEGMENT << 24) | customFrameDataOffset);

    return out;
}

function buildPortedAnimationData(roms: DecompressedRoms, def: AnimationDef): PortedAnimationData {
    const srcGame = def.home_game;
    const dstGame = otherGame(srcGame);
    const frameDataOffset = parseNum(def.frame_data_offset, `${def.name}.frame_data_offset`);
    const headerOffset = parseNum(def.header_offset, `${def.name}.header_offset`);
    const srcGameplayKeep = getFileFromRom(roms, srcGame, 'objects/gameplay_keep');
    const srcLinkAnim = getFileFromRom(roms, srcGame, 'link_animetion');
    const sourceHeader = parseSourcePlayerAnimHeader(srcGameplayKeep, headerOffset);
    const sourceHeaderOffset = sourceHeader.frameDataSegmented & 0x00ffffff;
    const sourceFrameCount = sourceHeader.frameCount;
    const runtimeFrameCount =
        def.frame_count === undefined
            ? sourceFrameCount
            : parseNum(def.frame_count, `${def.name}.frame_count`);
    const inferredFrameDataSize = sourceFrameCount * PLAYER_ANIM_FRAME_SIZE;
    const frameDataSize =
        def.frame_data_size === undefined
            ? inferredFrameDataSize
            : parseNum(def.frame_data_size, `${def.name}.frame_data_size`);

    if (sourceHeader.frameCount <= 0) {
        throw new Error(`${def.name}: invalid frame count ${sourceHeader.frameCount}`);
    }

    if (sourceHeaderOffset !== frameDataOffset) {
        throw new Error(
            `${def.name}: header points to ${hex(sourceHeaderOffset)}, ` +
            `but YAML frame_data_offset is ${hex(frameDataOffset)}`
        );
    }

    assertRange(`${srcGame}:link_animetion`, srcLinkAnim, frameDataOffset, frameDataSize);

    const rawFrameData = srcLinkAnim.subarray(frameDataOffset, frameDataOffset + frameDataSize);
    const frameData = resamplePlayerFrameData(
        rawFrameData,
        sourceFrameCount,
        runtimeFrameCount,
        PLAYER_ANIM_FRAME_SIZE,
        def.name
    );

    return {
        def,
        srcGame,
        dstGame,
        sourceHeader,
        runtimeFrameCount,
        sourceFrameDataOffset: frameDataOffset,
        sourceFrameDataSize: frameDataSize,
        frameData,
        frameSize: PLAYER_ANIM_FRAME_SIZE,
    };
}

function buildImportedAnimationPack(
    roms: DecompressedRoms,
    defs: AnimationDef[]
): ImportedAnimationPack {
    const parts: Record<Game, Uint8Array[]> = {
        oot: [],
        mm: [],
    };
    const sizes: Record<Game, number> = {
        oot: 0,
        mm: 0,
    };
    const entries: PackedImportedAnimation[] = [];

    for (const def of defs) {
        const ported = buildPortedAnimationData(roms, def);
        const dstGame = ported.dstGame;
        const customFrameDataOffset = align(sizes[dstGame], DMA_ALIGNMENT);
        const padSize = customFrameDataOffset - sizes[dstGame];

        if (padSize !== 0) {
            parts[dstGame].push(new Uint8Array(padSize));
        }

        parts[dstGame].push(ported.frameData);
        sizes[dstGame] = customFrameDataOffset + ported.frameData.length;

        entries.push({
            ...ported,
            customFrameDataOffset,
            customHeaderOffset: 0,
        });
    }

    const unpaddedOot = concatBuffers(...parts.oot);
    const unpaddedMm = concatBuffers(...parts.mm);
    const payloads = {
        oot: padToAlign(unpaddedOot, DMA_ALIGNMENT),
        mm: padToAlign(unpaddedMm, DMA_ALIGNMENT),
    };

    return {
        entries,
        payloads,
        unpaddedPayloadSizes: {
            oot: unpaddedOot.length,
            mm: unpaddedMm.length,
        },
        vroms: selectImportedLinkAnimVroms(roms, payloads),
    };
}

function assertRuntimeFrameDmasAreInsideImportedFile(game: Game, pack: ImportedAnimationPack) {
    const baseVrom = pack.vroms[game];
    const payloadEnd = baseVrom + pack.payloads[game].length;

    if (pack.payloads[game].length === 0) {
        return;
    }

    for (const entry of pack.entries.filter((e) => e.dstGame === game)) {
        const firstFrameVrom = baseVrom + entry.customFrameDataOffset;
        const lastByteEnd = firstFrameVrom + entry.frameData.length;

        if (!rangeContains(baseVrom, payloadEnd, firstFrameVrom, lastByteEnd)) {
            throw new Error(
                `[animations:dma] ${game}: ${entry.def.name} frame DMA range ` +
                `${hex(firstFrameVrom)}..${hex(lastByteEnd)} is outside imported file ` +
                `${hex(baseVrom)}..${hex(payloadEnd)}`
            );
        }

        if (entry.frameSize !== PLAYER_ANIM_FRAME_SIZE) {
            throw new Error(
                `[animations:dma] ${game}: ${entry.def.name} frameSize mismatch: ` +
                `got ${hex(entry.frameSize)}, expected ${hex(PLAYER_ANIM_FRAME_SIZE)}`
            );
        }

        const expectedTotal = entry.runtimeFrameCount * PLAYER_ANIM_FRAME_SIZE;

        if (entry.frameData.length !== expectedTotal) {
            throw new Error(
                `[animations:dma] ${game}: ${entry.def.name} total frame data mismatch: ` +
                `got ${hex(entry.frameData.length)}, expected ${hex(expectedTotal)}`
            );
        }
    }
}

function createGameplayKeepAppendPlans(roms: DecompressedRoms): Record<Game, GameplayKeepAppendPlan> {
    const ootBaseData = getFileFromRom(roms, 'oot', 'objects/gameplay_keep');
    const mmBaseData = getFileFromRom(roms, 'mm', 'objects/gameplay_keep');

    return {
        oot: {
            game: 'oot',
            baseData: ootBaseData,
            parts: [],
            size: ootBaseData.length,
            xmlUpdates: [],
        },
        mm: {
            game: 'mm',
            baseData: mmBaseData,
            parts: [],
            size: mmBaseData.length,
            xmlUpdates: [],
        },
    };
}

function appendToGameplayKeepPlan(
    plan: GameplayKeepAppendPlan,
    payload: Uint8Array,
    alignment: number
): number {
    const outOffset = align(plan.size, alignment);
    const pad = outOffset - plan.size;

    if (pad !== 0) {
        plan.parts.push(new Uint8Array(pad));
    }

    plan.parts.push(payload);
    plan.size = outOffset + payload.length;

    return outOffset;
}

function planAnimationSymbol(
    plan: GameplayKeepAppendPlan,
    entry: PackedImportedAnimation
) {
    const headerBytes = buildImportedLinkAnimHeader(
        entry.dstGame,
        entry.runtimeFrameCount,
        entry.customFrameDataOffset,
        entry.frameSize
    );
    const dstHeaderOffset = appendToGameplayKeepPlan(plan, headerBytes, 0x8);

    entry.customHeaderOffset = dstHeaderOffset;
    plan.xmlUpdates.push({
        name: entry.def.name,
        offset: dstHeaderOffset,
    });
}

function populateHeaderInBaseData(plan: GameplayKeepAppendPlan, entry: PackedImportedAnimation) {
    const headerBytes = buildImportedLinkAnimHeader(
        entry.dstGame,
        entry.runtimeFrameCount,
        entry.customFrameDataOffset,
        entry.frameSize
    );
    const offset = entry.customHeaderOffset;

    if (offset + headerBytes.length > plan.baseData.length) {
        const needed = offset + headerBytes.length - plan.baseData.length;
        const padding = new Uint8Array(needed);

        plan.baseData = concatBuffers(plan.baseData, padding);
    }

    plan.baseData.set(headerBytes, offset);
}

async function writeGameplayKeepPlan(plan: GameplayKeepAppendPlan) {
    const file = FILES[plan.game].gameplayKeepBin;
    const out = concatBuffers(plan.baseData, ...plan.parts);

    await fs.mkdir(path.dirname(file), { recursive: true });
    await atomicWriteFile(file, out);

    for (const update of plan.xmlUpdates) {
        await insertXmlPlayerAnimation(plan.game, update.name, update.offset);
    }
}

function escapeXmlAttr(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

async function insertXmlPlayerAnimation(game: Game, name: string, offset: number) {
    const xmlFile = FILES[game].gameplayKeepXml;
    const xml = await fs.readFile(xmlFile, 'utf8');
    const offsetText = `0x${offset.toString(16).toUpperCase()}`;
    let found = false;

    const updatedXml = xml.replace(
        /^([ \t]*<PlayerAnimation\b[^\r\n]*\/>[ \t]*)$/gm,
        (line: string) => {
            const nameMatch = line.match(/\bName\s*=\s*"([^"]*)"/);

            if (!nameMatch || nameMatch[1] !== name) {
                return line;
            }

            found = true;

            if (/\bOffset\s*=\s*"[^"]*"/.test(line)) {
                return line.replace(/\bOffset\s*=\s*"[^"]*"/, `Offset="${offsetText}"`);
            }

            return line.replace(/\s*\/>/, ` Offset="${offsetText}"/>`);
        }
    );

    if (found) {
        await atomicWriteFile(xmlFile, updatedXml);
        return;
    }

    const line = `        <PlayerAnimation Name="${escapeXmlAttr(name)}" Offset="${offsetText}"/>\n`;
    const marker = '    </File>';
    const pos = updatedXml.lastIndexOf(marker);

    if (pos < 0) {
        throw new Error(`${xmlFile}: missing ${marker}`);
    }

    await atomicWriteFile(xmlFile, updatedXml.slice(0, pos) + line + updatedXml.slice(pos));
}

function defineBaseForAnimation(name: string): string {
    return `COMBO_IMPORTED_ANIM_${name.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`;
}

function cSymbolForAnimation(name: string): string {
    const symbol = name.replace(/[^a-zA-Z0-9_]/g, '_');

    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(symbol)) {
        throw new Error(`${name}: cannot convert animation name to valid C symbol`);
    }

    return symbol;
}

function pushAnimationListMacro(
    lines: string[],
    macroName: string,
    entries: PackedImportedAnimation[]
) {
    const slash = '\\';

    if (entries.length === 0) {
        lines.push(`#define ${macroName}(_)`);
        return;
    }

    lines.push(`#define ${macroName}(_) ${slash}`);

    for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const base = defineBaseForAnimation(entry.def.name);
        const symbol = cSymbolForAnimation(entry.def.name);
        const vromMacro =
            entry.dstGame === 'oot'
                ? 'COMBO_IMPORTED_LINK_ANIM_OOT_VROM'
                : 'COMBO_IMPORTED_LINK_ANIM_MM_VROM';
        const continuation = i + 1 === entries.length ? '' : ` ${slash}`;

        lines.push(
            `    _(${symbol}, ${vromMacro}, ${base}_HEADER_SEGMENTED, ${base}_CUSTOM_OFFSET, ${base}_FRAMECOUNT, ${base}_FRAMESIZE)${continuation}`
        );
    }
}

async function emitExpectedImportedAnimationPayloads(pack: ImportedAnimationPack) {
    const defsText = await readDefsFileTextForHash();
    const defsSha256 = sha256Text(defsText);
    const manifest: ImportedAnimationArtifactManifest = {
        version: GENERATED_ARTIFACT_VERSION,
        defsSha256,
        games: {
            oot: {
                fileName: IMPORTED_LINK_ANIM_FILE.oot,
                payloadFile: IMPORTED_LINK_ANIM_EXPECTED_PAYLOAD_FILE.oot,
                vromFile: IMPORTED_LINK_ANIM_EXPECTED_VROM_FILE.oot,
                payloadSha256: sha256Bytes(pack.payloads.oot),
                payloadSize: pack.payloads.oot.length,
                unpaddedPayloadSize: pack.unpaddedPayloadSizes.oot,
                vrom: pack.vroms.oot,
            },
            mm: {
                fileName: IMPORTED_LINK_ANIM_FILE.mm,
                payloadFile: IMPORTED_LINK_ANIM_EXPECTED_PAYLOAD_FILE.mm,
                vromFile: IMPORTED_LINK_ANIM_EXPECTED_VROM_FILE.mm,
                payloadSha256: sha256Bytes(pack.payloads.mm),
                payloadSize: pack.payloads.mm.length,
                unpaddedPayloadSize: pack.unpaddedPayloadSizes.mm,
                vrom: pack.vroms.mm,
            },
        },
    };

    for (const game of ['oot', 'mm'] as const) {
        const payload = pack.payloads[game];
        const payloadFile = IMPORTED_LINK_ANIM_EXPECTED_PAYLOAD_FILE[game];
        const vromFile = IMPORTED_LINK_ANIM_EXPECTED_VROM_FILE[game];

        await atomicWriteFile(payloadFile, payload);
        await atomicWriteFile(vromFile, `${hex(pack.vroms[game])}\n`);
    }

    await atomicWriteFile(
        IMPORTED_LINK_ANIM_EXPECTED_MANIFEST_FILE,
        `${JSON.stringify(manifest, null, 2)}\n`
    );
}

async function emitImportedAnimationsHeader(roms: DecompressedRoms, pack: ImportedAnimationPack) {
    const lines: string[] = [];
    const ootLinkAnimKey = findFileKey('oot', 'link_animetion');
    const mmLinkAnimKey = findFileKey('mm', 'link_animetion');
    const ootLinkAnimIndex = FILES_TO_INDEX.oot[ootLinkAnimKey];
    const mmLinkAnimIndex = FILES_TO_INDEX.mm[mmLinkAnimKey];
    const ootLinkAnimDma = new DmaData(roms.oot.dma).read(ootLinkAnimIndex);
    const mmLinkAnimDma = new DmaData(roms.mm.dma).read(mmLinkAnimIndex);

    lines.push('#ifndef COMBO_IMPORTED_ANIMATIONS_H');
    lines.push('#define COMBO_IMPORTED_ANIMATIONS_H');
    lines.push('');
    lines.push('#include <combo.h>');
    lines.push('');
    lines.push(`#define COMBO_IMPORTED_LINK_ANIM_SEGMENT 0x${IMPORTED_LINK_ANIM_SEGMENT.toString(16).toUpperCase()}`);
    lines.push(`#define COMBO_IMPORTED_LINK_ANIM_FRAME_SIZE 0x${PLAYER_ANIM_FRAME_SIZE.toString(16).toUpperCase()}`);
    lines.push(`#define COMBO_LINK_ANIMETION_OOT_VROM 0x${ootLinkAnimDma.virtStart.toString(16).toUpperCase()}`);
    lines.push(`#define COMBO_LINK_ANIMETION_MM_VROM 0x${mmLinkAnimDma.virtStart.toString(16).toUpperCase()}`);
    lines.push(`#define COMBO_IMPORTED_LINK_ANIM_OOT_VROM 0x${pack.vroms.oot.toString(16).toUpperCase()}`);
    lines.push(`#define COMBO_IMPORTED_LINK_ANIM_MM_VROM 0x${pack.vroms.mm.toString(16).toUpperCase()}`);
    lines.push(`#define COMBO_IMPORTED_LINK_ANIM_OOT_FILE_SIZE 0x${pack.payloads.oot.length.toString(16).toUpperCase()}`);
    lines.push(`#define COMBO_IMPORTED_LINK_ANIM_MM_FILE_SIZE 0x${pack.payloads.mm.length.toString(16).toUpperCase()}`);
    lines.push(`#define COMBO_IMPORTED_LINK_ANIM_OOT_UNPADDED_SIZE 0x${pack.unpaddedPayloadSizes.oot.toString(16).toUpperCase()}`);
    lines.push(`#define COMBO_IMPORTED_LINK_ANIM_MM_UNPADDED_SIZE 0x${pack.unpaddedPayloadSizes.mm.toString(16).toUpperCase()}`);
    lines.push('');

    lines.push('#define COMBO_CUSTOM_DMA_FILE_LIST_OOT(_) \\');
    if (pack.payloads.oot.length > 0) {
        lines.push('    _(COMBO_IMPORTED_LINK_ANIM_OOT_VROM, COMBO_IMPORTED_LINK_ANIM_OOT_FILE_SIZE)');
    } else {
        lines.push('    /* empty */');
    }
    lines.push('');

    lines.push('#define COMBO_CUSTOM_DMA_FILE_LIST_MM(_) \\');
    if (pack.payloads.mm.length > 0) {
        lines.push('    _(COMBO_IMPORTED_LINK_ANIM_MM_VROM, COMBO_IMPORTED_LINK_ANIM_MM_FILE_SIZE)');
    } else {
        lines.push('    /* empty */');
    }
    lines.push('');

    for (const entry of pack.entries) {
        const base = defineBaseForAnimation(entry.def.name);
        const headerSegmented = (0x04 << 24) | entry.customHeaderOffset;

        lines.push(`#define ${base}_FRAMECOUNT ${entry.runtimeFrameCount}`);
        lines.push(`#define ${base}_FRAMESIZE 0x${entry.frameSize.toString(16).toUpperCase()}`);
        lines.push(`#define ${base}_TOTALSIZE 0x${entry.frameData.length.toString(16).toUpperCase()}`);
        lines.push(`#define ${base}_CUSTOM_OFFSET 0x${entry.customFrameDataOffset.toString(16).toUpperCase()}`);
        lines.push(`#define ${base}_HEADER_OFFSET 0x${entry.customHeaderOffset.toString(16).toUpperCase()}`);
        lines.push(`#define ${base}_HEADER_SEGMENTED 0x${headerSegmented.toString(16).toUpperCase()}`);
        lines.push(`#define ${base}_DST_${entry.dstGame.toUpperCase()} 1`);
        lines.push('');
    }

    pushAnimationListMacro(
        lines,
        'COMBO_IMPORTED_LINK_ANIMATION_LIST_OOT',
        pack.entries.filter((entry) => entry.dstGame === 'oot')
    );
    lines.push('');

    pushAnimationListMacro(
        lines,
        'COMBO_IMPORTED_LINK_ANIMATION_LIST_MM',
        pack.entries.filter((entry) => entry.dstGame === 'mm')
    );
    lines.push('');

    lines.push('#if defined(GAME_OOT)');
    lines.push('# define COMBO_LINK_ANIMETION_VROM COMBO_LINK_ANIMETION_OOT_VROM');
    lines.push('# define COMBO_IMPORTED_LINK_ANIM_VROM COMBO_IMPORTED_LINK_ANIM_OOT_VROM');
    lines.push('# define COMBO_IMPORTED_LINK_ANIM_FILE_SIZE COMBO_IMPORTED_LINK_ANIM_OOT_FILE_SIZE');
    lines.push('# define COMBO_IMPORTED_LINK_ANIM_UNPADDED_SIZE COMBO_IMPORTED_LINK_ANIM_OOT_UNPADDED_SIZE');
    lines.push('# define COMBO_IMPORTED_LINK_ANIMATION_LIST(_) COMBO_IMPORTED_LINK_ANIMATION_LIST_OOT(_)');
    lines.push('# define COMBO_CUSTOM_DMA_FILE_LIST(_) COMBO_CUSTOM_DMA_FILE_LIST_OOT(_)');
    lines.push('#elif defined(GAME_MM)');
    lines.push('# define COMBO_LINK_ANIMETION_VROM COMBO_LINK_ANIMETION_MM_VROM');
    lines.push('# define COMBO_IMPORTED_LINK_ANIM_VROM COMBO_IMPORTED_LINK_ANIM_MM_VROM');
    lines.push('# define COMBO_IMPORTED_LINK_ANIM_FILE_SIZE COMBO_IMPORTED_LINK_ANIM_MM_FILE_SIZE');
    lines.push('# define COMBO_IMPORTED_LINK_ANIM_UNPADDED_SIZE COMBO_IMPORTED_LINK_ANIM_MM_UNPADDED_SIZE');
    lines.push('# define COMBO_IMPORTED_LINK_ANIMATION_LIST(_) COMBO_IMPORTED_LINK_ANIMATION_LIST_MM(_)');
    lines.push('# define COMBO_CUSTOM_DMA_FILE_LIST(_) COMBO_CUSTOM_DMA_FILE_LIST_MM(_)');
    lines.push('#else');
    lines.push('# define COMBO_IMPORTED_LINK_ANIM_FILE_SIZE 0');
    lines.push('# define COMBO_IMPORTED_LINK_ANIM_UNPADDED_SIZE 0');
    lines.push('# define COMBO_IMPORTED_LINK_ANIMATION_LIST(_)');
    lines.push('# define COMBO_CUSTOM_DMA_FILE_LIST(_)');
    lines.push('#endif');
    lines.push('');
    lines.push('#endif');
    lines.push('');

    await fs.mkdir(BUILD_INCLUDE_DIR, { recursive: true });
    await atomicWriteFile(path.join(BUILD_INCLUDE_DIR, 'imported_animations.h'), lines.join('\n'));
}

export async function patchAnimationPorts(roms: DecompressedRoms, patch: Patchfile) {
    const defs = await readYaml();

    if (!defs.length) {
        await removeGeneratedImportedAnimationArtifacts();
        return;
    }

    const pack = buildImportedAnimationPack(roms, defs);

    await emitExpectedImportedAnimationPayloads(pack);

    for (const game of ['oot', 'mm'] as const) {
        assertRuntimeFrameDmasAreInsideImportedFile(game, pack);
    }

    for (const game of ['oot', 'mm'] as const) {
        const payload = pack.payloads[game];
        const fileName = IMPORTED_LINK_ANIM_FILE[game];
        const vrom = pack.vroms[game];

        if (payload.length === 0) {
            continue;
        }

        assertNewFileVromIsDmaFriendly(roms, game, fileName, vrom, payload.length);
        patch.addNewFile({
            name: fileName,
            vrom,
            data: payload,
            compressed: false,
        });
    }
}

export async function setupAnimationPorts() {
    const defs = await readYaml();

    if (!defs.length) {
        await removeGeneratedImportedAnimationArtifacts();
        return;
    }

    const monitor = new Monitor({});
    const [oot, mm] = await Promise.all([
        readFileUint8('../../roms/oot.z64'),
        readFileUint8('../../roms/mm.z64'),
    ]);
    const roms = await decompressGames(monitor, { oot, mm });
    const pack = buildImportedAnimationPack(roms, defs);
    const plans = createGameplayKeepAppendPlans(roms);

    await emitExpectedImportedAnimationPayloads(pack);

    for (const entry of pack.entries) {
        const plan = plans[entry.dstGame];

        planAnimationSymbol(plan, entry);
        populateHeaderInBaseData(plan, entry);
    }

    await writeGameplayKeepPlan(plans.oot);
    await writeGameplayKeepPlan(plans.mm);
    await emitImportedAnimationsHeader(roms, pack);
}