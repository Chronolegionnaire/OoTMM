import { bufReadU32BE, bufWriteU32BE } from '../util/buffer';
import { OOT_LINK_ADULT_OFFSETS, OOT_LINK_CHILD_OFFSETS } from './model';
import { ObjectEditor } from '../custom/object-editor';
import { PlayerModelGraphCompactor } from './player-model-compactor';
import { crossGamePieceDefaultLimb, isCrossGamePlayerPiece } from './player-model-compat.ts';
import { readPlayerSkeletonTranslations, retargetPlayerModelBindPose, type RetargetExtraList } from './player-model-retarget';

export type MmModelAge = 'adult' | 'child';

type ModelPiece = {
    lut: number;
    vanilla: number;
};

export type MmModelCompactionInfo = {
    originalSize: number;
    usedSize: number;
    replacedPieces: string[];
};

export type PreparedMmModel = {
    data: Uint8Array;
    compaction?: MmModelCompactionInfo;
    bodyOnlyCrossGameDiagnostic?: boolean;
};

const BASE_OFFSET = 0x06000000;
const LUT_START = 0x00005000;
const LUT_END = 0x00005800;
const HIERARCHY = 0x06005420;
const MM_CODE_VRAM = 0x800a5ac0;
const MANIFEST_MAGIC = '!PlayAsManifest0';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const MM_LINK_OFFSETS = {
    LUT_DL_WAIST: 0x06005110,
    LUT_DL_RTHIGH: 0x06005118,
    LUT_DL_RSHIN: 0x06005120,
    LUT_DL_RFOOT: 0x06005128,
    LUT_DL_LTHIGH: 0x06005130,
    LUT_DL_LSHIN: 0x06005138,
    LUT_DL_LFOOT: 0x06005140,
    LUT_DL_HEAD: 0x06005148,
    LUT_DL_HAT: 0x06005150,
    LUT_DL_COLLAR: 0x06005158,
    LUT_DL_LSHOULDER: 0x06005160,
    LUT_DL_LFOREARM: 0x06005168,
    LUT_DL_RSHOULDER: 0x06005170,
    LUT_DL_RFOREARM: 0x06005178,
    LUT_DL_TORSO: 0x06005180,
    LUT_DL_LHAND: 0x06005188,
    LUT_DL_LFIST: 0x06005190,
    LUT_DL_LHAND_BOTTLE: 0x06005198,
    LUT_DL_RHAND: 0x060051a0,
    LUT_DL_RFIST: 0x060051a8,
    LUT_DL_SHIELD_MIRROR_FACE: 0x060051b0,
    LUT_DL_SHIELD_MIRROR: 0x060051b8,
    LUT_DL_BLADE_GFSWORD_RAW: 0x060051c0,
    LUT_DL_SHEATH_GILDED: 0x060051c8,
    LUT_DL_HILT_GILDED: 0x060051d0,
    LUT_DL_BLADE_GILDED: 0x060051d8,
    LUT_DL_SHEATH_RAZOR: 0x060051e0,
    LUT_DL_SHIELD_HERO: 0x060051e8,
    LUT_DL_SHEATH_KOKIRI: 0x060051f0,
    LUT_DL_HOOKSHOT: 0x060051f8,
    LUT_DL_BOW: 0x06005200,
    LUT_DL_HOOKSHOT_SPIKE: 0x06005208,
    LUT_DL_OCARINA_TIME: 0x06005210,
    LUT_DL_FPS_RIGHT_ARM: 0x06005218,
    LUT_DL_BOW_STRING: 0x06005220,
    LUT_DL_SHIELD_HERO_BACK: 0x06005238,
    LUT_DL_SHIELD_MIRROR_COMBINED: 0x06005250,
    LUT_DL_SHIELD_MIRROR_BACK: 0x06005268,
    LUT_DL_SWORD_KOKIRI_SHEATHED: 0x06005290,
    LUT_DL_SWORD_RAZOR_SHEATHED: 0x060052b8,
    LUT_DL_SWORD_GILDED_SHEATHED: 0x060052e0,
    LUT_DL_LFIST_KOKIRI_SWORD: 0x06005300,
    LUT_DL_LFIST_RAZOR_SWORD: 0x06005320,
    LUT_DL_LFIST_GILDED_SWORD: 0x06005340,
    LUT_DL_LFIST_GFSWORD_SWORD: 0x06005358,
    LUT_DL_BLADE_GFSWORD: 0x06005360,
    LUT_DL_RFIST_SHIELD_HERO: 0x06005378,
    LUT_DL_RFIST_SHIELD_MIRROR: 0x06005390,
    LUT_DL_RFIST_HOOKSHOT: 0x060053a8,
    LUT_DL_RFIST_BOW: 0x060053c0,
    LUT_DL_RHAND_OCARINA_TIME: 0x060053d8,
    LUT_DL_FPS_RARM_HOOKSHOT: 0x060053f0,
    LUT_DL_FPS_RARM_BOW: 0x06005408,
    DL_DF_COMMAND: 0x06005410,
    LUT_DL_DF_COMMAND: 0x06005418,
    HIERARCHY,
};

const MM_PIECES: Record<string, ModelPiece> = {
    'Limb 1': { lut: MM_LINK_OFFSETS.LUT_DL_WAIST, vanilla: 0x00bdb0 },
    'Limb 3': { lut: MM_LINK_OFFSETS.LUT_DL_RTHIGH, vanilla: 0x00b360 },
    'Limb 4': { lut: MM_LINK_OFFSETS.LUT_DL_RSHIN, vanilla: 0x00b538 },
    'Limb 5': { lut: MM_LINK_OFFSETS.LUT_DL_RFOOT, vanilla: 0x00b778 },
    'Limb 6': { lut: MM_LINK_OFFSETS.LUT_DL_LTHIGH, vanilla: 0x00b888 },
    'Limb 7': { lut: MM_LINK_OFFSETS.LUT_DL_LSHIN, vanilla: 0x00ba60 },
    'Limb 8': { lut: MM_LINK_OFFSETS.LUT_DL_LFOOT, vanilla: 0x00bca0 },
    'Limb 10': { lut: MM_LINK_OFFSETS.LUT_DL_HEAD, vanilla: 0x00c3e8 },
    'Limb 11': { lut: MM_LINK_OFFSETS.LUT_DL_HAT, vanilla: 0x00caa8 },
    'Limb 12': { lut: MM_LINK_OFFSETS.LUT_DL_COLLAR, vanilla: 0x00bf88 },
    'Limb 13': { lut: MM_LINK_OFFSETS.LUT_DL_LSHOULDER, vanilla: 0x00d1b0 },
    'Limb 14': { lut: MM_LINK_OFFSETS.LUT_DL_LFOREARM, vanilla: 0x00e1c8 },
    'Limb 15': { lut: MM_LINK_OFFSETS.LUT_DL_LHAND, vanilla: 0x00f1d8 },
    'Limb 16': { lut: MM_LINK_OFFSETS.LUT_DL_RSHOULDER, vanilla: 0x00cce0 },
    'Limb 17': { lut: MM_LINK_OFFSETS.LUT_DL_RFOREARM, vanilla: 0x00cf08 },
    'Limb 18': { lut: MM_LINK_OFFSETS.LUT_DL_RHAND, vanilla: 0x00f998 },
    'Limb 20': { lut: MM_LINK_OFFSETS.LUT_DL_TORSO, vanilla: 0x00c048 },
    'Fist.L': { lut: MM_LINK_OFFSETS.LUT_DL_LFIST, vanilla: 0x00f548 },
    'Fist.R': { lut: MM_LINK_OFFSETS.LUT_DL_RFIST, vanilla: 0x00fd08 },
    'Bottle.Hand.L': { lut: MM_LINK_OFFSETS.LUT_DL_LHAND_BOTTLE, vanilla: 0x01dfa8 },
    'Shield.2.Face': { lut: MM_LINK_OFFSETS.LUT_DL_SHIELD_MIRROR_FACE, vanilla: 0x015f98 },
    'Shield.2': { lut: MM_LINK_OFFSETS.LUT_DL_SHIELD_MIRROR, vanilla: 0x016480 },
    'Sword.4': { lut: MM_LINK_OFFSETS.LUT_DL_BLADE_GFSWORD_RAW, vanilla: 0x016898 },
    'Sheath.3': { lut: MM_LINK_OFFSETS.LUT_DL_SHEATH_GILDED, vanilla: 0x016b80 },
    'Hilt.3': { lut: MM_LINK_OFFSETS.LUT_DL_HILT_GILDED, vanilla: 0x017058 },
    'Blade.3': { lut: MM_LINK_OFFSETS.LUT_DL_BLADE_GILDED, vanilla: 0x017310 },
    'Sheath.2': { lut: MM_LINK_OFFSETS.LUT_DL_SHEATH_RAZOR, vanilla: 0x017338 },
    'Shield.1': { lut: MM_LINK_OFFSETS.LUT_DL_SHIELD_HERO, vanilla: 0x017458 },
    'Sheath.1': { lut: MM_LINK_OFFSETS.LUT_DL_SHEATH_KOKIRI, vanilla: 0x017700 },
    'Hookshot': { lut: MM_LINK_OFFSETS.LUT_DL_HOOKSHOT, vanilla: 0x017858 },
    'Bow': { lut: MM_LINK_OFFSETS.LUT_DL_BOW, vanilla: 0x0181c8 },
    'Hookshot.Spike': { lut: MM_LINK_OFFSETS.LUT_DL_HOOKSHOT_SPIKE, vanilla: 0x01d960 },
    'Ocarina.2': { lut: MM_LINK_OFFSETS.LUT_DL_OCARINA_TIME, vanilla: 0x010448 },
    'FPS.Forearm.R': { lut: MM_LINK_OFFSETS.LUT_DL_FPS_RIGHT_ARM, vanilla: 0x017ec0 },
    'Bow.String': { lut: MM_LINK_OFFSETS.LUT_DL_BOW_STRING, vanilla: 0x017818 },
};

const OLD_TO_NEW_PIPELINE: Record<string, string> = {
    'Limb 1': 'Waist',
    'Limb 3': 'Thigh.R',
    'Limb 4': 'Shin.R',
    'Limb 5': 'Foot.R',
    'Limb 6': 'Thigh.L',
    'Limb 7': 'Shin.L',
    'Limb 8': 'Foot.L',
    'Limb 10': 'Head',
    'Limb 11': 'Hat',
    'Limb 12': 'Collar',
    'Limb 13': 'Shoulder.L',
    'Limb 14': 'Forearm.L',
    'Limb 15': 'Hand.L',
    'Limb 16': 'Shoulder.R',
    'Limb 17': 'Forearm.R',
    'Limb 18': 'Hand.R',
    'Limb 20': 'Torso',
};

function scan(data: Uint8Array, value: string) {
    const bytes = encoder.encode(value);

    for (let i = 0; i + bytes.length <= data.length; ++i) {
        let found = true;

        for (let j = 0; j < bytes.length; ++j) {
            if (data[i + j] !== bytes[j]) {
                found = false;
                break;
            }
        }

        if (found) {
            return i;
        }
    }

    return -1;
}

function asciiEquals(data: Uint8Array, offset: number, value: string) {
    const bytes = encoder.encode(value);

    if (offset < 0 || offset + bytes.length > data.length) {
        return false;
    }

    for (let i = 0; i < bytes.length; ++i) {
        if (data[offset + i] !== bytes[i]) {
            return false;
        }
    }

    return true;
}

function parseManifest(data: Uint8Array) {
    const start = scan(data, MANIFEST_MAGIC);

    if (start === -1) {
        throw new Error('No MM PlayAs manifest found');
    }

    const header = start + MANIFEST_MAGIC.length;

    if (header + 2 > data.length || data[header] !== 0x00) {
        throw new Error('Invalid MM PlayAs manifest');
    }

    const count = data[header + 1];
    const entries = new Map<string, number>();
    let offset = header + 2;

    for (let i = 0; i < count; ++i) {
        let end = offset;

        while (end < data.length && data[end] !== 0x00) {
            ++end;
        }

        if (end >= data.length || end + 5 > data.length) {
            throw new Error('Invalid MM PlayAs manifest entry');
        }

        const name = decoder.decode(data.subarray(offset, end));
        const pointer = bufReadU32BE(data, end + 1) & 0x00ffffff;
        entries.set(name, pointer);
        offset = end + 5;
    }

    return {
        start,
        entries,
    };
}

function findHierarchy(data: Uint8Array) {
    for (let i = 4; i + 4 < data.length; i += 4) {
        if (data[i] !== 0x06) {
            continue;
        }

        const possible = bufReadU32BE(data, i) & 0x00ffffff;

        if (possible >= data.length) {
            continue;
        }

        const possible2 = ((data[i - 3] << 16) | (data[i - 2] << 8) | data[i - 1]) >>> 0;
        const diff = possible - possible2;

        if (diff !== 0x0c && diff !== 0x10) {
            continue;
        }

        let pos = i + 4;
        let count = 1;

        while (pos < data.length && data[pos] === 0x06) {
            pos += 4;
            count++;
        }

        if (pos < data.length && data[pos] === count) {
            return pos - 4;
        }
    }

    throw new Error('No hierarchy found in MM model');
}

function insertData(data: Uint8Array, offset: number, insert: Uint8Array) {
    const out = new Uint8Array(data.length + insert.length);
    out.set(data.subarray(0, offset));
    out.set(insert, offset);
    out.set(data.subarray(offset), offset + insert.length);
    return out;
}

function writeCall(data: Uint8Array, offset: number, target: number) {
    data[offset + 0] = 0xde;
    data[offset + 1] = 0x01;
    data[offset + 2] = 0x00;
    data[offset + 3] = 0x00;
    bufWriteU32BE(data, offset + 4, target);
}

function writeMatrix(data: Uint8Array, offset: number, target: number) {
    data[offset + 0] = 0xda;
    data[offset + 1] = 0x38;
    data[offset + 2] = 0x00;
    data[offset + 3] = 0x00;
    bufWriteU32BE(data, offset + 4, target);
}

function writePopMatrix(data: Uint8Array, offset: number) {
    data[offset + 0] = 0xd8;
    data[offset + 1] = 0x38;
    data[offset + 2] = 0x00;
    data[offset + 3] = 0x02;
    data[offset + 4] = 0x00;
    data[offset + 5] = 0x00;
    data[offset + 6] = 0x00;
    data[offset + 7] = 0x40;
}

function writeDf(data: Uint8Array, offset: number) {
    data[offset + 0] = 0xdf;
    for (let i = 1; i < 8; ++i) {
        data[offset + i] = 0x00;
    }
}

function readMmCodeU32(code: Uint8Array, address: number) {
    const offset = address - MM_CODE_VRAM;

    if (offset < 0 || offset + 4 > code.length) {
        throw new Error(`MM code address out of range: 0x${address.toString(16)}`);
    }

    return bufReadU32BE(code, offset);
}

function findMatrixAddress(data: Uint8Array, address: number, seen = new Set<number>()): number | null {
    if ((address >>> 24) !== 0x06) {
        return null;
    }

    const offset = address & 0x00ffffff;

    if (offset >= data.length || seen.has(offset)) {
        return null;
    }

    seen.add(offset);

    for (let i = offset; i + 8 <= data.length; i += 8) {
        const op = data[i];
        const target = bufReadU32BE(data, i + 4);

        if (op === 0xda && (target >>> 24) === 0x06) {
            const matrix = target & 0x00ffffff;

            if (matrix + 0x40 <= data.length) {
                return matrix;
            }
        }

        if (op === 0xde) {
            const nested = findMatrixAddress(data, target, seen);

            if (nested !== null) {
                return nested;
            }
        }

        if (op === 0xdf) {
            break;
        }
    }

    return null;
}

function copyMatrixFromTable(data: Uint8Array, vanilla: Uint8Array, code: Uint8Array, tableAddress: number, outputOffset: number) {
    const list = readMmCodeU32(code, tableAddress);
    const matrix = findMatrixAddress(vanilla, list);

    if (matrix === null) {
        throw new Error(`Failed to find MM model matrix for table 0x${tableAddress.toString(16)}`);
    }

    data.set(vanilla.subarray(matrix, matrix + 0x40), outputOffset);
}

function writePool(data: Uint8Array, age: MmModelAge, vanilla: Uint8Array, code: Uint8Array, pieces: Map<string, number>) {
    data.fill(0x00, LUT_START, LUT_END);

    data.set(encoder.encode('MODLOADER64'), 0x5000);
    data[0x500b] = age === 'adult' ? 0x68 : 0x04;
    bufWriteU32BE(data, 0x500c, HIERARCHY);

    copyMatrixFromTable(data, vanilla, code, 0x801c00b4, 0x5010);
    copyMatrixFromTable(data, vanilla, code, 0x801c00ac, 0x5050);
    copyMatrixFromTable(data, vanilla, code, 0x801c00bc, 0x5090);
    copyMatrixFromTable(data, vanilla, code, 0x801c00c4, 0x50d0);

    for (const [name, piece] of Object.entries(MM_PIECES)) {
        const target = pieces.get(name);

        if (target === undefined) {
            throw new Error(`Failed to resolve MM model piece ${name}`);
        }

        writeCall(data, piece.lut - BASE_OFFSET, target);
    }

    writeMatrix(data, 0x5228, 0x06005050);
    writeCall(data, 0x5230, MM_LINK_OFFSETS.LUT_DL_SHIELD_HERO);
    writeCall(data, 0x5238, 0x06005228);

    writeCall(data, 0x5240, MM_LINK_OFFSETS.LUT_DL_SHIELD_MIRROR);
    writeCall(data, 0x5248, MM_LINK_OFFSETS.LUT_DL_SHIELD_MIRROR_FACE);
    writeCall(data, 0x5250, 0x06005240);

    writeMatrix(data, 0x5258, 0x06005010);
    writeCall(data, 0x5260, 0x06005240);
    writeCall(data, 0x5268, 0x06005258);

    writeMatrix(data, 0x5270, 0x06005090);
    writeCall(data, 0x5278, 0x040021a8);
    writePopMatrix(data, 0x5280);
    writeCall(data, 0x5288, MM_LINK_OFFSETS.LUT_DL_SHEATH_KOKIRI);
    writeCall(data, 0x5290, 0x06005270);

    writeMatrix(data, 0x5298, 0x060050d0);
    writeCall(data, 0x52a0, 0x04001d00);
    writePopMatrix(data, 0x52a8);
    writeCall(data, 0x52b0, MM_LINK_OFFSETS.LUT_DL_SHEATH_RAZOR);
    writeCall(data, 0x52b8, 0x06005298);

    writeMatrix(data, 0x52c0, 0x06005090);
    writeCall(data, 0x52c8, MM_LINK_OFFSETS.LUT_DL_HILT_GILDED);
    writePopMatrix(data, 0x52d0);
    writeCall(data, 0x52d8, MM_LINK_OFFSETS.LUT_DL_SHEATH_GILDED);
    writeCall(data, 0x52e0, 0x060052c0);

    writeCall(data, 0x52e8, 0x040021a8);
    writeCall(data, 0x52f0, 0x040028c0);
    writeCall(data, 0x52f8, MM_LINK_OFFSETS.LUT_DL_LFIST);
    writeCall(data, 0x5300, 0x060052e8);

    writeCall(data, 0x5308, 0x04001d00);
    writeCall(data, 0x5310, 0x04002168);
    writeCall(data, 0x5318, MM_LINK_OFFSETS.LUT_DL_LFIST);
    writeCall(data, 0x5320, 0x06005308);

    writeCall(data, 0x5328, MM_LINK_OFFSETS.LUT_DL_HILT_GILDED);
    writeCall(data, 0x5330, MM_LINK_OFFSETS.LUT_DL_BLADE_GILDED);
    writeCall(data, 0x5338, MM_LINK_OFFSETS.LUT_DL_LFIST);
    writeCall(data, 0x5340, 0x06005328);

    writeCall(data, 0x5348, MM_LINK_OFFSETS.LUT_DL_BLADE_GFSWORD_RAW);
    writeCall(data, 0x5350, MM_LINK_OFFSETS.LUT_DL_LFIST);
    writeCall(data, 0x5358, 0x06005348);
    writeCall(data, 0x5360, 0x06005348);

    writeCall(data, 0x5368, MM_LINK_OFFSETS.LUT_DL_SHIELD_HERO);
    writeCall(data, 0x5370, MM_LINK_OFFSETS.LUT_DL_RFIST);
    writeCall(data, 0x5378, 0x06005368);

    writeCall(data, 0x5380, MM_LINK_OFFSETS.LUT_DL_SHIELD_MIRROR);
    writeCall(data, 0x5388, MM_LINK_OFFSETS.LUT_DL_RFIST);
    writeCall(data, 0x5390, 0x06005380);

    writeCall(data, 0x5398, MM_LINK_OFFSETS.LUT_DL_HOOKSHOT);
    writeCall(data, 0x53a0, MM_LINK_OFFSETS.LUT_DL_RFIST);
    writeCall(data, 0x53a8, 0x06005398);

    writeCall(data, 0x53b0, MM_LINK_OFFSETS.LUT_DL_BOW);
    writeCall(data, 0x53b8, MM_LINK_OFFSETS.LUT_DL_RFIST);
    writeCall(data, 0x53c0, 0x060053b0);

    writeCall(data, 0x53c8, MM_LINK_OFFSETS.LUT_DL_OCARINA_TIME);
    writeCall(data, 0x53d0, MM_LINK_OFFSETS.LUT_DL_RHAND);
    writeCall(data, 0x53d8, 0x060053c8);

    writeCall(data, 0x53e0, MM_LINK_OFFSETS.LUT_DL_HOOKSHOT);
    writeCall(data, 0x53e8, MM_LINK_OFFSETS.LUT_DL_FPS_RIGHT_ARM);
    writeCall(data, 0x53f0, 0x060053e0);

    writeCall(data, 0x53f8, MM_LINK_OFFSETS.LUT_DL_BOW);
    writeCall(data, 0x5400, MM_LINK_OFFSETS.LUT_DL_FPS_RIGHT_ARM);
    writeCall(data, 0x5408, 0x060053f8);

    writeDf(data, 0x5410);
    writeCall(data, 0x5418, 0x06005410);
}

function resolveManifestPiece(entries: Map<string, number>, name: string, newPipeline: boolean) {
    const names = [name];

    if (newPipeline && OLD_TO_NEW_PIPELINE[name]) {
        names.unshift(OLD_TO_NEW_PIPELINE[name]);
    }

    for (const candidate of names) {
        const pointer = entries.get(candidate);

        if (pointer !== undefined) {
            return pointer;
        }
    }

    return null;
}


function mmVanillaEquipmentPieces(): string[] {
    return Object.keys(MM_PIECES).filter((name) => !isCrossGamePlayerPiece(name));
}

function alignMm16(value: number) {
    return (value + 0x0f) & ~0x0f;
}

type CompactedMmSkeleton = {
    limbs: Uint8Array[];
    count: number;
};

function collectMmSkeletonForCompaction(
    graph: PlayerModelGraphCompactor,
    data: Uint8Array,
    age: MmModelAge,
): CompactedMmSkeleton {
    const hierarchyOffset = HIERARCHY - BASE_OFFSET;
    if (hierarchyOffset < 0 || hierarchyOffset + 0x0c > data.length) {
        throw new Error(`Invalid MM ${age} hierarchy while compacting`);
    }

    const tableAddress = bufReadU32BE(data, hierarchyOffset);
    const count = data[hierarchyOffset + 4];
    if ((tableAddress >>> 24) !== 0x06 || count === 0 || count > 0x40) {
        throw new Error(`Invalid MM ${age} limb table while compacting`);
    }

    const tableOffset = tableAddress & 0x00ffffff;
    if (tableOffset + count * 4 > data.length) {
        throw new Error(`Out-of-range MM ${age} limb table while compacting`);
    }

    const limbs: Uint8Array[] = [];
    for (let i = 0; i < count; ++i) {
        const limbAddress = bufReadU32BE(data, tableOffset + i * 4);
        if ((limbAddress >>> 24) !== 0x06) {
            throw new Error(`Invalid MM ${age} limb ${i} while compacting`);
        }

        const limbOffset = limbAddress & 0x00ffffff;
        if (limbOffset + 0x10 > data.length) {
            throw new Error(`Out-of-range MM ${age} limb ${i} while compacting`);
        }

        const limb = new Uint8Array(data.subarray(limbOffset, limbOffset + 0x10));
        for (const pointerOffset of [0x08, 0x0c]) {
            const address = bufReadU32BE(limb, pointerOffset);
            if (address !== 0 && (address >>> 24) === 0x06) {
                graph.addDisplayListRoot(address, {
                    preserveCi8: i >= 10 && i <= 12,
                });
            }
        }
        limbs.push(limb);
    }

    return { limbs, count };
}

type MmCompactionAttempt = {
    model: PreparedMmModel;
    usedSize: number;
};

function buildMmCompactionAttempt(
    prepared: PreparedMmModel,
    vanilla: Uint8Array,
    age: MmModelAge,
    maxSize: number | undefined,
    replacedPieces: string[],
): MmCompactionAttempt {
    const source = prepared.data;
    const replacements = new Set(replacedPieces);
    if (source.length < LUT_END) {
        throw new Error(`Cannot compact MM ${age} model smaller than the player LUT`);
    }
    if (maxSize !== undefined && maxSize < LUT_END) {
        throw new Error(`MM ${age} model budget is smaller than the player LUT`);
    }

    const graph = new PlayerModelGraphCompactor(source, LUT_END, {
        quantizeCi8ToCi4: true,
        allowProtectedCi4UpToBytes: 0x200,
    });
    const skeleton = collectMmSkeletonForCompaction(graph, source, age);
    const sourceTargets = new Map<string, number>();

    for (const [name, piece] of Object.entries(MM_PIECES)) {
        if (replacements.has(name)) {
            continue;
        }

        const entry = piece.lut - BASE_OFFSET;
        if (entry < LUT_START || entry + 8 > LUT_END || source[entry] !== 0xde) {
            throw new Error(`Invalid MM ${age} LUT entry for ${name} while compacting`);
        }

        const target = bufReadU32BE(source, entry + 4);
        graph.addDisplayListRoot(target);
        sourceTargets.set(name, target);
    }

    const packed = graph.build(LUT_END);
    const skeletonStart = LUT_END + packed.data.length;
    const tableStart = alignMm16(skeletonStart + skeleton.count * 0x10);
    const afterSkeleton = alignMm16(tableStart + skeleton.count * 4);

    const vanillaGraph = new PlayerModelGraphCompactor(vanilla, 0);
    const vanillaTargets = new Map<string, number>();
    for (const name of replacedPieces) {
        const target = BASE_OFFSET | MM_PIECES[name].vanilla;
        vanillaGraph.addDisplayListRoot(target);
        vanillaTargets.set(name, target);
    }
    const vanillaPacked = vanillaGraph.build(afterSkeleton);

    const usedSize = alignMm16(afterSkeleton + vanillaPacked.data.length);
    if (maxSize !== undefined && usedSize > maxSize) {
        throw new Error(
            `MM ${age} player model exceeds its explicit size limit: ` +
            `0x${usedSize.toString(16)} > 0x${maxSize.toString(16)}`,
        );
    }
    const output = new Uint8Array(usedSize);

    output.set(source.subarray(0, LUT_END), 0);
    output.set(packed.data, LUT_END);
    for (const patch of packed.fixedPointerPatches) {
        bufWriteU32BE(output, patch.offset, patch.value);
    }

    for (let i = 0; i < skeleton.count; ++i) {
        const limbOffset = skeletonStart + i * 0x10;
        const limb = new Uint8Array(skeleton.limbs[i]);
        for (const pointerOffset of [0x08, 0x0c]) {
            const address = bufReadU32BE(limb, pointerOffset);
            if (address !== 0 && (address >>> 24) === 0x06) {
                bufWriteU32BE(limb, pointerOffset, packed.mapAddress(address));
            }
        }
        output.set(limb, limbOffset);
        bufWriteU32BE(output, tableStart + i * 4, BASE_OFFSET | limbOffset);
    }

    output.set(vanillaPacked.data, afterSkeleton);

    const hierarchyOffset = HIERARCHY - BASE_OFFSET;
    bufWriteU32BE(output, hierarchyOffset, BASE_OFFSET | tableStart);
    output[hierarchyOffset + 4] = skeleton.count;
    output[hierarchyOffset + 8] = 0x12;

    for (const [name, piece] of Object.entries(MM_PIECES)) {
        const entry = piece.lut - BASE_OFFSET;
        let target: number;
        if (replacements.has(name)) {
            const originalTarget = vanillaTargets.get(name);
            if (originalTarget === undefined) {
                throw new Error(`Failed to compact MM ${age} vanilla equipment piece ${name}`);
            }
            target = vanillaPacked.mapAddress(originalTarget);
        } else {
            const originalTarget = sourceTargets.get(name);
            if (originalTarget === undefined) {
                throw new Error(`Failed to compact MM ${age} model piece ${name}`);
            }
            target = packed.mapAddress(originalTarget);
        }
        writeCall(output, entry, target);
    }

    return {
        model: {
            data: output,
            compaction: {
                originalSize: prepared.data.length,
                usedSize,
                replacedPieces: [...replacedPieces],
            },
        },
        usedSize,
    };
}

function buildMmBodyOnlyDiagnosticAttempt(
    prepared: PreparedMmModel,
    age: MmModelAge,
    maxSize: number | undefined,
): MmCompactionAttempt {
    const source = prepared.data;

    if (source.length < LUT_END) {
        throw new Error(`Cannot compact MM ${age} diagnostic model smaller than the player LUT`);
    }
    if (maxSize !== undefined && maxSize < LUT_END) {
        throw new Error(`MM ${age} player model budget is smaller than the player LUT`);
    }

    const graph = new PlayerModelGraphCompactor(source, LUT_END, {
        quantizeCi8ToCi4: true,
        allowProtectedCi4UpToBytes: 0x200,
    });
    const skeleton = collectMmSkeletonForCompaction(graph, source, age);
    const sourceTargets = new Map<string, number>();

    for (const [name, piece] of Object.entries(MM_PIECES)) {
        if (!isCrossGamePlayerPiece(name)) {
            continue;
        }

        const entry = piece.lut - BASE_OFFSET;
        if (entry < LUT_START || entry + 8 > LUT_END || source[entry] !== 0xde) {
            throw new Error(`Invalid MM ${age} body LUT entry for ${name} while diagnostic-compacting`);
        }

        const target = bufReadU32BE(source, entry + 4);
        if ((target >>> 24) !== 0x06) {
            throw new Error(`Invalid MM ${age} body target for ${name}: 0x${target.toString(16)}`);
        }

        graph.addDisplayListRoot(target);
        sourceTargets.set(name, target);
    }

    const packed = graph.build(LUT_END);
    const skeletonStart = LUT_END + packed.data.length;
    const tableStart = alignMm16(skeletonStart + skeleton.count * 0x10);
    const usedSize = alignMm16(tableStart + skeleton.count * 4);
    if (maxSize !== undefined && usedSize > maxSize) {
        throw new Error(
            `MM ${age} body-only player model exceeds its explicit size limit: ` +
            `0x${usedSize.toString(16)} > 0x${maxSize.toString(16)}`,
        );
    }
    const output = new Uint8Array(usedSize);
    output.set(source.subarray(0, LUT_END), 0);
    output.set(packed.data, LUT_END);

    for (const patch of packed.fixedPointerPatches) {
        bufWriteU32BE(output, patch.offset, patch.value);
    }
    for (let i = 0; i < skeleton.count; ++i) {
        const limbOffset = skeletonStart + i * 0x10;
        const limb = new Uint8Array(skeleton.limbs[i]);

        for (const pointerOffset of [0x08, 0x0c]) {
            const address = bufReadU32BE(limb, pointerOffset);
            if (address !== 0 && (address >>> 24) === 0x06) {
                bufWriteU32BE(limb, pointerOffset, packed.mapAddress(address));
            }
        }

        output.set(limb, limbOffset);
        bufWriteU32BE(output, tableStart + i * 4, BASE_OFFSET | limbOffset);
    }

    const hierarchyOffset = HIERARCHY - BASE_OFFSET;
    bufWriteU32BE(output, hierarchyOffset, BASE_OFFSET | tableStart);
    output[hierarchyOffset + 4] = skeleton.count;
    output[hierarchyOffset + 8] = 0x12;

    for (const [name, piece] of Object.entries(MM_PIECES)) {
        const entry = piece.lut - BASE_OFFSET;

        if (!isCrossGamePlayerPiece(name)) {
            writeCall(output, entry, MM_LINK_OFFSETS.DL_DF_COMMAND);
            continue;
        }

        const originalTarget = sourceTargets.get(name);
        if (originalTarget === undefined) {
            throw new Error(`Missing MM ${age} diagnostic body target for ${name}`);
        }

        writeCall(output, entry, packed.mapAddress(originalTarget));
    }

    return {
        model: {
            data: output,
            compaction: {
                originalSize: prepared.data.length,
                usedSize,
                replacedPieces: mmVanillaEquipmentPieces(),
            },
        },
        usedSize,
    };
}

export function compactMmPlayerModel(
    prepared: PreparedMmModel,
    vanilla: Uint8Array,
    age: MmModelAge,
    maxSize?: number,
    preserveEquipmentPieces: Iterable<string> = [],
): PreparedMmModel {
    const outputBudget = maxSize;

    const preserve = new Set(preserveEquipmentPieces);
    if (prepared.bodyOnlyCrossGameDiagnostic && preserve.size === 0) {
        return buildMmBodyOnlyDiagnosticAttempt(
            prepared,
            age,
            outputBudget,
        ).model;
    }

    const vanillaEquipment = mmVanillaEquipmentPieces()
        .filter((name) => !preserve.has(name));

    return buildMmCompactionAttempt(
        prepared,
        vanilla,
        age,
        outputBudget,
        vanillaEquipment,
    ).model;
}


function ootProcessedBodyLuts(age: MmModelAge): Record<string, number> {
    const d = age === 'adult' ? OOT_LINK_ADULT_OFFSETS : OOT_LINK_CHILD_OFFSETS;
    return {
        'Limb 1': d.LUT_DL_WAIST,
        'Limb 3': d.LUT_DL_RTHIGH,
        'Limb 4': d.LUT_DL_RSHIN,
        'Limb 5': d.LUT_DL_RFOOT,
        'Limb 6': d.LUT_DL_LTHIGH,
        'Limb 7': d.LUT_DL_LSHIN,
        'Limb 8': d.LUT_DL_LFOOT,
        'Limb 10': d.LUT_DL_HEAD,
        'Limb 11': d.LUT_DL_HAT,
        'Limb 12': d.LUT_DL_COLLAR,
        'Limb 13': d.LUT_DL_LSHOULDER,
        'Limb 14': d.LUT_DL_LFOREARM,
        'Limb 15': d.LUT_DL_LHAND,
        'Limb 16': d.LUT_DL_RSHOULDER,
        'Limb 17': d.LUT_DL_RFOREARM,
        'Limb 18': d.LUT_DL_RHAND,
        'Limb 20': d.LUT_DL_TORSO,
        'Fist.L': d.LUT_DL_LFIST,
        'Fist.R': d.LUT_DL_RFIST,
    };
}

function unwrapProcessedOotLut(data: Uint8Array, address: number) {
    let current = address - BASE_OFFSET;
    const seen = new Set<number>();

    while (current >= LUT_START && current + 8 <= LUT_END) {
        if (seen.has(current)) {
            throw new Error(`Cycle in processed OoT player LUT at 0x${current.toString(16)}`);
        }
        seen.add(current);

        if (data[current] !== 0xde) {
            return current;
        }

        const target = bufReadU32BE(data, current + 4);
        if ((target >>> 24) !== 0x06) {
            return current;
        }

        const next = target & 0x00ffffff;
        if (next < LUT_START || next >= LUT_END) {
            return current;
        }
        current = next;
    }

    throw new Error(`Processed OoT LUT address 0x${address.toString(16)} is invalid`);
}

function readProcessedOotLutTarget(data: Uint8Array, address: number, description: string) {
    const entry = unwrapProcessedOotLut(data, address);
    if (entry < LUT_START || entry + 8 > LUT_END || data[entry] !== 0xde) {
        throw new Error(`${description} LUT entry is not a display-list call`);
    }

    const target = bufReadU32BE(data, entry + 4);
    if ((target >>> 24) !== 0x06 || (target & 0x00ffffff) >= data.length) {
        throw new Error(`${description} has an invalid segment-06 target: 0x${target.toString(16)}`);
    }
    return target;
}

function convertProcessedOotToMm(
    input: Uint8Array,
    vanilla: Uint8Array,
    code: Uint8Array,
    age: MmModelAge,
    skeletonTemplate: Uint8Array,
): Uint8Array {
    let data = new Uint8Array(input);
    const sourceType = data[LUT_START + 0x0b];
    const expectedSourceType = age === 'adult' ? 0x00 : 0x01;

    if (sourceType !== expectedSourceType) {
        throw new Error(
            `Processed cross-game model is not an OoT ${age} model ` +
            `(type 0x${sourceType.toString(16)})`,
        );
    }
    const sourceHierarchyOffset = findHierarchy(data);
    const sourceLimbTable = bufReadU32BE(data, sourceHierarchyOffset);
    if ((sourceLimbTable >>> 24) !== 0x06) {
        throw new Error(`Processed OoT ${age} model has an invalid limb table`);
    }
    const sourceLimbTableOffset = sourceLimbTable & 0x00ffffff;
    if (sourceLimbTableOffset < LUT_END || sourceLimbTableOffset + 21 * 4 > data.length) {
        throw new Error(
            `Processed OoT ${age} model stores its limb table inside the fixed player pool; ` +
            `this cross-game layout is not supported`,
        );
    }

    const sourceLuts = ootProcessedBodyLuts(age);
    const pieces = new Map<string, number>();

    for (const name of Object.keys(MM_PIECES)) {
        if (!isCrossGamePlayerPiece(name)) {
            pieces.set(name, MM_LINK_OFFSETS.DL_DF_COMMAND);
            continue;
        }

        const sourceLut = sourceLuts[name];
        if (sourceLut === undefined) {
            throw new Error(`No processed OoT body mapping exists for MM piece ${name}`);
        }

        const target = readProcessedOotLutTarget(
            data,
            sourceLut,
            `Processed OoT ${age} ${name}`,
        );
        pieces.set(name, target);

    }
    writePool(data, age, vanilla, code, pieces);
    const hierarchyOffset = HIERARCHY - BASE_OFFSET;
    bufWriteU32BE(data, hierarchyOffset, sourceLimbTable);
    data[hierarchyOffset + 4] = 0x15;
    data[hierarchyOffset + 8] = 0x12;

    return data;
}

export function prepareMmModel(
    model: Uint8Array,
    vanilla: Uint8Array,
    code: Uint8Array,
    age: MmModelAge,
    crossGame = false,
    skeletonTemplate: Uint8Array = vanilla,
): PreparedMmModel {
    let data: Uint8Array = new Uint8Array(model);
    const processed = asciiEquals(data, LUT_START, 'MODLOADER64');
    let bodyOnlyCrossGameDiagnostic = false;

    if (vanilla.length < LUT_END) {
        throw new Error('Vanilla MM Human model is too small');
    }

    if (data.length < LUT_END) {
        throw new Error(`MM ${age} model is too small`);
    }

    if (processed && crossGame) {
        data = convertProcessedOotToMm(
            data,
            vanilla,
            code,
            age,
            skeletonTemplate,
        );
        bodyOnlyCrossGameDiagnostic = true;
    } else if (!processed) {
        const manifest = parseManifest(data);
        const newPipeline = scan(data, 'riggedmesh') !== -1;
        const pieces = new Map<string, number>();
        const missing: string[] = [];
        const retargetExtraLists: RetargetExtraList[] = [];

        for (const name of Object.keys(MM_PIECES)) {
            if (!isCrossGamePlayerPiece(name)) {
                missing.push(name);
                continue;
            }

            const pointer = resolveManifestPiece(manifest.entries, name, newPipeline);

            if (pointer === null) {
                missing.push(name);
            } else {
                pieces.set(name, BASE_OFFSET | pointer);

                if (crossGame) {
                    const defaultLimb = crossGamePieceDefaultLimb(name);
                    if (defaultLimb !== null) {
                        retargetExtraLists.push({
                            address: BASE_OFFSET | pointer,
                            defaultLimb,
                        });
                    }
                }
            }
        }

        if (missing.length > 0) {
            const editor = new ObjectEditor(0x06, manifest.start);
            editor.loadSegment(0x06, vanilla);

            for (const name of missing) {
                editor.submitListAddr(BASE_OFFSET | MM_PIECES[name].vanilla);
            }

            const copied = editor.build();
            data = insertData(data, manifest.start, copied.data);

            for (let i = 0; i < missing.length; ++i) {
                pieces.set(missing[i], copied.offsets[i]);
            }
        }

        if (crossGame) {
            const targetSkeleton = readPlayerSkeletonTranslations(skeletonTemplate);
            data = retargetPlayerModelBindPose(data, targetSkeleton, retargetExtraLists);
        }

        writePool(data, age, vanilla, code, pieces);

        const hierarchyOffset = findHierarchy(data);
        data.set(data.subarray(hierarchyOffset, hierarchyOffset + 4), HIERARCHY - BASE_OFFSET);
        data[HIERARCHY - BASE_OFFSET + 4] = 0x15;
        data[HIERARCHY - BASE_OFFSET + 8] = 0x12;
    } else {
        const type = data[LUT_START + 0x0b];
        const expectedType = age === 'adult' ? 0x68 : 0x04;

        if (type !== expectedType) {
            throw new Error(`Processed MM model is for ${type === 0x68 ? 'adult' : type === 0x04 ? 'child' : 'unknown'} Link, not ${age} Link`);
        }

        const headerHierarchy = bufReadU32BE(data, LUT_START + 0x0c);

        if (headerHierarchy === 0xffffffff || headerHierarchy === 0x00000000) {
            bufWriteU32BE(data, LUT_START + 0x0c, HIERARCHY);
        } else if (headerHierarchy !== HIERARCHY) {
            throw new Error(`Processed MM ${age} model has an invalid hierarchy pointer: 0x${headerHierarchy.toString(16)}`);
        }

        const hierarchyOffset = HIERARCHY - BASE_OFFSET;
        const limbTable = bufReadU32BE(data, hierarchyOffset);

        if ((limbTable >>> 24) !== 0x06 || (limbTable & 0x00ffffff) >= data.length) {
            throw new Error(`Processed MM ${age} model has an invalid hierarchy`);
        }

        data[hierarchyOffset + 4] = 0x15;
        data[hierarchyOffset + 8] = 0x12;
    }

    if (data.length > vanilla.length) {
        return {
            data,
            bodyOnlyCrossGameDiagnostic,
        };
    }

    const output = new Uint8Array(vanilla.length);
    output.set(vanilla);
    output.set(data);

    return {
        data: output,
        bodyOnlyCrossGameDiagnostic,
    };
}

function tableWrites() {
    const d = MM_LINK_OFFSETS;
    const writes = new Map<number, number>();
    const w32 = (address: number, value: number) => writes.set(address, value);
    const w32a = (address: number, values: number[]) => values.forEach((value, index) => w32(address + index * 4, value));

    w32(0x801bfe10, d.HIERARCHY);
    w32a(0x801c001c, [d.LUT_DL_WAIST, d.LUT_DL_WAIST]);
    w32a(0x801c0024, [d.LUT_DL_RFIST_SHIELD_HERO, d.LUT_DL_RFIST_SHIELD_HERO, d.LUT_DL_RFIST_SHIELD_MIRROR, d.LUT_DL_RFIST_SHIELD_MIRROR]);
    w32a(0x801c0054, [d.LUT_DL_DF_COMMAND, d.LUT_DL_DF_COMMAND]);
    w32a(0x801c007c, [d.LUT_DL_DF_COMMAND, d.LUT_DL_DF_COMMAND]);
    w32a(0x801c00a4, [d.LUT_DL_DF_COMMAND, d.LUT_DL_DF_COMMAND]);
    w32a(0x801c00ac, [d.LUT_DL_SHIELD_HERO_BACK, d.LUT_DL_SHIELD_HERO_BACK, d.LUT_DL_SHIELD_MIRROR_BACK, d.LUT_DL_SHIELD_MIRROR_BACK]);
    w32a(0x801c00bc, [d.LUT_DL_SWORD_KOKIRI_SHEATHED, d.LUT_DL_SWORD_KOKIRI_SHEATHED, d.LUT_DL_SWORD_RAZOR_SHEATHED, d.LUT_DL_SWORD_RAZOR_SHEATHED, d.LUT_DL_SWORD_GILDED_SHEATHED, d.LUT_DL_SWORD_GILDED_SHEATHED]);
    w32a(0x801c00d4, [d.LUT_DL_SHEATH_KOKIRI, d.LUT_DL_SHEATH_KOKIRI, d.LUT_DL_SHEATH_RAZOR, d.LUT_DL_SHEATH_RAZOR, d.LUT_DL_SHEATH_GILDED, d.LUT_DL_SHEATH_GILDED]);
    w32a(0x801c010c, [d.LUT_DL_LFIST_GFSWORD_SWORD, d.LUT_DL_LFIST_GFSWORD_SWORD]);
    w32a(0x801c0134, [d.LUT_DL_LHAND, d.LUT_DL_LHAND]);
    w32a(0x801c015c, [d.LUT_DL_LFIST, d.LUT_DL_LFIST]);
    w32a(0x801c0184, [d.LUT_DL_LFIST_KOKIRI_SWORD, d.LUT_DL_LFIST_KOKIRI_SWORD]);
    w32a(0x801c018c, [d.LUT_DL_LFIST_KOKIRI_SWORD, d.LUT_DL_LFIST_KOKIRI_SWORD, d.LUT_DL_LFIST_RAZOR_SWORD, d.LUT_DL_LFIST_RAZOR_SWORD, d.LUT_DL_LFIST_GILDED_SWORD, d.LUT_DL_LFIST_GILDED_SWORD]);
    w32a(0x801c01c4, [d.LUT_DL_RHAND, d.LUT_DL_RHAND]);
    w32a(0x801c01ec, [d.LUT_DL_RFIST, d.LUT_DL_RFIST]);
    w32a(0x801c0214, [d.LUT_DL_RFIST_BOW, d.LUT_DL_RFIST_BOW]);
    w32a(0x801c023c, [d.LUT_DL_RHAND_OCARINA_TIME, d.LUT_DL_RHAND_OCARINA_TIME]);
    w32a(0x801c0264, [d.LUT_DL_RFIST_HOOKSHOT, d.LUT_DL_RFIST_HOOKSHOT]);
    w32a(0x801c028c, [d.LUT_DL_LHAND_BOTTLE, d.LUT_DL_LHAND_BOTTLE]);
    w32(0x801c02a4, d.LUT_DL_DF_COMMAND);
    w32(0x801c02b8, d.LUT_DL_LFIST);
    w32(0x801c02cc, d.LUT_DL_RSHOULDER);
    w32(0x801c02e0, d.LUT_DL_FPS_RARM_BOW);
    w32(0x801c02f4, d.LUT_DL_FPS_RARM_HOOKSHOT);
    w32(0x801c0d94, d.LUT_DL_BOW_STRING);

    return writes;
}

function patchMmCodeU32(code: Uint8Array, address: number, value: number) {
    const offset = address - MM_CODE_VRAM;

    if (offset < 0 || offset + 4 > code.length) {
        throw new Error(`MM code address out of range: 0x${address.toString(16)}`);
    }

    bufWriteU32BE(code, offset, value);
}

function patchSnapshotU32(data: Uint8Array, address: number, value: number) {
    let offset = 0;

    while (offset + 8 <= data.length) {
        const start = bufReadU32BE(data, offset);
        const size = bufReadU32BE(data, offset + 4);
        offset += 8;

        if (start === 0 || size === 0) {
            break;
        }

        if (address >= start && address + 4 <= start + size) {
            bufWriteU32BE(data, offset + address - start, value);
            return;
        }

        offset += size;
    }

    throw new Error(`MM child model table address not found: 0x${address.toString(16)}`);
}

export function patchMmChildModelTables(snapshot: Uint8Array, code: Uint8Array) {
    for (const [address, value] of tableWrites()) {
        patchSnapshotU32(snapshot, address, value);
        patchMmCodeU32(code, address, value);
    }
}

export function patchMmAdultModelTables(data: Uint8Array) {
    const writes = tableWrites();

    for (let offset = 0; offset + 0x0c <= data.length; offset += 0x0c) {
        const op = bufReadU32BE(data, offset);

        if (op === 0x00000000) {
            return;
        }

        if (op !== 0x00000002) {
            continue;
        }

        const address = bufReadU32BE(data, offset + 4);
        const value = writes.get(address);

        if (value !== undefined) {
            bufWriteU32BE(data, offset + 8, value);
        }
    }

    throw new Error('MM adult age model table is missing its end command');
}
