import { bufReadU16BE, bufReadU32BE, bufWriteU16BE, bufWriteU32BE } from '../util/buffer';

const SEGMENT_MODEL = 0x06;
const SEGMENT_MATRIX = 0x0d;
const LIMB_COUNT = 21;
const DLIST_COUNT = 18;

type Vec3 = [number, number, number];

type Limb = {
    recordOffset: number;
    translation: Vec3;
    child: number;
    sibling: number;
    dlistNear: number;
    dlistFar: number;
};

type Skeleton = {
    hierarchyOffset: number;
    limbTableOffset: number;
    limbs: Limb[];
};

export type RetargetExtraList = {
    address: number;
    defaultLimb: number;
};

function signed16(value: number) {
    return value & 0x8000 ? value - 0x10000 : value;
}

function unsigned16(value: number) {
    return value & 0xffff;
}

function findSkeleton(data: Uint8Array): Skeleton {
    for (let hierarchyOffset = 0; hierarchyOffset + 12 <= data.length; hierarchyOffset += 4) {
        const limbTableAddress = bufReadU32BE(data, hierarchyOffset);
        if ((limbTableAddress >>> 24) !== SEGMENT_MODEL) {
            continue;
        }
        if (data[hierarchyOffset + 4] !== LIMB_COUNT || data[hierarchyOffset + 8] !== DLIST_COUNT) {
            continue;
        }

        const limbTableOffset = limbTableAddress & 0x00ffffff;
        if (limbTableOffset + LIMB_COUNT * 4 > data.length) {
            continue;
        }

        const limbs: Limb[] = [];
        let valid = true;

        for (let i = 0; i < LIMB_COUNT; ++i) {
            const limbAddress = bufReadU32BE(data, limbTableOffset + i * 4);
            if ((limbAddress >>> 24) !== SEGMENT_MODEL) {
                valid = false;
                break;
            }

            const recordOffset = limbAddress & 0x00ffffff;
            if (recordOffset + 0x10 > data.length) {
                valid = false;
                break;
            }

            limbs.push({
                recordOffset,
                translation: [
                    signed16(bufReadU16BE(data, recordOffset + 0)),
                    signed16(bufReadU16BE(data, recordOffset + 2)),
                    signed16(bufReadU16BE(data, recordOffset + 4)),
                ],
                child: data[recordOffset + 6],
                sibling: data[recordOffset + 7],
                dlistNear: bufReadU32BE(data, recordOffset + 8),
                dlistFar: bufReadU32BE(data, recordOffset + 12),
            });
        }

        if (valid) {
            return {
                hierarchyOffset,
                limbTableOffset,
                limbs,
            };
        }
    }

    throw new Error('Failed to find 21-limb player skeleton');
}

function makeParents(limbs: Limb[]) {
    const parents = new Array<number | null>(limbs.length).fill(null);
    const visited = new Set<number>();

    function walkChain(index: number, parent: number | null) {
        let current = index;

        while (current !== 0xff) {
            if (current < 0 || current >= limbs.length || visited.has(current)) {
                return;
            }

            visited.add(current);
            parents[current] = parent;

            const child = limbs[current].child;
            if (child !== 0xff) {
                walkChain(child, current);
            }

            current = limbs[current].sibling;
        }
    }

    walkChain(0, null);
    return parents;
}

function globalTranslations(translations: Vec3[], parents: Array<number | null>) {
    const out: Vec3[] = [];

    for (let i = 0; i < translations.length; ++i) {
        let x = 0;
        let y = 0;
        let z = 0;
        let current: number | null = i;
        const seen = new Set<number>();

        while (current !== null) {
            if (seen.has(current)) {
                throw new Error('Invalid cyclic player skeleton');
            }
            seen.add(current);

            const t = translations[current];
            x += t[0];
            y += t[1];
            z += t[2];
            current = parents[current];
        }

        out.push([x, y, z]);
    }

    return out;
}

function matrixSlotToLimb(limbs: Limb[]) {
    const out: number[] = [];

    for (let i = 0; i < limbs.length; ++i) {
        const limb = limbs[i];
        if (limb.dlistNear !== 0 || limb.dlistFar !== 0) {
            out.push(i);
        }
    }

    if (out.length !== DLIST_COUNT) {
        throw new Error(`Unexpected player skeleton display-list count: ${out.length}`);
    }

    return out;
}

function normalizeTargetTranslations(target: ReadonlyArray<ReadonlyArray<number>>) {
    if (target.length !== LIMB_COUNT) {
        throw new Error(`Expected ${LIMB_COUNT} target skeleton translations, got ${target.length}`);
    }

    const out: Vec3[] = target.map((v, i) => {
        if (v.length < 3) {
            throw new Error(`Invalid target skeleton translation for limb ${i}`);
        }
        return [signed16(v[0] & 0xffff), signed16(v[1] & 0xffff), signed16(v[2] & 0xffff)];
    });

    return out;
}

export function readPlayerSkeletonTranslations(data: Uint8Array): Vec3[] {
    return findSkeleton(data).limbs.map((limb) => [...limb.translation] as Vec3);
}

export function retargetPlayerModelBindPose(
    input: Uint8Array,
    targetTranslationsInput: ReadonlyArray<ReadonlyArray<number>>,
    extraLists: RetargetExtraList[] = [],
): Uint8Array {
    const source = findSkeleton(input);
    const sourceTranslations = source.limbs.map((limb) => [...limb.translation] as Vec3);
    const targetTranslations = normalizeTargetTranslations(targetTranslationsInput);
    const geometryTargetTranslations = targetTranslations.map((v) => [...v] as Vec3);
    geometryTargetTranslations[0] = [...sourceTranslations[0]] as Vec3;
    const parents = makeParents(source.limbs);
    const sourceGlobals = globalTranslations(sourceTranslations, parents);
    const targetGlobals = globalTranslations(geometryTargetTranslations, parents);
    const slotToLimb = matrixSlotToLimb(source.limbs);

    const shifts: Vec3[] = sourceGlobals.map((sourcePos, limb) => [
        sourcePos[0] - targetGlobals[limb][0],
        sourcePos[1] - targetGlobals[limb][1],
        sourcePos[2] - targetGlobals[limb][2],
    ]);

    type VertexUse = {
        commandOffset: number;
        sourceOffset: number;
        length: number;
        shift: Vec3;
    };

    const vertexUses: VertexUse[] = [];
    const commandUse = new Map<number, string>();
    const recursion = new Set<string>();

    function processList(address: number, initialLimb: number): number {
        if ((address >>> 24) !== SEGMENT_MODEL) {
            return initialLimb;
        }

        let currentLimb = initialLimb;
        let offset = address & 0x00ffffff;
        const recursionKey = `${offset}:${initialLimb}`;

        if (recursion.has(recursionKey)) {
            return currentLimb;
        }
        recursion.add(recursionKey);

        for (let commandCount = 0; commandCount < 0x10000; ++commandCount) {
            if (offset + 8 > input.length) {
                throw new Error(`Player display list runs out of range at 0x${offset.toString(16)}`);
            }

            const op = input[offset];
            const target = bufReadU32BE(input, offset + 4);

            if (op === 0xda && (target >>> 24) === SEGMENT_MATRIX) {
                const matrixOffset = target & 0x00ffffff;
                if ((matrixOffset & 0x3f) === 0) {
                    const slot = matrixOffset >>> 6;
                    if (slot < slotToLimb.length) {
                        currentLimb = slotToLimb[slot];
                    }
                }
            } else if (op === 0x01 && (target >>> 24) === SEGMENT_MODEL) {
                const length = bufReadU16BE(input, offset + 1);
                const sourceOffset = target & 0x00ffffff;

                if (length === 0 || (length & 0x0f) !== 0 || sourceOffset + length > input.length) {
                    throw new Error(`Invalid player vertex load at 0x${offset.toString(16)}`);
                }

                const shift = shifts[currentLimb];
                const useKey = `${sourceOffset}:${length}:${shift[0]}:${shift[1]}:${shift[2]}`;
                const previous = commandUse.get(offset);

                if (previous !== undefined && previous !== useKey) {
                    throw new Error(
                        `Cross-game model reuses display-list command 0x${offset.toString(16)} with incompatible limb matrices`,
                    );
                }

                if (previous === undefined) {
                    commandUse.set(offset, useKey);
                    vertexUses.push({ commandOffset: offset, sourceOffset, length, shift });
                }
            } else if (op === 0xde && (target >>> 24) === SEGMENT_MODEL) {
                currentLimb = processList(target, currentLimb);

                if (input[offset + 1] === 0x01) {
                    break;
                }
            } else if (op === 0xdf) {
                break;
            }

            offset += 8;
        }

        recursion.delete(recursionKey);
        return currentLimb;
    }

    for (let limbIndex = 0; limbIndex < source.limbs.length; ++limbIndex) {
        const limb = source.limbs[limbIndex];
        const lists = new Set<number>();

        if (limb.dlistNear !== 0) lists.add(limb.dlistNear);
        if (limb.dlistFar !== 0) lists.add(limb.dlistFar);

        for (const address of lists) {
            processList(address, limbIndex);
        }
    }

    for (const extra of extraLists) {
        if (extra.address !== 0) {
            processList(extra.address, extra.defaultLimb);
        }
    }

    const cloneOffsets = new Map<string, number>();
    const cloneBlocks: Array<{ offset: number; sourceOffset: number; length: number; shift: Vec3 }> = [];
    let outputLength = (input.length + 0x0f) & ~0x0f;

    for (const use of vertexUses) {
        const { shift } = use;
        if (shift[0] === 0 && shift[1] === 0 && shift[2] === 0) {
            continue;
        }

        const key = `${use.sourceOffset}:${use.length}:${shift[0]}:${shift[1]}:${shift[2]}`;
        if (!cloneOffsets.has(key)) {
            if (outputLength + use.length >= 0x01000000) {
                throw new Error('Cross-game player model exceeds segment 0x06 address space');
            }

            cloneOffsets.set(key, outputLength);
            cloneBlocks.push({
                offset: outputLength,
                sourceOffset: use.sourceOffset,
                length: use.length,
                shift,
            });
            outputLength = (outputLength + use.length + 0x0f) & ~0x0f;
        }
    }

    const output = new Uint8Array(outputLength);
    output.set(input);

    for (const block of cloneBlocks) {
        output.set(input.subarray(block.sourceOffset, block.sourceOffset + block.length), block.offset);

        for (let i = 0; i < block.length; i += 0x10) {
            const vertexOffset = block.offset + i;
            const x = signed16(bufReadU16BE(output, vertexOffset + 0)) + block.shift[0];
            const y = signed16(bufReadU16BE(output, vertexOffset + 2)) + block.shift[1];
            const z = signed16(bufReadU16BE(output, vertexOffset + 4)) + block.shift[2];

            if (x < -0x8000 || x > 0x7fff || y < -0x8000 || y > 0x7fff || z < -0x8000 || z > 0x7fff) {
                throw new Error('Cross-game player vertex translation overflows s16');
            }

            bufWriteU16BE(output, vertexOffset + 0, unsigned16(x));
            bufWriteU16BE(output, vertexOffset + 2, unsigned16(y));
            bufWriteU16BE(output, vertexOffset + 4, unsigned16(z));
        }
    }

    for (const use of vertexUses) {
        const { shift } = use;
        if (shift[0] === 0 && shift[1] === 0 && shift[2] === 0) {
            continue;
        }

        const key = `${use.sourceOffset}:${use.length}:${shift[0]}:${shift[1]}:${shift[2]}`;
        const cloneOffset = cloneOffsets.get(key);
        if (cloneOffset === undefined) {
            throw new Error('Internal cross-game vertex relocation failure');
        }

        bufWriteU32BE(output, use.commandOffset + 4, 0x06000000 | cloneOffset);
    }

    for (let i = 0; i < source.limbs.length; ++i) {
        const recordOffset = source.limbs[i].recordOffset;
        bufWriteU16BE(output, recordOffset + 0, unsigned16(targetTranslations[i][0]));
        bufWriteU16BE(output, recordOffset + 2, unsigned16(targetTranslations[i][1]));
        bufWriteU16BE(output, recordOffset + 4, unsigned16(targetTranslations[i][2]));
    }

    return output;
}

