import { bufReadU16BE, bufReadU32BE, bufWriteU16BE, bufWriteU32BE } from '../util/buffer';
import { OOT_LINK_ADULT_OFFSETS, OOT_LINK_CHILD_OFFSETS } from './model';
import { PlayerModelGraphCompactor } from './player-model-compactor.ts';
import { crossGamePieceDefaultLimb, isCrossGamePlayerPiece } from './player-model-compat.ts';
import { retargetPlayerModelBindPose, type RetargetExtraList } from './player-model-retarget';

export type OotModelAge = 'adult' | 'child';

type ModelPiece = [number, number];
type ModelPieces = Record<string, ModelPiece>;
type ModelSkips = Record<string, [number, number][]>;

export type ModelCompactionInfo = {
    originalSize: number;
    usedSize: number;
    replacedPieces: string[];
};

export type PreparedOotModel = {
    data: Uint8Array;
    dfAddr: number;
    compaction?: ModelCompactionInfo;
};

const BASE_OFFSET = 0x06000000;
const LUT_START = 0x00005000;
const LUT_END = 0x00005800;
const PRE_CONSTANT_START = 0x0000500c;

export const OOT_ADULT_MODEL_SIZE = 0x00037800;
const ADULT_SIZE = OOT_ADULT_MODEL_SIZE;
const ADULT_HIERARCHY = 0x06005380;
const ADULT_POST_START = 0x00005238;

export const OOT_CHILD_MODEL_SIZE = 0x0002cf80;
const CHILD_SIZE = OOT_CHILD_MODEL_SIZE;
const CHILD_HIERARCHY = 0x060053a8;
const CHILD_POST_START = 0x00005228;

const TOLERANCE = 0x100;

const encoder = new TextEncoder();

function decodeBase64(data: string) {
    const raw = atob(data);
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; ++i) {
        out[i] = raw.charCodeAt(i);
    }
    return out;
}

const ADULT_PRE_CONSTANTS = decodeBase64('BgBTgAABAAAAAAAAAAAAAQAAAAAAAAAAAAEAAP01/soATgABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD//wAAAAAAAAAA//8AAAAAAAAAAAABAAADpwBeAB0AAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
const ADULT_POST_CONSTANTS = decodeBase64('2jgAAAYAUBDeAAAABgBRONg4AAIAAABA3gEAAAYAUTDaOAAABgBQUN4BAAAGAFFg2jgAAAYAUFDeAQAABgBRaN4AAAAGAFI43gEAAAYAUljeAAAABgBSON4BAAAGAFJo3gAAAAYAUTDeAQAABgBSWN4AAAAGAFEw3gEAAAYAUmjeAAAABgBRON4AAAAGAFFA3gEAAAYAURDeAAAABgBRSN4AAAAGAFFQ3gEAAAYAURDeAAAABgBRSN4AAAAGAFFY3gEAAAYAURDeAAAABgBRcN4BAAAGAFEQ3gAAAAYAUWDeAQAABgBRKN4AAAAGAFFo3gEAAAYAUSjeAAAABgBRgN4BAAAGAFEo3gAAAAYAUZDeAQAABgBRKN4AAAAGAFGI3gEAAAYAUSDeAAAABgBRgN4BAAAGAFIA3gAAAAYAUgjeAQAABgBSAA==');
const CHILD_PRE_CONSTANTS = decodeBase64('BgBTqAABAAAAAAAAAAAAAQAAAAAAAAAAAAEAAP5I/y0AAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD//wAAAAAAAAAA//8AAAAAAAAAAAABAAACIQAAAFAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP//AAAAAQAAAAAAAAAA//8AAAAAAAAAAP+mAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==');
const CHILD_POST_CONSTANTS = decodeBase64('2jgAAAYAUBDeAAAABgBRgNg4AAIAAABA3gEAAAYAUXjeAQAABgBSKNo4AAAGAFCQ3gEAAAYAUNDeAQAABgBSUNo4AAAGAFBQ3gEAAAYAUNDeAQAABgBSaN4AAAAGAFIo3gEAAAYAUbjeAQAABgBSgN4AAAAGAFIo3gEAAAYAUmjeAQAABgBSmN4AAAAGAFIo3gEAAAYAUbjeAQAABgBSsN4AAAAGAFF43gEAAAYAUmjeAQAABgBSyN4AAAAGAFGA3gAAAAYAUYjeAQAABgBRWN4BAAAGAFLg3gAAAAYAUcjeAQAABgBRUN4BAAAGAFMA3gAAAAYAUbDeAQAABgBRWN4BAAAGAFMY3gAAAAYAUNDeAQAABgBRcN4BAAAGAFMw3gAAAAYAUZDeAQAABgBRcN4BAAAGAFNI3gAAAAYAUZjeAQAABgBRaN4BAAAGAFNg3gAAAAYAUaDeAQAABgBRaN4BAAAGAFN43gAAAAYAUZDeAQAABgBR2N4BAAAGAFOQ');

const ADULT_PIECES: ModelPieces = {
    'Sheath': [OOT_LINK_ADULT_OFFSETS.LUT_DL_SWORD_SHEATH, 0x249d8],
    'FPS.Hookshot': [OOT_LINK_ADULT_OFFSETS.LUT_DL_FPS_HOOKSHOT, 0x2a738],
    'Hilt.2': [OOT_LINK_ADULT_OFFSETS.LUT_DL_SWORD_HILT, 0x22060],
    'Hilt.3': [OOT_LINK_ADULT_OFFSETS.LUT_DL_LONGSWORD_HILT, 0x238c8],
    'Blade.2': [OOT_LINK_ADULT_OFFSETS.LUT_DL_SWORD_BLADE, 0x21f78],
    'Hookshot.Spike': [OOT_LINK_ADULT_OFFSETS.LUT_DL_HOOKSHOT_HOOK, 0x2b288],
    'Hookshot': [OOT_LINK_ADULT_OFFSETS.LUT_DL_HOOKSHOT, 0x24d70],
    'Fist.L': [OOT_LINK_ADULT_OFFSETS.LUT_DL_LFIST, 0x21ce8],
    'Fist.R': [OOT_LINK_ADULT_OFFSETS.LUT_DL_RFIST, 0x226e0],
    'FPS.Forearm.L': [OOT_LINK_ADULT_OFFSETS.LUT_DL_FPS_LFOREARM, 0x29fa0],
    'FPS.Forearm.R': [OOT_LINK_ADULT_OFFSETS.LUT_DL_FPS_RFOREARM, 0x29918],
    'Gauntlet.Fist.L': [OOT_LINK_ADULT_OFFSETS.LUT_DL_UPGRADE_LFIST, 0x25438],
    'Gauntlet.Fist.R': [OOT_LINK_ADULT_OFFSETS.LUT_DL_UPGRADE_RFIST, 0x257b8],
    'Gauntlet.Forearm.L': [OOT_LINK_ADULT_OFFSETS.LUT_DL_UPGRADE_LFOREARM, 0x25218],
    'Gauntlet.Forearm.R': [OOT_LINK_ADULT_OFFSETS.LUT_DL_UPGRADE_RFOREARM, 0x25598],
    'Gauntlet.Hand.L': [OOT_LINK_ADULT_OFFSETS.LUT_DL_UPGRADE_LHAND, 0x252d8],
    'Gauntlet.Hand.R': [OOT_LINK_ADULT_OFFSETS.LUT_DL_UPGRADE_RHAND, 0x25658],
    'Bottle.Hand.L': [OOT_LINK_ADULT_OFFSETS.LUT_DL_LHAND_BOTTLE, 0x29600],
    'FPS.Hand.L': [OOT_LINK_ADULT_OFFSETS.LUT_DL_FPS_LHAND, 0x24b58],
    'FPS.Hand.R': [OOT_LINK_ADULT_OFFSETS.LUT_DL_FPS_RHAND, 0x29c20],
    'Bow.String': [OOT_LINK_ADULT_OFFSETS.LUT_DL_BOW_STRING, 0x2b108],
    'Bow': [OOT_LINK_ADULT_OFFSETS.LUT_DL_BOW, 0x22da8],
    'Blade.3.Break': [OOT_LINK_ADULT_OFFSETS.LUT_DL_BLADEBREAK, 0x2ba38],
    'Blade.3': [OOT_LINK_ADULT_OFFSETS.LUT_DL_LONGSWORD_BLADE, 0x23a28],
    'Bottle': [OOT_LINK_ADULT_OFFSETS.LUT_DL_BOTTLE, 0x2ad58],
    'Broken.Blade.3': [OOT_LINK_ADULT_OFFSETS.LUT_DL_LONGSWORD_BROKEN, 0x23eb0],
    'Foot.2.L': [OOT_LINK_ADULT_OFFSETS.LUT_DL_BOOT_LIRON, 0x25918],
    'Foot.2.R': [OOT_LINK_ADULT_OFFSETS.LUT_DL_BOOT_RIRON, 0x25a60],
    'Foot.3.L': [OOT_LINK_ADULT_OFFSETS.LUT_DL_BOOT_LHOVER, 0x25ba8],
    'Foot.3.R': [OOT_LINK_ADULT_OFFSETS.LUT_DL_BOOT_RHOVER, 0x25db0],
    'Hammer': [OOT_LINK_ADULT_OFFSETS.LUT_DL_HAMMER, 0x233e0],
    'Hookshot.Aiming.Reticule': [OOT_LINK_ADULT_OFFSETS.LUT_DL_HOOKSHOT_AIM, 0x2cb48],
    'Hookshot.Chain': [OOT_LINK_ADULT_OFFSETS.LUT_DL_HOOKSHOT_CHAIN, 0x2aff0],
    'Ocarina.2': [OOT_LINK_ADULT_OFFSETS.LUT_DL_OCARINA_TIME, 0x248d8],
    'Shield.2': [OOT_LINK_ADULT_OFFSETS.LUT_DL_SHIELD_HYLIAN, 0x22970],
    'Shield.3': [OOT_LINK_ADULT_OFFSETS.LUT_DL_SHIELD_MIRROR, 0x241c0],
    'Limb 1': [OOT_LINK_ADULT_OFFSETS.LUT_DL_WAIST, 0x35330],
    'Limb 3': [OOT_LINK_ADULT_OFFSETS.LUT_DL_RTHIGH, 0x35678],
    'Limb 4': [OOT_LINK_ADULT_OFFSETS.LUT_DL_RSHIN, 0x358b0],
    'Limb 5': [OOT_LINK_ADULT_OFFSETS.LUT_DL_RFOOT, 0x358b0],
    'Limb 6': [OOT_LINK_ADULT_OFFSETS.LUT_DL_LTHIGH, 0x35cb8],
    'Limb 7': [OOT_LINK_ADULT_OFFSETS.LUT_DL_LSHIN, 0x35ef0],
    'Limb 8': [OOT_LINK_ADULT_OFFSETS.LUT_DL_LFOOT, 0x361a0],
    'Limb 10': [OOT_LINK_ADULT_OFFSETS.LUT_DL_HEAD, 0x365e8],
    'Limb 11': [OOT_LINK_ADULT_OFFSETS.LUT_DL_HAT, 0x36d30],
    'Limb 12': [OOT_LINK_ADULT_OFFSETS.LUT_DL_COLLAR, 0x362f8],
    'Limb 13': [OOT_LINK_ADULT_OFFSETS.LUT_DL_LSHOULDER, 0x37210],
    'Limb 14': [OOT_LINK_ADULT_OFFSETS.LUT_DL_LFOREARM, 0x373d8],
    'Limb 15': [OOT_LINK_ADULT_OFFSETS.LUT_DL_LHAND, 0x21aa8],
    'Limb 16': [OOT_LINK_ADULT_OFFSETS.LUT_DL_RSHOULDER, 0x36e58],
    'Limb 17': [OOT_LINK_ADULT_OFFSETS.LUT_DL_RFOREARM, 0x37018],
    'Limb 18': [OOT_LINK_ADULT_OFFSETS.LUT_DL_RHAND, 0x22498],
    'Limb 20': [OOT_LINK_ADULT_OFFSETS.LUT_DL_TORSO, 0x363b8],
};

const ADULT_SKIPS: ModelSkips = {
    'FPS.Hookshot': [[0x2f0, 0x618]],
    'Hilt.2': [[0x1e8, 0x430]],
    'Hilt.3': [[0x160, 0x480]],
    'Blade.2': [[0x0e8, 0x518]],
    'Hookshot': [[0x250, 0x4a0]],
    'Bow': [[0x158, 0x3b0]],
    'Blade.3': [[0x0b8, 0x320]],
    'Broken.Blade.3': [[0x0a0, 0x308]],
    'Hammer': [[0x278, 0x4e0]],
    'Shield.2': [[0x158, 0x2b8], [0x3a8, 0x430]],
    'Shield.3': [[0x1b8, 0x3e8]],
};

const ADULT_SKELETON = [
    [0xffc7, 0x0d31, 0x0000],
    [0x0000, 0x0000, 0x0000],
    [0x03b1, 0x0000, 0x0000],
    [0xfe71, 0x0045, 0xff07],
    [0x051a, 0x0000, 0x0000],
    [0x04e8, 0x0005, 0x000b],
    [0xfe74, 0x004c, 0x0108],
    [0x0518, 0x0000, 0x0000],
    [0x04e9, 0x0006, 0x0003],
    [0x0000, 0x0015, 0xfff9],
    [0x0570, 0xfefd, 0x0000],
    [0xfed6, 0xfd44, 0x0000],
    [0x0000, 0x0000, 0x0000],
    [0x040f, 0xff54, 0x02a8],
    [0x0397, 0x0000, 0x0000],
    [0x02f2, 0x0000, 0x0000],
    [0x040f, 0xff53, 0xfd58],
    [0x0397, 0x0000, 0x0000],
    [0x02f2, 0x0000, 0x0000],
    [0x03d2, 0xfd4c, 0x0156],
    [0x0000, 0x0000, 0x0000],
];

const CHILD_PIECES: ModelPieces = {
    'Slingshot.String': [OOT_LINK_CHILD_OFFSETS.LUT_DL_SLINGSHOT_STRING, 0x221a8],
    'Sheath': [OOT_LINK_CHILD_OFFSETS.LUT_DL_SWORD_SHEATH, 0x15408],
    'Blade.2': [OOT_LINK_CHILD_OFFSETS.LUT_DL_MASTER_SWORD, 0x15698],
    'Blade.1': [OOT_LINK_CHILD_OFFSETS.LUT_DL_SWORD_BLADE, 0x14110],
    'Boomerang': [OOT_LINK_CHILD_OFFSETS.LUT_DL_BOOMERANG, 0x14660],
    'Fist.L': [OOT_LINK_CHILD_OFFSETS.LUT_DL_LFIST, 0x13e18],
    'Fist.R': [OOT_LINK_CHILD_OFFSETS.LUT_DL_RFIST, 0x14320],
    'Hilt.1': [OOT_LINK_CHILD_OFFSETS.LUT_DL_SWORD_HILT, 0x14048],
    'Shield.1': [OOT_LINK_CHILD_OFFSETS.LUT_DL_SHIELD_DEKU, 0x14440],
    'Slingshot': [OOT_LINK_CHILD_OFFSETS.LUT_DL_SLINGSHOT, 0x15f08],
    'Ocarina.1': [OOT_LINK_CHILD_OFFSETS.LUT_DL_OCARINA_FAIRY, 0x15ba8],
    'Bottle': [OOT_LINK_CHILD_OFFSETS.LUT_DL_BOTTLE, 0x18478],
    'Ocarina.2': [OOT_LINK_CHILD_OFFSETS.LUT_DL_OCARINA_TIME, 0x15ab8],
    'Bottle.Hand.L': [OOT_LINK_CHILD_OFFSETS.LUT_DL_LHAND_BOTTLE, 0x18478],
    'GoronBracelet': [OOT_LINK_CHILD_OFFSETS.LUT_DL_GORON_BRACELET, 0x16118],
    'Mask.Bunny': [OOT_LINK_CHILD_OFFSETS.LUT_DL_MASK_BUNNY, 0x2ca38],
    'Mask.Skull': [OOT_LINK_CHILD_OFFSETS.LUT_DL_MASK_SKULL, 0x2ad40],
    'Mask.Spooky': [OOT_LINK_CHILD_OFFSETS.LUT_DL_MASK_SPOOKY, 0x2af70],
    'Mask.Gerudo': [OOT_LINK_CHILD_OFFSETS.LUT_DL_MASK_GERUDO, 0x2b788],
    'Mask.Goron': [OOT_LINK_CHILD_OFFSETS.LUT_DL_MASK_GORON, 0x2b350],
    'Mask.Keaton': [OOT_LINK_CHILD_OFFSETS.LUT_DL_MASK_KEATON, 0x2b060],
    'Mask.Truth': [OOT_LINK_CHILD_OFFSETS.LUT_DL_MASK_TRUTH, 0x2b1f0],
    'Mask.Zora': [OOT_LINK_CHILD_OFFSETS.LUT_DL_MASK_ZORA, 0x2b580],
    'FPS.Forearm.R': [OOT_LINK_CHILD_OFFSETS.LUT_DL_FPS_RIGHT_ARM, 0x18048],
    'DekuStick': [OOT_LINK_CHILD_OFFSETS.LUT_DL_DEKU_STICK, 0x06cc0],
    'Shield.2': [OOT_LINK_CHILD_OFFSETS.LUT_DL_SHIELD_HYLIAN_BACK, 0x14c30],
    'Limb 1': [OOT_LINK_CHILD_OFFSETS.LUT_DL_WAIST, 0x202a8],
    'Limb 3': [OOT_LINK_CHILD_OFFSETS.LUT_DL_RTHIGH, 0x204f0],
    'Limb 4': [OOT_LINK_CHILD_OFFSETS.LUT_DL_RSHIN, 0x206e8],
    'Limb 5': [OOT_LINK_CHILD_OFFSETS.LUT_DL_RFOOT, 0x20978],
    'Limb 6': [OOT_LINK_CHILD_OFFSETS.LUT_DL_LTHIGH, 0x20ad8],
    'Limb 7': [OOT_LINK_CHILD_OFFSETS.LUT_DL_LSHIN, 0x20cd0],
    'Limb 8': [OOT_LINK_CHILD_OFFSETS.LUT_DL_LFOOT, 0x20f60],
    'Limb 10': [OOT_LINK_CHILD_OFFSETS.LUT_DL_HEAD, 0x21360],
    'Limb 11': [OOT_LINK_CHILD_OFFSETS.LUT_DL_HAT, 0x219b0],
    'Limb 12': [OOT_LINK_CHILD_OFFSETS.LUT_DL_COLLAR, 0x210c0],
    'Limb 13': [OOT_LINK_CHILD_OFFSETS.LUT_DL_LSHOULDER, 0x21e18],
    'Limb 14': [OOT_LINK_CHILD_OFFSETS.LUT_DL_LFOREARM, 0x21fe8],
    'Limb 15': [OOT_LINK_CHILD_OFFSETS.LUT_DL_LHAND, 0x13cb0],
    'Limb 16': [OOT_LINK_CHILD_OFFSETS.LUT_DL_RSHOULDER, 0x21ae8],
    'Limb 17': [OOT_LINK_CHILD_OFFSETS.LUT_DL_RFOREARM, 0x21cb8],
    'Limb 18': [OOT_LINK_CHILD_OFFSETS.LUT_DL_RHAND, 0x141c0],
    'Limb 20': [OOT_LINK_CHILD_OFFSETS.LUT_DL_TORSO, 0x21130],
};

const CHILD_SKIPS: ModelSkips = {
    'Boomerang': [[0x140, 0x240]],
    'Hilt.1': [[0x0c8, 0x170]],
    'Shield.1': [[0x140, 0x218]],
    'Ocarina.1': [[0x110, 0x240]],
};

const CHILD_SKELETON = [
    [0x0000, 0x0948, 0x0000],
    [0xfffc, 0xff98, 0x0000],
    [0x025f, 0x0000, 0x0000],
    [0xff54, 0x0032, 0xff42],
    [0x02b9, 0x0000, 0x0000],
    [0x0339, 0x0005, 0x000b],
    [0xff56, 0x0039, 0x00c0],
    [0x02b7, 0x0000, 0x0000],
    [0x0331, 0x0008, 0x0004],
    [0x0000, 0xff99, 0xfff9],
    [0x03e4, 0xff37, 0xffff],
    [0xfe93, 0xfd62, 0x0000],
    [0x0000, 0x0000, 0x0000],
    [0x02b8, 0xff51, 0x01d2],
    [0x0245, 0x0000, 0x0000],
    [0x0202, 0x0000, 0x0000],
    [0x02b8, 0xff51, 0xfe2e],
    [0x0241, 0x0000, 0x0000],
    [0x020d, 0x0000, 0x0000],
    [0x0291, 0xfdf5, 0x016f],
    [0x0000, 0x0000, 0x0000],
];

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

function asciiEquals(data: Uint8Array, offset: number, value: string) {
    if (offset < 0 || offset + value.length > data.length) {
        return false;
    }

    for (let i = 0; i < value.length; ++i) {
        if (data[offset + i] !== value.charCodeAt(i)) {
            return false;
        }
    }

    return true;
}

function scan(data: Uint8Array, value: Uint8Array | string, start = 0) {
    const bytes = typeof value === 'string' ? encoder.encode(value) : value;
    let dataIndex = 0;

    for (let i = start; i < data.length; ++i) {
        if (data[i] === bytes[dataIndex]) {
            dataIndex++;

            if (typeof value === 'string' && ['Bottle', 'Bow', 'Slingshot', 'Hookshot', 'Fist.L', 'Fist.R', 'Blade.3'].includes(value) && i < data.length - 1 && data[i + 1] === 0x2e) {
                if (value === 'Blade.3') {
                    let resetCount = false;
                    if (data[i] !== 0x65) {
                        resetCount = true;
                    }
                    if (!resetCount && i > 10 && asciiEquals(data, i - 11, 'Broken.')) {
                        resetCount = true;
                    }
                    if (resetCount) {
                        dataIndex = 0;
                    }
                } else if (['Fist.L', 'Fist.R'].includes(value) && i > 11) {
                    if (asciiEquals(data, i - 12, 'Gauntlet.')) {
                        dataIndex = 0;
                    }
                } else {
                    dataIndex = 0;
                }
            }

            if (typeof value === 'string' && value === 'Hookshot' && dataIndex === 1 && i > 3 && asciiEquals(data, i - 4, 'FPS.')) {
                dataIndex = 0;
            }

            if (typeof value === 'string' && ['Hand.L', 'Hand.R'].includes(value) && dataIndex === 1) {
                if (i > 8 && asciiEquals(data, i - 9, 'Gauntlet.')) {
                    dataIndex = 0;
                }
                if (dataIndex === 1 && i > 3 && asciiEquals(data, i - 4, 'FPS.')) {
                    dataIndex = 0;
                }
                if (value === 'Hand.L' && dataIndex === 1 && i > 6 && asciiEquals(data, i - 7, 'Bottle.')) {
                    dataIndex = 0;
                }
            }

            if (typeof value === 'string' && ['Forearm.L', 'Forearm.R'].includes(value) && dataIndex === 1 && i > 3 && asciiEquals(data, i - 4, 'FPS.')) {
                dataIndex = 0;
            }

            if (dataIndex === bytes.length) {
                if (start === 0) {
                    return i + 1;
                }

                i += 2;
                if (i + 4 > data.length) {
                    return -1;
                }
                return bufReadU32BE(data, i);
            }
        } else {
            dataIndex = 0;
        }
    }

    return -1;
}

function unwrap(data: Uint8Array, address: number) {
    let current = address;
    let target = bufReadU32BE(data, current + 4) & 0x00ffffff;

    while (target >= LUT_START && target <= LUT_END) {
        current = target;
        target = bufReadU32BE(data, current + 4) & 0x00ffffff;
    }

    return current;
}

function writeDLPointer(data: number[], offset: number, value: number) {
    data[offset] = value >>> 24;
    data[offset + 1] = (value >>> 16) & 0xff;
    data[offset + 2] = (value >>> 8) & 0xff;
    data[offset + 3] = value & 0xff;
}

function copyRange(data: Uint8Array, start: number, size: number) {
    return new Uint8Array(data.subarray(start, start + size));
}

function loadVanilla(vanilla: Uint8Array, missing: string[], rebase: number, pieces: ModelPieces, skips: ModelSkips) {
    const segment = 0x06;
    const vertices = new Map<number, Uint8Array>();
    const matrices = new Map<number, Uint8Array>();
    const textures = new Map<number, Uint8Array>();
    const displayLists = new Map<string, { data: number[], offset: number }>();

    for (const item of missing) {
        const offset = pieces[item][1];
        let i = offset;
        const displayList: number[] = [];

        while (i + 8 <= vanilla.length) {
            const skipped = (skips[item] || []).some(([start, end]) => {
                const itemIndex = i - offset;
                return start <= itemIndex && itemIndex < end;
            });

            if (skipped) {
                i += 8;
                continue;
            }

            const op = vanilla[i];
            const seg = vanilla[i + 4];
            const lo = bufReadU32BE(vanilla, i + 4);

            if (op === 0xdf) {
                displayList.push(...vanilla.subarray(i, i + 8));
                break;
            } else if (op === 0x01 && seg === segment) {
                const vtxStart = lo & 0x00ffffff;
                const vtxLen = bufReadU16BE(vanilla, i + 1);
                const current = vertices.get(vtxStart);
                if (!current || current.length < vtxLen) {
                    vertices.set(vtxStart, copyRange(vanilla, vtxStart, vtxLen));
                }
            } else if (op === 0xda && seg === segment) {
                const mtxStart = lo & 0x00ffffff;
                if (!matrices.has(mtxStart)) {
                    matrices.set(mtxStart, copyRange(vanilla, mtxStart, 0x40));
                }
            } else if (op === 0xfd && seg === segment) {
                const textureType = (vanilla[i + 1] >> 3) & 0x1f;
                const numTexelBits = 4 * (2 ** (textureType & 0x3));
                const bytesPerTexel = Math.floor(numTexelBits / 8);
                const texOffset = lo & 0x00ffffff;
                let numTexels = -1;
                const returnStack: number[] = [];
                let j = i + 8;

                while (j + 8 <= vanilla.length && numTexels === -1) {
                    const opJ = vanilla[j];
                    const segJ = vanilla[j + 4];
                    const loJ = bufReadU32BE(vanilla, j + 4);

                    if (opJ === 0xdf) {
                        if (returnStack.length === 0) {
                            numTexels = 0;
                            break;
                        } else {
                            j = returnStack.pop()!;
                        }
                    } else if (opJ === 0xfd) {
                        numTexels = 0;
                        break;
                    } else if (opJ === 0xde) {
                        if (segJ === segment) {
                            if (vanilla[j + 1] === 0x00) {
                                returnStack.push(j);
                            }
                            j = loJ & 0x00ffffff;
                        }
                    } else if (opJ === 0xf0) {
                        numTexels = ((loJ & 0x00fff000) >>> 14) + 1;
                        break;
                    } else if (opJ === 0xf3) {
                        numTexels = ((loJ & 0x00fff000) >>> 12) + 1;
                        break;
                    }

                    j += 8;
                }

                const dataLen = bytesPerTexel * Math.max(numTexels, 0);
                const current = textures.get(texOffset);
                if (!current || current.length < dataLen) {
                    textures.set(texOffset, copyRange(vanilla, texOffset, dataLen));
                }
            }

            displayList.push(...vanilla.subarray(i, i + 8));
            i += 8;
        }

        displayLists.set(item, { data: displayList, offset });
    }

    const vanillaZobj: number[] = [];
    const oldTex2New = new Map<number, number>();
    const oldVer2New = new Map<number, number>();
    const oldMtx2New = new Map<number, number>();
    const oldDL2New = new Map<number, number>();

    for (const [offset, texture] of textures) {
        oldTex2New.set(offset, vanillaZobj.length);
        vanillaZobj.push(...texture);
    }

    for (const [offset, vertex] of vertices) {
        oldVer2New.set(offset, vanillaZobj.length);
        vanillaZobj.push(...vertex);
    }

    for (const [offset, matrix] of matrices) {
        oldMtx2New.set(offset, vanillaZobj.length);
        vanillaZobj.push(...matrix);
    }

    let displayListOffset = vanillaZobj.length;
    for (const entry of displayLists.values()) {
        oldDL2New.set(entry.offset, displayListOffset);
        displayListOffset += (entry.data.length + 0x0f) & ~0x0f;
    }

    for (const entry of displayLists.values()) {
        const dl = entry.data;

        for (let i = 0; i < dl.length; i += 8) {
            const op = dl[i];
            const seg = dl[i + 4];
            const lo = (((dl[i + 4] << 24) | (dl[i + 5] << 16) | (dl[i + 6] << 8) | dl[i + 7]) >>> 0);

            if (seg === segment) {
                let target: number | undefined;

                if (op === 0x01) {
                    target = oldVer2New.get(lo & 0x00ffffff);
                } else if (op === 0xda) {
                    target = oldMtx2New.get(lo & 0x00ffffff);
                } else if (op === 0xfd) {
                    target = oldTex2New.get(lo & 0x00ffffff);
                } else if (op === 0xde) {
                    target = oldDL2New.get(lo & 0x00ffffff);
                }

                if (target !== undefined) {
                    writeDLPointer(dl, i + 4, BASE_OFFSET + target + rebase);
                } else if ([0x01, 0xda, 0xfd, 0xde].includes(op)) {
                    throw new Error(`Failed to relocate vanilla model data at 0x${lo.toString(16)}`);
                }
            }
        }

        vanillaZobj.push(...dl);
        while (vanillaZobj.length % 0x10 !== 0) {
            vanillaZobj.push(0x00);
        }
    }

    const offsets = new Map<string, number>();
    for (const item of missing) {
        const offset = oldDL2New.get(pieces[item][1]);
        if (offset === undefined) {
            throw new Error(`Failed to copy vanilla model piece ${item}`);
        }
        offsets.set(item, offset);
    }

    return {
        data: new Uint8Array(vanillaZobj),
        offsets,
    };
}

function findHierarchy(data: Uint8Array, age: OotModelAge) {
    for (let i = 4; i + 4 < data.length; i += 4) {
        if (data[i] === 0x06) {
            const possible = bufReadU32BE(data, i) & 0x00ffffff;
            if (possible < data.length) {
                const possible2 = ((data[i - 3] << 16) | (data[i - 2] << 8) | data[i - 1]) >>> 0;
                const diff = possible - possible2;
                if (diff === 0x0c || diff === 0x10) {
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
            }
        }
    }

    throw new Error(`No hierarchy found in ${age} model`);
}

function checkDiff(limb: number, skeleton: number) {
    const normalDiff = Math.abs(limb - skeleton);
    const flowDiff = Math.abs(normalDiff - 0xffff);
    const diff = Math.min(normalDiff, flowDiff);
    return diff > TOLERANCE;
}

function correctSkeleton(data: Uint8Array, skeleton: number[][], age: OotModelAge) {
    const hierarchy = findHierarchy(data, age);
    const limbPointer = bufReadU32BE(data, hierarchy) & 0x00ffffff;
    if (limbPointer + 4 > data.length) {
        throw new Error(`Invalid hierarchy in ${age} model`);
    }

    const limb = bufReadU32BE(data, limbPointer) & 0x00ffffff;
    if (limb + 21 * 0x10 > data.length) {
        throw new Error(`Invalid skeleton in ${age} model`);
    }

    let hasVanillaSkeleton = true;
    let withinTolerance = true;

    for (let i = 1; i < 21; ++i) {
        const offset = limb + i * 0x10;
        const limbX = bufReadU16BE(data, offset);
        const limbY = bufReadU16BE(data, offset + 2);
        const limbZ = bufReadU16BE(data, offset + 4);
        const skeletonX = skeleton[i][0];
        const skeletonY = skeleton[i][1];
        const skeletonZ = skeleton[i][2];

        if (limbX !== skeletonX || limbY !== skeletonY || limbZ !== skeletonZ) {
            hasVanillaSkeleton = false;
            if (checkDiff(limbX, skeletonX) || checkDiff(limbY, skeletonY) || checkDiff(limbZ, skeletonZ)) {
                withinTolerance = false;
                break;
            }
        }
    }

    if (!hasVanillaSkeleton && withinTolerance) {
        for (let i = 0; i < 21; ++i) {
            const offset = limb + i * 0x10;
            bufWriteU16BE(data, offset, skeleton[i][0]);
            bufWriteU16BE(data, offset + 2, skeleton[i][1]);
            bufWriteU16BE(data, offset + 4, skeleton[i][2]);
        }
    }
}

function getPieces(age: OotModelAge, newPipeline: boolean) {
    const source = age === 'adult' ? ADULT_PIECES : CHILD_PIECES;
    const pieces: ModelPieces = {};

    for (const [name, piece] of Object.entries(source)) {
        pieces[newPipeline ? OLD_TO_NEW_PIPELINE[name] || name : name] = piece;
    }

    return pieces;
}

function insertData(data: Uint8Array, offset: number, insert: Uint8Array) {
    const out = new Uint8Array(data.length + insert.length);
    out.set(data.subarray(0, offset), 0);
    out.set(insert, offset);
    out.set(data.subarray(offset), offset + insert.length);
    return out;
}

function findEmptyListOffset(data: Uint8Array) {
    const emptyList = new Uint8Array([0xdf, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
    const offset = scan(data, emptyList);
    if (offset === -1) {
        throw new Error('Failed to find empty list offset');
    }
    return offset - emptyList.length;
}


function ootVanillaEquipmentPieces(age: OotModelAge): string[] {
    const pieces = age === 'adult' ? ADULT_PIECES : CHILD_PIECES;
    return Object.keys(pieces).filter((name) => !isCrossGamePlayerPiece(name));
}

function align16(value: number) {
    return (value + 0x0f) & ~0x0f;
}

type CompactedPlayerSkeleton = {
    limbs: Uint8Array[];
    count: number;
};
function collectPlayerSkeletonForCompaction(
    graph: PlayerModelGraphCompactor,
    data: Uint8Array,
    hierarchy: number,
    age: OotModelAge,
): CompactedPlayerSkeleton {
    const hierarchyOffset = hierarchy - BASE_OFFSET;
    if (hierarchyOffset < 0 || hierarchyOffset + 0x0c > data.length) {
        throw new Error(`Invalid ${age} player hierarchy while compacting`);
    }

    const tableAddress = bufReadU32BE(data, hierarchyOffset);
    const count = data[hierarchyOffset + 4];
    if ((tableAddress >>> 24) !== 0x06 || count === 0 || count > 0x40) {
        throw new Error(`Invalid ${age} player limb table while compacting`);
    }

    const tableOffset = tableAddress & 0x00ffffff;
    if (tableOffset + count * 4 > data.length) {
        throw new Error(`Out-of-range ${age} player limb table while compacting`);
    }

    const limbs: Uint8Array[] = [];
    for (let i = 0; i < count; ++i) {
        const limbAddress = bufReadU32BE(data, tableOffset + i * 4);
        if ((limbAddress >>> 24) !== 0x06) {
            throw new Error(`Invalid ${age} player limb ${i} while compacting`);
        }

        const limbOffset = limbAddress & 0x00ffffff;
        if (limbOffset + 0x10 > data.length) {
            throw new Error(`Out-of-range ${age} player limb ${i} while compacting`);
        }

        const limb = new Uint8Array(data.subarray(limbOffset, limbOffset + 0x10));
        for (const pointerOffset of [0x08, 0x0c]) {
            const address = bufReadU32BE(limb, pointerOffset);
            if (address !== 0 && (address >>> 24) === 0x06) {
                graph.addDisplayListRoot(address);
            }
        }
        limbs.push(limb);
    }

    return { limbs, count };
}

type OotCompactionAttempt = {
    model: PreparedOotModel;
    usedSize: number;
};

function buildOotCompactionAttempt(
    prepared: PreparedOotModel,
    vanilla: Uint8Array,
    age: OotModelAge,
    maxSize: number,
    replacedPieces: string[],
): OotCompactionAttempt {
    const source = prepared.data;
    const hierarchy = age === 'adult' ? ADULT_HIERARCHY : CHILD_HIERARCHY;
    const pieces = age === 'adult' ? ADULT_PIECES : CHILD_PIECES;
    const skips = age === 'adult' ? ADULT_SKIPS : CHILD_SKIPS;
    const replacements = new Set(replacedPieces);

    if (source.length < LUT_END) {
        throw new Error(`Cannot compact ${age} OoT model smaller than the player LUT`);
    }
    if (maxSize < LUT_END) {
        throw new Error(`OoT ${age} model budget is smaller than the player LUT`);
    }

    const graph = new PlayerModelGraphCompactor(source, LUT_END);
    const skeleton = collectPlayerSkeletonForCompaction(graph, source, hierarchy, age);
    const pieceTargets = new Map<string, { entry: number, target: number }>();

    for (const [name, piece] of Object.entries(pieces)) {
        const lutOffset = piece[0] - BASE_OFFSET;
        const entry = unwrap(source, lutOffset);
        if (entry < LUT_START || entry + 8 > LUT_END) {
            throw new Error(`OoT ${age} LUT entry for ${name} escaped the fixed player pool`);
        }

        if (replacements.has(name)) {
            continue;
        }

        const target = bufReadU32BE(source, entry + 4);
        graph.addDisplayListRoot(target);
        pieceTargets.set(name, { entry, target });
    }

    const packed = graph.build(LUT_END);
    const skeletonStart = LUT_END + packed.data.length;
    const tableStart = align16(skeletonStart + skeleton.count * 0x10);
    const afterSkeleton = align16(tableStart + skeleton.count * 4);

    const vanillaCopied = replacedPieces.length > 0
        ? loadVanilla(vanilla, replacedPieces, afterSkeleton, pieces, skips)
        : { data: new Uint8Array(0), offsets: new Map<string, number>() };

    const usedSize = align16(afterSkeleton + vanillaCopied.data.length);
    const outputSize = usedSize <= maxSize ? maxSize : usedSize;
    const output = new Uint8Array(outputSize);

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

    output.set(vanillaCopied.data, afterSkeleton);

    const hierarchyOffset = hierarchy - BASE_OFFSET;
    bufWriteU32BE(output, hierarchyOffset, BASE_OFFSET | tableStart);
    output[hierarchyOffset + 4] = skeleton.count;

    for (const [name, piece] of Object.entries(pieces)) {
        const lutOffset = piece[0] - BASE_OFFSET;
        const entry = unwrap(output, lutOffset);
        let target: number;

        if (replacements.has(name)) {
            const vanillaOffset = vanillaCopied.offsets.get(name);
            if (vanillaOffset === undefined) {
                throw new Error(`Failed to compact OoT ${age} vanilla equipment piece ${name}`);
            }
            target = BASE_OFFSET | (afterSkeleton + vanillaOffset);
        } else {
            const compacted = pieceTargets.get(name);
            if (!compacted) {
                throw new Error(`Failed to compact OoT ${age} model piece ${name}`);
            }
            target = packed.mapAddress(compacted.target);
        }

        output[entry] = 0xde;
        output[entry + 1] = 0x01;
        bufWriteU32BE(output, entry + 4, target);
    }

    const dfAddr = findEmptyListOffset(output);
    return {
        model: {
            data: output,
            dfAddr,
            compaction: {
                originalSize: prepared.data.length,
                usedSize,
                replacedPieces: [...replacedPieces],
            },
        },
        usedSize,
    };
}

export function compactOotPlayerModel(
    prepared: PreparedOotModel,
    vanilla: Uint8Array,
    age: OotModelAge,
    maxSize = age === 'adult' ? OOT_ADULT_MODEL_SIZE : OOT_CHILD_MODEL_SIZE,
    preserveEquipmentPieces: Iterable<string> = [],
): PreparedOotModel {

    const preserve = new Set(preserveEquipmentPieces);
    const vanillaEquipment = ootVanillaEquipmentPieces(age)
        .filter((name) => !preserve.has(name));
    return buildOotCompactionAttempt(
        prepared,
        vanilla,
        age,
        maxSize,
        vanillaEquipment,
    ).model;
}


const MM_PROCESSED_BODY_LUTS: Record<string, number> = {
    'Limb 1': 0x06005110,
    'Limb 3': 0x06005118,
    'Limb 4': 0x06005120,
    'Limb 5': 0x06005128,
    'Limb 6': 0x06005130,
    'Limb 7': 0x06005138,
    'Limb 8': 0x06005140,
    'Limb 10': 0x06005148,
    'Limb 11': 0x06005150,
    'Limb 12': 0x06005158,
    'Limb 13': 0x06005160,
    'Limb 14': 0x06005168,
    'Limb 15': 0x06005188,
    'Limb 16': 0x06005170,
    'Limb 17': 0x06005178,
    'Limb 18': 0x060051a0,
    'Limb 20': 0x06005180,
    'Fist.L': 0x06005190,
    'Fist.R': 0x060051a8,
};

function readProcessedDirectLutTarget(data: Uint8Array, address: number, description: string) {
    const offset = address - BASE_OFFSET;
    if (offset < LUT_START || offset + 8 > LUT_END) {
        throw new Error(`${description} LUT address is outside the processed player pool`);
    }
    if (data[offset] !== 0xde) {
        throw new Error(`${description} LUT entry is not a display-list call`);
    }

    const target = bufReadU32BE(data, offset + 4);
    if ((target >>> 24) !== 0x06 || (target & 0x00ffffff) >= data.length) {
        throw new Error(`${description} has an invalid segment-06 target: 0x${target.toString(16)}`);
    }
    return target;
}

function convertProcessedMmToOot(
    input: Uint8Array,
    vanilla: Uint8Array,
    age: OotModelAge,
    skeleton: number[][],
    hierarchy: number,
    preConstants: Uint8Array,
    postConstants: Uint8Array,
    postConstantStart: number,
): Uint8Array {
    let data = new Uint8Array(input);
    const sourceType = data[LUT_START + 0x0b];
    const expectedSourceType = age === 'adult' ? 0x68 : 0x04;

    if (sourceType !== expectedSourceType) {
        throw new Error(
            `Processed cross-game model is not an MM ${age} model ` +
            `(type 0x${sourceType.toString(16)})`,
        );
    }

    const sourceHierarchyOffset = findHierarchy(data, age);
    const sourceLimbTable = bufReadU32BE(data, sourceHierarchyOffset);
    if ((sourceLimbTable >>> 24) !== 0x06) {
        throw new Error(`Processed MM ${age} model has an invalid limb table`);
    }
    const sourceLimbTableOffset = sourceLimbTable & 0x00ffffff;
    if (sourceLimbTableOffset < LUT_END || sourceLimbTableOffset + 21 * 4 > data.length) {
        throw new Error(
            `Processed MM ${age} model stores its limb table inside the fixed player pool; ` +
            `this cross-game layout is not supported`,
        );
    }

    const pieces = age === 'adult' ? ADULT_PIECES : CHILD_PIECES;
    const bodyTargets = new Map<string, number>();

    for (const name of Object.keys(pieces)) {
        if (!isCrossGamePlayerPiece(name)) {
            continue;
        }

        const sourceLut = MM_PROCESSED_BODY_LUTS[name];
        if (sourceLut === undefined) {
            throw new Error(`No processed MM body mapping exists for OoT piece ${name}`);
        }

        const target = readProcessedDirectLutTarget(
            data,
            sourceLut,
            `Processed MM ${age} ${name}`,
        );
        bodyTargets.set(name, target);

    }

    data.set(vanilla.subarray(LUT_START, LUT_END), LUT_START);
    data.set(encoder.encode('HEYLOOKHERE'), LUT_START);
    data[LUT_START + 0x0b] = age === 'adult' ? 0x00 : 0x01;
    data.set(preConstants, PRE_CONSTANT_START);
    data.set(postConstants, postConstantStart);

    const hierarchyTarget = hierarchy - BASE_OFFSET;
    bufWriteU32BE(data, hierarchyTarget, sourceLimbTable);
    data[hierarchyTarget + 4] = 0x15;
    data[hierarchyTarget + 8] = 0x12;

    for (const [name, piece] of Object.entries(pieces)) {
        if (!isCrossGamePlayerPiece(name)) {
            continue;
        }

        const target = bodyTargets.get(name);
        if (target === undefined) {
            throw new Error(`Failed to carry processed MM body piece ${name} into OoT`);
        }

        const entry = unwrap(data, piece[0] - BASE_OFFSET);
        if (entry < LUT_START || entry + 8 > LUT_END) {
            throw new Error(`OoT ${age} LUT entry for ${name} escaped the fixed player pool`);
        }
        data[entry] = 0xde;
        data[entry + 1] = 0x01;
        data[entry + 2] = 0x00;
        data[entry + 3] = 0x00;
        bufWriteU32BE(data, entry + 4, target);
    }

    return data;
}

export function prepareOotModel(model: Uint8Array, vanilla: Uint8Array, age: OotModelAge, crossGame = false): PreparedOotModel {
    const size = age === 'adult' ? ADULT_SIZE : CHILD_SIZE;
    const hierarchy = age === 'adult' ? ADULT_HIERARCHY : CHILD_HIERARCHY;
    const postConstantStart = age === 'adult' ? ADULT_POST_START : CHILD_POST_START;
    const preConstants = age === 'adult' ? ADULT_PRE_CONSTANTS : CHILD_PRE_CONSTANTS;
    const postConstants = age === 'adult' ? ADULT_POST_CONSTANTS : CHILD_POST_CONSTANTS;
    const skips = age === 'adult' ? ADULT_SKIPS : CHILD_SKIPS;
    const skeleton = age === 'adult' ? ADULT_SKELETON : CHILD_SKELETON;
    let data: Uint8Array = new Uint8Array(model);
    const processed = asciiEquals(data, LUT_START, 'MODLOADER64');

    if (vanilla.length < size) {
        throw new Error(`Vanilla model for ${age} Link is too small`);
    }

    if (processed && crossGame) {
        if (data.length < LUT_END) {
            throw new Error(`Processed cross-game model for ${age} Link is too small`);
        }

        data = convertProcessedMmToOot(
            data,
            vanilla,
            age,
            skeleton,
            hierarchy,
            preConstants,
            postConstants,
            postConstantStart,
        );
    } else if (!processed) {
        if (data.length < LUT_END) {
            throw new Error(`Model for ${age} Link is too small`);
        }

        data.fill(0x00, LUT_START, LUT_END);

        const footerStart = scan(data, '!PlayAsManifest0');
        if (footerStart === -1) {
            throw new Error(`No PlayAs manifest found in ${age} model`);
        }

        const startAddr = footerStart - '!PlayAsManifest0'.length;
        const newPipeline = scan(data, 'riggedmesh', startAddr) !== -1;
        const pieces = getPieces(age, newPipeline);
        const missing: string[] = [];
        const offsets = new Map<string, number>();
        const retargetExtraLists: RetargetExtraList[] = [];

        for (const item of Object.keys(pieces)) {

            if (!isCrossGamePlayerPiece(item)) {
                missing.push(item);
                continue;
            }

            const offset = scan(data, item, footerStart);
            if (offset === -1) {
                missing.push(item);
            } else {
                offsets.set(item, offset);

                if (crossGame) {
                    const defaultLimb = crossGamePieceDefaultLimb(item);
                    if (defaultLimb !== null) {
                        retargetExtraLists.push({
                            address: BASE_OFFSET | offset,
                            defaultLimb,
                        });
                    }
                }
            }
        }

        if (missing.length > 0) {
            const copied = loadVanilla(vanilla, missing, startAddr, pieces, skips);
            data = insertData(data, startAddr, copied.data);


            for (const [item, offset] of copied.offsets) {
                offsets.set(item, offset + startAddr);
            }
        }

        if (crossGame) {
            data = retargetPlayerModelBindPose(data, skeleton, retargetExtraLists);
        }

        for (const item of Object.keys(pieces)) {
            const offset = offsets.get(item);
            if (offset === undefined) {
                throw new Error(`Failed to resolve model piece ${item}`);
            }

            const lut = pieces[item][0] - BASE_OFFSET;
            const entry = unwrap(data, lut);
            data[entry] = 0xde;
            data[entry + 1] = 0x01;
            bufWriteU32BE(data, entry + 4, offset + BASE_OFFSET);
        }

        data.set(encoder.encode('HEYLOOKHERE'), LUT_START);
        data.set(preConstants, PRE_CONSTANT_START);
        data.set(postConstants, postConstantStart);

        const hierarchyOffset = findHierarchy(data, age);
        const hierarchyTarget = hierarchy - BASE_OFFSET;
        data.set(data.subarray(hierarchyOffset, hierarchyOffset + 4), hierarchyTarget);
        data[hierarchyTarget + 4] = 0x15;
        data[hierarchyTarget + 8] = 0x12;
    } else {
        if (data.length < LUT_END) {
            throw new Error(`Processed model for ${age} Link is too small`);
        }

        const type = data[LUT_START + 0x0b];
        const expectedType = age === 'adult' ? 0x00 : 0x01;

        if (type !== expectedType) {
            throw new Error(`Processed model is for ${type === 0x00 ? 'adult' : type === 0x01 ? 'child' : 'unknown'} Link, not ${age} Link`);
        }

        const headerHierarchy = bufReadU32BE(data, PRE_CONSTANT_START);

        if (headerHierarchy === 0xffffffff || headerHierarchy === 0x00000000) {
            bufWriteU32BE(data, PRE_CONSTANT_START, hierarchy);
        } else if (headerHierarchy !== hierarchy) {
            throw new Error(`Processed ${age} model has an invalid hierarchy pointer: 0x${headerHierarchy.toString(16)}`);
        }
    }

    if (!(processed && crossGame)) {
        correctSkeleton(data, skeleton, age);
    }

    const dfAddr = findEmptyListOffset(data);

    if (data.length > size) {
        return {
            data,
            dfAddr,
        };
    }

    const output = new Uint8Array(size);
    output.set(vanilla.subarray(0, Math.min(vanilla.length, size)));
    output.set(data);

    return {
        data: output,
        dfAddr,
    };
}
