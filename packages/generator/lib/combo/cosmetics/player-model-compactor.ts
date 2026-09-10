import { bufReadU32BE, bufWriteU32BE } from '../util/buffer';

type ByteRange = {
  start: number;
  end: number;
};

type MappedRange = ByteRange & {
  mappedStart: number;
};

export type PlayerModelPointerPatch = {
  offset: number;
  value: number;
};

export type PlayerModelGraphBuild = {
  data: Uint8Array;
  fixedPointerPatches: PlayerModelPointerPatch[];
  mapAddress(address: number): number;
};

export type PlayerModelGraphRootOptions = {
  preserveCi8?: boolean;
};

export type PlayerModelGraphCompactorOptions = {
  quantizeCi8ToCi4?: boolean;
  allowProtectedCi4UpToBytes?: number;
};

type TextureReference = {
  listOffset: number;
  commandOffset: number;
  address: number;
  byteLength: number;
};

type PaletteReference = {
  listOffset: number;
  commandOffset: number;
  address: number;
  count: number;
};

type Ci8Pair = {
  listOffset: number;
  textureCommand: number;
  loadBlockCommand: number;
  renderTileCommand: number;
  tileSizeCommand: number | null;
  paletteCommand: number;
  paletteTileCommand: number;
  loadTlutCommand: number;
  textureAddress: number;
  paletteAddress: number;
  textureByteLength: number;
  width: number;
  height: number;
};

type QuantColor = {
  value: number;
  r: number;
  g: number;
  b: number;
  a: number;
  weight: number;
};

const SEGMENT = 0x06;
const G_IM_FMT_CI = 2;
const G_IM_FMT_RGBA = 0;
const G_IM_SIZ_4B = 0;
const G_IM_SIZ_8B = 1;
const G_IM_SIZ_16B = 2;

function align16(value: number) {
  return (value + 0x0f) & ~0x0f;
}

function readU16BE(data: Uint8Array, offset: number) {
  return (data[offset] << 8) | data[offset + 1];
}

function writeU16BE(data: Uint8Array, offset: number, value: number) {
  data[offset] = (value >>> 8) & 0xff;
  data[offset + 1] = value & 0xff;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
export class PlayerModelGraphCompactor {
  private readonly source: Uint8Array;
  private readonly preserveBefore: number;
  private readonly options: Required<PlayerModelGraphCompactorOptions>;

  private readonly seenLists = new Set<number>();
  private readonly protectedLists = new Set<number>();
  private readonly listChildren = new Map<number, number[]>();
  private readonly listSizes = new Map<number, number>();
  private readonly ranges: ByteRange[] = [];

  private readonly textureReferences: TextureReference[] = [];
  private readonly paletteReferences: PaletteReference[] = [];
  private readonly ci8Pairs: Ci8Pair[] = [];

  private imagesFinalized = false;

  constructor(
      source: Uint8Array,
      preserveBefore: number,
      options: PlayerModelGraphCompactorOptions = {},
  ) {
    this.source = new Uint8Array(source);
    this.preserveBefore = preserveBefore;
    this.options = {
      quantizeCi8ToCi4: options.quantizeCi8ToCi4 ?? false,
      allowProtectedCi4UpToBytes: options.allowProtectedCi4UpToBytes ?? 0,
    };
  }

  addDisplayListRoot(
      address: number,
      options: PlayerModelGraphRootOptions = {},
  ) {
    this.visitDisplayList(address, options.preserveCi8 ?? false);
  }

  private segmentOffset(address: number) {
    return address & 0x00ffffff;
  }

  private isLocalAddress(address: number) {
    return address !== 0 && (address >>> 24) === SEGMENT;
  }

  private addRange(address: number, size: number) {
    if (!this.isLocalAddress(address) || size <= 0) {
      return;
    }

    const start = this.segmentOffset(address);
    if (start >= this.source.length) {
      throw new Error(`Player model pointer 0x${address.toString(16)} is out of range`);
    }

    const end = Math.min(this.source.length, start + size);
    if (end <= start) {
      return;
    }

    this.ranges.push({ start, end });
  }

  private displayListSize(address: number) {
    if (!this.isLocalAddress(address)) {
      return 0;
    }

    const offset = this.segmentOffset(address);
    const cached = this.listSizes.get(offset);
    if (cached !== undefined) {
      return cached;
    }

    if (offset >= this.source.length) {
      throw new Error(`Display list 0x${address.toString(16)} is out of range`);
    }

    let size = 0;
    while (offset + size + 8 <= this.source.length) {
      const word = bufReadU32BE(this.source, offset + size);
      const op = word >>> 24;
      const op2 = (word >>> 16) & 0xff;
      size += 8;

      if (op === 0xdf || (op === 0xde && op2 === 0x01)) {
        this.listSizes.set(offset, size);
        return size;
      }
    }

    throw new Error(`Unterminated player display list at 0x${address.toString(16)}`);
  }

  private textureByteLength(command: number, end: number) {
    const setImage = bufReadU32BE(this.source, command);
    const sizeCode = (setImage >>> 19) & 3;
    const bpp = [4, 8, 16, 32][sizeCode];

    const scanEnd = Math.min(end, command + 0x80);
    for (let offset = command + 8; offset + 8 <= scanEnd; offset += 8) {
      const op = this.source[offset];

      if (op === 0xfd) {
        break;
      }

      if (op === 0xf3) {
        const load = bufReadU32BE(this.source, offset + 4);
        const lrs = (load >>> 12) & 0xfff;
        return Math.max(Math.ceil(((lrs + 1) * bpp) / 8), 8);
      }
    }
    if (command + 0x38 <= end) {
      const renderTile = bufReadU32BE(this.source, command + 0x28);
      const renderSizeCode = (renderTile >>> 19) & 3;
      const renderBpp = [4, 8, 16, 32][renderSizeCode];
      const dimensions = bufReadU32BE(this.source, command + 0x34);
      const width = (((dimensions >>> 12) & 0xfff) / 4) + 1;
      const height = ((dimensions & 0xfff) / 4) + 1;
      return Math.max(Math.ceil((width * height * renderBpp) / 8), 8);
    }

    throw new Error(`Unable to determine texture size at 0x${command.toString(16)}`);
  }

  private paletteCount(command: number, end: number) {
    const scanEnd = Math.min(end, command + 0x80);
    for (let offset = command + 8; offset + 8 <= scanEnd; offset += 8) {
      const op = this.source[offset];

      if (op === 0xfd) {
        break;
      }

      if (op === 0xf0) {
        return ((bufReadU32BE(this.source, offset + 4) >>> 14) & 0x3ff) + 1;
      }
    }

    if (command + 0x28 <= end) {
      return ((bufReadU32BE(this.source, command + 0x24) & 0xffffff) >> 14) + 1;
    }

    throw new Error(`Unable to determine palette size at 0x${command.toString(16)}`);
  }

  private tryParseCi8Pair(
      listOffset: number,
      command: number,
      end: number,
  ): Ci8Pair | null {
    const prefix = [0xfd, 0xf5, 0xe6, 0xf3, 0xe7, 0xf5];
    if (command + prefix.length * 8 > end) {
      return null;
    }
    for (let i = 0; i < prefix.length; ++i) {
      if (this.source[command + i * 8] !== prefix[i]) {
        return null;
      }
    }

    let cursor = command + 6 * 8;
    let tileSizeCommand: number | null = null;
    if (cursor + 8 <= end && this.source[cursor] === 0xf2) {
      tileSizeCommand = cursor;
      cursor += 8;
    }

    const suffix = [0xfd, 0xe8, 0xf5, 0xe6, 0xf0, 0xe7];
    if (cursor + suffix.length * 8 > end) {
      return null;
    }
    for (let i = 0; i < suffix.length; ++i) {
      if (this.source[cursor + i * 8] !== suffix[i]) {
        return null;
      }
    }

    const textureCommand = command;
    const loadBlockCommand = command + 3 * 8;
    const renderTileCommand = command + 5 * 8;
    const paletteCommand = cursor;
    const paletteTileCommand = cursor + 2 * 8;
    const loadTlutCommand = cursor + 4 * 8;

    const textureWord = bufReadU32BE(this.source, textureCommand);
    const renderTileWord = bufReadU32BE(this.source, renderTileCommand);
    const paletteWord = bufReadU32BE(this.source, paletteCommand);

    const textureFormat = (textureWord >>> 21) & 7;
    const textureLoadSize = (textureWord >>> 19) & 3;
    const renderFormat = (renderTileWord >>> 21) & 7;
    const renderSize = (renderTileWord >>> 19) & 3;
    const paletteFormat = (paletteWord >>> 21) & 7;
    const paletteSize = (paletteWord >>> 19) & 3;

    if (
        textureFormat !== G_IM_FMT_CI ||
        textureLoadSize !== G_IM_SIZ_16B ||
        renderFormat !== G_IM_FMT_CI ||
        renderSize !== G_IM_SIZ_8B ||
        paletteFormat !== G_IM_FMT_RGBA ||
        paletteSize !== G_IM_SIZ_16B
    ) {
      return null;
    }

    const textureAddress = bufReadU32BE(this.source, textureCommand + 4);
    const paletteAddress = bufReadU32BE(this.source, paletteCommand + 4);
    if (!this.isLocalAddress(textureAddress) || !this.isLocalAddress(paletteAddress)) {
      return null;
    }

    const paletteCount =
        ((bufReadU32BE(this.source, loadTlutCommand + 4) >>> 14) & 0x3ff) + 1;
    if (paletteCount !== 256) {
      return null;
    }

    const textureByteLength = this.textureByteLength(textureCommand, end);

    let width: number;
    let height: number;

    if (tileSizeCommand !== null) {
      const dimensions = bufReadU32BE(this.source, tileSizeCommand + 4);
      const rawWidth = (dimensions >>> 12) & 0xfff;
      const rawHeight = dimensions & 0xfff;

      if ((rawWidth & 3) !== 0 || (rawHeight & 3) !== 0) {
        return null;
      }

      width = (rawWidth >>> 2) + 1;
      height = (rawHeight >>> 2) + 1;
    } else {
      const line = (renderTileWord >>> 9) & 0x1ff;
      width = line * 8;
      if (width === 0 || textureByteLength % width !== 0) {
        return null;
      }
      height = textureByteLength / width;
    }

    if (
        width <= 0 ||
        height <= 0 ||
        !Number.isInteger(width) ||
        !Number.isInteger(height) ||
        width * height > textureByteLength
    ) {
      return null;
    }

    return {
      listOffset,
      textureCommand,
      loadBlockCommand,
      renderTileCommand,
      tileSizeCommand,
      paletteCommand,
      paletteTileCommand,
      loadTlutCommand,
      textureAddress,
      paletteAddress,
      textureByteLength,
      width,
      height,
    };
  }

  private markListProtected(offset: number) {
    if (this.protectedLists.has(offset)) {
      return;
    }

    this.protectedLists.add(offset);
    for (const child of this.listChildren.get(offset) ?? []) {
      this.visitDisplayList(child, true);
    }
  }

  private visitDisplayList(address: number, preserveCi8: boolean) {
    if (!this.isLocalAddress(address)) {
      return;
    }

    const offset = this.segmentOffset(address);
    if (this.seenLists.has(offset)) {
      if (preserveCi8) {
        this.markListProtected(offset);
      }
      return;
    }

    this.seenLists.add(offset);
    if (preserveCi8) {
      this.protectedLists.add(offset);
    }

    const size = this.displayListSize(address);
    this.addRange(address, size);

    const children: number[] = [];
    const end = offset + size;

    for (let command = offset; command < end; command += 8) {
      const word = bufReadU32BE(this.source, command);
      const op = word >>> 24;
      const target = bufReadU32BE(this.source, command + 4);

      if (op === 0x01 && this.isLocalAddress(target)) {
        const count = (word >>> 12) & 0xff;
        this.addRange(target, count * 16);
        continue;
      }

      if (op === 0xda && this.isLocalAddress(target)) {
        this.addRange(target, 0x40);
        continue;
      }

      if (op === 0xde && this.isLocalAddress(target)) {
        children.push(target);
        this.visitDisplayList(target, preserveCi8);
        continue;
      }

      if (op !== 0xfd || !this.isLocalAddress(target)) {
        continue;
      }

      if (command + 0x10 > end) {
        throw new Error(`Truncated texture command at 0x${command.toString(16)}`);
      }

      const nextOp = this.source[command + 8];
      if (nextOp === 0xf5) {
        this.textureReferences.push({
          listOffset: offset,
          commandOffset: command,
          address: target,
          byteLength: this.textureByteLength(command, end),
        });

        const pair = this.tryParseCi8Pair(offset, command, end);
        if (pair !== null) {
          this.ci8Pairs.push(pair);
        }
      } else if (nextOp === 0xe8) {
        this.paletteReferences.push({
          listOffset: offset,
          commandOffset: command,
          address: target,
          count: this.paletteCount(command, end),
        });
      } else {
        throw new Error(
            `Unsupported segment-06 texture reference at 0x${command.toString(16)} ` +
            `(next opcode 0x${nextOp.toString(16)})`,
        );
      }
    }

    this.listChildren.set(offset, children);
  }

  private decodeColor(value: number, weight: number): QuantColor {
    return {
      value,
      r: (value >>> 11) & 0x1f,
      g: (value >>> 6) & 0x1f,
      b: (value >>> 1) & 0x1f,
      a: value & 1,
      weight,
    };
  }

  private encodeColor(r: number, g: number, b: number, a: number) {
    return (
        (clamp(Math.round(r), 0, 31) << 11) |
        (clamp(Math.round(g), 0, 31) << 6) |
        (clamp(Math.round(b), 0, 31) << 1) |
        (a ? 1 : 0)
    );
  }

  private colorDistance(a: number, b: number) {
    const ar = (a >>> 11) & 0x1f;
    const ag = (a >>> 6) & 0x1f;
    const ab = (a >>> 1) & 0x1f;
    const aa = a & 1;
    const br = (b >>> 11) & 0x1f;
    const bg = (b >>> 6) & 0x1f;
    const bb = (b >>> 1) & 0x1f;
    const ba = b & 1;

    const dr = ar - br;
    const dg = ag - bg;
    const db = ab - bb;
    const alphaPenalty = aa === ba ? 0 : 0x10000;
    return dr * dr + dg * dg + db * db + alphaPenalty;
  }

  private representative(box: QuantColor[]) {
    let total = 0;
    let r = 0;
    let g = 0;
    let b = 0;
    let alphaWeight = 0;

    for (const color of box) {
      total += color.weight;
      r += color.r * color.weight;
      g += color.g * color.weight;
      b += color.b * color.weight;
      alphaWeight += color.a * color.weight;
    }

    if (total === 0) {
      return 0;
    }

    return this.encodeColor(
        r / total,
        g / total,
        b / total,
        alphaWeight * 2 >= total ? 1 : 0,
    );
  }

  private makePalette(histogram: Map<number, number>) {
    const colors = [...histogram.entries()].map(([value, weight]) =>
        this.decodeColor(value, weight),
    );

    if (colors.length === 0) {
      return new Array<number>(16).fill(0);
    }

    if (colors.length <= 16) {
      const palette = colors
          .sort((a, b) => b.weight - a.weight || a.value - b.value)
          .map((color) => color.value);
      while (palette.length < 16) {
        palette.push(palette[0]);
      }
      return palette;
    }

    const boxes: QuantColor[][] = [colors];

    while (boxes.length < 16) {
      let bestIndex = -1;
      let bestScore = -1;
      let bestChannel: 'r' | 'g' | 'b' | 'a' = 'r';

      for (let i = 0; i < boxes.length; ++i) {
        const box = boxes[i];
        if (box.length < 2) {
          continue;
        }

        let minR = 31;
        let minG = 31;
        let minB = 31;
        let minA = 1;
        let maxR = 0;
        let maxG = 0;
        let maxB = 0;
        let maxA = 0;
        let weight = 0;

        for (const color of box) {
          minR = Math.min(minR, color.r);
          minG = Math.min(minG, color.g);
          minB = Math.min(minB, color.b);
          minA = Math.min(minA, color.a);
          maxR = Math.max(maxR, color.r);
          maxG = Math.max(maxG, color.g);
          maxB = Math.max(maxB, color.b);
          maxA = Math.max(maxA, color.a);
          weight += color.weight;
        }

        const channelRanges: Array<['r' | 'g' | 'b' | 'a', number]> = [
          ['a', (maxA - minA) * 32],
          ['r', maxR - minR],
          ['g', maxG - minG],
          ['b', maxB - minB],
        ];
        channelRanges.sort((a, b) => b[1] - a[1]);

        const score = channelRanges[0][1] * Math.sqrt(weight);
        if (score > bestScore) {
          bestScore = score;
          bestIndex = i;
          bestChannel = channelRanges[0][0];
        }
      }

      if (bestIndex < 0) {
        break;
      }

      const box = boxes[bestIndex].slice().sort((a, b) => {
        const av = a[bestChannel];
        const bv = b[bestChannel];
        return av - bv || b.weight - a.weight || a.value - b.value;
      });

      const totalWeight = box.reduce((sum, color) => sum + color.weight, 0);
      const half = totalWeight / 2;
      let running = 0;
      let split = 1;
      for (; split < box.length; ++split) {
        running += box[split - 1].weight;
        if (running >= half) {
          break;
        }
      }
      split = clamp(split, 1, box.length - 1);

      boxes.splice(bestIndex, 1, box.slice(0, split), box.slice(split));
    }

    const palette: number[] = [];
    for (const box of boxes) {
      const value = this.representative(box);
      if (!palette.includes(value)) {
        palette.push(value);
      }
    }

    const byWeight = colors.slice().sort((a, b) => b.weight - a.weight || a.value - b.value);
    for (const color of byWeight) {
      if (palette.length >= 16) {
        break;
      }
      if (!palette.includes(color.value)) {
        palette.push(color.value);
      }
    }

    const transparent = byWeight.find((color) => color.a === 0);
    const opaque = byWeight.find((color) => color.a === 1);
    if (transparent && !palette.some((value) => (value & 1) === 0)) {
      palette[palette.length - 1] = transparent.value;
    }
    if (opaque && !palette.some((value) => (value & 1) === 1)) {
      palette[palette.length - 1] = opaque.value;
    }

    while (palette.length < 16) {
      palette.push(palette[0]);
    }

    return palette.slice(0, 16);
  }

  private calcDxt4b(width: number) {
    const words = Math.max(1, Math.floor(width / 16));
    return clamp(Math.floor((0x800 + words - 1) / words), 0, 0xfff);
  }

  private rewriteCi8PairAsCi4(pair: Ci8Pair) {
    const pixelCount = pair.width * pair.height;
    const loadUnits16 = Math.max(1, (pixelCount + 3) >> 2);
    const newLrs = loadUnits16 - 1;
    const newDxt = this.calcDxt4b(pair.width);

    const oldLoad = bufReadU32BE(this.source, pair.loadBlockCommand + 4);
    const newLoad =
        (oldLoad & 0xff000000) |
        ((newLrs & 0xfff) << 12) |
        (newDxt & 0xfff);
    bufWriteU32BE(this.source, pair.loadBlockCommand + 4, newLoad);
    const oldRender0 = bufReadU32BE(this.source, pair.renderTileCommand);
    const ci4Line = (((pair.width >>> 1) + 7) >>> 3) & 0x1ff;
    const newRender0 =
        (oldRender0 & ~((3 << 19) | (0x1ff << 9))) |
        (G_IM_SIZ_4B << 19) |
        (ci4Line << 9);
    bufWriteU32BE(this.source, pair.renderTileCommand, newRender0);
    const oldRender1 = bufReadU32BE(this.source, pair.renderTileCommand + 4);
    bufWriteU32BE(
        this.source,
        pair.renderTileCommand + 4,
        oldRender1 & ~(0xf << 20),
    );
    const oldPaletteTile0 = bufReadU32BE(this.source, pair.paletteTileCommand);
    bufWriteU32BE(
        this.source,
        pair.paletteTileCommand,
        (oldPaletteTile0 & ~0x1ff) | 0x100,
    );

    const oldTlut = bufReadU32BE(this.source, pair.loadTlutCommand + 4);
    const newTlut = (oldTlut & ~(0x3ff << 14)) | (15 << 14);
    bufWriteU32BE(this.source, pair.loadTlutCommand + 4, newTlut);
  }

  private finalizeImages() {
    if (this.imagesFinalized) {
      return;
    }
    this.imagesFinalized = true;

    const textureSizes = new Map<number, number>();
    const paletteSizes = new Map<number, number>();

    if (this.options.quantizeCi8ToCi4) {
      const pairByTextureCommand = new Map<number, Ci8Pair>();
      const pairByPaletteCommand = new Map<number, Ci8Pair>();
      for (const pair of this.ci8Pairs) {
        pairByTextureCommand.set(pair.textureCommand, pair);
        pairByPaletteCommand.set(pair.paletteCommand, pair);
      }
      const unsafeTextures = new Set<number>();
      const unsafePalettes = new Set<number>();

      for (const ref of this.textureReferences) {
        const pair = pairByTextureCommand.get(ref.commandOffset);
        if (!pair || pair.textureAddress !== ref.address) {
          unsafeTextures.add(ref.address);
        }
      }
      for (const ref of this.paletteReferences) {
        const pair = pairByPaletteCommand.get(ref.commandOffset);
        if (!pair || pair.paletteAddress !== ref.address) {
          unsafePalettes.add(ref.address);
        }
      }
      const texturePalettes = new Map<number, number>();
      for (const pair of this.ci8Pairs) {
        const previous = texturePalettes.get(pair.textureAddress);
        if (previous !== undefined && previous !== pair.paletteAddress) {
          unsafeTextures.add(pair.textureAddress);
          unsafePalettes.add(previous);
          unsafePalettes.add(pair.paletteAddress);
        } else {
          texturePalettes.set(pair.textureAddress, pair.paletteAddress);
        }
      }

      const protectedTextures = new Set<number>();
      const protectedPalettes = new Set<number>();
      for (const pair of this.ci8Pairs) {
        if (!this.protectedLists.has(pair.listOffset)) {
          continue;
        }

        const mayConvertSmallProtected =
            this.options.allowProtectedCi4UpToBytes > 0 &&
            pair.textureByteLength <= this.options.allowProtectedCi4UpToBytes;

        if (!mayConvertSmallProtected) {
          protectedTextures.add(pair.textureAddress);
          protectedPalettes.add(pair.paletteAddress);
        }
      }

      const groups = new Map<number, Ci8Pair[]>();
      for (const pair of this.ci8Pairs) {
        if (
            unsafeTextures.has(pair.textureAddress) ||
            unsafePalettes.has(pair.paletteAddress) ||
            protectedTextures.has(pair.textureAddress) ||
            protectedPalettes.has(pair.paletteAddress)
        ) {
          continue;
        }

        const pairs = groups.get(pair.paletteAddress) ?? [];
        pairs.push(pair);
        groups.set(pair.paletteAddress, pairs);
      }

      for (const [paletteAddress, pairs] of groups) {
        const textures = new Map<number, Ci8Pair>();
        let compatible = true;

        for (const pair of pairs) {
          const previous = textures.get(pair.textureAddress);
          if (
              previous &&
              (previous.width !== pair.width ||
                  previous.height !== pair.height ||
                  previous.textureByteLength !== pair.textureByteLength)
          ) {
            compatible = false;
            break;
          }
          textures.set(pair.textureAddress, pair);
        }

        if (!compatible) {
          continue;
        }

        const paletteOffset = this.segmentOffset(paletteAddress);
        if (paletteOffset + 0x200 > this.source.length) {
          continue;
        }

        const sourcePalette = new Array<number>(256);
        for (let i = 0; i < 256; ++i) {
          sourcePalette[i] = readU16BE(this.source, paletteOffset + i * 2);
        }

        const histogram = new Map<number, number>();
        for (const pair of textures.values()) {
          const textureOffset = this.segmentOffset(pair.textureAddress);
          const pixelCount = pair.width * pair.height;
          if (textureOffset + pixelCount > this.source.length) {
            compatible = false;
            break;
          }

          for (let i = 0; i < pixelCount; ++i) {
            const color = sourcePalette[this.source[textureOffset + i]];
            histogram.set(color, (histogram.get(color) ?? 0) + 1);
          }
        }

        if (!compatible || histogram.size === 0) {
          continue;
        }

        const newPalette = this.makePalette(histogram);
        const remap = new Uint8Array(256);

        for (let oldIndex = 0; oldIndex < 256; ++oldIndex) {
          const color = sourcePalette[oldIndex];
          let best = 0;
          let bestDistance = Number.POSITIVE_INFINITY;

          for (let newIndex = 0; newIndex < 16; ++newIndex) {
            const distance = this.colorDistance(color, newPalette[newIndex]);
            if (distance < bestDistance) {
              bestDistance = distance;
              best = newIndex;
            }
          }

          remap[oldIndex] = best;
        }

        for (let i = 0; i < 16; ++i) {
          writeU16BE(this.source, paletteOffset + i * 2, newPalette[i]);
        }
        paletteSizes.set(paletteAddress, 0x20);

        for (const pair of textures.values()) {
          const textureOffset = this.segmentOffset(pair.textureAddress);
          const pixelCount = pair.width * pair.height;
          const packedSize = Math.max(2, ((pixelCount + 3) >> 2) * 2);
          const packed = new Uint8Array(packedSize);

          for (let pixel = 0; pixel < pixelCount; pixel += 2) {
            const hi = remap[this.source[textureOffset + pixel]] & 0x0f;
            const lo =
                pixel + 1 < pixelCount
                    ? remap[this.source[textureOffset + pixel + 1]] & 0x0f
                    : 0;
            packed[pixel >>> 1] = (hi << 4) | lo;
          }

          this.source.set(packed, textureOffset);
          textureSizes.set(pair.textureAddress, packedSize);
        }

        for (const pair of pairs) {
          this.rewriteCi8PairAsCi4(pair);
        }
      }
    }

    for (const ref of this.textureReferences) {
      this.addRange(ref.address, textureSizes.get(ref.address) ?? ref.byteLength);
    }
    for (const ref of this.paletteReferences) {
      this.addRange(ref.address, (paletteSizes.get(ref.address) ?? ref.count * 2));
    }
  }

  build(outBase: number): PlayerModelGraphBuild {
    this.finalizeImages();

    const movable = this.ranges
        .filter((range) => range.end > this.preserveBefore)
        .map((range) => ({
          start: Math.max(range.start, this.preserveBefore),
          end: range.end,
        }))
        .filter((range) => range.end > range.start)
        .sort((a, b) => a.start - b.start || a.end - b.end);

    const merged: ByteRange[] = [];
    for (const range of movable) {
      const last = merged[merged.length - 1];
      if (!last || range.start > last.end) {
        merged.push({ ...range });
      } else if (range.end > last.end) {
        last.end = range.end;
      }
    }

    const mapped: MappedRange[] = [];
    let cursor = outBase;
    for (const range of merged) {
      cursor = align16(cursor);
      mapped.push({ ...range, mappedStart: cursor });
      cursor += range.end - range.start;
    }
    cursor = align16(cursor);

    const data = new Uint8Array(Math.max(0, cursor - outBase));
    for (const range of mapped) {
      data.set(
          this.source.subarray(range.start, range.end),
          range.mappedStart - outBase,
      );
    }

    const mapOffset = (offset: number) => {
      if (offset < this.preserveBefore) {
        return offset;
      }

      for (const range of mapped) {
        if (range.start <= offset && offset < range.end) {
          return range.mappedStart + (offset - range.start);
        }
      }

      throw new Error(`Reachable player-model data at 0x${offset.toString(16)} was not packed`);
    };

    const mapAddress = (address: number) => {
      if (!this.isLocalAddress(address)) {
        return address;
      }
      return (SEGMENT << 24) | mapOffset(this.segmentOffset(address));
    };

    const fixedPointerPatches: PlayerModelPointerPatch[] = [];

    for (const listOffset of this.seenLists) {
      const size = this.listSizes.get(listOffset);
      if (size === undefined) {
        continue;
      }

      for (let command = listOffset; command < listOffset + size; command += 8) {
        const op = this.source[command];
        if (![0x01, 0xda, 0xde, 0xfd].includes(op)) {
          continue;
        }

        const oldTarget = bufReadU32BE(this.source, command + 4);
        if (!this.isLocalAddress(oldTarget)) {
          continue;
        }

        const newTarget = mapAddress(oldTarget);
        if (newTarget === oldTarget) {
          continue;
        }

        if (command < this.preserveBefore) {
          fixedPointerPatches.push({
            offset: command + 4,
            value: newTarget,
          });
        } else {
          const mappedCommand = mapOffset(command);
          bufWriteU32BE(data, mappedCommand - outBase + 4, newTarget);
        }
      }
    }

    return {
      data,
      fixedPointerPatches,
      mapAddress,
    };
  }
}
