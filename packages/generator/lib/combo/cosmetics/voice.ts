import type { RomBuilder } from '../rom-builder';
import {
    bufReadU16BE,
    bufReadU32BE,
    bufWriteU32BE,
} from '../util/buffer';
import { encodeVadpcm, readVadpcmBook } from './vadpcm';
import type {
    PlayerVoiceAge,
    PlayerVoiceClip,
    PlayerVoicePair,
    PlayerVoiceSet,
} from './voice-input';

const AUDIO_SAMPLE_RATE = 32000;
const MAX_CUSTOM_VOICE_SAMPLE_RATE = 24000;
const MIN_POOLED_VOICE_SAMPLE_RATE = 8000;
const MM_HUMAN_VOICE_SAMPLE_BANK_ID = 3;
const MM_HUMAN_VOICE_FILE_ALIGNMENT = 0x10;
const MM_CHILD_ALIAS_EVENT = 0x13;
const MM_CHILD_ALIAS_SLOT = 0;

const OOT_ADULT_EFFECTS: readonly number[] = [
    ...Array.from({ length: 28 }, (_, i) => i),
    55,
    56,
    60,
    61,
    67,
    77,
    78,
    79,
    80,
    81,
    82,
    83,
    84,
    85,
    86,
    87,
    88,
    134,
];

const OOT_ADULT_TARGETS: ReadonlyMap<number, readonly number[]> = new Map([
    [0x00, [0x00, 0x01, 0x02, 0x03]],
    [0x01, [0x04, 0x05]],
    [0x02, [0x15, 0x16]],
    [0x03, [0x06, 0x19]],
    [0x04, [0x07, 0x08]],
    [0x05, [0x09, 0x0a, 0x0b]],
    [0x06, [0x0c, 0x0d, 0x0e]],
    [0x07, [0x11, 0x12]],
    [0x08, [0x0f, 0x10]],
    [0x09, [0x13, 0x17]],
    [0x0a, [0x38]],
    [0x0b, [0x4d]],
    [0x0e, [0x50]],
    [0x0f, [0x53]],
    [0x10, [0x37]],
    [0x11, [0x56]],
    [0x14, [0x1a, 0x1b]],
    [0x16, [0x86]],
    [0x1a, [0x18]],
    [0x1c, [0x3d]],
]);

const CHILD_TARGETS: ReadonlyMap<number, readonly number[]> = new Map([
    [0x00, [0x1c, 0x1d, 0x1e, 0x1f]],
    [0x01, [0x20, 0x21]],
    [0x03, [0x22, 0x32]],
    [0x04, [0x23, 0x24]],
    [0x05, [0x25, 0x26, 0x27]],
    [0x06, [0x28, 0x29, 0x2a]],
    [0x07, [0x2d, 0x2e]],
    [0x08, [0x2b, 0x2c]],
    [0x09, [0x2f, 0x30]],
    [0x0a, [0x34]],
    [0x0b, [0x41]],
    [0x0d, [0x14]],
    [0x0e, [0x43]],
    [0x0f, [0x47]],
    [0x10, [0x33]],
    [0x11, [0x4a]],
    [0x13, [0x43]],
    [0x14, [0x35, 0x36]],
    [0x16, [0x87]],
    [0x1a, [0x31]],
    [0x1c, [0x3f]],
]);

const OOT_ORDERED_EFFECT_GROUPS: Readonly<
    Record<PlayerVoiceAge, ReadonlyMap<number, readonly number[]>>
> = {
    adult: new Map([
        [0x0b, [0x4d, 0x4e, 0x4f]],
        [0x0e, [0x50, 0x51, 0x52]],
        [0x0f, [0x53, 0x54, 0x55]],
        [0x11, [0x56, 0x57, 0x58]],
    ]),

    child: new Map([
        [0x0b, [0x41, 0x42]],
        [0x0e, [0x43, 0x44, 0x45, 0x46]],
        [0x0f, [0x47, 0x48, 0x49]],
        [0x11, [0x4a, 0x4b, 0x4c]],
    ]),
};

const MM_CHILD_PRIVATE_EFFECT_SLOTS: ReadonlyMap<number, number> = new Map([
    [0x01, 0x01],
    [0x02, 0x02],
    [0x03, 0x03],
    [0x05, 0x04],
    [0x06, 0x05],
    [0x07, 0x06],
    [0x08, 0x07],
    [0x09, 0x08],
    [0x0a, 0x09],
    [0x0b, 0x0a],
    [0x0c, 0x0b],
]);

const MM_CHILD_TARGETS_BASE: ReadonlyMap<number, readonly number[]> = CHILD_TARGETS;

const MM_CHILD_ORDERED_SOURCE_GROUPS: ReadonlyMap<number, readonly number[]> = new Map([
    [0x0b, [0x01, 0x02]],
    [0x0e, [0x03, 0x05, 0x06]],
    [0x0f, [0x07, 0x08, 0x09]],
    [0x11, [0x0a, 0x0b, 0x0c]],
]);

type DecodedAudio = {
    channelData: Float32Array[];
    sampleRate: number;
};

type DecodedVoice = {
    samples: Float32Array;
    sampleRate: number;
};

type EncodedVoice = {
    data: Uint8Array;
    frames: number;
    sampleRate: number;
    tuning: number;
};

type EncodedVoiceChunk = {
    effect: number;
    encoded: EncodedVoice;
    sampleAddr: number;
    selector: number;
};

type TableEntry = {
    addr: number;
    size: number;
    index: number;
};

type ResolvedSlice = {
    data: Uint8Array;
    offset: number;
};

type FontContext = {
    font: Uint8Array;
    bankTable: Uint8Array;
    sfxTable: number;
};

type SampleBankContext = {
    key: string;
    game: 'oot' | 'mm';
    id: number;
    addr: number;
    size: number;
    data: Uint8Array;
};

type StorageSpan = {
    start: number;
    end: number;
};

type SampleBankStoragePool = {
    bank: SampleBankContext;
    spans: StorageSpan[];
};

type EffectSampleRegion = {
    effect: number;
    effectOffset: number;
    sample: number;
    sampleBank: SampleBankContext;
    selector: number;
    sampleAddr: number;
    capacity: number;
};

type PatchedSample = {
    clipKey: string;
    encoded: EncodedVoice;
    sampleAddr: number;
    selector: number;
};

type SampleOrigin = {
    selector: number;
    sampleAddr: number;
    capacity: number;
};

type PatchState = {
    decoded: Map<PlayerVoiceClip, DecodedVoice>;
    sampleBanks: Map<string, SampleBankContext>;
    storagePools: Map<string, SampleBankStoragePool>;
    patchedSamples: Map<string, PatchedSample>;
    sampleOrigins: Map<string, SampleOrigin>;
    globalRateCap: number;
};

type VoiceSetStorageSpec = {
    game: 'oot' | 'mm';
    age: PlayerVoiceAge;
    context: FontContext;
    set: PlayerVoiceSet | null;
    targets: ReadonlyMap<number, readonly number[]>;
    orderedGroups: ReadonlyMap<number, readonly number[]> | null;
    sequence: Uint8Array | null;
};

type NonOrderedReservationDemand = {
    order: number;
    context: FontContext;
    region: EffectSampleRegion;
    clip: PlayerVoiceClip;
    decoded: DecodedVoice;
    fullSize: number;
};

function asciiEquals(data: Uint8Array, offset: number, value: string) {
    if (offset + value.length > data.length) return false;
    for (let i = 0; i < value.length; ++i) {
        if (data[offset + i] !== value.charCodeAt(i)) return false;
    }
    return true;
}

function audioFormat(data: Uint8Array, name: string): 'wav' | 'aiff' | 'vorbis' {
    if (asciiEquals(data, 0, 'RIFF') && asciiEquals(data, 8, 'WAVE')) return 'wav';
    if (asciiEquals(data, 0, 'FORM') && (asciiEquals(data, 8, 'AIFF') || asciiEquals(data, 8, 'AIFC'))) return 'aiff';
    if (asciiEquals(data, 0, 'OggS')) return 'vorbis';

    const lower = name.toLowerCase();
    if (lower.endsWith('.wav')) return 'wav';
    if (lower.endsWith('.aiff') || lower.endsWith('.aif') || lower.endsWith('.aifc')) return 'aiff';
    if (lower.endsWith('.ogg') || lower.endsWith('.oga')) return 'vorbis';
    throw new Error(`Unsupported voice audio format: ${name}`);
}

async function decodeAudio(data: Uint8Array, name: string): Promise<DecodedAudio> {
    switch (audioFormat(data, name)) {
        case 'wav': {
            const module = await import('@audio/decode-wav');
            return module.default(data) as DecodedAudio;
        }
        case 'aiff': {
            const module = await import('@audio/decode-aiff');
            return module.default(data) as DecodedAudio;
        }
        case 'vorbis': {
            const module = await import('@audio/decode-vorbis');
            return await module.default(data) as DecodedAudio;
        }
    }
}

function readU24BE(data: Uint8Array, offset: number) {
    return (data[offset] << 16) | (data[offset + 1] << 8) | data[offset + 2];
}

function writeU24BE(data: Uint8Array, offset: number, value: number) {
    data[offset] = value >>> 16;
    data[offset + 1] = value >>> 8;
    data[offset + 2] = value;
}

function writeF32BE(data: Uint8Array, offset: number, value: number) {
    new DataView(data.buffer, data.byteOffset + offset, 4).setFloat32(0, value, false);
}

function hasVoices(set: PlayerVoiceSet | null) {
    if (!set) return false;
    for (const clips of set.values()) {
        if (clips.length) return true;
    }
    return false;
}

function hashBytes(data: Uint8Array) {
    let a = 0x811c9dc5;
    let b = 0x9e3779b9;
    for (let i = 0; i < data.length; ++i) {
        const value = data[i];
        a ^= value;
        a = Math.imul(a, 0x01000193) >>> 0;
        b ^= value + i;
        b = Math.imul(b, 0x85ebca6b) >>> 0;
        b ^= b >>> 13;
    }
    return `${data.length.toString(16)}:${a.toString(16)}:${b.toString(16)}`;
}

function clipKey(clip: PlayerVoiceClip) {
    return `${clip.normalize ? 1 : 0}:${hashBytes(clip.data)}`;
}

function tableEntry(data: Uint8Array, index: number): TableEntry {
    const offset = index * 0x10;
    if (offset + 0x10 > data.length) throw new Error(`Audio table entry ${index} is out of range`);
    return {
        addr: bufReadU32BE(data, offset),
        size: bufReadU32BE(data, offset + 4),
        index,
    };
}

function resolvedTableEntry(data: Uint8Array, index: number) {
    const seen = new Set<number>();
    let current = index;
    for (;;) {
        if (seen.has(current)) throw new Error(`Audio table alias loop at ${index}`);
        seen.add(current);
        const entry = tableEntry(data, current);
        if (entry.size !== 0) return entry;
        current = entry.addr;
    }
}

function resolveSlice(builder: RomBuilder, addr: number, size: number): ResolvedSlice {
    const end = addr + size;
    for (const file of builder.allFiles()) {
        if (!file.data.length) continue;
        const starts: number[] = [];
        if (file.vaddr !== undefined) starts.push(file.vaddr);
        if (file.paddr !== undefined && file.type === 'uncompressed') starts.push(file.paddr);
        for (const start of starts) {
            const fileEnd = start + file.data.length;
            if (addr >= start && end <= fileEnd) {
                const offset = addr - start;
                return {
                    data: file.data.subarray(offset, offset + size),
                    offset,
                };
            }
        }
    }
    throw new Error(`Unable to resolve ROM file range 0x${addr.toString(16)}-0x${end.toString(16)}`);
}

function getFont0(builder: RomBuilder, game: 'oot' | 'mm'): FontContext {
    const bankTable = builder.fileByNameRequired(`${game}/bank_table`).data;
    const fontEntry = tableEntry(bankTable, 0);
    const font = resolveSlice(builder, fontEntry.addr, fontEntry.size).data;
    const sfxTable = bufReadU32BE(font, 4);
    if (!sfxTable || sfxTable >= font.length) {
        throw new Error(`${game.toUpperCase()} Soundfont 0 has an invalid SFX table`);
    }
    return { font, bankTable, sfxTable };
}

function getSampleBank(
    builder: RomBuilder,
    state: PatchState,
    game: 'oot' | 'mm',
    bankTable: Uint8Array,
    selector: number,
) {
    if (selector > 1) {
        throw new Error(`${game.toUpperCase()} voice sample uses unsupported sample-bank selector ${selector}`);
    }

    const id = bankTable[0x0a + selector];
    if (id === 0xff) throw new Error(`${game.toUpperCase()} voice sample has no sample bank`);

    let tableGame: 'oot' | 'mm' = game;
    let tableId = id;
    if (game === 'mm' && id >= 8) {
        tableGame = 'oot';
        tableId = id - 8;
    } else if (id >= 8) {
        throw new Error(`${game.toUpperCase()} voice sample uses unsupported foreign sample bank ${id}`);
    }

    const audioTable = builder.fileByNameRequired(`${tableGame}/audio_table`).data;
    const entry = resolvedTableEntry(audioTable, tableId);
    const key = `${tableGame}:${entry.addr}:${entry.size}`;
    const cached = state.sampleBanks.get(key);
    if (cached) return cached;

    const source = resolveSlice(builder, entry.addr, entry.size);
    const value: SampleBankContext = {
        key,
        game: tableGame,
        id: tableId,
        addr: entry.addr,
        size: entry.size,
        data: source.data,
    };
    state.sampleBanks.set(key, value);
    return value;
}

function effectInfo(context: FontContext, effect: number) {
    const effectOffset = context.sfxTable + effect * 8;
    if (effectOffset + 8 > context.font.length) throw new Error(`Soundfont effect ${effect} is out of range`);
    const sample = bufReadU32BE(context.font, effectOffset);
    if (!sample || sample + 0x10 > context.font.length) {
        throw new Error(`Soundfont effect ${effect} has an invalid sample`);
    }
    return { effectOffset, sample };
}

async function decodeClip(state: PatchState, clip: PlayerVoiceClip): Promise<DecodedVoice> {
    const cached = state.decoded.get(clip);
    if (cached) return cached;

    let decoded: DecodedAudio;
    try {
        decoded = await decodeAudio(clip.data, clip.name);
    } catch (e) {
        throw new Error(`Failed to decode ${clip.name}: ${e}`);
    }

    const { channelData, sampleRate } = decoded;
    if (!channelData.length || !Number.isFinite(sampleRate) || sampleRate <= 0) {
        throw new Error(`Invalid voice audio ${clip.name}`);
    }

    let frames = channelData[0].length;
    for (const channel of channelData) frames = Math.min(frames, channel.length);
    if (!frames) throw new Error(`Empty voice audio ${clip.name}`);

    const mono = new Float32Array(frames);
    for (let i = 0; i < frames; ++i) {
        let value = 0;
        for (const channel of channelData) value += Number.isFinite(channel[i]) ? channel[i] : 0;
        mono[i] = value / channelData.length;
    }

    if (clip.normalize) {
        let peak = 0;
        for (const value of mono) peak = Math.max(peak, Math.abs(value));
        if (peak > 0) for (let i = 0; i < mono.length; ++i) mono[i] /= peak;
    }

    let start = 0;
    if (clip.normalize) {
        while (start < mono.length && Math.round(Math.abs(mono[start]) * 32767) === 0) ++start;
    }
    if (start >= mono.length) start = 0;

    const value = {
        samples: new Float32Array(mono.subarray(start)),
        sampleRate,
    };
    state.decoded.set(clip, value);
    return value;
}

function sinc(value: number) {
    if (Math.abs(value) < 1e-8) return 1;
    const x = Math.PI * value;
    return Math.sin(x) / x;
}

function floatToS16(value: number) {
    const clamped = Math.max(-1, Math.min(1, value));
    return clamped < 0 ? Math.round(clamped * 32768) : Math.round(clamped * 32767);
}

function resampleLinearToS16(input: Float32Array, sourceRate: number, targetRate: number) {
    const outputLength = Math.max(1, Math.floor(input.length * targetRate / sourceRate));
    const output = new Int16Array(outputLength);
    const ratio = sourceRate / targetRate;
    for (let i = 0; i < outputLength; ++i) {
        const position = i * ratio;
        const index = Math.floor(position);
        const fraction = position - index;
        const a = input[Math.min(index, input.length - 1)];
        const b = input[Math.min(index + 1, input.length - 1)];
        output[i] = floatToS16(a + (b - a) * fraction);
    }
    return output;
}

function resampleBandlimitedToS16(input: Float32Array, sourceRate: number, targetRate: number) {
    const outputLength = Math.max(1, Math.floor(input.length * targetRate / sourceRate));
    const output = new Int16Array(outputLength);
    const sourcePerOutput = sourceRate / targetRate;
    const cutoff = Math.min(1, targetRate / sourceRate) * 0.92;
    const radius = Math.max(12, Math.min(48, Math.ceil(8 / Math.max(cutoff, 0.08))));

    for (let i = 0; i < outputLength; ++i) {
        const position = i * sourcePerOutput;
        const center = Math.floor(position);
        const left = Math.max(0, center - radius);
        const right = Math.min(input.length - 1, center + radius);
        let sum = 0;
        let weightSum = 0;
        for (let sourceIndex = left; sourceIndex <= right; ++sourceIndex) {
            const distance = position - sourceIndex;
            const normalizedDistance = distance / radius;
            const window = 0.5 + 0.5 * Math.cos(Math.PI * normalizedDistance);
            const weight = cutoff * sinc(cutoff * distance) * window;
            sum += input[sourceIndex] * weight;
            weightSum += weight;
        }
        const value = Math.abs(weightSum) > 1e-12 ? sum / weightSum : 0;
        output[i] = floatToS16(value);
    }
    return output;
}

function resampleToS16(input: Float32Array, sourceRate: number, targetRate: number) {
    return targetRate >= sourceRate * 0.85
        ? resampleLinearToS16(input, sourceRate, targetRate)
        : resampleBandlimitedToS16(input, sourceRate, targetRate);
}

function encodeVoice(decoded: DecodedVoice, font: Uint8Array, sample: number, clipName: string): EncodedVoice {
    if ((font[sample] >>> 4) !== 0) throw new Error(`Target for ${clipName} is not a standard VADPCM sample`);
    const bookPointer = bufReadU32BE(font, sample + 0x0c);
    if (!bookPointer) throw new Error(`Target for ${clipName} has no VADPCM predictor book`);
    const book = readVadpcmBook(font, bookPointer);
    const targetRate = Math.min(
        AUDIO_SAMPLE_RATE,
        MAX_CUSTOM_VOICE_SAMPLE_RATE,
        Math.max(1, Math.floor(decoded.sampleRate)),
    );
    const samples = resampleToS16(decoded.samples, decoded.sampleRate, targetRate);
    const data = encodeVadpcm(samples, book);
    return {
        data,
        frames: samples.length,
        sampleRate: targetRate,
        tuning: targetRate / AUDIO_SAMPLE_RATE,
    };
}

function updateSampleMetadata(font: Uint8Array, sample: number, encoded: EncodedVoice) {
    writeU24BE(font, sample + 1, encoded.data.length);
    const loop = bufReadU32BE(font, sample + 8);
    if (loop && loop + 0x10 <= font.length) {
        bufWriteU32BE(font, loop, 0);
        bufWriteU32BE(font, loop + 4, encoded.frames);
        bufWriteU32BE(font, loop + 8, 0);
    }
}

function registerStorageRegion(state: PatchState, region: EffectSampleRegion) {
    let pool = state.storagePools.get(region.sampleBank.key);
    if (!pool) {
        pool = { bank: region.sampleBank, spans: [] };
        state.storagePools.set(region.sampleBank.key, pool);
    }
    pool.spans.push({ start: region.sampleAddr, end: region.sampleAddr + region.capacity });
}

function mergeStoragePools(state: PatchState) {
    for (const pool of state.storagePools.values()) {
        const ordered = [...pool.spans].sort((a, b) => a.start - b.start);
        const merged: StorageSpan[] = [];
        for (const span of ordered) {
            if (span.start < 0 || span.end > pool.bank.data.length || span.end <= span.start) {
                throw new Error('Invalid reclaimed voice-storage span');
            }
            const previous = merged[merged.length - 1];
            if (previous && span.start <= previous.end) previous.end = Math.max(previous.end, span.end);
            else merged.push({ ...span });
        }
        pool.spans = merged;
    }
}

function storageSpanLength(span: StorageSpan) {
    return span.end - span.start;
}

function bestFitSpan(pool: SampleBankStoragePool, size: number) {
    let best = -1;
    let bestLength = Number.MAX_SAFE_INTEGER;
    for (let i = 0; i < pool.spans.length; ++i) {
        const length = storageSpanLength(pool.spans[i]);
        if (length >= size && length < bestLength) {
            best = i;
            bestLength = length;
        }
    }
    return best;
}

function largestStorageSpan(pool: SampleBankStoragePool) {
    let best = -1;
    let bestLength = 0;
    for (let i = 0; i < pool.spans.length; ++i) {
        const length = storageSpanLength(pool.spans[i]);
        if (length > bestLength) {
            best = i;
            bestLength = length;
        }
    }
    return { index: best, length: bestLength };
}

function consumeStorageSpan(pool: SampleBankStoragePool, index: number, data: Uint8Array) {
    const span = pool.spans[index];
    if (!span || data.length > storageSpanLength(span)) throw new Error('Voice storage allocator overflow');
    const sampleAddr = span.start;
    pool.bank.data.set(data, sampleAddr);
    span.start += data.length;
    if (span.start === span.end) pool.spans.splice(index, 1);
    return sampleAddr;
}

function encodeVoiceToCapacity(
    decoded: DecodedVoice,
    font: Uint8Array,
    sample: number,
    capacity: number,
    clipName: string,
): EncodedVoice {
    if ((font[sample] >>> 4) !== 0) throw new Error(`Target for ${clipName} is not a standard VADPCM sample`);
    const bookPointer = bufReadU32BE(font, sample + 0x0c);
    if (!bookPointer) throw new Error(`Target for ${clipName} has no VADPCM predictor book`);

    const maxFrames = Math.floor(capacity / 9);
    const maxSamples = maxFrames * 16;
    if (maxSamples < 16) throw new Error(`No reclaimed voice-storage span is large enough for ${clipName}`);

    const maxRateForCapacity = Math.floor(maxSamples * decoded.sampleRate / decoded.samples.length);
    const targetRate = Math.min(
        AUDIO_SAMPLE_RATE,
        MAX_CUSTOM_VOICE_SAMPLE_RATE,
        Math.max(1, Math.floor(decoded.sampleRate)),
        maxRateForCapacity,
    );

    if (targetRate < MIN_POOLED_VOICE_SAMPLE_RATE) {
        throw new Error(
            `${clipName} cannot fit in reclaimed Link voice storage without dropping below ` +
            `${MIN_POOLED_VOICE_SAMPLE_RATE} Hz (best is ${targetRate} Hz)`,
        );
    }

    const samples = resampleToS16(decoded.samples, decoded.sampleRate, targetRate);
    const book = readVadpcmBook(font, bookPointer);
    const data = encodeVadpcm(samples, book);
    if (data.length > capacity) throw new Error(`${clipName} exceeded its pooled voice-storage capacity`);

    return {
        data,
        frames: samples.length,
        sampleRate: targetRate,
        tuning: targetRate / AUDIO_SAMPLE_RATE,
    };
}

function allocateVoiceStorage(
    state: PatchState,
    region: EffectSampleRegion,
    decoded: DecodedVoice,
    font: Uint8Array,
    clipName: string,
) {
    const pool = state.storagePools.get(region.sampleBank.key);
    if (!pool) throw new Error('Voice storage pool was not prepared');

    let encoded = encodeVoice(decoded, font, region.sample, clipName);
    let spanIndex = bestFitSpan(pool, encoded.data.length);
    if (spanIndex < 0) {
        const largest = largestStorageSpan(pool);
        if (largest.index < 0) throw new Error(`No reclaimed Link voice storage remains for ${clipName}`);
        encoded = encodeVoiceToCapacity(decoded, font, region.sample, largest.length, clipName);
        spanIndex = largest.index;
    }

    const sampleAddr = consumeStorageSpan(pool, spanIndex, encoded.data);
    return { encoded, sampleAddr };
}

function encodePcmChunk(
    pcm: Int16Array,
    font: Uint8Array,
    sample: number,
    targetRate: number,
    clipName: string,
): EncodedVoice {
    if (!pcm.length) throw new Error(`Ordered voice chunk for ${clipName} is empty`);
    if ((font[sample] >>> 4) !== 0) throw new Error(`Target for ${clipName} is not a standard VADPCM sample`);
    const bookPointer = bufReadU32BE(font, sample + 0x0c);
    if (!bookPointer) throw new Error(`Target for ${clipName} has no VADPCM predictor book`);
    const book = readVadpcmBook(font, bookPointer);
    const data = encodeVadpcm(pcm, book);
    return {
        data,
        frames: pcm.length,
        sampleRate: targetRate,
        tuning: targetRate / AUDIO_SAMPLE_RATE,
    };
}

type OrderedStorageCandidate = {
    span: StorageSpan;
    frames: number;
};

function partitionVadpcmFrames(totalFrames: number, capacities: readonly number[]) {
    if (!capacities.length) throw new Error('No ordered voice storage capacities');
    let actualCapacities = capacities;
    if (totalFrames < actualCapacities.length) actualCapacities = actualCapacities.slice(0, totalFrames);

    const result: number[] = [];
    let remainingFrames = totalFrames;
    let remainingCapacity = actualCapacities.reduce((a, b) => a + b, 0);

    for (let i = 0; i < actualCapacities.length; ++i) {
        const capacity = actualCapacities[i];
        const slotsAfter = actualCapacities.length - i - 1;
        if (i === actualCapacities.length - 1) {
            if (remainingFrames < 1 || remainingFrames > capacity) {
                throw new Error('Unable to partition ordered voice frames');
            }
            result.push(remainingFrames);
            break;
        }

        const laterCapacity = remainingCapacity - capacity;
        const minimum = Math.max(1, remainingFrames - laterCapacity);
        const maximum = Math.min(capacity, remainingFrames - slotsAfter);
        if (minimum > maximum) throw new Error('Unable to partition ordered voice frames');
        const proportional = Math.round(remainingFrames * capacity / remainingCapacity);
        const frames = Math.max(minimum, Math.min(maximum, proportional));
        result.push(frames);
        remainingFrames -= frames;
        remainingCapacity -= capacity;
    }
    return result;
}

function maxVadpcmFramesForShortOrderedNote(sampleRate: number) {
    const maxSamples = Math.max(1, Math.ceil(127 * sampleRate / 96) - 1);
    return Math.max(1, Math.floor(maxSamples / 16));
}

function orderedPartitionForSequenceBudget(
    totalFrames: number,
    candidates: readonly OrderedStorageCandidate[],
    sampleRate: number,
    sequenceByteBudget: number,
) {
    const count = candidates.length;
    if (!count || sequenceByteBudget < count * 3) return null;

    const maxLongCommands = Math.min(count, sequenceByteBudget - count * 3);
    const requiredShortCommands = count - maxLongCommands;
    const shortFrameLimit = maxVadpcmFramesForShortOrderedNote(sampleRate);
    const sorted = [...candidates].sort((a, b) => b.frames - a.frames);
    const longCandidates = sorted.slice(0, count - requiredShortCommands);
    const shortCandidates = sorted.slice(count - requiredShortCommands);
    const orderedCandidates = [...shortCandidates, ...longCandidates];
    const capacities = orderedCandidates.map((candidate, index) =>
        index < requiredShortCommands ? Math.min(candidate.frames, shortFrameLimit) : candidate.frames,
    );
    if (capacities.some(capacity => capacity < 1)) return null;

    const totalCapacity = capacities.reduce((sum, capacity) => sum + capacity, 0);
    if (totalFrames < count || totalFrames > totalCapacity) return null;
    const parts = partitionVadpcmFrames(totalFrames, capacities);
    return { candidates: orderedCandidates, parts };
}

type OrderedAllocationPlan = {
    targetRate: number;
    candidates: OrderedStorageCandidate[];
    parts: number[];
};

function orderedAllocationPlanForSpans(
    spans: readonly StorageSpan[],
    maxChunks: number,
    decoded: DecodedVoice,
    rateCap: number,
    sequenceByteBudget: number,
): OrderedAllocationPlan | null {
    const targetRate = Math.min(preferredVoiceSampleRate(decoded), rateCap);
    const outputSamples = Math.max(1, Math.floor(decoded.samples.length * targetRate / decoded.sampleRate));
    const neededVadpcmFrames = Math.ceil(outputSamples / 16);
    const candidates = spans
        .map(span => ({ span, frames: Math.floor(storageSpanLength(span) / 9) }))
        .filter(candidate => candidate.frames > 0);

    if (!candidates.length || maxChunks < 1) return null;

    let bestPlan: OrderedAllocationPlan | null = null;
    let bestSelectedBytes = Number.MAX_SAFE_INTEGER;
    let bestCount = Number.MAX_SAFE_INTEGER;
    const maxCount = Math.min(maxChunks, candidates.length, neededVadpcmFrames);

    for (let count = 1; count <= maxCount; ++count) {
        const selected: OrderedStorageCandidate[] = [];
        const visit = (startIndex: number) => {
            if (selected.length === count) {
                const partition = orderedPartitionForSequenceBudget(
                    neededVadpcmFrames,
                    selected,
                    targetRate,
                    sequenceByteBudget,
                );
                if (!partition) return;
                const selectedBytes = selected.reduce((sum, candidate) => sum + storageSpanLength(candidate.span), 0);
                if (selectedBytes < bestSelectedBytes || (selectedBytes === bestSelectedBytes && count < bestCount)) {
                    bestPlan = { targetRate, candidates: partition.candidates, parts: partition.parts };
                    bestSelectedBytes = selectedBytes;
                    bestCount = count;
                }
                return;
            }

            const needed = count - selected.length;
            for (let i = startIndex; i <= candidates.length - needed; ++i) {
                selected.push(candidates[i]);
                visit(i + 1);
                selected.pop();
            }
        };
        visit(0);
    }

    return bestPlan;
}

function consumeStorageAt(pool: SampleBankStoragePool, start: number, data: Uint8Array) {
    const end = start + data.length;
    for (let i = 0; i < pool.spans.length; ++i) {
        const span = pool.spans[i];
        if (start < span.start || end > span.end) continue;
        pool.bank.data.set(data, start);
        const replacement: StorageSpan[] = [];
        if (span.start < start) replacement.push({ start: span.start, end: start });
        if (end < span.end) replacement.push({ start: end, end: span.end });
        pool.spans.splice(i, 1, ...replacement);
        return start;
    }
    throw new Error(`Voice storage range 0x${start.toString(16)}-0x${end.toString(16)} disappeared`);
}

function allocateOrderedVoiceStorage(
    state: PatchState,
    context: FontContext,
    regions: readonly EffectSampleRegion[],
    decoded: DecodedVoice,
    clipName: string,
    sequenceByteBudget: number,
): EncodedVoiceChunk[] {
    const pool = state.storagePools.get(regions[0].sampleBank.key);
    if (!pool) throw new Error('Ordered voice storage pool was not prepared');

    const plan = orderedAllocationPlanForSpans(
        pool.spans,
        regions.length,
        decoded,
        state.globalRateCap,
        sequenceByteBudget,
    );
    if (!plan) {
        const actualRate = Math.min(preferredVoiceSampleRate(decoded), state.globalRateCap);
        throw new Error(
            `${clipName} could not use the globally planned ${actualRate} Hz voice-storage layout ` +
            `(${sequenceByteBudget}-byte sequence patch)`,
        );
    }

    const pcm = resampleToS16(decoded.samples, decoded.sampleRate, plan.targetRate);
    type PendingChunk = {
        region: EffectSampleRegion;
        candidate: OrderedStorageCandidate;
        encoded: EncodedVoice;
    };
    const pending: PendingChunk[] = [];
    let pcmOffset = 0;

    for (let i = 0; i < plan.parts.length; ++i) {
        const region = regions[i];
        const candidate = plan.candidates[i];
        const sampleCount = Math.min(plan.parts[i] * 16, pcm.length - pcmOffset);
        const chunkPcm = pcm.subarray(pcmOffset, pcmOffset + sampleCount);
        const encoded = encodePcmChunk(chunkPcm, context.font, region.sample, plan.targetRate, clipName);
        if (encoded.data.length > storageSpanLength(candidate.span)) {
            throw new Error(`Ordered voice chunk for ${clipName} exceeded its planned storage span`);
        }
        pending.push({ region, candidate, encoded });
        pcmOffset += sampleCount;
    }

    if (pcmOffset !== pcm.length) throw new Error(`Ordered voice split for ${clipName} did not consume the whole clip`);

    const encodedSequenceBytes = pending.reduce(
        (sum, item) => sum + (rawTicks(item.encoded.frames, item.encoded.sampleRate) <= 0x7f ? 3 : 4),
        0,
    );
    if (encodedSequenceBytes > sequenceByteBudget) {
        throw new Error(
            `${clipName} internal ordered split needs ${encodedSequenceBytes} sequence bytes but budget is ${sequenceByteBudget}`,
        );
    }

    const chunks: EncodedVoiceChunk[] = [];
    for (const item of pending) {
        const sampleAddr = consumeStorageAt(pool, item.candidate.span.start, item.encoded.data);
        const patched: PatchedSample = {
            clipKey: clipName,
            encoded: item.encoded,
            sampleAddr,
            selector: item.region.selector,
        };
        state.patchedSamples.set(
            physicalSampleKey(item.region.sampleBank, item.region.sampleAddr, item.region.capacity),
            patched,
        );
        applyPatchedSampleMetadata(context, item.region, patched);
        chunks.push({
            effect: item.region.effect,
            encoded: item.encoded,
            sampleAddr,
            selector: item.region.selector,
        });
    }
    return chunks;
}

function sampleSelector(font: Uint8Array, sample: number) {
    return (font[sample] >>> 2) & 3;
}

function sampleOrigin(state: PatchState, game: 'oot' | 'mm', font: Uint8Array, sample: number) {
    const key = `${game}:${sample}`;
    const cached = state.sampleOrigins.get(key);
    if (cached) return cached;
    const value: SampleOrigin = {
        selector: sampleSelector(font, sample),
        sampleAddr: bufReadU32BE(font, sample + 4),
        capacity: readU24BE(font, sample + 1),
    };
    state.sampleOrigins.set(key, value);
    return value;
}

function physicalSampleKey(sampleBank: SampleBankContext, sampleAddr: number, capacity: number) {
    return `${sampleBank.key}:${sampleAddr}:${capacity}`;
}

function applyPatchedSampleMetadata(
    context: FontContext,
    region: EffectSampleRegion,
    patched: PatchedSample,
) {
    bufWriteU32BE(context.font, region.sample + 4, patched.sampleAddr);
    updateSampleMetadata(context.font, region.sample, patched.encoded);
    writeF32BE(context.font, region.effectOffset + 4, patched.encoded.tuning);
}

async function patchSampleRegion(
    builder: RomBuilder,
    state: PatchState,
    game: 'oot' | 'mm',
    context: FontContext,
    region: EffectSampleRegion,
    clip: PlayerVoiceClip,
): Promise<PatchedSample> {
    const key = physicalSampleKey(region.sampleBank, region.sampleAddr, region.capacity);
    const existing = state.patchedSamples.get(key);
    if (existing) {
        applyPatchedSampleMetadata(context, region, existing);
        return existing;
    }

    const decoded = trimStorageSilence(await decodeClip(state, clip));
    const allocation = allocateVoiceStorage(state, region, decoded, context.font, clip.name);
    const patched: PatchedSample = {
        clipKey: clipKey(clip),
        encoded: allocation.encoded,
        sampleAddr: allocation.sampleAddr,
        selector: region.selector,
    };
    state.patchedSamples.set(key, patched);
    applyPatchedSampleMetadata(context, region, patched);
    return patched;
}

function effectSampleRegion(
    builder: RomBuilder,
    state: PatchState,
    game: 'oot' | 'mm',
    context: FontContext,
    effect: number,
): EffectSampleRegion {
    const { effectOffset, sample } = effectInfo(context, effect);
    const origin = sampleOrigin(state, game, context.font, sample);
    if (origin.selector > 1) {
        throw new Error(`${game.toUpperCase()} effect ${effect} uses unsupported sample selector ${origin.selector}`);
    }
    const sampleBank = getSampleBank(builder, state, game, context.bankTable, origin.selector);
    const { sampleAddr, capacity } = origin;
    if (sampleAddr + capacity > sampleBank.data.length) {
        throw new Error(`${game.toUpperCase()} effect ${effect} extends past its sample bank`);
    }
    return {
        effect,
        effectOffset,
        sample,
        sampleBank,
        selector: origin.selector,
        sampleAddr,
        capacity,
    };
}

function tryOrderedEffectSampleRegion(
    builder: RomBuilder,
    state: PatchState,
    game: 'oot' | 'mm',
    context: FontContext,
    effect: number,
): EffectSampleRegion | null {
    const effectOffset = context.sfxTable + effect * 8;
    if (effectOffset + 8 > context.font.length) return null;
    const sample = bufReadU32BE(context.font, effectOffset);
    if (!sample || sample + 0x10 > context.font.length) return null;
    if ((context.font[sample] >>> 4) !== 0) return null;
    const bookPointer = bufReadU32BE(context.font, sample + 0x0c);
    if (!bookPointer || bookPointer + 8 > context.font.length) return null;

    const origin = sampleOrigin(state, game, context.font, sample);
    if (origin.selector > 1) return null;
    const sampleBank = getSampleBank(builder, state, game, context.bankTable, origin.selector);
    const { sampleAddr, capacity } = origin;
    if (capacity < 9) return null;
    if (sampleAddr + capacity > sampleBank.data.length) {
        throw new Error(`${game.toUpperCase()} effect ${effect} extends past its sample bank`);
    }
    return {
        effect,
        effectOffset,
        sample,
        sampleBank,
        selector: origin.selector,
        sampleAddr,
        capacity,
    };
}

function trimStorageSilence(decoded: DecodedVoice) {
    const input = decoded.samples;
    if (input.length < 2) return decoded;
    let peak = 0;
    for (const sample of input) peak = Math.max(peak, Math.abs(sample));
    if (peak <= 0) return decoded;

    const threshold = peak * 0.01;
    let start = 0;
    let end = input.length;
    while (start < end && Math.abs(input[start]) < threshold) ++start;
    while (end > start && Math.abs(input[end - 1]) < threshold) --end;

    const padding = Math.round(decoded.sampleRate * 0.02);
    start = Math.max(0, start - padding);
    end = Math.min(input.length, end + padding);
    if (start === 0 && end === input.length) return decoded;
    return {
        samples: new Float32Array(input.subarray(start, end)),
        sampleRate: decoded.sampleRate,
    };
}

function orderedSequenceByteBudget(game: 'oot' | 'mm', age: PlayerVoiceAge, event: number) {
    if ((game === 'oot' && age === 'adult') || (game === 'mm' && age === 'adult')) {
        switch (event) {
            case 0x0b: return 9;
            case 0x0e: return 11;
            case 0x0f: return 11;
            case 0x11: return 11;
        }
    }
    if (game === 'oot' && age === 'child') {
        switch (event) {
            case 0x0b: return 9;
            case 0x0e: return 15;
            case 0x0f: return 11;
            case 0x11: return 10;
        }
    }
    if (game === 'mm' && age === 'child') {
        switch (event) {
            case 0x0b: return 9;
            case 0x0e: return 15;
            case 0x0f: return 11;
            case 0x11: return 10;
        }
    }
    throw new Error(`${game.toUpperCase()} ${age} event 0x${event.toString(16)} has no ordered sequence budget`);
}

async function patchEffectGroupInPlace(
    builder: RomBuilder,
    state: PatchState,
    game: 'oot' | 'mm',
    context: FontContext,
    effects: readonly number[],
    clip: PlayerVoiceClip,
    age: PlayerVoiceAge,
    event: number,
): Promise<EncodedVoiceChunk[]> {
    const regions: EffectSampleRegion[] = [];
    const physicalKeys = new Set<string>();
    for (const effect of effects) {
        const region = tryOrderedEffectSampleRegion(builder, state, game, context, effect);
        if (!region) continue;
        const key = physicalSampleKey(region.sampleBank, region.sampleAddr, region.capacity);
        if (physicalKeys.has(key)) continue;
        physicalKeys.add(key);
        regions.push(region);
    }

    if (!regions.length) {
        throw new Error(`${game.toUpperCase()} ${age} ordered voice event 0x${event.toString(16)} has no usable sample slots`);
    }

    const primaryBank = regions[0].sampleBank.key;
    for (const region of regions) {
        if (region.sampleBank.key !== primaryBank) {
            throw new Error(`${game.toUpperCase()} ordered voice samples span multiple sample banks`);
        }
    }

    const decoded = trimStorageSilence(await decodeClip(state, clip));
    return allocateOrderedVoiceStorage(
        state,
        context,
        regions,
        decoded,
        clip.name,
        orderedSequenceByteBudget(game, age, event),
    );
}

async function patchEffectInPlace(
    builder: RomBuilder,
    state: PatchState,
    game: 'oot' | 'mm',
    context: FontContext,
    effect: number,
    clip: PlayerVoiceClip,
): Promise<PatchedSample> {
    const region = effectSampleRegion(builder, state, game, context, effect);
    return await patchSampleRegion(builder, state, game, context, region, clip);
}

function rawTicks(frames: number, sampleRate: number) {
    return Math.max(1, Math.floor((frames / sampleRate) * (120 * 48) / 60) + 1);
}

function orderedNoteCommand(note: number, encoded: EncodedVoice) {
    const duration = rawTicks(encoded.frames, encoded.sampleRate);
    if (duration > 0x7fff) throw new Error('Ordered voice chunk duration is too long');
    if (duration <= 0x7f) return Uint8Array.of(note, duration, 0x64);
    return Uint8Array.of(note, 0x80 | (duration >>> 8), duration & 0xff, 0x64);
}

function writeOrderedCommands(
    sequence: Uint8Array,
    offset: number,
    size: number,
    chunks: readonly EncodedVoiceChunk[],
    noteForEffect: (effect: number) => number,
    label: string,
) {
    const commands: number[] = [];
    for (const chunk of chunks) commands.push(...orderedNoteCommand(noteForEffect(chunk.effect), chunk.encoded));
    if (commands.length > size) {
        throw new Error(`${label} replacement needs ${commands.length} sequence bytes but only ${size} are available`);
    }
    const patch = new Uint8Array(size);
    patch.fill(0xff);
    patch.set(commands);
    if (offset + size > sequence.length) throw new Error(`${label} voice sequence patch is out of range`);
    sequence.set(patch, offset);
}

function patchOrderedSequence(
    sequence: Uint8Array,
    game: 'oot' | 'mm',
    age: PlayerVoiceAge,
    event: number,
    chunks: readonly EncodedVoiceChunk[],
) {
    let offset = -1;
    let size = 0;

    if (game === 'oot' && age === 'adult') {
        switch (event) {
            case 0x0b: offset = 0x6265; size = 9; break;
            case 0x0e: offset = 0x628d; size = 11; break;
            case 0x0f: offset = 0x629f; size = 11; break;
            case 0x11: offset = 0x62ba; size = 11; break;
        }
    } else if (game === 'oot' && age === 'child') {
        switch (event) {
            case 0x0b: offset = 0x642a; size = 9; break;
            case 0x0e: offset = 0x6457; size = 15; break;
            case 0x0f: offset = 0x646d; size = 11; break;
            case 0x11: offset = 0x6488; size = 10; break;
        }
    } else if (game === 'mm' && age === 'child') {
        switch (event) {
            case 0x0b: offset = 0xb9b1; size = 9; break;
            case 0x0e: offset = 0xb9e4; size = 15; break;
            case 0x0f: offset = 0xb9fa; size = 11; break;
            case 0x11: offset = 0xba15; size = 10; break;
        }
    }

    if (offset < 0) return;

    let noteForEffect: (effect: number) => number = effect => effect;

    if (game === 'mm' && age === 'child') {
        if (!chunks.length) return;

        const childEffectBase = chunks[0].effect & ~0x3f;
        const childBlock = childEffectBase >>> 6;

        for (const chunk of chunks) {
            if ((chunk.effect & ~0x3f) !== childEffectBase) {
                throw new Error(
                    `MM Child ordered event 0x${event.toString(16)} spans multiple effect pages`,
                );
            }
        }
        if (offset < 2 || sequence[offset - 2] !== 0xc2) {
            throw new Error(
                `MM Child ordered event 0x${event.toString(16)} is missing its page-select command`,
            );
        }
        sequence[offset - 1] = childBlock;

        noteForEffect = effect => 0x40 + (effect & 0x3f);
    }

    writeOrderedCommands(
        sequence,
        offset,
        size,
        chunks,
        noteForEffect,
        `${game.toUpperCase()} ${age} event 0x${event.toString(16)}`,
    );
}

function findUniquePattern(data: Uint8Array, pattern: readonly number[]) {
    let found = -1;
    outer:
        for (let offset = 0; offset + pattern.length <= data.length; ++offset) {
            for (let i = 0; i < pattern.length; ++i) {
                if (data[offset + i] !== pattern[i]) continue outer;
            }
            if (found >= 0) throw new Error('MM Adult voice sequence pattern is not unique');
            found = offset;
        }
    if (found < 0) throw new Error('MM Adult voice sequence pattern was not found');
    return found;
}

function patchMmAdultOrderedSequence(
    sequence: Uint8Array,
    adultEffectBase: number,
    event: number,
    chunks: readonly EncodedVoiceChunk[],
) {
    const adultBlock = adultEffectBase >>> 6;
    const slotForOotEffect = (effect: number) => {
        const value = OOT_ADULT_EFFECTS.indexOf(effect);
        if (value < 0) throw new Error(`MM Adult OoT effect ${effect} is missing`);
        return 0x40 + value;
    };
    const noteForMmEffect = (effect: number) => {
        const value = effect - adultEffectBase;
        if (value < 0 || value >= OOT_ADULT_EFFECTS.length) {
            throw new Error(`MM Adult imported effect ${effect} is out of range`);
        }
        return 0x40 + value;
    };

    let pattern: number[] | null = null;
    let size = 0;
    switch (event) {
        case 0x0b:
            size = 9;
            pattern = [
                0xc2, adultBlock,
                slotForOotEffect(77), 0x57, 0x64,
                slotForOotEffect(78), 0x61, 0x64,
                slotForOotEffect(79), 0x47, 0x64,
                0xff,
            ];
            break;
        case 0x0e:
            size = 11;
            pattern = [
                0xc2, adultBlock,
                slotForOotEffect(80), 0x7f, 0x64,
                slotForOotEffect(81), 0x81, 0x18, 0x64,
                slotForOotEffect(82), 0x81, 0x3e, 0x64,
                0xff,
            ];
            break;
        case 0x0f:
            size = 11;
            pattern = [
                0xc2, adultBlock,
                slotForOotEffect(83), 0x81, 0x22, 0x64,
                slotForOotEffect(84), 0x80, 0xa3, 0x64,
                slotForOotEffect(85), 0x35, 0x64,
                0xff,
            ];
            break;
        case 0x11:
            size = 11;
            pattern = [
                0xc2, adultBlock,
                slotForOotEffect(86), 0x80, 0xb9, 0x64,
                slotForOotEffect(87), 0x80, 0x86, 0x64,
                slotForOotEffect(88), 0x74, 0x64,
                0xff,
            ];
            break;
    }

    if (!pattern) return;
    const layer = findUniquePattern(sequence, pattern);
    writeOrderedCommands(
        sequence,
        layer + 2,
        size,
        chunks,
        noteForMmEffect,
        `MM Adult event 0x${event.toString(16)}`,
    );
}

function getSequence0(builder: RomBuilder, game: 'oot' | 'mm') {
    const seqTable = builder.fileByNameRequired(`${game}/seq_table`).data;
    const entry = resolvedTableEntry(seqTable, 0);
    return resolveSlice(builder, entry.addr, entry.size).data;
}

type MmAdultVoiceLayout = {
    adultEffectBase: number;
    targets: ReadonlyMap<number, readonly number[]>;
    orderedGroups: ReadonlyMap<number, readonly number[]>;
};

function alignUp(value: number, alignment: number) {
    return Math.ceil(value / alignment) * alignment;
}

function mmAdultEffectBase(context: FontContext) {
    const numSfx = bufReadU16BE(context.bankTable, 0x0e);
    const base = numSfx - OOT_ADULT_EFFECTS.length;
    if (base < 0) throw new Error('MM Adult Link imported effect block is missing');
    return base;
}

function mmChildEffectBase(context: FontContext) {
    const adultEffectBase = mmAdultEffectBase(context);
    const childEffectBase = adultEffectBase - 0x40;
    if (childEffectBase < 0) throw new Error('MM Child private voice page is missing');
    if ((childEffectBase & 0x3f) !== 0) {
        throw new Error(`MM Child private voice page is not 0x40-aligned: 0x${childEffectBase.toString(16)}`);
    }
    return childEffectBase;
}

function mmChildPrivateEffect(context: FontContext, sourceEffect: number) {
    const slot = MM_CHILD_PRIVATE_EFFECT_SLOTS.get(sourceEffect);
    if (slot === undefined) {
        throw new Error(`MM Child source effect 0x${sourceEffect.toString(16)} has no private slot`);
    }
    return mmChildEffectBase(context) + slot;
}

function mmChildTargets(context: FontContext): ReadonlyMap<number, readonly number[]> {
    const childEffectBase = mmChildEffectBase(context);

    return new Map([
        ...CHILD_TARGETS,
        [0x0b, [mmChildPrivateEffect(context, 0x01)]],
        [0x0e, [mmChildPrivateEffect(context, 0x03)]],
        [0x0f, [mmChildPrivateEffect(context, 0x07)]],
        [0x11, [mmChildPrivateEffect(context, 0x0a)]],
        [MM_CHILD_ALIAS_EVENT, [childEffectBase + MM_CHILD_ALIAS_SLOT]],
    ]);
}

function mmChildOrderedEffectGroups(
    context: FontContext,
): ReadonlyMap<number, readonly number[]> {
    const result = new Map<number, readonly number[]>();

    for (const [event, sourceEffects] of MM_CHILD_ORDERED_SOURCE_GROUPS) {
        result.set(
            event,
            sourceEffects.map(effect => mmChildPrivateEffect(context, effect)),
        );
    }

    return result;
}

function mmAdultEffectForOotEffect(adultEffectBase: number, ootEffect: number) {
    const slot = OOT_ADULT_EFFECTS.indexOf(ootEffect);
    if (slot < 0) throw new Error(`OoT Adult effect ${ootEffect} is not imported into MM`);
    return adultEffectBase + slot;
}

function remapMmAdultTargets(
    adultEffectBase: number,
    source: ReadonlyMap<number, readonly number[]>,
) {
    const result = new Map<number, readonly number[]>();
    for (const [event, effects] of source) {
        result.set(event, effects.map(effect => mmAdultEffectForOotEffect(adultEffectBase, effect)));
    }
    return result;
}

function writeAudioTableEntry(
    table: Uint8Array,
    index: number,
    templateIndex: number,
    addr: number,
    size: number,
) {
    const offset = index * 0x10;
    const templateOffset = templateIndex * 0x10;
    if (offset + 0x10 > table.length || templateOffset + 0x10 > table.length) {
        throw new Error('MM sample-bank audio-table entry is out of range');
    }

    table.set(new Uint8Array(table.subarray(templateOffset, templateOffset + 0x10)), offset);
    bufWriteU32BE(table, offset, addr);
    bufWriteU32BE(table, offset + 4, size);
    table[offset + 0x08] = 2;
    table[offset + 0x09] = 4;
}

function prepareMmVoiceBank(
    builder: RomBuilder,
    state: PatchState,
    context: FontContext,
    includeChild: boolean,
): MmAdultVoiceLayout {
    const adultEffectBase = mmAdultEffectBase(context);
    const childTargets = mmChildTargets(context);
    const childOrderedGroups = mmChildOrderedEffectGroups(context);
    const audioTable = builder.fileByNameRequired('mm/audio_table').data;
    const targetEntryOffset = MM_HUMAN_VOICE_SAMPLE_BANK_ID * 0x10;

    if (targetEntryOffset + 0x10 > audioTable.length) {
        throw new Error(`MM audio table has no entry ${MM_HUMAN_VOICE_SAMPLE_BANK_ID}`);
    }
    if (bufReadU32BE(audioTable, targetEntryOffset + 4) !== 0) {
        throw new Error(`MM audio-table entry ${MM_HUMAN_VOICE_SAMPLE_BANK_ID} is already in use`);
    }

    type PrivateSample = {
        sample: number;
        compactAddr: number;
        size: number;
        sourceBank: SampleBankContext;
        sourceAddr: number;
        changeSelector: boolean;
    };

    const privateSamples: PrivateSample[] = [];
    let compactSize = 0x10;
    let privateSelector = -1;

    const seenAdultSamples = new Map<number, PrivateSample>();
    for (let slot = 0; slot < OOT_ADULT_EFFECTS.length; ++slot) {
        const effect = adultEffectBase + slot;
        const { sample } = effectInfo(context, effect);
        if (seenAdultSamples.has(sample)) continue;

        const selector = sampleSelector(context.font, sample);
        if (selector > 1) throw new Error(`MM Adult imported sample uses unsupported selector ${selector}`);
        if (privateSelector < 0) privateSelector = selector;
        else if (selector !== privateSelector) {
            throw new Error('MM Adult imported samples span multiple selectors');
        }

        const sourceBank = getSampleBank(builder, state, 'mm', context.bankTable, selector);
        const sourceAddr = bufReadU32BE(context.font, sample + 4);
        const size = readU24BE(context.font, sample + 1);
        if (!size || sourceAddr + size > sourceBank.data.length) {
            throw new Error(`MM Adult effect ${effect} has an invalid source sample`);
        }

        const entry: PrivateSample = {
            sample,
            compactAddr: compactSize,
            size,
            sourceBank,
            sourceAddr,
            changeSelector: false,
        };
        privateSamples.push(entry);
        seenAdultSamples.set(sample, entry);
        compactSize += size;
    }

    if (privateSelector < 0) throw new Error('MM Adult imported voice selector was not found');

    if (includeChild) {
        const childEffects = new Set<number>();
        for (const effects of childTargets.values()) {
            for (const effect of effects) childEffects.add(effect);
        }
        for (const effects of childOrderedGroups.values()) {
            for (const effect of effects) childEffects.add(effect);
        }

        const seenChildSamples = new Set<number>();
        for (const effect of [...childEffects].sort((a, b) => a - b)) {
            const { sample } = effectInfo(context, effect);
            if (seenChildSamples.has(sample)) continue;
            seenChildSamples.add(sample);

            const selector = sampleSelector(context.font, sample);
            if (selector > 1) throw new Error(`MM Child effect ${effect} uses unsupported selector ${selector}`);
            if (selector === privateSelector) {
                throw new Error(
                    `MM Child effect ${effect} unexpectedly uses the imported Adult sample-bank selector`,
                );
            }

            const sourceBank = getSampleBank(builder, state, 'mm', context.bankTable, selector);
            const sourceAddr = bufReadU32BE(context.font, sample + 4);
            const size = readU24BE(context.font, sample + 1);
            if (!size || sourceAddr + size > sourceBank.data.length) {
                throw new Error(`MM Child effect ${effect} has an invalid source sample`);
            }

            privateSamples.push({
                sample,
                compactAddr: compactSize,
                size,
                sourceBank,
                sourceAddr,
                changeSelector: true,
            });
            compactSize += size;
        }
    }

    compactSize = alignUp(compactSize, MM_HUMAN_VOICE_FILE_ALIGNMENT);
    const bankData = new Uint8Array(compactSize);

    for (const entry of privateSamples) {
        bankData.set(
            entry.sourceBank.data.subarray(entry.sourceAddr, entry.sourceAddr + entry.size),
            entry.compactAddr,
        );
    }

    const bankVrom = builder.addFile({
        name: 'custom/mm_human_voice_bank',
        game: 'custom',
        type: 'uncompressed',
        data: bankData,
    })!;

    let templateIndex = -1;
    for (let i = 0; i < MM_HUMAN_VOICE_SAMPLE_BANK_ID; ++i) {
        if (bufReadU32BE(audioTable, i * 0x10 + 4) !== 0) {
            templateIndex = i;
            break;
        }
    }
    if (templateIndex < 0) throw new Error('MM Audiotable has no concrete bank entry to clone');

    writeAudioTableEntry(
        audioTable,
        MM_HUMAN_VOICE_SAMPLE_BANK_ID,
        templateIndex,
        bankVrom,
        bankData.length,
    );

    context.bankTable[0x0a + privateSelector] = MM_HUMAN_VOICE_SAMPLE_BANK_ID;

    for (const entry of privateSamples) {
        if (entry.changeSelector) {
            context.font[entry.sample] =
                (context.font[entry.sample] & ~0x0c) |
                (privateSelector << 2);
        }
        bufWriteU32BE(context.font, entry.sample + 4, entry.compactAddr);
    }
    for (const key of [...state.sampleOrigins.keys()]) {
        if (key.startsWith('mm:')) state.sampleOrigins.delete(key);
    }

    for (const [key, bank] of [...state.sampleBanks.entries()]) {
        if (bank.game === 'mm' && bank.id === MM_HUMAN_VOICE_SAMPLE_BANK_ID) {
            state.sampleBanks.delete(key);
        }
    }

    return {
        adultEffectBase,
        targets: remapMmAdultTargets(adultEffectBase, OOT_ADULT_TARGETS),
        orderedGroups: remapMmAdultTargets(adultEffectBase, OOT_ORDERED_EFFECT_GROUPS.adult),
    };
}

async function patchMappedVoiceSet(
    builder: RomBuilder,
    state: PatchState,
    game: 'oot' | 'mm',
    context: FontContext,
    set: PlayerVoiceSet | null,
    targets: ReadonlyMap<number, readonly number[]>,
    orderedGroups: ReadonlyMap<number, readonly number[]> | null,
    age: PlayerVoiceAge,
    sequence: Uint8Array | null,
    skipOrdered = false,
) {
    const patchedEffects = new Map<number, PatchedSample>();
    if (!set) return patchedEffects;

    const events = [...set.entries()].sort(([a], [b]) => a - b);
    for (const [event, clips] of events) {
        const effects = targets.get(event);
        if (!effects || !clips.length) continue;
        const orderedEffects = orderedGroups?.get(event);
        if (orderedEffects && sequence) {
            if (skipOrdered) continue;
            const chunks = await patchEffectGroupInPlace(
                builder,
                state,
                game,
                context,
                orderedEffects,
                clips[0],
                age,
                event,
            );
            for (const chunk of chunks) {
                patchedEffects.set(chunk.effect, {
                    clipKey: clipKey(clips[0]),
                    encoded: chunk.encoded,
                    sampleAddr: chunk.sampleAddr,
                    selector: chunk.selector,
                });
            }
            if (game === 'mm' && age === 'adult') {
                patchMmAdultOrderedSequence(sequence, mmAdultEffectBase(context), event, chunks);
            } else {
                patchOrderedSequence(sequence, game, age, event, chunks);
            }
            continue;
        }

        const selected = clips.slice(0, effects.length);
        for (let i = 0; i < effects.length; ++i) {
            const effect = effects[i];
            const clip = selected[i % selected.length];
            const patched = await patchEffectInPlace(builder, state, game, context, effect, clip);
            patchedEffects.set(effect, patched);
        }
    }
    return patchedEffects;
}

async function patchOrderedMappedVoiceSet(
    builder: RomBuilder,
    state: PatchState,
    game: 'oot' | 'mm',
    context: FontContext,
    set: PlayerVoiceSet | null,
    orderedGroups: ReadonlyMap<number, readonly number[]> | null,
    age: PlayerVoiceAge,
    sequence: Uint8Array | null,
) {
    const patchedEffects = new Map<number, PatchedSample>();
    if (!set || !orderedGroups || !sequence) return patchedEffects;

    const events = [...set.entries()].sort(([a], [b]) => a - b);
    for (const [event, clips] of events) {
        if (!clips.length) continue;
        const orderedEffects = orderedGroups.get(event);
        if (!orderedEffects) continue;
        const chunks = await patchEffectGroupInPlace(
            builder,
            state,
            game,
            context,
            orderedEffects,
            clips[0],
            age,
            event,
        );
        for (const chunk of chunks) {
            patchedEffects.set(chunk.effect, {
                clipKey: clipKey(clips[0]),
                encoded: chunk.encoded,
                sampleAddr: chunk.sampleAddr,
                selector: chunk.selector,
            });
        }
        if (game === 'mm' && age === 'adult') {
            patchMmAdultOrderedSequence(sequence, mmAdultEffectBase(context), event, chunks);
        } else {
            patchOrderedSequence(sequence, game, age, event, chunks);
        }
    }
    return patchedEffects;
}

function preferredVoiceSampleRate(decoded: DecodedVoice) {
    return Math.min(
        AUDIO_SAMPLE_RATE,
        MAX_CUSTOM_VOICE_SAMPLE_RATE,
        Math.max(1, Math.floor(decoded.sampleRate)),
    );
}

function estimatedVadpcmSize(decoded: DecodedVoice, targetRate: number) {
    const samples = Math.max(1, Math.floor(decoded.samples.length * targetRate / decoded.sampleRate));
    return Math.ceil(samples / 16) * 9;
}

function mergeStorageSpans(spans: readonly StorageSpan[]) {
    const ordered = [...spans].sort((a, b) => a.start - b.start);
    const merged: StorageSpan[] = [];
    for (const span of ordered) {
        const previous = merged[merged.length - 1];
        if (previous && span.start <= previous.end) previous.end = Math.max(previous.end, span.end);
        else merged.push({ ...span });
    }
    return merged;
}

function orderedPhysicalKeysForSpecs(
    builder: RomBuilder,
    state: PatchState,
    specs: readonly VoiceSetStorageSpec[],
) {
    const result = new Set<string>();
    for (const spec of specs) {
        if (!spec.set || !spec.orderedGroups || !spec.sequence) continue;
        for (const [event, clips] of spec.set) {
            if (!clips.length) continue;
            const orderedEffects = spec.orderedGroups.get(event);
            if (!orderedEffects) continue;
            for (const effect of orderedEffects) {
                const region = tryOrderedEffectSampleRegion(builder, state, spec.game, spec.context, effect);
                if (!region) continue;
                result.add(physicalSampleKey(region.sampleBank, region.sampleAddr, region.capacity));
            }
        }
    }
    return result;
}

function encodeVoiceAtRate(
    decoded: DecodedVoice,
    font: Uint8Array,
    sample: number,
    targetRate: number,
    clipName: string,
): EncodedVoice {
    if ((font[sample] >>> 4) !== 0) throw new Error(`Target for ${clipName} is not a standard VADPCM sample`);
    const bookPointer = bufReadU32BE(font, sample + 0x0c);
    if (!bookPointer) throw new Error(`Target for ${clipName} has no VADPCM predictor book`);
    const samples = resampleToS16(decoded.samples, decoded.sampleRate, targetRate);
    const book = readVadpcmBook(font, bookPointer);
    const data = encodeVadpcm(samples, book);
    return {
        data,
        frames: samples.length,
        sampleRate: targetRate,
        tuning: targetRate / AUDIO_SAMPLE_RATE,
    };
}

type IndependentDemandEntry = {
    key: string;
    demand: NonOrderedReservationDemand;
};

type IndependentPlannedBin = {
    span: StorageSpan;
    remaining: number;
    entries: IndependentDemandEntry[];
};

function independentDemandRate(demand: NonOrderedReservationDemand, rateCap: number) {
    return Math.min(preferredVoiceSampleRate(demand.decoded), rateCap);
}

function independentDemandSize(demand: NonOrderedReservationDemand, rateCap: number) {
    return estimatedVadpcmSize(demand.decoded, independentDemandRate(demand, rateCap));
}

function tryPackIndependentDemands(
    entries: readonly IndependentDemandEntry[],
    spans: readonly StorageSpan[],
    rateCap: number,
): IndependentPlannedBin[] | null {
    const bins: IndependentPlannedBin[] = spans.map(span => ({
        span: { ...span },
        remaining: storageSpanLength(span),
        entries: [],
    }));

    const ordered = [...entries].sort((a, b) => {
        const sizeA = independentDemandSize(a.demand, rateCap);
        const sizeB = independentDemandSize(b.demand, rateCap);
        return sizeB - sizeA || a.demand.order - b.demand.order;
    });

    for (const entry of ordered) {
        const size = independentDemandSize(entry.demand, rateCap);
        let best = -1;
        let bestRemaining = Number.MAX_SAFE_INTEGER;
        for (let i = 0; i < bins.length; ++i) {
            if (bins[i].remaining < size) continue;
            const after = bins[i].remaining - size;
            if (after < bestRemaining) {
                best = i;
                bestRemaining = after;
            }
        }
        if (best < 0) return null;
        bins[best].entries.push(entry);
        bins[best].remaining -= size;
    }
    return bins;
}

async function collectIndependentVoiceDemands(
    builder: RomBuilder,
    state: PatchState,
    specs: readonly VoiceSetStorageSpec[],
) {
    const orderedKeys = orderedPhysicalKeysForSpecs(builder, state, specs);
    const demands = new Map<string, NonOrderedReservationDemand>();
    let order = 0;

    for (const spec of specs) {
        if (!spec.set) continue;
        const events = [...spec.set.entries()].sort(([a], [b]) => a - b);
        for (const [event, clips] of events) {
            const effects = spec.targets.get(event);
            if (!effects || !clips.length) continue;
            if (spec.orderedGroups?.get(event) && spec.sequence) continue;
            const selected = clips.slice(0, effects.length);
            for (let i = 0; i < effects.length; ++i) {
                const effect = effects[i];
                const clip = selected[i % selected.length];
                const region = effectSampleRegion(builder, state, spec.game, spec.context, effect);
                const key = physicalSampleKey(region.sampleBank, region.sampleAddr, region.capacity);
                if (orderedKeys.has(key) || demands.has(key)) continue;
                const decoded = trimStorageSilence(await decodeClip(state, clip));
                const targetRate = preferredVoiceSampleRate(decoded);
                demands.set(key, {
                    order: order++,
                    context: spec.context,
                    region,
                    clip,
                    decoded,
                    fullSize: estimatedVadpcmSize(decoded, targetRate),
                });
            }
        }
    }
    return demands;
}

type OrderedPlanningDemand = {
    game: 'oot' | 'mm';
    age: PlayerVoiceAge;
    event: number;
    context: FontContext;
    clip: PlayerVoiceClip;
    decoded: DecodedVoice;
    regions: EffectSampleRegion[];
    sequenceByteBudget: number;
};

async function collectOrderedVoiceDemands(
    builder: RomBuilder,
    state: PatchState,
    specs: readonly VoiceSetStorageSpec[],
) {
    const result: OrderedPlanningDemand[] = [];
    for (const spec of specs) {
        if (!spec.set || !spec.orderedGroups || !spec.sequence) continue;
        const events = [...spec.set.entries()].sort(([a], [b]) => a - b);
        for (const [event, clips] of events) {
            if (!clips.length) continue;
            const effects = spec.orderedGroups.get(event);
            if (!effects) continue;
            const regions: EffectSampleRegion[] = [];
            const physicalKeys = new Set<string>();
            for (const effect of effects) {
                const region = tryOrderedEffectSampleRegion(builder, state, spec.game, spec.context, effect);
                if (!region) continue;
                const key = physicalSampleKey(region.sampleBank, region.sampleAddr, region.capacity);
                if (physicalKeys.has(key)) continue;
                physicalKeys.add(key);
                regions.push(region);
            }
            if (!regions.length) {
                throw new Error(
                    `${spec.game.toUpperCase()} ${spec.age} ordered voice event ` +
                    `0x${event.toString(16)} has no usable sample slots`,
                );
            }
            const bankKey = regions[0].sampleBank.key;
            if (regions.some(region => region.sampleBank.key !== bankKey)) {
                throw new Error(`${spec.game.toUpperCase()} ordered voice samples span multiple sample banks`);
            }
            result.push({
                game: spec.game,
                age: spec.age,
                event,
                context: spec.context,
                clip: clips[0],
                decoded: trimStorageSilence(await decodeClip(state, clips[0])),
                regions,
                sequenceByteBudget: orderedSequenceByteBudget(spec.game, spec.age, event),
            });
        }
    }
    return result;
}

function consumePlannedStorage(spans: StorageSpan[], start: number, size: number) {
    const end = start + size;
    for (let i = 0; i < spans.length; ++i) {
        const span = spans[i];
        if (start < span.start || end > span.end) continue;
        const replacement: StorageSpan[] = [];
        if (span.start < start) replacement.push({ start: span.start, end: start });
        if (end < span.end) replacement.push({ start: end, end: span.end });
        spans.splice(i, 1, ...replacement);
        return true;
    }
    return false;
}

type GlobalVoiceRateCheck = {
    ok: boolean;
    reason?: string;
};

function globalVoiceRateCheck(
    state: PatchState,
    orderedDemands: readonly OrderedPlanningDemand[],
    independentDemands: ReadonlyMap<string, NonOrderedReservationDemand>,
    rateCap: number,
): GlobalVoiceRateCheck {
    const simulated = new Map<string, StorageSpan[]>();
    for (const [key, pool] of state.storagePools) {
        simulated.set(key, pool.spans.map(span => ({ ...span })));
    }

    for (const demand of orderedDemands) {
        const bankKey = demand.regions[0].sampleBank.key;
        const spans = simulated.get(bankKey);
        if (!spans) return { ok: false, reason: `${demand.clip.name} has no reclaimed sample-bank storage` };
        const plan = orderedAllocationPlanForSpans(
            spans,
            demand.regions.length,
            demand.decoded,
            rateCap,
            demand.sequenceByteBudget,
        );
        if (!plan) {
            return {
                ok: false,
                reason:
                    `${demand.clip.name} cannot fit at the common ${rateCap} Hz cap with its ` +
                    `${demand.sequenceByteBudget}-byte ordered sequence budget`,
            };
        }
        for (let i = 0; i < plan.parts.length; ++i) {
            const bytes = plan.parts[i] * 9;
            if (!consumePlannedStorage(spans, plan.candidates[i].span.start, bytes)) {
                return { ok: false, reason: `Internal ordered storage simulation failed for ${demand.clip.name}` };
            }
        }
    }

    const byBank = new Map<string, IndependentDemandEntry[]>();
    for (const [key, demand] of independentDemands) {
        const bankKey = demand.region.sampleBank.key;
        const list = byBank.get(bankKey) || [];
        list.push({ key, demand });
        byBank.set(bankKey, list);
    }

    for (const [bankKey, entries] of byBank) {
        const spans = simulated.get(bankKey) || [];
        if (!tryPackIndependentDemands(entries, spans, rateCap)) {
            return {
                ok: false,
                reason:
                    `Independent Link voices cannot be packed at the common ${rateCap} Hz cap ` +
                    `after the ordered voices are reserved`,
            };
        }
    }
    return { ok: true };
}

async function chooseGlobalVoiceSampleRate(
    builder: RomBuilder,
    state: PatchState,
    specs: readonly VoiceSetStorageSpec[],
) {
    const orderedDemands = await collectOrderedVoiceDemands(builder, state, specs);
    const independentDemands = await collectIndependentVoiceDemands(builder, state, specs);
    const check = (rate: number) => globalVoiceRateCheck(state, orderedDemands, independentDemands, rate);
    const top = MAX_CUSTOM_VOICE_SAMPLE_RATE;
    const step = 250;
    if (check(top).ok) return top;

    for (let coarse = top - step; coarse >= MIN_POOLED_VOICE_SAMPLE_RATE; coarse -= step) {
        const coarseCheck = check(coarse);
        if (!coarseCheck.ok) continue;
        const upper = Math.min(top, coarse + step - 1);
        for (let exact = upper; exact > coarse; --exact) {
            if (check(exact).ok) return exact;
        }
        return coarse;
    }

    const floorCheck = check(MIN_POOLED_VOICE_SAMPLE_RATE);
    throw new Error(
        `The complete custom Link voice pack cannot fit even when every voice is capped equally at ` +
        `${MIN_POOLED_VOICE_SAMPLE_RATE} Hz. ${floorCheck.reason || 'The reclaimed storage is insufficient.'}`,
    );
}

async function reserveNonOrderedVoiceStorageLargestFirst(
    builder: RomBuilder,
    state: PatchState,
    specs: readonly VoiceSetStorageSpec[],
) {
    const demands = await collectIndependentVoiceDemands(builder, state, specs);
    const byBank = new Map<string, IndependentDemandEntry[]>();
    for (const [key, demand] of demands) {
        if (state.patchedSamples.has(key)) continue;
        const bankKey = demand.region.sampleBank.key;
        const list = byBank.get(bankKey) || [];
        list.push({ key, demand });
        byBank.set(bankKey, list);
    }

    for (const [bankKey, entries] of byBank) {
        const pool = state.storagePools.get(bankKey);
        if (!pool) throw new Error(`Voice storage pool ${bankKey} was not prepared`);
        const plan = tryPackIndependentDemands(entries, pool.spans, state.globalRateCap);
        if (!plan) throw new Error(`Internal global voice-storage plan mismatch at ${state.globalRateCap} Hz`);

        const remaining: StorageSpan[] = [];
        for (const bin of plan) {
            if (!bin.entries.length) {
                remaining.push({ ...bin.span });
                continue;
            }

            let cursor = bin.span.start;
            const binEntries = [...bin.entries].sort((a, b) =>
                independentDemandSize(b.demand, state.globalRateCap) -
                independentDemandSize(a.demand, state.globalRateCap) ||
                a.demand.order - b.demand.order,
            );

            for (const entry of binEntries) {
                const targetRate = independentDemandRate(entry.demand, state.globalRateCap);
                const encoded = encodeVoiceAtRate(
                    entry.demand.decoded,
                    entry.demand.context.font,
                    entry.demand.region.sample,
                    targetRate,
                    entry.demand.clip.name,
                );
                if (cursor + encoded.data.length > bin.span.end) {
                    throw new Error(`Voice-storage plan overflow while writing ${entry.demand.clip.name}`);
                }
                pool.bank.data.set(encoded.data, cursor);
                state.patchedSamples.set(entry.key, {
                    clipKey: clipKey(entry.demand.clip),
                    encoded,
                    sampleAddr: cursor,
                    selector: entry.demand.region.selector,
                });
                cursor += encoded.data.length;
            }

            if (cursor < bin.span.end) remaining.push({ start: cursor, end: bin.span.end });
        }
        pool.spans = mergeStorageSpans(remaining);
    }
}

function registerMappedVoiceSetStorage(
    builder: RomBuilder,
    state: PatchState,
    game: 'oot' | 'mm',
    context: FontContext,
    set: PlayerVoiceSet | null,
    targets: ReadonlyMap<number, readonly number[]>,
    orderedGroups: ReadonlyMap<number, readonly number[]> | null,
    sequence: Uint8Array | null,
) {
    if (!set) return;
    const seen = new Set<string>();
    for (const [event, clips] of [...set.entries()].sort(([a], [b]) => a - b)) {
        const effects = targets.get(event);
        if (!effects || !clips.length) continue;
        const orderedEffects = orderedGroups?.get(event);
        if (orderedEffects && sequence) {
            for (const effect of orderedEffects) {
                const region = tryOrderedEffectSampleRegion(builder, state, game, context, effect);
                if (!region) continue;
                const key = physicalSampleKey(region.sampleBank, region.sampleAddr, region.capacity);
                if (!seen.has(key)) {
                    seen.add(key);
                    registerStorageRegion(state, region);
                }
            }
            continue;
        }

        for (const effect of effects) {
            const region = effectSampleRegion(builder, state, game, context, effect);
            const key = physicalSampleKey(region.sampleBank, region.sampleAddr, region.capacity);
            if (!seen.has(key)) {
                seen.add(key);
                registerStorageRegion(state, region);
            }
        }
    }
}

export async function patchPlayerVoices(
    builder: RomBuilder,
    ootVoices: PlayerVoicePair,
    mmVoices: PlayerVoicePair,
) {
    const hasOotAdult = hasVoices(ootVoices.adult);
    const hasOotChild = hasVoices(ootVoices.child);
    const hasMmAdult = hasVoices(mmVoices.adult);
    const hasMmChild = hasVoices(mmVoices.child);

    if (!hasOotAdult && !hasOotChild && !hasMmAdult && !hasMmChild) return false;

    const state: PatchState = {
        decoded: new Map(),
        sampleBanks: new Map(),
        storagePools: new Map(),
        patchedSamples: new Map(),
        sampleOrigins: new Map(),
        globalRateCap: MAX_CUSTOM_VOICE_SAMPLE_RATE,
    };

    const ootContext = hasOotAdult || hasOotChild ? getFont0(builder, 'oot') : null;
    const ootSequence = ootContext ? getSequence0(builder, 'oot') : null;

    const needsMmVoiceBank = hasMmAdult || hasMmChild || hasOotAdult;
    const mmContext = needsMmVoiceBank ? getFont0(builder, 'mm') : null;
    const mmSequence = mmContext ? getSequence0(builder, 'mm') : null;

    let mmAdultLayout: MmAdultVoiceLayout | null = null;
    if (needsMmVoiceBank) {
        if (!mmContext) throw new Error('MM Soundfont 0 is unavailable for Human voice isolation');
        mmAdultLayout = prepareMmVoiceBank(builder, state, mmContext, hasMmChild);
    }

    const resolvedMmChildTargets =
        mmContext ? mmChildTargets(mmContext) : MM_CHILD_TARGETS_BASE;
    const resolvedMmChildOrderedGroups =
        mmContext ? mmChildOrderedEffectGroups(mmContext) : MM_CHILD_ORDERED_SOURCE_GROUPS;

    if (ootContext) {
        registerMappedVoiceSetStorage(
            builder,
            state,
            'oot',
            ootContext,
            ootVoices.adult,
            OOT_ADULT_TARGETS,
            OOT_ORDERED_EFFECT_GROUPS.adult,
            ootSequence,
        );
        registerMappedVoiceSetStorage(
            builder,
            state,
            'oot',
            ootContext,
            ootVoices.child,
            CHILD_TARGETS,
            OOT_ORDERED_EFFECT_GROUPS.child,
            ootSequence,
        );
    }

    if (mmContext) {
        if (hasMmAdult) {
            if (!mmAdultLayout) throw new Error('MM Adult voice layout was not prepared');
            registerMappedVoiceSetStorage(
                builder,
                state,
                'mm',
                mmContext,
                mmVoices.adult,
                mmAdultLayout.targets,
                mmAdultLayout.orderedGroups,
                mmSequence,
            );
        }
        registerMappedVoiceSetStorage(
            builder,
            state,
            'mm',
            mmContext,
            mmVoices.child,
            resolvedMmChildTargets,
            resolvedMmChildOrderedGroups,
            mmSequence,
        );
    }

    mergeStoragePools(state);

    const storageSpecs: VoiceSetStorageSpec[] = [];
    if (ootContext) {
        storageSpecs.push(
            {
                game: 'oot',
                age: 'adult',
                context: ootContext,
                set: ootVoices.adult,
                targets: OOT_ADULT_TARGETS,
                orderedGroups: OOT_ORDERED_EFFECT_GROUPS.adult,
                sequence: ootSequence,
            },
            {
                game: 'oot',
                age: 'child',
                context: ootContext,
                set: ootVoices.child,
                targets: CHILD_TARGETS,
                orderedGroups: OOT_ORDERED_EFFECT_GROUPS.child,
                sequence: ootSequence,
            },
        );
    }

    if (mmContext) {
        if (hasMmAdult) {
            if (!mmAdultLayout) throw new Error('MM Adult voice layout was not prepared');
            storageSpecs.push({
                game: 'mm',
                age: 'adult',
                context: mmContext,
                set: mmVoices.adult,
                targets: mmAdultLayout.targets,
                orderedGroups: mmAdultLayout.orderedGroups,
                sequence: mmSequence,
            });
        }
        storageSpecs.push({
            game: 'mm',
            age: 'child',
            context: mmContext,
            set: mmVoices.child,
            targets: resolvedMmChildTargets,
            orderedGroups: resolvedMmChildOrderedGroups,
            sequence: mmSequence,
        });
    }

    state.globalRateCap = await chooseGlobalVoiceSampleRate(builder, state, storageSpecs);

    if (ootContext) {
        await patchOrderedMappedVoiceSet(
            builder,
            state,
            'oot',
            ootContext,
            ootVoices.adult,
            OOT_ORDERED_EFFECT_GROUPS.adult,
            'adult',
            ootSequence,
        );
        await patchOrderedMappedVoiceSet(
            builder,
            state,
            'oot',
            ootContext,
            ootVoices.child,
            OOT_ORDERED_EFFECT_GROUPS.child,
            'child',
            ootSequence,
        );
    }

    if (mmContext) {
        if (hasMmAdult) {
            if (!mmAdultLayout) throw new Error('MM Adult voice layout was not prepared');
            await patchOrderedMappedVoiceSet(
                builder,
                state,
                'mm',
                mmContext,
                mmVoices.adult,
                mmAdultLayout.orderedGroups,
                'adult',
                mmSequence,
            );
        }
        await patchOrderedMappedVoiceSet(
            builder,
            state,
            'mm',
            mmContext,
            mmVoices.child,
            resolvedMmChildOrderedGroups,
            'child',
            mmSequence,
        );
    }

    await reserveNonOrderedVoiceStorageLargestFirst(builder, state, storageSpecs);

    if (ootContext) {
        await patchMappedVoiceSet(
            builder,
            state,
            'oot',
            ootContext,
            ootVoices.adult,
            OOT_ADULT_TARGETS,
            OOT_ORDERED_EFFECT_GROUPS.adult,
            'adult',
            ootSequence,
            true,
        );
        await patchMappedVoiceSet(
            builder,
            state,
            'oot',
            ootContext,
            ootVoices.child,
            CHILD_TARGETS,
            OOT_ORDERED_EFFECT_GROUPS.child,
            'child',
            ootSequence,
            true,
        );
    }

    if (mmContext) {
        if (hasMmAdult) {
            if (!mmAdultLayout) throw new Error('MM Adult voice layout was not prepared');
            await patchMappedVoiceSet(
                builder,
                state,
                'mm',
                mmContext,
                mmVoices.adult,
                mmAdultLayout.targets,
                mmAdultLayout.orderedGroups,
                'adult',
                mmSequence,
                true,
            );
        }
        await patchMappedVoiceSet(
            builder,
            state,
            'mm',
            mmContext,
            mmVoices.child,
            resolvedMmChildTargets,
            resolvedMmChildOrderedGroups,
            'child',
            mmSequence,
            true,
        );
    }

    return needsMmVoiceBank;
}
