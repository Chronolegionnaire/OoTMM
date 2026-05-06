import { promises as fs } from 'fs';
import path from 'path';
import YAML from 'yaml';

import { FILES as GAME_FILES, Monitor } from '@ootmm/core';

import { decompressGames, DecompressedRoms } from '../decompress.ts';
import { DmaData } from '../dma.ts';
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

type ImportedAnimation = {
    def: AnimationDef;
    srcGame: Game;
    dstGame: Game;
    frameCount: number;
    frameDataOffset: number;
    frameSize: number;
    headerOffset: number;
};

type ImportedAnimationPack = {
    entries: ImportedAnimation[];
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
const BUILD_INCLUDE_DIR = path.join(GENERATOR_ROOT, 'build/include/combo');
const BUILD_ASSETS_DIR = path.join(GENERATOR_ROOT, 'build/assets');

const PLAYER_LIMB_COUNT = 0x16;
const VEC3S_SIZE = 6;
const PLAYER_ANIM_FRAME_SIZE = PLAYER_LIMB_COUNT * VEC3S_SIZE + 2;
const IMPORTED_LINK_ANIM_SEGMENT = 0x08;

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

function hex(n: number, width = 0): string {
    const s = (n >>> 0).toString(16).toUpperCase();
    return `0x${width ? s.padStart(width, '0') : s}`;
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
    const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
    let off = 0;

    for (const part of parts) {
        out.set(part, off);
        off += part.length;
    }

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

function parseSourcePlayerAnimHeader(buf: Uint8Array, off: number): SourcePlayerAnimHeader {
    assertRange('gameplay_keep', buf, off, 8);

    return {
        frameCount: readU16BE(buf, off + 0x00),
        frameDataSegmented: readU32BE(buf, off + 0x04),
    };
}

function buildImportedLinkAnimHeader(dstGame: Game, frameCount: number, frameSize: number): Uint8Array {
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
    }

    writeU32BE(out, 0x04, IMPORTED_LINK_ANIM_SEGMENT << 24);

    return out;
}

function buildImportedAnimation(roms: DecompressedRoms, def: AnimationDef): ImportedAnimation {
    const srcGame = def.home_game;
    const dstGame = otherGame(srcGame);
    const frameDataOffset = parseNum(def.frame_data_offset, `${def.name}.frame_data_offset`);
    const headerOffset = parseNum(def.header_offset, `${def.name}.header_offset`);
    const srcGameplayKeep = getFileFromRom(roms, srcGame, 'objects/gameplay_keep');
    const srcLinkAnim = getFileFromRom(roms, srcGame, 'link_animetion');
    const sourceHeader = parseSourcePlayerAnimHeader(srcGameplayKeep, headerOffset);
    const sourceFrameDataOffset = sourceHeader.frameDataSegmented & 0x00ffffff;
    const frameCount =
        def.frame_count === undefined
            ? sourceHeader.frameCount
            : parseNum(def.frame_count, `${def.name}.frame_count`);
    const frameDataSize =
        def.frame_data_size === undefined
            ? sourceHeader.frameCount * PLAYER_ANIM_FRAME_SIZE
            : parseNum(def.frame_data_size, `${def.name}.frame_data_size`);
    const expectedFrameDataSize = sourceHeader.frameCount * PLAYER_ANIM_FRAME_SIZE;

    if (sourceHeader.frameCount <= 0) {
        throw new Error(`${def.name}: invalid frame count ${sourceHeader.frameCount}`);
    }

    if (sourceFrameDataOffset !== frameDataOffset) {
        throw new Error(
            `${def.name}: header points to ${hex(sourceFrameDataOffset)}, ` +
            `but YAML frame_data_offset is ${hex(frameDataOffset)}`
        );
    }

    if (frameCount !== sourceHeader.frameCount) {
        throw new Error(
            `${def.name}: direct foreign DMA does not support resampling; ` +
            `frame_count ${frameCount} must match source frame count ${sourceHeader.frameCount}`
        );
    }

    if (frameDataSize !== expectedFrameDataSize) {
        throw new Error(
            `${def.name}: direct foreign DMA requires full contiguous frame data; ` +
            `frame_data_size ${hex(frameDataSize)} must equal ${hex(expectedFrameDataSize)}`
        );
    }

    assertRange(`${srcGame}:link_animetion`, srcLinkAnim, frameDataOffset, frameDataSize);

    return {
        def,
        srcGame,
        dstGame,
        frameCount,
        frameDataOffset,
        frameSize: PLAYER_ANIM_FRAME_SIZE,
        headerOffset: 0,
    };
}

function buildImportedAnimationPack(roms: DecompressedRoms, defs: AnimationDef[]): ImportedAnimationPack {
    return {
        entries: defs.map((def) => buildImportedAnimation(roms, def)),
    };
}

function createGameplayKeepAppendPlans(roms: DecompressedRoms): Record<Game, GameplayKeepAppendPlan> {
    return {
        oot: {
            game: 'oot',
            baseData: getFileFromRom(roms, 'oot', 'objects/gameplay_keep'),
            parts: [],
            size: getFileFromRom(roms, 'oot', 'objects/gameplay_keep').length,
            xmlUpdates: [],
        },
        mm: {
            game: 'mm',
            baseData: getFileFromRom(roms, 'mm', 'objects/gameplay_keep'),
            parts: [],
            size: getFileFromRom(roms, 'mm', 'objects/gameplay_keep').length,
            xmlUpdates: [],
        },
    };
}

function appendToGameplayKeepPlan(plan: GameplayKeepAppendPlan, payload: Uint8Array, alignment: number): number {
    const outOffset = align(plan.size, alignment);
    const padSize = outOffset - plan.size;

    if (padSize !== 0) {
        plan.parts.push(new Uint8Array(padSize));
    }

    plan.parts.push(payload);
    plan.size = outOffset + payload.length;

    return outOffset;
}

function planAnimationSymbol(plan: GameplayKeepAppendPlan, entry: ImportedAnimation) {
    entry.headerOffset = appendToGameplayKeepPlan(
        plan,
        buildImportedLinkAnimHeader(entry.dstGame, entry.frameCount, entry.frameSize),
        0x8
    );

    plan.xmlUpdates.push({
        name: entry.def.name,
        offset: entry.headerOffset,
    });
}

function planAnimationSymbols(roms: DecompressedRoms, pack: ImportedAnimationPack): Record<Game, GameplayKeepAppendPlan> {
    const plans = createGameplayKeepAppendPlans(roms);

    for (const entry of pack.entries) {
        planAnimationSymbol(plans[entry.dstGame], entry);
    }

    return plans;
}

async function writeGameplayKeepPlan(plan: GameplayKeepAppendPlan) {
    const out = concatBuffers(plan.baseData, ...plan.parts);

    await atomicWriteFile(FILES[plan.game].gameplayKeepBin, out);

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
    const offsetText = hex(offset);
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

    const marker = '    </File>';
    const pos = updatedXml.lastIndexOf(marker);

    if (pos < 0) {
        throw new Error(`${xmlFile}: missing ${marker}`);
    }

    const line = `        <PlayerAnimation Name="${escapeXmlAttr(name)}" Offset="${offsetText}"/>\n`;

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

function foreignFrameVromExpr(entry: ImportedAnimation): string {
    const sourceVromMacro =
        entry.srcGame === 'oot'
            ? 'COMBO_LINK_ANIMETION_OOT_VROM'
            : 'COMBO_LINK_ANIMETION_MM_VROM';

    return `((${sourceVromMacro} + ${hex(entry.frameDataOffset)}) | VROM_FOREIGN_OFFSET)`;
}

function pushAnimationListMacro(lines: string[], macroName: string, entries: ImportedAnimation[]) {
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
        const continuation = i + 1 === entries.length ? '' : ` ${slash}`;

        lines.push(
            `    _(${symbol}, ${base}_HEADER_SEGMENTED, ${base}_FRAME_VROM, ${base}_FRAMECOUNT, ${base}_FRAMESIZE)${continuation}`
        );
    }
}

async function emitImportedAnimationsHeader(roms: DecompressedRoms, pack: ImportedAnimationPack) {
    const ootLinkAnimIndex = FILES_TO_INDEX.oot[findFileKey('oot', 'link_animetion')];
    const mmLinkAnimIndex = FILES_TO_INDEX.mm[findFileKey('mm', 'link_animetion')];
    const ootLinkAnimDma = new DmaData(roms.oot.dma).read(ootLinkAnimIndex);
    const mmLinkAnimDma = new DmaData(roms.mm.dma).read(mmLinkAnimIndex);
    const lines: string[] = [];

    lines.push('#ifndef COMBO_IMPORTED_ANIMATIONS_H');
    lines.push('#define COMBO_IMPORTED_ANIMATIONS_H');
    lines.push('');
    lines.push('#include <combo.h>');
    lines.push('');
    lines.push(`#define COMBO_IMPORTED_LINK_ANIM_SEGMENT ${hex(IMPORTED_LINK_ANIM_SEGMENT)}`);
    lines.push(`#define COMBO_IMPORTED_LINK_ANIM_FRAME_SIZE ${hex(PLAYER_ANIM_FRAME_SIZE)}`);
    lines.push(`#define COMBO_LINK_ANIMETION_OOT_VROM ${hex(ootLinkAnimDma.virtStart)}`);
    lines.push(`#define COMBO_LINK_ANIMETION_MM_VROM ${hex(mmLinkAnimDma.virtStart)}`);
    lines.push('');
    lines.push('#define COMBO_CUSTOM_DMA_FILE_LIST_OOT(_)');
    lines.push('#define COMBO_CUSTOM_DMA_FILE_LIST_MM(_)');
    lines.push('');

    for (const entry of pack.entries) {
        const base = defineBaseForAnimation(entry.def.name);
        const headerSegmented = (0x04 << 24) | entry.headerOffset;
        const totalSize = entry.frameCount * entry.frameSize;

        lines.push(`#define ${base}_FRAMECOUNT ${entry.frameCount}`);
        lines.push(`#define ${base}_FRAMESIZE ${hex(entry.frameSize)}`);
        lines.push(`#define ${base}_TOTALSIZE ${hex(totalSize)}`);
        lines.push(`#define ${base}_SOURCE_OFFSET ${hex(entry.frameDataOffset)}`);
        lines.push(`#define ${base}_FRAME_VROM ${foreignFrameVromExpr(entry)}`);
        lines.push(`#define ${base}_HEADER_OFFSET ${hex(entry.headerOffset)}`);
        lines.push(`#define ${base}_HEADER_SEGMENTED ${hex(headerSegmented)}`);
        lines.push(`#define ${base}_SRC_${entry.srcGame.toUpperCase()} 1`);
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
    lines.push('# define COMBO_IMPORTED_LINK_ANIMATION_LIST(_) COMBO_IMPORTED_LINK_ANIMATION_LIST_OOT(_)');
    lines.push('# define COMBO_CUSTOM_DMA_FILE_LIST(_) COMBO_CUSTOM_DMA_FILE_LIST_OOT(_)');
    lines.push('#elif defined(GAME_MM)');
    lines.push('# define COMBO_LINK_ANIMETION_VROM COMBO_LINK_ANIMETION_MM_VROM');
    lines.push('# define COMBO_IMPORTED_LINK_ANIMATION_LIST(_) COMBO_IMPORTED_LINK_ANIMATION_LIST_MM(_)');
    lines.push('# define COMBO_CUSTOM_DMA_FILE_LIST(_) COMBO_CUSTOM_DMA_FILE_LIST_MM(_)');
    lines.push('#else');
    lines.push('# define COMBO_IMPORTED_LINK_ANIMATION_LIST(_)');
    lines.push('# define COMBO_CUSTOM_DMA_FILE_LIST(_)');
    lines.push('#endif');
    lines.push('');
    lines.push('#endif');
    lines.push('');

    await atomicWriteFile(path.join(BUILD_INCLUDE_DIR, 'imported_animations.h'), lines.join('\n'));
}

export async function patchAnimationPorts(roms: DecompressedRoms, _patch?: unknown) {
    const defs = await readYaml();

    if (!defs.length) {
        await removeGeneratedImportedAnimationArtifacts();
        return;
    }

    const pack = buildImportedAnimationPack(roms, defs);

    planAnimationSymbols(roms, pack);
    await emitImportedAnimationsHeader(roms, pack);
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
    const plans = planAnimationSymbols(roms, pack);

    await writeGameplayKeepPlan(plans.oot);
    await writeGameplayKeepPlan(plans.mm);
    await emitImportedAnimationsHeader(roms, pack);
}