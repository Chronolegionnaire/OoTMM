import type { Game } from '@ootmm/data';
import type { ColorArg, BufferPath, Options } from '@ootmm/core';

import fs from 'node:fs';
import { GAMES } from '@ootmm/data';
import { COLORS, Monitor, Random, randString, sample } from '@ootmm/core';
import { recolorImage } from '../image';
import { RomBuilder } from '../rom-builder';
import { png } from '../util/png';
import { enableModelOotLinkAdult, enableModelOotLinkChild } from './model';
import { randomizeMusic } from './music';
import { LogWriter } from '../util/log-writer';
import { bufReadU32BE, bufWriteU32BE } from '../util/buffer';
import {
  compactOotPlayerModel,
  OOT_ADULT_MODEL_SIZE,
  OOT_CHILD_MODEL_SIZE,
  prepareOotModel,
} from './oot-model-loader.ts';
import {
  compactMmPlayerModel,
  patchMmAdultModelTables,
  patchMmChildModelTables,
  prepareMmModel,
} from './mm-model-loader.ts';
import { mergePlayerModelInputs, resolvePlayerModelInput } from './model-input';
import type { ResolvedPlayerModel } from './model-input';
import { mergePlayerVoiceInputs, resolvePlayerVoiceInput } from './voice-input';
import { patchPlayerVoices } from './voice';
import {toU32Buffer} from "../util.ts";
import {
  applyEquipmentOverridesToMmGameplayKeep,
  applyEquipmentOverridesToMmModel,
  applyEquipmentOverridesToOotModel,
  applyEquipmentOverridesToPreparedMmModel,
  applyEquipmentOverridesToPreparedOotModel,
  resolveEquipmentInput,
  type EquipmentResolvedOverride,
} from './equipment-input';

export async function cosmeticsAssets() {
  return {
    MASK_TUNIC: await png('masks/tunic', 'bitmask'),
    MASK_OOT_SHIELD_MIRROR: await png('masks/oot_shield_mirror', 'bitmask'),
  }
}

type Unpromise<T extends Promise<any>> = T extends Promise<infer U> ? U : never;
type Assets = Unpromise<ReturnType<typeof cosmeticsAssets>>;

function colorBufferRGB(color: number) {
  const buffer = new Uint8Array(3);
  buffer[0] = color >>> 16;
  buffer[1] = (color >>> 8) & 0xff;
  buffer[2] = color & 0xff;
  return buffer;
}

function clamp8(value: number): number {
  return Math.max(0, Math.min(255, value));
}

function brightness(color: number, bright: number): number {
  const r = clamp8((color >>> 16) * bright);
  const g = clamp8(((color >>> 8) & 0xff) * bright);
  const b = clamp8((color & 0xff) * bright);
  return (r & 0xff) << 16 | (g & 0xff) << 8 | (b & 0xff);
}

function resolveColor(random: Random, c: ColorArg, auto?: () => number | null): number | null {
  switch (c) {
    case 'default':
      return null;
    case 'random':
      return sample(random, Object.values(COLORS)).value;
    case 'auto':
      return auto ? auto() : null;
    default:
      return COLORS[c].value;
  }
}

class CosmeticsPass {
  private assetsPromise: Promise<Assets> | null;
  private logWriter: LogWriter;

  constructor(
      private monitor: Monitor,
      private opts: Options,
      private builder: RomBuilder,
      private symbols: Record<Game, Map<string, number[]>>,
  ) {
    this.assetsPromise = null;
    this.logWriter = new LogWriter();
  }

  private asset(key: keyof Assets): Promise<Uint8Array> {
    if (this.assetsPromise === null) {
      this.assetsPromise = cosmeticsAssets();
    }
    return this.assetsPromise.then((assets) => assets[key]);
  }

  private patchSymbol(name: string, buffer: Uint8Array) {
    for (const game of GAMES) {
      const addrs = this.symbols[game].get(name) || [];
      for (const addr of addrs) {
        const file = this.builder.fileByVRAM(game, addr);
        if (!file) {
          throw new Error(`Failed to find file for symbol ${name} at 0x${addr.toString(16)}`);
        }
        const offset = addr - file.vram![game]![0];
        file.data.set(buffer, offset);
      }
    }
  }

  private addNewFile(data: Uint8Array, compressed = true) {
    const size = (data.length + 0xf) & ~0xf;
    const vrom = this.builder.addFile({ data, type: compressed ? 'compressed' : 'uncompressed', game: 'custom' })!;
    return [vrom, (vrom + size) >>> 0];
  }

  private async patchMmTunicDeku(color: number) {
    const file = this.builder.fileByNameRequired('mm/objects/object_link_nuts');
    const lutOff = 0x4090;
    const lut = file.data.subarray(lutOff, lutOff + 16 * 2);
    const newLut = recolorImage('rgba16', lut, null, 0x00b439, color);
    lut.set(newLut);
  }

  private patchMmTunicGoron(color: number) {
    const file = this.builder.fileByNameRequired('mm/objects/object_link_goron');

    const texOff = 0x2780;
    const tex = file.data.subarray(texOff, texOff + 8 * 16 * 2);
    const newTex = recolorImage('rgba16', tex, null, 0x00b439, color);
    tex.set(newTex);

    const texOff2 = 0xceb8;
    const tex2 = file.data.subarray(texOff2, texOff2 + 8 * 16 * 2);
    const newTex2 = recolorImage('rgba16', tex2, null, 0x00b439, color);
    tex2.set(newTex2);
  }

  private patchMmTunicZora(color: number) {
    const fileLink = this.builder.fileByNameRequired('mm/objects/object_link_zora');
    const fileKeep = this.builder.fileByNameRequired('mm/objects/gameplay_keep');

    const lutOff = 0x5000 + 9 * 16 * 2;
    const lut = fileLink.data.subarray(lutOff, lutOff + 16 * 2 * 2);
    const newLut = recolorImage('rgba16', lut, null, 0x00b439, color);
    lut.set(newLut);

    const lutOff2 = 0xc578 + 9 * 16 * 2;
    const lut2 = fileLink.data.subarray(lutOff2, lutOff2 + 16 * 2 * 2);
    const newLut2 = recolorImage('rgba16', lut2, null, 0x00b439, color);
    lut2.set(newLut2);

    const texOff = 0x10228 + 7 * 16 * 2;
    const tex = fileLink.data.subarray(texOff, texOff + (32 - 7) * 16 * 2);
    const newTex = recolorImage('rgba16', tex, null, 0x00b439, color);
    tex.set(newTex);

    /* Fin */
    const texOff2 = 0x700b0 + 7 * 16 * 2;
    const tex2 = fileKeep.data.subarray(texOff2, texOff2 + (32 - 7) * 16 * 2);
    const newTex2 = recolorImage('rgba16', tex2, null, 0x00b439, color);
    tex2.set(newTex2);
  }

  private patchMmTunicFierceDeity(color: number) {
    const file = this.builder.fileByNameRequired('mm/objects/object_link_boy');
    const lutOff = 0x8128;
    const lut = file.data.subarray(lutOff, lutOff + 16 * 2);
    const newLut = recolorImage('rgba16', lut, null, 0xffffff, color);
    lut.set(newLut);
  }

  private async patchOotTunic(index: number, color: number) {
    const defaultColorIcons: number[] = [
      0x005a00,
      0x7a0000,
      0x0020b7,
    ];
    const defaultColorIcon = defaultColorIcons[index];
    const fileOotCode = this.builder.fileByNameRequired('oot/code');
    const fileOotIconItemStatic = this.builder.fileByNameRequired('oot/icon_item_static');
    const mask = await this.asset('MASK_TUNIC');
    const colorBuffer = colorBufferRGB(color);

    /* Patch the in-game color */
    fileOotCode.data.set(colorBuffer, 0xe6a38 + index * 3);

    /* Patch the icon */
    const iconIndex = 0x41 + index;
    const iconOffset = 0x1000 * iconIndex;
    const icon = fileOotIconItemStatic.data.subarray(iconOffset, iconOffset + 0x1000);
    const newIcon = recolorImage('rgba32', icon, mask, defaultColorIcon, color);
    icon.set(newIcon);

    /* Patch the GI */
    if (index !== 0 && this.opts.cosmetics.applyFreestandings) {
      const file = this.builder.fileByNameRequired('oot/objects/object_gi_clothes');
      let off = 0x14e0 + (index - 1) * 0x20;
      const colorPrim1 = colorBufferRGB(brightness(color, 0.76));
      const colorEnv1 = colorBufferRGB(brightness(color, 0.53));
      const colorPrim2 = colorBuffer;
      const colorEnv2 = colorBufferRGB(brightness(color, 0.59));

      file.data.set(colorPrim1, off + 0x0c);
      file.data.set(colorEnv1, off + 0x14);
      file.data.set(colorPrim2, off + 0x4c);
      file.data.set(colorEnv2, off + 0x54);
    }
  }

  private async patchOotShieldMirror(color: number) {
    const buffer = colorBufferRGB(color);
    const fileObjectLinkBoy = this.builder.fileByNameRequired('oot/objects/object_link_boy');
    const fileIconItemStatic = this.builder.fileByNameRequired('oot/icon_item_static');
    const fileGi = this.builder.fileByNameRequired('oot/objects/object_gi_shield_3');
    const mask = await this.asset('MASK_OOT_SHIELD_MIRROR');

    /* Patch the field model */
    for (const off of [0x21270, 0x21768, 0x24278, 0x26560, 0x26980, 0x28dd0]) {
      fileObjectLinkBoy.data.set(buffer, off + 4);
    }

    /* Patch icon */
    const iconOffset = 0x40 * 0x1000;
    const icon = fileIconItemStatic.data.subarray(iconOffset, iconOffset + 0x1000);
    const newIcon = recolorImage('rgba32', icon, mask, 0xff1313, color);
    icon.set(newIcon);

    /* Patch gi */
    if (this.opts.cosmetics.applyFreestandings) {
      const primColor = colorBufferRGB(color);
      const envColor = colorBufferRGB(brightness(color, 0.2));
      fileGi.data.set(primColor, 0xfc8 + 4);
      fileGi.data.set(envColor, 0xfd0 + 4);
    }

    /* Patch the ageless shield (sheath) */
    const fileAgeless1 = this.builder.fileByName('custom/eq_shield_mirror');
    if (fileAgeless1) {
      const off = 0x1b1c;
      const original = bufReadU32BE(fileAgeless1.data, off);
      if (original === 0xd70000ff) {
        fileAgeless1.data.set(buffer, off);
      }
    }

    const fileAgeless2 = this.builder.fileByName('custom/eq_sheath_shield_mirror');
    if (fileAgeless2) {
      const off = 0x1e7c;
      const original = bufReadU32BE(fileAgeless2.data, off);
      if (original === 0xd70000ff) {
        fileAgeless2.data.set(buffer, off);
      }
    }
  }

  private async getPathBuffer(path: BufferPath | null): Promise<Uint8Array | null> {
    if (path === null) {
      return null;
    }

    if (typeof path === 'string') {
      if (!process.env.__IS_BROWSER__) {
        return fs.promises.readFile(path);
      } else {
        throw new Error(`Cannot load buffers from path`);
      }
    } else if (path instanceof File) {
      const reader = new FileReader();
      return new Promise<Uint8Array>((resolve, reject) => {
        reader.onload = () => {
          resolve(new Uint8Array(reader.result as ArrayBuffer));
        };
        reader.onerror = () => {
          reject(new Error('Failed to read file'));
        };
        reader.readAsArrayBuffer(path);
      });
    } else {
      return new Uint8Array(path);
    }
  }

  private equipmentInputName(path: BufferPath, index: number) {
    if (typeof path === 'string') return path;
    if (typeof File !== 'undefined' && path instanceof File) return path.name;
    return `equipment-${index + 1}`;
  }

  private async resolveEquipmentCosmetics(game: 'oot' | 'mm', paths: BufferPath[]): Promise<Map<string, EquipmentResolvedOverride>> {
    const winners = new Map<string, EquipmentResolvedOverride>();

    for (let i = 0; i < paths.length; ++i) {
      const data = await this.getPathBuffer(paths[i]);
      if (!data) continue;
      const sourceName = this.equipmentInputName(paths[i], i);
      const overrides = await resolveEquipmentInput(data, sourceName);
      for (let j = 0; j < overrides.length; ++j) {
        const override = overrides[j];
        if (!override.targetId.startsWith(`${game}:`)) {
          throw new Error(`${sourceName}: configured for ${override.targetId.startsWith('oot:') ? 'OoT' : 'MM'} but was placed in the ${game === 'oot' ? 'OoT' : 'MM'} equipment list`);
        }
        winners.set(override.targetId, { ...override, stackOrder: i * 0x1000 + j });
      }
    }

    return winners;
  }

  private validateModel(data: Uint8Array) {
    const magic = new TextEncoder().encode('MODLOADER64');
    const index = data.findIndex((v, i) => {
      for (let j = 0; j < magic.length; ++j) {
        if (data[i + j] !== magic[j]) {
          return false;
        }
      }
      return true;
    });
    if (index === -1) {
      throw new Error('Invalid model file');
    }
  }

  private findEmptyListOffset(data: Uint8Array) {
    const emptyList = new Uint8Array([0xdf, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
    for (let i = 0; i < data.length; i += 8) {
      let found = true;
      for (let j = 0; j < 8; ++j) {
        if (data[i + j] !== emptyList[j]) {
          found = false;
          break;
        }
      }
      if (found) {
        return i;
      }
    }
    throw new Error('Failed to find empty list offset');
  }

  private logCompaction(game: 'OoT' | 'MM', age: 'adult' | 'child', before: number, used: number, replaced: string[]) {
    const fallback = replaced.length > 0
        ? `; forced vanilla equipment: ${replaced.join(', ')}`
        : '';
    this.monitor.log(
        `${game} ${age} player model compacted: ` +
        `0x${before.toString(16)} -> 0x${used.toString(16)}${fallback}`
    );
  }

  private async patchOotChildModel(modelInput: ResolvedPlayerModel | null, equipment: Map<string, EquipmentResolvedOverride>) {
    const original = this.builder.fileByNameRequired('oot/objects/object_link_child');

    if (!modelInput) {
      const patched = applyEquipmentOverridesToOotModel(original.data, 'child', equipment.values());
      if (patched === original.data || patched.length === original.data.length) {
        original.data = patched;
      } else {
        const code = this.builder.fileByNameRequired('oot/code');
        const object = this.addNewFile(patched);
        code.data.set(toU32Buffer(object), 0xe7f58 + 8 * 0x15);
      }
      return;
    }

    const crossGame = modelInput.sourceGame !== null && modelInput.sourceGame !== 'oot';
    let model = prepareOotModel(modelInput.data, original.data, 'child', crossGame);

    const equipmentResult = applyEquipmentOverridesToPreparedOotModel(
        model.data, 'child', equipment.values());
    model = { ...model, data: equipmentResult.data };

    const before = model.data.length;
    model = compactOotPlayerModel(
        model, original.data, 'child', OOT_CHILD_MODEL_SIZE,
        equipmentResult.preservedPieces);
    if (model.compaction) {
      this.logCompaction('OoT', 'child', before, model.compaction.usedSize, model.compaction.replacedPieces);
      if (equipmentResult.preservedPieces.length > 0) {
        this.monitor.log(`OoT child custom equipment kept in final compacted Link object: ${equipmentResult.preservedPieces.join(', ')}.`);
      }
    }

    if (model.data.length <= original.data.length) {
      original.data = model.data;
    } else {
      const code = this.builder.fileByNameRequired('oot/code');
      const object = this.addNewFile(model.data);
      code.data.set(toU32Buffer(object), 0xe7f58 + 8 * 0x15);
      this.monitor.log(`OoT child final player model/equipment relocated at 0x${model.data.length.toString(16)} bytes after compaction.`);
    }
    enableModelOotLinkChild(this.builder, model.dfAddr);
  }

  private async patchOotAdultModel(modelInput: ResolvedPlayerModel | null, equipment: Map<string, EquipmentResolvedOverride>) {
    const original = this.builder.fileByNameRequired('oot/objects/object_link_boy');

    if (!modelInput) {
      const patched = applyEquipmentOverridesToOotModel(original.data, 'adult', equipment.values());
      if (patched === original.data || patched.length === original.data.length) {
        original.data = patched;
      } else {
        const code = this.builder.fileByNameRequired('oot/code');
        const object = this.addNewFile(patched);
        code.data.set(toU32Buffer(object), 0xe7f58 + 8 * 0x14);
      }
      return;
    }

    const crossGame = modelInput.sourceGame !== null && modelInput.sourceGame !== 'oot';
    let model = prepareOotModel(modelInput.data, original.data, 'adult', crossGame);
    const equipmentResult = applyEquipmentOverridesToPreparedOotModel(
        model.data, 'adult', equipment.values());
    model = { ...model, data: equipmentResult.data };

    const before = model.data.length;
    model = compactOotPlayerModel(
        model, original.data, 'adult', OOT_ADULT_MODEL_SIZE,
        equipmentResult.preservedPieces);
    if (model.compaction) {
      this.logCompaction('OoT', 'adult', before, model.compaction.usedSize, model.compaction.replacedPieces);
      if (equipmentResult.preservedPieces.length > 0) {
        this.monitor.log(`OoT adult custom equipment kept in final compacted Link object: ${equipmentResult.preservedPieces.join(', ')}.`);
      }
    }

    if (model.data.length <= original.data.length) {
      original.data = model.data;
    } else {
      const code = this.builder.fileByNameRequired('oot/code');
      const object = this.addNewFile(model.data);
      code.data.set(toU32Buffer(object), 0xe7f58 + 8 * 0x14);
      this.monitor.log(`OoT adult final player model/equipment relocated at 0x${model.data.length.toString(16)} bytes after compaction.`);
    }
    enableModelOotLinkAdult(this.builder, model.dfAddr);
  }

  private replaceCustomObject(name: string, data: Uint8Array) {
    const original = this.builder.fileByNameRequired(name);
    const objectTable = this.builder.fileByNameRequired('custom/object_table');

    if (original.vaddr === undefined) {
      throw new Error(`Custom object ${name} has no VROM address`);
    }

    const oldStart = original.vaddr;
    const oldEnd = oldStart + original.data.length;
    let tableOffset = -1;

    for (let offset = 0; offset + 8 <= objectTable.data.length; offset += 8) {
      const start = bufReadU32BE(objectTable.data, offset);
      const end = bufReadU32BE(objectTable.data, offset + 4);

      if (start === oldStart && end === oldEnd) {
        tableOffset = offset;
        break;
      }
    }

    if (tableOffset === -1) {
      throw new Error(`Failed to find custom object table entry for ${name}`);
    }

    const [start] = this.addNewFile(data);

    bufWriteU32BE(objectTable.data, tableOffset, start);
    bufWriteU32BE(objectTable.data, tableOffset + 4, start + data.length);
  }

  patchFileSelect(color: number) {
    /* Patch the skybox */
    const basePal = this.builder.fileByNameRequired('oot/misc/vr_fine3_pal_static');
    const newPal = recolorImage('rgba16', basePal.data, null, 0x0000ff, color);
    this.builder.addFile({ game: 'custom', type: 'uncompressed', vaddr: 0xf1100000, data: newPal });

    /* Patch the file select color */
    this.patchSymbol('COLOR_FILE_SELECT', colorBufferRGB(color));
    this.patchSymbol('COLOR_FILE_SELECT_HIGHLIGHT', colorBufferRGB(brightness(color, 1.2)));
  }

  private async patchMmChildModel(modelInput: ResolvedPlayerModel | null, equipment: Map<string, EquipmentResolvedOverride>) {
    const original = this.builder.fileByNameRequired('mm/objects/object_link_child');
    const code = this.builder.fileByNameRequired('mm/code');

    if (!modelInput) {
      const patched = applyEquipmentOverridesToMmModel(original.data, equipment.values());
      if (patched.length <= original.data.length) {
        original.data = patched;
      } else {
        const object = this.addNewFile(patched);
        code.data.set(toU32Buffer(object), 0x11cc80 + 8 * 0x11);
      }
      return;
    }

    const childTables = this.builder.fileByNameRequired('custom/mm_age_model_child_tables');
    const crossGame = modelInput.sourceGame !== null && modelInput.sourceGame !== 'mm';
    let model = prepareMmModel(modelInput.data, original.data, code.data, 'child', crossGame);
    const equipmentResult = applyEquipmentOverridesToPreparedMmModel(model.data, equipment.values());
    model = { ...model, data: equipmentResult.data };
    const before = model.data.length;
    model = compactMmPlayerModel(model, original.data, 'child', undefined, equipmentResult.preservedPieces);
    if (model.compaction) {
      this.logCompaction('MM', 'child', before, model.compaction.usedSize, model.compaction.replacedPieces);
      if (equipmentResult.preservedPieces.length > 0) {
        this.monitor.log(`MM child custom equipment kept in final compacted Link object: ${equipmentResult.preservedPieces.join(', ')}.`);
      }
    }

    patchMmChildModelTables(childTables.data, code.data);
    if (model.data.length <= original.data.length) {
      original.data = model.data;
    } else {
      const object = this.addNewFile(model.data);
      code.data.set(toU32Buffer(object), 0x11cc80 + 8 * 0x11);
    }
  }

  private async patchMmAdultModel(modelInput: ResolvedPlayerModel | null, equipment: Map<string, EquipmentResolvedOverride>) {
    const vanilla = this.builder.fileByNameRequired('mm/objects/object_link_child');
    const adultTemplate = this.builder.fileByNameRequired('custom/mm_adult_link');
    const code = this.builder.fileByNameRequired('mm/code');
    const adultTables = this.builder.fileByNameRequired('custom/mm_age_model_tables');

    if (!modelInput) {
      const hasPlayerEquipment = [...equipment.keys()].some((id) => id.startsWith('mm:') && id !== 'mm:sword:kokiri' && id !== 'mm:sword:razor');
      if (!hasPlayerEquipment) return;
      let model = prepareMmModel(adultTemplate.data, vanilla.data, code.data, 'adult', false, adultTemplate.data);
      const equipmentResult = applyEquipmentOverridesToPreparedMmModel(model.data, equipment.values());
      model = { ...model, data: equipmentResult.data };
      const before = model.data.length;
      model = compactMmPlayerModel(model, vanilla.data, 'adult', undefined, equipmentResult.preservedPieces);
      if (model.compaction) {
        this.logCompaction('MM', 'adult', before, model.compaction.usedSize, model.compaction.replacedPieces);
        if (equipmentResult.preservedPieces.length > 0) {
          this.monitor.log(`MM adult custom equipment kept in final compacted Link object: ${equipmentResult.preservedPieces.join(', ')}.`);
        }
      }
      patchMmAdultModelTables(adultTables.data);
      this.replaceCustomObject('custom/mm_adult_link', model.data);
      return;
    }

    const crossGame = modelInput.sourceGame !== null && modelInput.sourceGame !== 'mm';
    let model = prepareMmModel(modelInput.data, vanilla.data, code.data, 'adult', crossGame, adultTemplate.data);
    const equipmentResult = applyEquipmentOverridesToPreparedMmModel(model.data, equipment.values());
    model = { ...model, data: equipmentResult.data };
    const before = model.data.length;
    model = compactMmPlayerModel(model, vanilla.data, 'adult', undefined, equipmentResult.preservedPieces);
    if (model.compaction) {
      this.logCompaction('MM', 'adult', before, model.compaction.usedSize, model.compaction.replacedPieces);
      if (equipmentResult.preservedPieces.length > 0) {
        this.monitor.log(`MM adult custom equipment kept in final compacted Link object: ${equipmentResult.preservedPieces.join(', ')}.`);
      }
    }

    patchMmAdultModelTables(adultTables.data);
    this.replaceCustomObject('custom/mm_adult_link', model.data);
  }

  private patchMmGameplayKeepEquipment(equipment: Map<string, EquipmentResolvedOverride>) {
    const keep = this.builder.fileByNameRequired('mm/objects/gameplay_keep');
    const patched = applyEquipmentOverridesToMmGameplayKeep(keep.data, equipment.values());
    if (patched === keep.data) return;
    const code = this.builder.fileByNameRequired('mm/code');
    const object = this.addNewFile(patched);
    code.data.set(toU32Buffer(object), 0x11cc80 + 8 * 0x01);
  }

  async run(): Promise<string | null> {
    const c = this.opts.cosmetics;

    /* Create a random number generator */
    const random = new Random();
    await random.seed(randString());

    /* Resolve colors */
    const colorOotTunicKokiri = resolveColor(random, c.ootTunicKokiri);
    const colorOotTunicGoron = resolveColor(random, c.ootTunicGoron);
    const colorOotTunicZora = resolveColor(random, c.ootTunicZora);
    const colorMmTunicHuman = resolveColor(random, c.mmTunicHuman, () => colorOotTunicKokiri);
    const colorMmTunicDeku = resolveColor(random, c.mmTunicDeku, () => colorMmTunicHuman);
    const colorMmTunicGoron = resolveColor(random, c.mmTunicGoron, () => colorMmTunicHuman);
    const colorMmTunicZora = resolveColor(random, c.mmTunicZora, () => colorMmTunicHuman);
    const colorMmTunicFierceDeity = resolveColor(random, c.mmTunicFierceDeity);
    const colorOotShieldMirror = resolveColor(random, c.ootShieldMirror);
    const colorDpad = resolveColor(random, c.dpad);
    const colorFileSelect = resolveColor(random, c.fileSelect);

    /* Patch hold target */
    if (c.defaultHold) {
      this.patchSymbol('HOLD_TARGET', new Uint8Array([0x01]));
    }

    /* Patch human tunics */
    if (colorOotTunicKokiri !== null) {
      await this.patchOotTunic(0, colorOotTunicKokiri);
    }

    if (colorOotTunicGoron !== null) {
      await this.patchOotTunic(1, colorOotTunicGoron);
      this.patchSymbol('MM_COLOR_TUNIC_GORON', colorBufferRGB(colorOotTunicGoron));
    }

    if (colorOotTunicZora !== null) {
      await this.patchOotTunic(2, colorOotTunicZora);
      this.patchSymbol('MM_COLOR_TUNIC_ZORA', colorBufferRGB(colorOotTunicZora));
    }

    if (colorMmTunicHuman !== null) {
      this.patchSymbol('MM_COLOR_TUNIC_KOKIRI', colorBufferRGB(colorMmTunicHuman));
    }

    /* Forms */
    if (colorMmTunicDeku !== null) this.patchMmTunicDeku(colorMmTunicDeku);
    if (colorMmTunicGoron !== null) this.patchMmTunicGoron(colorMmTunicGoron);
    if (colorMmTunicZora !== null) this.patchMmTunicZora(colorMmTunicZora);
    if (colorMmTunicFierceDeity !== null) this.patchMmTunicFierceDeity(colorMmTunicFierceDeity);

    /* Patch OoT Mirror Shield */
    if (colorOotShieldMirror !== null) this.patchOotShieldMirror(colorOotShieldMirror);

    /* Patch D-Pad */
    if (colorDpad !== null) {
      this.patchSymbol('DPAD_COLOR', colorBufferRGB(colorDpad));
    }

    if (colorFileSelect !== null) this.patchFileSelect(colorFileSelect);

    if(c.nightBgm) {
      this.patchSymbol('NIGHT_BGM', new Uint8Array([0x01]));
    }

    const [equipmentOot, equipmentMm] = await Promise.all([
      this.resolveEquipmentCosmetics('oot', c.equipmentOot),
      this.resolveEquipmentCosmetics('mm', c.equipmentMm),
    ]);
    const equipment = new Map<string, EquipmentResolvedOverride>([...equipmentOot, ...equipmentMm]);
    if (equipment.size > 0) {
      this.monitor.log(`Resolved ${equipmentOot.size} OoT and ${equipmentMm.size} MM equipment cosmetic target(s); lower files won conflicts after remapping in each game.`);
    }

    const ootChildInput = await resolvePlayerModelInput(
        await this.getPathBuffer(c.modelOotChildLink),
        'oot',
        'child'
    );

    const ootAdultInput = await resolvePlayerModelInput(
        await this.getPathBuffer(c.modelOotAdultLink),
        'oot',
        'adult'
    );

    const mmChildInput = await resolvePlayerModelInput(
        await this.getPathBuffer(c.modelMmChildLink),
        'mm',
        'child'
    );

    const mmAdultInput = await resolvePlayerModelInput(
        await this.getPathBuffer(c.modelMmAdultLink),
        'mm',
        'adult'
    );

    const ootModels = mergePlayerModelInputs(
        ootChildInput,
        ootAdultInput
    );

    const mmModels = mergePlayerModelInputs(
        mmChildInput,
        mmAdultInput
    );
    await this.patchOotChildModel(ootModels.child, equipment);
    await this.patchOotAdultModel(ootModels.adult, equipment);
    await this.patchMmAdultModel(mmModels.adult, equipment);
    await this.patchMmChildModel(mmModels.child, equipment);
    this.patchMmGameplayKeepEquipment(equipment);

    const ootChildVoiceInput = await resolvePlayerVoiceInput(
        await this.getPathBuffer(c.voiceOotChildLink),
        'child'
    );

    const ootAdultVoiceInput = await resolvePlayerVoiceInput(
        await this.getPathBuffer(c.voiceOotAdultLink),
        'adult'
    );

    const mmChildVoiceInput = await resolvePlayerVoiceInput(
        await this.getPathBuffer(c.voiceMmChildLink),
        'child'
    );

    const mmAdultVoiceInput = await resolvePlayerVoiceInput(
        await this.getPathBuffer(c.voiceMmAdultLink),
        'adult'
    );

    const ootVoices = mergePlayerVoiceInputs(
        ootChildVoiceInput,
        ootAdultVoiceInput
    );

    const mmVoices = mergePlayerVoiceInputs(
        mmChildVoiceInput,
        mmAdultVoiceInput
    );

    await patchPlayerVoices(
        this.builder,
        ootVoices,
        mmVoices
    );

    /* Custom music */
    if (c.music) {
      this.patchSymbol('MUSIC_CUSTOM', new Uint8Array([0x01]));
      const data = await this.getPathBuffer(c.music);
      if (data)
        await randomizeMusic(c, this.logWriter, this.monitor, this.builder, random, data);
    }
    if (c.musicNames) {
      this.patchSymbol('MUSIC_NAMES', new Uint8Array([0x01]));
    }

    if(c.noLowHealthBeep) {
      this.patchSymbol('NO_LOW_HEALTH_BEEP', new Uint8Array([0x01]));
    }

    if (c.gerudoTunic) {
      this.patchSymbol('GERUDO_TUNIC', new Uint8Array([0x01]));
    }

    const log = this.logWriter.emit();
    if (log !== '') {
      return log;
    } else {
      return null;
    }
  }
}

export async function cosmetics(monitor: Monitor, opts: Options, builder: RomBuilder, symbols: Record<Game, Map<string, number[]>>): Promise<string | null> {
  const x = new CosmeticsPass(monitor, opts, builder, symbols);
  return x.run();
}
