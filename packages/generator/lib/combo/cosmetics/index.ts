import type { Game } from '@ootmm/data';
import type { ColorArg, BufferPath, Options, Cosmetics } from '@ootmm/core';

import fs from 'node:fs';
import JSZip from 'jszip';
import { GAMES } from '@ootmm/data';
import { COLORS, Monitor, Random, randString, sample, shuffle } from '@ootmm/core';
import { concatUint8Arrays } from 'uint8array-extras';
import { recolorImage } from '../image';
import { RomBuilder } from '../rom-builder';
import { png } from '../util/png';
import { LogWriter } from '../util/log-writer';
import { bufReadU32BE, bufWriteU32BE } from '../util/buffer';
import { toU32Buffer } from '../util.ts';
import { align16 } from '../compact.ts';
import {
  enableModelOotLinkAdult,
  enableModelOotLinkChild,
  mergePlayerModelInputs,
  resolvePlayerModelInput,
  type ResolvedPlayerModel,
} from './player-model';
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
import { mergePlayerVoiceInputs, resolvePlayerVoiceInput } from './voice-input';
import { patchPlayerVoices } from './voice';
import {
  applyEquipmentOverridesToMmGameplayKeep,
  applyEquipmentOverridesToMmModel,
  applyEquipmentOverridesToOotModel,
  applyEquipmentOverridesToPreparedMmModel,
  applyEquipmentOverridesToPreparedOotModel,
  resolveEquipmentInput,
  type EquipmentResolvedOverride,
} from './equipment-input';

/* music.ts */
type MusicType = 'bgm' | 'fanfare';

type MusicEntry = {
  type: MusicType;
  name: string;
  oot?: number[];
  mm?: number[];
  categories: MusicCategory[];
}

enum MusicCategory {
  NONE = 0,
  BGM_TITLE_SCREEN,
  BGM_FILE_SELECT,
  BGM_CALM,
  BGM_FIELD,
  BGM_DUNGEON,
  BGM_DUNGEON_FINAL,
  BGM_TOWN,
  BGM_BATTLE,
  BGM_ACTION,
  BGM_MINIGAME,
  BGM_MINIBOSS,
  BGM_BOSS,
  BGM_BOSS_FINAL,
  BGM_INDOOR,
}

const MUSIC: {[k: string]: MusicEntry} = {
  OOT_FILE_SELECT:                      { type: 'bgm',     name: 'OoT - File Select',                     oot: [0x57], categories: [MusicCategory.BGM_FILE_SELECT, MusicCategory.BGM_CALM] },
  OOT_HYRULE_FIELD:                     { type: 'bgm',     name: 'OoT - Hyrule Field',                    oot: [0x02], categories: [MusicCategory.BGM_FIELD] },
  OOT_DODONGO_CAVERN:                   { type: 'bgm',     name: 'OoT - Dodongo Cavern',                  oot: [0x18], categories: [MusicCategory.BGM_DUNGEON] },
  OOT_KAKARIKO_ADULT:                   { type: 'bgm',     name: 'OoT - Kakariko Adult',                  oot: [0x19], categories: [MusicCategory.BGM_TOWN] },
  OOT_BATTLE:                           { type: 'bgm',     name: 'OoT - Battle',                          oot: [0x1a], categories: [MusicCategory.BGM_BATTLE, MusicCategory.BGM_ACTION] },
  OOT_BATTLE_BOSS:                      { type: 'bgm',     name: 'OoT - Boss Battle',                     oot: [0x1b], categories: [MusicCategory.BGM_BOSS, MusicCategory.BGM_BATTLE, MusicCategory.BGM_ACTION] },
  OOT_DEKU_TREE:                        { type: 'bgm',     name: 'OoT - Deku Tree',                       oot: [0x1c], categories: [MusicCategory.BGM_DUNGEON] },
  OOT_MARKET:                           { type: 'bgm',     name: 'OoT - Market',                          oot: [0x1d], categories: [MusicCategory.BGM_TOWN] },
  OOT_TITLE:                            { type: 'bgm',     name: 'OoT - Title Theme',                     oot: [0x1e], categories: [MusicCategory.BGM_TITLE_SCREEN, MusicCategory.BGM_CALM] },
  OOT_HOUSES:                           { type: 'bgm',     name: 'OoT - Houses',                          oot: [0x1f], categories: [MusicCategory.BGM_INDOOR, MusicCategory.BGM_CALM] },
  OOT_JABU_JABU:                        { type: 'bgm',     name: 'OoT - Jabu Jabu',                       oot: [0x26], categories: [MusicCategory.BGM_DUNGEON] },
  OOT_KAKARIKO_CHILD:                   { type: 'bgm',     name: 'OoT - Kakariko Child',                  oot: [0x27], categories: [MusicCategory.BGM_TOWN] },
  OOT_FAIRY_FOUNTAIN:                   { type: 'bgm',     name: 'OoT - Fairy Fountain',                  oot: [0x28], categories: [MusicCategory.BGM_CALM] },
  OOT_ZELDA_THEME:                      { type: 'bgm',     name: 'OoT - Zelda Theme',                     oot: [0x29], categories: [MusicCategory.BGM_CALM] },
  OOT_TEMPLE_FIRE:                      { type: 'bgm',     name: 'OoT - Fire Temple',                     oot: [0x2a], categories: [MusicCategory.BGM_DUNGEON] },
  OOT_TEMPLE_FOREST:                    { type: 'bgm',     name: 'OoT - Forest Temple',                   oot: [0x2c], categories: [MusicCategory.BGM_DUNGEON] },
  OOT_CASTLE_COURTYARD:                 { type: 'bgm',     name: 'OoT - Castle Courtyard',                oot: [0x2d], categories: [MusicCategory.BGM_CALM] },
  OOT_GANONDORF_THEME:                  { type: 'bgm',     name: 'OoT - Ganondorf Theme',                 oot: [0x2e], categories: [MusicCategory.BGM_ACTION] },
  OOT_LON_LON_RANCH:                    { type: 'bgm',     name: 'OoT - Lon Lon Ranch',                   oot: [0x2f], categories: [MusicCategory.BGM_TOWN] },
  OOT_GORON_CITY:                       { type: 'bgm',     name: 'OoT - Goron City',                      oot: [0x30], categories: [MusicCategory.BGM_TOWN] },
  OOT_BATTLE_MINIBOSS:                  { type: 'bgm',     name: 'OoT - Miniboss Battle',                 oot: [0x38], categories: [MusicCategory.BGM_MINIBOSS, MusicCategory.BGM_BATTLE, MusicCategory.BGM_ACTION] },
  OOT_TEMPLE_OF_TIME:                   { type: 'bgm',     name: 'OoT - Temple of Time',                  oot: [0x3a], categories: [MusicCategory.BGM_CALM] },
  OOT_KOKIRI_FOREST:                    { type: 'bgm',     name: 'OoT - Kokiri Forest',                   oot: [0x3c], categories: [MusicCategory.BGM_TOWN] },
  OOT_LOST_WOODS:                       { type: 'bgm',     name: 'OoT - Lost Woods',                      oot: [0x3e], categories: [] /* ??? */ },
  OOT_TEMPLE_SPIRIT:                    { type: 'bgm',     name: 'OoT - Spirit Temple',                   oot: [0x3f], categories: [MusicCategory.BGM_DUNGEON] },
  OOT_HORSE_RACE:                       { type: 'bgm',     name: 'OoT - Horse Race',                      oot: [0x40], categories: [MusicCategory.BGM_MINIGAME, MusicCategory.BGM_ACTION] },
  OOT_INGO_THEME:                       { type: 'bgm',     name: 'OoT - Ingo Theme',                      oot: [0x42], categories: [MusicCategory.BGM_CALM] },
  OOT_FAIRY_FLYING:                     { type: 'bgm',     name: 'OoT - Fairy Flying',                    oot: [0x4a], categories: [MusicCategory.BGM_CALM] },
  OOT_THEME_DEKU_TREE:                  { type: 'bgm',     name: 'OoT - Deku Tree Theme',                 oot: [0x4b], categories: [MusicCategory.BGM_CALM] },
  OOT_WINDMILL_HUT:                     { type: 'bgm',     name: 'OoT - Windmill Hut',                    oot: [0x4c], categories: [MusicCategory.BGM_CALM] },
  OOT_SHOOTING_GALLERY:                 { type: 'bgm',     name: 'OoT - Shooting Gallery',                oot: [0x4e], categories: [MusicCategory.BGM_MINIGAME, MusicCategory.BGM_ACTION] },
  OOT_SHEIK_THEME:                      { type: 'bgm',     name: 'OoT - Sheik Theme',                     oot: [0x4f], categories: [MusicCategory.BGM_CALM] },
  OOT_ZORAS_DOMAIN:                     { type: 'bgm',     name: 'OoT - Zoras Domain',                    oot: [0x50], categories: [MusicCategory.BGM_TOWN] },
  OOT_SHOP:                             { type: 'bgm',     name: 'OoT - Shop',                            oot: [0x55], categories: [MusicCategory.BGM_CALM] },
  OOT_SAGES:                            { type: 'bgm',     name: 'OoT - Chamber of the Sages',            oot: [0x56], categories: [MusicCategory.BGM_CALM] },
  OOT_ICE_CAVERN:                       { type: 'bgm',     name: 'OoT - Ice Cavern',                      oot: [0x58], categories: [MusicCategory.BGM_DUNGEON] },
  OOT_KAEPORA_GAEBORA:                  { type: 'bgm',     name: 'OoT - Kaepora Gaebora',                 oot: [0x5a], categories: [MusicCategory.BGM_CALM] },
  OOT_TEMPLE_SHADOW:                    { type: 'bgm',     name: 'OoT - Shadow Temple',                   oot: [0x5b], categories: [MusicCategory.BGM_DUNGEON] },
  OOT_TEMPLE_WATER:                     { type: 'bgm',     name: 'OoT - Water Temple',                    oot: [0x5c], categories: [MusicCategory.BGM_DUNGEON] },
  OOT_GERUDO_VALLEY:                    { type: 'bgm',     name: 'OoT - Gerudo Valley',                   oot: [0x5f], categories: [MusicCategory.BGM_ACTION] },
  OOT_POTION_SHOP:                      { type: 'bgm',     name: 'OoT - Potion Shop (OoT)',               oot: [0x60], categories: [MusicCategory.BGM_CALM] },
  OOT_KOTAKE_KOUME:                     { type: 'bgm',     name: 'OoT - Kotake and Koume',                oot: [0x61], categories: [MusicCategory.BGM_CALM] },
  OOT_ESCAPE_CASTLE:                    { type: 'bgm',     name: 'OoT - Castle Escape',                   oot: [0x62], categories: [MusicCategory.BGM_ACTION] },
  OOT_UNDERGROUND_CASTLE:               { type: 'bgm',     name: 'OoT - Castle Underground',              oot: [0x63], categories: [MusicCategory.BGM_ACTION] },
  OOT_BATTLE_GANONDORF:                 { type: 'bgm',     name: 'OoT - Ganondorf Battle',                oot: [0x64], categories: [MusicCategory.BGM_BOSS_FINAL, MusicCategory.BGM_BOSS, MusicCategory.BGM_BATTLE, MusicCategory.BGM_ACTION] },
  OOT_BATTLE_GANON:                     { type: 'bgm',     name: 'OoT - Ganon Battle',                    oot: [0x65], categories: [MusicCategory.BGM_BOSS_FINAL, MusicCategory.BGM_BOSS, MusicCategory.BGM_BATTLE, MusicCategory.BGM_ACTION] },
  OOT_BATTLE_BOSS_FIRE:                 { type: 'bgm',     name: 'OoT - Fire Temple Boss',                oot: [0x6b], categories: [MusicCategory.BGM_BOSS, MusicCategory.BGM_BATTLE, MusicCategory.BGM_ACTION] },
  OOT_MINIGAME:                         { type: 'bgm',     name: 'OoT - Minigame',                        oot: [0x6c], categories: [MusicCategory.BGM_MINIGAME, MusicCategory.BGM_ACTION] },
  OOT_GROTTOS:                          { type: 'bgm',     name: 'OoT - Grottos',                         oot: [0x6e], categories: [MusicCategory.BGM_CALM] },
  OOT_GRAVES:                           { type: 'bgm',     name: 'OoT - Graves',                          oot: [0x6f], categories: [MusicCategory.BGM_CALM] },
  OOT_GERUDO_TRAINING_GROUNDS:          { type: 'bgm',     name: 'OoT - Gerudo Training Grounds',         oot: [0x70], categories: [MusicCategory.BGM_DUNGEON] },
  MM_TERMINA_FIELD:                     { type: 'bgm',     name: 'MM - Termina Field',                    mm: [0x02], categories: [MusicCategory.BGM_FIELD] },
  MM_TEMPLE_STONE_TOWER:                { type: 'bgm',     name: 'MM - Stone Tower Temple',               mm: [0x06], categories: [MusicCategory.BGM_DUNGEON] },
  MM_TEMPLE_STONE_TOWER_INVERTED:       { type: 'bgm',     name: 'MM - Stone Tower Temple Inverted',      mm: [0x07], categories: [MusicCategory.BGM_DUNGEON] },
  MM_SOUTHERN_SWAMP:                    { type: 'bgm',     name: 'MM - Southern Swamp',                   mm: [0x0c], categories: [MusicCategory.BGM_FIELD] },
  MM_ALIENS:                            { type: 'bgm',     name: 'MM - Aliens',                           mm: [0x0d], categories: [MusicCategory.BGM_ACTION] },
  MM_MINIGAME:                          { type: 'bgm',     name: 'MM - Minigame',                         mm: [0x0e], categories: [MusicCategory.BGM_MINIGAME, MusicCategory.BGM_ACTION] },
  MM_SHARP_CURSE:                       { type: 'bgm',     name: 'MM - Sharp Curse',                      mm: [0x0f], categories: [MusicCategory.BGM_BATTLE, MusicCategory.BGM_ACTION] },
  MM_GREAT_BAY_COAST:                   { type: 'bgm',     name: 'MM - Great Bay Coast',                  mm: [0x10], categories: [MusicCategory.BGM_FIELD] },
  MM_IKANA_VALLEY:                      { type: 'bgm',     name: 'MM - Ikana Valley',                     mm: [0x11], categories: [MusicCategory.BGM_FIELD] },
  MM_COURT_DEKU_KING:                   { type: 'bgm',     name: 'MM - Court of the Deku King',           mm: [0x12], categories: [MusicCategory.BGM_ACTION] },
  MM_MOUNTAIN_VILLAGE:                  { type: 'bgm',     name: 'MM - Mountain Village',                 mm: [0x13], categories: [MusicCategory.BGM_TOWN] },
  MM_PIRATES_FORTRESS:                  { type: 'bgm',     name: 'MM - Pirates Fortress',                 mm: [0x14], categories: [MusicCategory.BGM_DUNGEON] },
  MM_CLOCK_TOWN_DAY_1:                  { type: 'bgm',     name: 'MM - Clock Town Day 1',                 mm: [0x15, 0x1d], categories: [MusicCategory.BGM_TOWN] },
  MM_CLOCK_TOWN_DAY_2:                  { type: 'bgm',     name: 'MM - Clock Town Day 2',                 mm: [0x16, 0x23], categories: [MusicCategory.BGM_TOWN] },
  MM_CLOCK_TOWN_DAY_3:                  { type: 'bgm',     name: 'MM - Clock Town Day 3',                 mm: [0x17], categories: [MusicCategory.BGM_TOWN] },
  MM_BATTLE_BOSS:                       { type: 'bgm',     name: 'MM - Boss Battle',                      mm: [0x1b], categories: [MusicCategory.BGM_BOSS, MusicCategory.BGM_BATTLE, MusicCategory.BGM_ACTION] },
  MM_WOODFALL_TEMPLE:                   { type: 'bgm',     name: 'MM - Woodfall Temple',                  mm: [0x1c], categories: [MusicCategory.BGM_DUNGEON] },
  MM_STOCK_POT_INN:                     { type: 'bgm',     name: 'MM - Stock Pot Inn',                    mm: [0x1f], categories: [MusicCategory.BGM_INDOOR] },
  MM_MINIGAME2:                         { type: 'bgm',     name: 'MM - Minigame 2',                       mm: [0x25], categories: [MusicCategory.BGM_MINIGAME, MusicCategory.BGM_ACTION] },
  MM_GORON_RACE:                        { type: 'bgm',     name: 'MM - Goron Race',                       mm: [0x26], categories: [MusicCategory.BGM_MINIGAME, MusicCategory.BGM_ACTION] },
  MM_MUSIC_BOX_HOUSE:                   { type: 'bgm',     name: 'MM - Music Box House',                  mm: [0x27], categories: [MusicCategory.BGM_CALM] },
  MM_FAIRYS_FOUNTAIN:                   { type: 'bgm',     name: 'MM - Fairy\'s Fountain',                mm: [0x28] /* 0x18 = File Select */, categories: [MusicCategory.BGM_CALM] },
  MM_MARINE_RESEARCH_LABORATORY:        { type: 'bgm',     name: 'MM - Marine Research Laboratory',       mm: [0x2c], categories: [MusicCategory.BGM_INDOOR] },
  MM_ROMANI_RANCH:                      { type: 'bgm',     name: 'MM - Romani Ranch',                     mm: [0x2f], categories: [MusicCategory.BGM_TOWN] },
  MM_GORON_VILLAGE:                     { type: 'bgm',     name: 'MM - Goron Village',                    mm: [0x30], categories: [MusicCategory.BGM_TOWN] },
  MM_MAYOR_DOTOUR:                      { type: 'bgm',     name: 'MM - Mayor Dotour',                     mm: [0x31], categories: [MusicCategory.BGM_CALM] },
  MM_ZORA_HALL:                         { type: 'bgm',     name: 'MM - Zora Hall',                        mm: [0x36], categories: [MusicCategory.BGM_TOWN] },
  MM_MINIBOSS:                          { type: 'bgm',     name: 'MM - Mini Boss',                        mm: [0x38], categories: [MusicCategory.BGM_MINIBOSS, MusicCategory.BGM_BATTLE, MusicCategory.BGM_ACTION] },
  MM_ASTRAL_OBSERVATORY:                { type: 'bgm',     name: 'MM - Astral Observatory',               mm: [0x3a], categories: [MusicCategory.BGM_CALM] },
  MM_BOMBERS_HIDEOUT:                   { type: 'bgm',     name: 'MM - Bombers Hideout',                  mm: [0x3b], categories: [MusicCategory.BGM_ACTION] },
  MM_MILK_BAR:                          { type: 'bgm',     name: 'MM - Milk Bar',                         mm: [0x3c, 0x56], categories: [MusicCategory.BGM_INDOOR] },
  MM_WOODS_OF_MYSTERY:                  { type: 'bgm',     name: 'MM - Woods of Mystery',                 mm: [0x3e], categories: [MusicCategory.BGM_FIELD] },
  MM_GORMAN_RACE:                       { type: 'bgm',     name: 'MM - Gorman Race',                      mm: [0x40], categories: [MusicCategory.BGM_MINIGAME, MusicCategory.BGM_ACTION] },
  MM_GORMAN_BROS:                       { type: 'bgm',     name: 'MM - Gorman Bros.',                     mm: [0x42], categories: [MusicCategory.BGM_INDOOR] },
  MM_KOTAKE_POTION_SHOP:                { type: 'bgm',     name: 'MM - Kotake\'s Potion Shop',            mm: [0x43], categories: [MusicCategory.BGM_INDOOR] },
  MM_STORE:                             { type: 'bgm',     name: 'MM - Store',                            mm: [0x44], categories: [MusicCategory.BGM_INDOOR] },
  MM_TARGET_PRACTICE:                   { type: 'bgm',     name: 'MM - Target Practice',                  mm: [0x46], categories: [MusicCategory.BGM_MINIGAME, MusicCategory.BGM_ACTION] },
  MM_SWORD_TRAINING:                    { type: 'bgm',     name: 'MM - Sword Training',                   mm: [0x50], categories: [MusicCategory.BGM_MINIGAME, MusicCategory.BGM_ACTION] },
  MM_FINAL_HOURS:                       { type: 'bgm',     name: 'MM - Final Hours',                      mm: [0x57, 0x60] /* Not clear why there are two versions */, categories: [MusicCategory.BGM_CALM] },
  MM_TEMPLE_SNOWHEAD:                   { type: 'bgm',     name: 'MM - Snowhead Temple',                  mm: [0x65], categories: [MusicCategory.BGM_DUNGEON] },
  MM_TEMPLE_GREAT_BAY:                  { type: 'bgm',     name: 'MM - Great Bay Temple',                 mm: [0x66], categories: [MusicCategory.BGM_DUNGEON] },
  MM_BATTLE_MAJORA3:                    { type: 'bgm',     name: 'MM - Majora\'s Wrath',                  mm: [0x69], categories: [MusicCategory.BGM_BOSS_FINAL, MusicCategory.BGM_BOSS, MusicCategory.BGM_BATTLE, MusicCategory.BGM_ACTION] },
  MM_BATTLE_MAJORA2:                    { type: 'bgm',     name: 'MM - Majora\'s Incarnation',            mm: [0x6a], categories: [MusicCategory.BGM_BOSS_FINAL, MusicCategory.BGM_BOSS, MusicCategory.BGM_BATTLE, MusicCategory.BGM_ACTION] },
  MM_BATTLE_MAJORA1:                    { type: 'bgm',     name: 'MM - Majora\'s Mask',                   mm: [0x6b], categories: [MusicCategory.BGM_BOSS_FINAL, MusicCategory.BGM_BOSS, MusicCategory.BGM_BATTLE, MusicCategory.BGM_ACTION] },
  MM_IKANA_CASTLE:                      { type: 'bgm',     name: 'MM - Ikana Castle',                     mm: [0x6f], categories: [MusicCategory.BGM_DUNGEON] },
  MM_CLEAR_WOODFALL:                    { type: 'bgm',     name: 'MM - Woodfall Clear',                   mm: [0x78], categories: [MusicCategory.BGM_FIELD] },
  MM_CLEAR_SNOWHEAD:                    { type: 'bgm',     name: 'MM - Snowhead Clear',                   mm: [0x79], categories: [MusicCategory.BGM_FIELD] },
  FANFARE_SHARED_ITEM_MAJOR:            { type: 'fanfare', name: 'Shared - Fanfare Item Major',           oot: [0x22], mm: [0x22], categories: [] },
  FANFARE_SHARED_ITEM_HEART_PIECE:      { type: 'fanfare', name: 'Shared - Fanfare Item Heart Piece',     oot: [0x39], mm: [0x39], categories: [] },
  FANFARE_SHARED_ITEM_HEART_CONTAINER:  { type: 'fanfare', name: 'Shared - Fanfare Item Heart Container', oot: [0x24], mm: [0x24], categories: [] },
  FANFARE_SHARED_ITEM_MASK:             { type: 'fanfare', name: 'Shared - Fanfare Item Mask',            oot: [], mm: [0x37], categories: [] },
  FANFARE_SHARED_ITEM_STONE:            { type: 'fanfare', name: 'Shared - Fanfare Item Stone',           oot: [0x32], mm: [], categories: [] },
  FANFARE_SHARED_ITEM_MEDALLION:        { type: 'fanfare', name: 'Shared - Fanfare Item Medallion',       oot: [0x43], mm: [], categories: [] },
  FANFARE_SHARED_ITEM_OCARINA:          { type: 'fanfare', name: 'Shared - Fanfare Item Ocarina',         oot: [0x3d], mm: [0x52], categories: [] },
  FANFARE_OOT_GAME_OVER:                { type: 'fanfare', name: 'OoT - Fanfare Game Over',               oot: [0x20], categories: [] },
  FANFARE_OOT_BOSS_CLEAR:               { type: 'fanfare', name: 'OoT - Fanfare Boss Clear',              oot: [0x21], categories: [] },
};

const OOTRS_CATEGORIES: {[k: string]: MusicCategory[]} = {
  'Battle': [MusicCategory.BGM_BATTLE],
  'MinibossBattle': [MusicCategory.BGM_MINIBOSS],
  'BossBattle': [MusicCategory.BGM_BOSS],
  'Field': [MusicCategory.BGM_FIELD],
  'Dungeon': [MusicCategory.BGM_DUNGEON],
  'Town': [MusicCategory.BGM_TOWN],
  'Indoor': [MusicCategory.BGM_INDOOR],
  'Minigame': [MusicCategory.BGM_MINIGAME],
  'Calm': [MusicCategory.BGM_CALM],
  'TitleScreen': [MusicCategory.BGM_TITLE_SCREEN],
};

const MMRS_CATEGORIES: {[k: string]: MusicCategory[]} = {
  '0': [MusicCategory.BGM_FIELD],
  '1': [MusicCategory.BGM_TOWN],
  '2': [MusicCategory.BGM_DUNGEON],
  '3': [MusicCategory.BGM_INDOOR],
  '4': [MusicCategory.BGM_MINIGAME],
  '5': [MusicCategory.BGM_ACTION],
  '6': [MusicCategory.BGM_CALM],
  '7': [MusicCategory.BGM_BOSS],
  '16': [MusicCategory.BGM_TITLE_SCREEN, MusicCategory.BGM_CALM],
};

type MusicFile = {
  type: 'bgm' | 'fanfare';
  seq: Uint8Array;
  bankIdOot: number | null;
  bankIdMm: number | null;
  bankCustom: { meta: Uint8Array, data: Uint8Array } | null;
  filename: string;
  name: string;
  games: Game[];
  categories: Set<MusicCategory>;
};

const DIACRITICS_BASES = {
  'á': 'a',
  'à': 'a',
  'â': 'a',
  'ä': 'a',
  'Á': 'A',
  'À': 'A',
  'Â': 'A',
  'Ä': 'A',
  'é': 'e',
  'è': 'e',
  'ê': 'e',
  'ë': 'e',
  'É': 'E',
  'È': 'E',
  'Ê': 'E',
  'Ë': 'E',
  'í': 'i',
  'ì': 'i',
  'î': 'i',
  'ï': 'i',
  'Í': 'I',
  'Ì': 'I',
  'Î': 'I',
  'Ï': 'I',
  'ó': 'o',
  'ò': 'o',
  'ô': 'o',
  'ö': 'o',
  'Ó': 'O',
  'Ò': 'O',
  'Ô': 'O',
  'Ö': 'O',
  'ú': 'u',
  'ù': 'u',
  'û': 'u',
  'ü': 'u',
  'Ú': 'U',
  'Ù': 'U',
  'Û': 'U',
  'Ü': 'U',
  'ý': 'y',
  'ÿ': 'y',
  'Ý': 'Y',
  'Ÿ': 'Y',
  'ç': 'c',
  'Ç': 'C',
  'ñ': 'n',
  'Ñ': 'N',
  'æ': 'ae',
  'Æ': 'AE',
  'œ': 'oe',
  'Œ': 'OE',
};

function saneName(name: string) {
  /* Force NFC */
  name = name.normalize('NFC');

  /* Remove diacritics */
  for (const [base, repl] of Object.entries(DIACRITICS_BASES)) {
    name = name.replaceAll(base, repl);
  }

  /* Remove every other non-ascii */
  name = name.replace(/[^ -~]/g, '');

  return name;
}

function isMusicSuitable(entry: MusicEntry, file: MusicFile) {
  if (entry.type !== file.type) return false;
  if (entry.oot !== undefined && !file.games.includes('oot')) return false;
  if (entry.mm !== undefined && !file.games.includes('mm')) return false;

  return true;
}

function musicPriority(file: MusicFile, categories: MusicCategory[]) {
  let priority = 0;
  for (const c of categories) {
    if (file.categories.has(c)) {
      return priority;
    }
    priority++;
  }

  return priority;
}

function mmrSampleBank(sb: number) {
  if (sb === 0xff) {
    return 0xff;
  }
  return sb + 8;
}

class MusicInjector {
  private musics: MusicFile[];
  private namesBuffer: Uint8Array;
  private bankId: number;

  constructor(
    private cosmetics: Cosmetics,
    private writer: LogWriter,
    private monitor: Monitor,
    private builder: RomBuilder,
    private random: Random,
    private musicZipData: Uint8Array,
  ) {
    this.musics = [];
    this.namesBuffer = new Uint8Array(256 * 2 * 48);
    this.bankId = 0x60;
  }

  private isMaxBank() {
    return this.bankId >= 0xf0;
  }

  private addCustomBank(meta: Uint8Array, data: Uint8Array) {
    const bankId = this.bankId++;
    const dataVrom = this.appendAudio(data);
    const dataSize = data.length;
    const prefix = toU32Buffer([dataVrom, dataSize]);
    const fullmeta = concatUint8Arrays([prefix, meta]);
    const customFile = this.builder.fileByNameRequired('custom/bank_table');
    const offset = (bankId - 0x60) * 0x10;
    customFile.data.set(fullmeta, offset);
    return bankId;
  }

  private registerName(seqId: number, name: string) {
    /* Cut name to 48 characters */
    name = name.slice(0, 48);

    /* Write to buffer */
    const offset = seqId * 48;
    const nameEncoded = new TextEncoder().encode(name);
    this.namesBuffer.set(nameEncoded, offset);
  }

  private async loadMusicsOotrs(files: JSZip.JSZipObject[]) {
    for (const f of files) {
      /* Get the music zip */
      const musicZipBuffer = await f.async('uint8array');
      let musicZip: JSZip;
      try {
        musicZip = await JSZip.loadAsync(musicZipBuffer);
      } catch (e) {
        this.monitor.warn(`Skipped music file ${f.name}: invalid zip file`);
        continue;
      }

      /* Look for custom bank data */
      const filesBank = musicZip.file(/\.z?bank$/);
      if (filesBank.length > 1) {
        this.monitor.warn(`Skipped music file ${f.name}: multiple bank files`);
        continue;
      }
      const filesBankmeta = musicZip.file(/\.z?bankmeta$/);
      if (filesBankmeta.length > 1) {
        this.monitor.warn(`Skipped music file ${f.name}: multiple bankmeta files`);
        continue;
      }

      if (filesBank.length !== filesBankmeta.length) {
        this.monitor.warn(`Skipped music file ${f.name}: bank and bankmeta mismatch`);
        continue;
      }

      const badFiles = musicZip.file(/\.z?sound$/);
      if (badFiles.length > 0) {
        this.monitor.warn(`Skipped music file ${f.name}: unsupported files found`);
        continue;
      }

      /* Find the meta file */
      const metaFile = musicZip.file(/\.meta$/);
      if (metaFile.length !== 1) {
        this.monitor.warn(`Skipped music file ${f.name}: multiple metadata files`);
        continue;
      }

      /* Find the seq file */
      const seqFiles = musicZip.file(/\.seq$/);
      if (seqFiles.length !== 1) {
        this.monitor.warn(`Skipped music file ${f.name}: multiple sequence files`);
        continue;
      }

      /* Parse the metadata */
      const metaRaw = await metaFile[0].async('text');
      const meta = metaRaw.split(/\r?\n/);
      if (meta.length < 3) {
        this.monitor.warn(`Skipped music file ${f.name}: metadata must have at least 3 lines`);
        continue;
      }
      const filename = f.name.split('/').pop()!;
      const name = saneName(meta[0]);
      let type = meta[2].toLowerCase();
      const games: Game[] = ['oot'];
      if (type === 'f') {
        type = 'fanfare';
      }
      if (type !== 'bgm' && type !== 'fanfare') {
        this.monitor.warn(`Skipped music file ${f.name}: unknown type ${type}`);
        continue;
      }

      const categoriesLine = meta[3] || '';
      const categories = categoriesLine.split(',').map(x => x.trim()).filter(x => x.length > 0);
      let categoriesSet = new Set<MusicCategory>();
      for (const c of categories) {
        const mapped = OOTRS_CATEGORIES[c];
        if (mapped) {
          for (const mc of mapped) {
            categoriesSet.add(mc);
          }
        }
      }

      let bankCustom: { meta: Uint8Array, data: Uint8Array } | null = null;
      let bankIdOot: number | null = null;
      let bankIdMm: number | null = null;

      if (filesBank.length) {
        const bank = await filesBank[0].async('uint8array');
        const bankmeta = await filesBankmeta[0].async('uint8array');
        if (bankmeta.length !== 0x08) {
          this.monitor.warn(`Skipped music file ${f.name}: invalid bankmeta length`);
          continue;
        }

        /* Fix songs not using the correct sequence player for their type */
        /* array = [ Sample Medium, Sequence Player, Audio Table, Font ID, Number of Instruments, Number of Drums, Number of Sound Effects MSB, Number of Sound Effects LSB ]
        /* OOT: 0x02 is BGM & Ambience, 0x01 is Fanfares; MM: 0x02 is BGM, 0x01 is Fanfares */
        if (type === 'bgm' && bankmeta[1] !== 0x02) {
          bankmeta[1] = 0x02;
        }
        else if (type === 'fanfare' && bankmeta[1] !== 0x01) {
          bankmeta[1] = 0x01;
        }

        bankCustom = { meta: bankmeta, data: bank };
        games.push('mm');
      } else {
        bankIdOot = parseInt(meta[1], 16);
        if (bankIdOot >= 2) {
          bankIdMm = bankIdOot + 0x30;
          games.push('mm');
        }
      }

      /* Add the music */
      let seq = await seqFiles[0].async('uint8array');
      if (seq.length & 0xf) {
        const pad = new Uint8Array(16 - (seq.length & 0xf));
        pad.fill(0x00);
        seq = concatUint8Arrays([seq, pad]);
      }
      const music: MusicFile = { type, seq, bankIdOot, bankIdMm, bankCustom, filename, name, games, categories: categoriesSet };
      this.musics.push(music);
    }
  }

  private async loadMusicsMmrs(files: JSZip.JSZipObject[]) {
    for (const f of files) {
      /* Get the music zip */
      const musicZipBuffer = await f.async('uint8array');
      let musicZip: JSZip;
      try {
        musicZip = await JSZip.loadAsync(musicZipBuffer);
      } catch (e) {
        this.monitor.warn(`Skipped music file ${f.name}: invalid zip file`);
        continue;
      }

      /* Look for custom bank data */
      const filesBank = musicZip.file(/\.z?bank$/);
      if (filesBank.length > 1) {
        this.monitor.warn(`Skipped music file ${f.name}: multiple bank files`);
        continue;
      }
      const filesBankmeta = musicZip.file(/\.z?bankmeta$/);
      if (filesBankmeta.length > 1) {
        this.monitor.warn(`Skipped music file ${f.name}: multiple bankmeta files`);
        continue;
      }

      if (filesBank.length !== filesBankmeta.length) {
        this.monitor.warn(`Skipped music file ${f.name}: bank and bankmeta mismatch`);
        continue;
      }

      const badFiles = musicZip.file(/\.z?sound$/);
      if (badFiles.length > 0) {
        this.monitor.warn(`Skipped music file ${f.name}: unsupported files found`);
        continue;
      }

      /* Find the zseq file */
      const zseqFiles = musicZip.file(/\.(z|a)?seq$/);
      if (zseqFiles.length !== 1) {
        this.monitor.warn(`Skipped music file ${f.name}: multiple sequence files`);
        continue;
      }

      /* Get the categories.txt file */
      const categoriesTxt = musicZip.file('categories.txt');
      if (!categoriesTxt) {
        this.monitor.warn(`Skipped music file ${f.name}: categories.txt not found`);
        continue;
      }
      const categoriesData = await categoriesTxt.async('text');
      const categories = categoriesData.split(/[,-]/).map(x => x.trim());

      /* Extract the bank ID from the zseq filename */
      let zseqFilename = zseqFiles[0].name;
      if (zseqFilename.includes('/')) {
        zseqFilename = zseqFilename.split('/').pop()!;
      }
      const bankIdRaw = zseqFilename.split('.')[0];

      /* Add the music */
      let seq = await zseqFiles[0].async('uint8array');
      if (seq.length & 0xf) {
        const pad = new Uint8Array(16 - (seq.length & 0xf));
        pad.fill(0x00);
        seq = concatUint8Arrays([seq, pad]);
      }

      const games: Game[] = ['mm'];
      let type: MusicType;
      if (['8', '9', '10'].some(x => categories.includes(x))) {
        type = 'fanfare';
      } else {
        type = 'bgm';
      }

      let categoriesSet = new Set<MusicCategory>();
      for (const c of categories) {
        const mapped = MMRS_CATEGORIES[c];
        if (mapped) {
          for (const mc of mapped) {
            categoriesSet.add(mc);
          }
        }
      }

      const filename = f.name.split('/').pop()!;
      const name = saneName(filename.replace('.mmrs', ''));

      let bankCustom: { meta: Uint8Array, data: Uint8Array } | null = null;
      let bankIdOot: number | null = null;
      let bankIdMm: number | null = null;

      if (filesBank.length) {
        const bank = await filesBank[0].async('uint8array');
        const bankmeta = await filesBankmeta[0].async('uint8array');
        if (bankmeta.length !== 0x08) {
          this.monitor.warn(`Skipped music file ${f.name}: invalid bankmeta length`);
          continue;
        }

        /* Fix songs not using the correct sequence player for their type */
        /* array = [ Sample Medium, Sequence Player, Audio Table, Font ID, Number of Instruments, Number of Drums, Number of Sound Effects MSB, Number of Sound Effects LSB ]
        /* OOT: 0x02 is BGM & Ambience, 0x01 is Fanfares; MM: 0x02 is BGM, 0x01 is Fanfares */
        if (type === 'bgm' && bankmeta[1] !== 0x02) {
          bankmeta[1] = 0x02;
        }
        else if (type === 'fanfare' && bankmeta[1] !== 0x01) {
          bankmeta[1] = 0x01;
        }

        const sampleBank1 = mmrSampleBank(bankmeta[0x02]);
        const sampleBank2 = mmrSampleBank(bankmeta[0x03]);
        const sampleBanks = new Uint8Array([sampleBank1, sampleBank2]);
        bankmeta.set(sampleBanks, 0x02);
        bankCustom = { meta: bankmeta, data: bank };
        games.push('oot');
      } else {
        bankIdMm = parseInt(bankIdRaw, 16);
        if (bankIdMm >= 2) {
          bankIdOot = bankIdMm + 0x30;
          games.push('oot');
        }
      }

      const music: MusicFile = { type, seq, bankIdOot, bankIdMm, bankCustom, filename, name, games, categories: categoriesSet };
      this.musics.push(music);
    }
  }

  private async loadMusics(data: Uint8Array) {
    const zip = await JSZip.loadAsync(data);
    await this.loadMusicsOotrs(zip.file(/\.ootrs$/));
    await this.loadMusicsMmrs(zip.file(/\.mmrs$/));
  }

  private appendAudio(seq: Uint8Array) {
    const vrom = this.builder.addFile({ game: 'custom', type: 'uncompressed', data: seq })!;
    return vrom;
  }

  private async injectMusicMeta(game: Game, slot: number, vrom: number, seqLength: number, bankId: number, name: string) {
    const fileSeqTable = this.builder.fileByNameRequired(`${game}/seq_table`);
    const fileSeqBanks = this.builder.fileByNameRequired(`${game}/seq_banks`);

    /* Patch the bank ID */
    fileSeqBanks.data[slot] = bankId;

    /* Add the pointer */
    const seqTableData = toU32Buffer([vrom, seqLength]);
    fileSeqTable.data.set(seqTableData, slot * 0x10);

    /* Register the name */
    this.registerName(game === 'mm' ? slot + 256 : slot, name);
  }

  private async injectMusic(slot: string, music: MusicFile) {
    const entry = MUSIC[slot];
    const vrom = this.appendAudio(music.seq);
    let customBankId: number | null = null;

    if (music.bankCustom) {
      /* Kaepora Gaebora's theme is one of a few special cases where BGM use the fanfare sequence player */
      if (slot === "OOT_KAEPORA_GAEBORA") {
        music.bankCustom.meta[1] = 0x01
      }
      customBankId = this.addCustomBank(music.bankCustom.meta, music.bankCustom.data);
    }

    for (const id of entry.oot || []) {
      await this.injectMusicMeta('oot', id, vrom, music.seq.length, customBankId || music.bankIdOot!, music.name);
    }

    for (const id of entry.mm || []) {
      await this.injectMusicMeta('mm', id, vrom, music.seq.length, customBankId || music.bankIdMm!, music.name);
    }
  }

  private patchOot() {
    /* Disable battle music */
    const filePlayerActor = this.builder.fileByNameRequired('oot/ovl_player_actor');
    filePlayerActor.data[0x1690f] = 0;
  }

  private patchMm() {
    /* Disable battle music */
    const filePlayerActor = this.builder.fileByNameRequired('mm/ovl_player_actor');
    filePlayerActor.data[0x16818] = 0x10;
    filePlayerActor.data[0x16819] = 0x00;
  }

  private async shuffleMusics() {
    const slots = shuffle(this.random, Object.keys(MUSIC));
    const musics = new Set(this.musics);
    let musics_name = new Array();

    this.writer.indent('Music');
    for (;;) {
      if (musics.size === 0 || slots.length === 0) {
        break;
      }

      const slot = slots.pop()!;
      let candidates = Array.from(musics).filter(x => isMusicSuitable(MUSIC[slot], x));
      if (this.isMaxBank()) {
        candidates = candidates.filter(x => x.bankCustom === null);
      }

      if (candidates.length === 0) {
        continue;
      }

      if (this.cosmetics.musicCategories) {
        const minPriority = Math.min(...candidates.map(x => musicPriority(x, MUSIC[slot].categories)));
        candidates = candidates.filter(x => musicPriority(x, MUSIC[slot].categories) === minPriority);
      }

      const music = sample(this.random, candidates);
      musics.delete(music);
      await this.injectMusic(slot, music);
      const entry = MUSIC[slot];
      musics_name.push(`${entry.name}: ${music.name} (${music.filename})`);
    }
    for(let entry of musics_name.sort()) {
      this.writer.write(entry);
    }
    this.writer.unindent();
  }

  async run() {
    /* Extract the list of musics */
    await this.loadMusics(this.musicZipData);

    /* Shuffle musics */
    await this.shuffleMusics();

    /* Run misc. patches */
    this.patchOot();
    this.patchMm();

    /* Inject the music names */
    this.builder.addFile({ game: 'custom', type: 'uncompressed', vaddr: 0xf1000000, data: this.namesBuffer });
  }
}

export async function randomizeMusic(cosmetics: Cosmetics, writer: LogWriter, monitor: Monitor, builder: RomBuilder, random: Random, data: Uint8Array) {
  const injector = new MusicInjector(cosmetics, writer, monitor, builder, random, data);
  await injector.run();
}

/* index.ts */
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

const MM_ADULT_BASE_OBJECT_BUDGET = 0x00040000;
const MM_OBJECT_BANK_EXPANSION = 0x00020000;
const MM_OBJECT_BANK_SAFETY = 0x00008000;
const MM_COSMETIC_SHARED_EXPANSION = MM_OBJECT_BANK_EXPANSION - MM_OBJECT_BANK_SAFETY;

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

  private addNewFile(data: Uint8Array, compressed = true, name?: string) {
    const size = align16(data.length);
    const vrom = this.builder.addFile({name, data, type: compressed ? 'compressed' : 'uncompressed', game: 'custom'})!;
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
        const object = this.addNewFile(patched, true, 'custom/cosmetic_oot_link_child');
        code.data.set(toU32Buffer(object), 0xe7f58 + 8 * 0x15);
        this.builder.removeFile('oot/objects/object_link_child');
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
      const object = this.addNewFile(model.data, true, 'custom/cosmetic_oot_link_child');
      code.data.set(toU32Buffer(object), 0xe7f58 + 8 * 0x15);
      this.builder.removeFile('oot/objects/object_link_child');
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
      const object = this.addNewFile(model.data, true, 'custom/cosmetic_oot_link_adult');
      code.data.set(toU32Buffer(object), 0xe7f58 + 8 * 0x14);
      this.builder.removeFile('oot/objects/object_link_boy');
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

    /* Keep the existing custom VROM allocation when the replacement fits.
     * If it must move, retire the old file so both copies are not packed into
     * the final 64 MiB ROM. */
    if (data.length <= original.data.length) {
      original.data = data;
      bufWriteU32BE(objectTable.data, tableOffset + 4, oldStart + data.length);
      return;
    }

    const [start] = this.addNewFile(data, true, `${name}_runtime`);
    bufWriteU32BE(objectTable.data, tableOffset, start);
    bufWriteU32BE(objectTable.data, tableOffset + 4, start + data.length);
    this.builder.removeFile(name);
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

  private async patchMmChildModel(
      modelInput: ResolvedPlayerModel | null,
      equipment: Map<string, EquipmentResolvedOverride>,
      persistentFootprintGrowth = 0,
  ) {
    const original = this.builder.fileByNameRequired('mm/objects/object_link_child');
    const code = this.builder.fileByNameRequired('mm/code');

    if (persistentFootprintGrowth > MM_COSMETIC_SHARED_EXPANSION) {
      throw new Error(
        `MM gameplay_keep equipment growth alone exceeds the cosmetic expansion budget: ` +
        `0x${persistentFootprintGrowth.toString(16)} > 0x${MM_COSMETIC_SHARED_EXPANSION.toString(16)}`
      );
    }

    const stockChildFootprint = align16(original.data.length);
    const childExpansion = MM_COSMETIC_SHARED_EXPANSION - persistentFootprintGrowth;
    const childObjectBudget = stockChildFootprint + childExpansion;

    if (!modelInput) {
      const patched = applyEquipmentOverridesToMmModel(original.data, equipment.values());
      const patchedFootprint = align16(patched.length);
      if (patchedFootprint > childObjectBudget) {
        throw new Error(
          `MM child Link/equipment exceeds the object-space growth budget: ` +
          `0x${patchedFootprint.toString(16)} > 0x${childObjectBudget.toString(16)}`
        );
      }
      if (patched.length <= original.data.length) {
        original.data = patched;
      } else {
        const object = this.addNewFile(patched, true, 'custom/cosmetic_mm_link_child');
        code.data.set(toU32Buffer(object), 0x11cc80 + 8 * 0x11);
        this.builder.removeFile('mm/objects/object_link_child');
      }
      return;
    }

    const childTables = this.builder.fileByNameRequired('custom/mm_age_model_child_tables');
    const crossGame = modelInput.sourceGame !== null && modelInput.sourceGame !== 'mm';
    let model = prepareMmModel(modelInput.data, original.data, code.data, 'child', crossGame);
    const equipmentResult = applyEquipmentOverridesToPreparedMmModel(model.data, equipment.values());
    model = { ...model, data: equipmentResult.data };
    const before = model.data.length;
    model = compactMmPlayerModel(model, original.data, 'child', childObjectBudget, equipmentResult.preservedPieces);
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
      const object = this.addNewFile(model.data, true, 'custom/cosmetic_mm_link_child');
      code.data.set(toU32Buffer(object), 0x11cc80 + 8 * 0x11);
      this.builder.removeFile('mm/objects/object_link_child');
    }
  }

  private async patchMmAdultModel(modelInput: ResolvedPlayerModel | null, equipment: Map<string, EquipmentResolvedOverride>, persistentFootprintGrowth = 0) {
    const vanilla = this.builder.fileByNameRequired('mm/objects/object_link_child');
    const adultTemplate = this.builder.fileByNameRequired('custom/mm_adult_link');
    const code = this.builder.fileByNameRequired('mm/code');
    const adultTables = this.builder.fileByNameRequired('custom/mm_age_model_tables');

    if (persistentFootprintGrowth > MM_COSMETIC_SHARED_EXPANSION) {
      throw new Error(
        `MM gameplay_keep equipment growth alone exceeds the V8.3 cosmetic expansion budget: ` +
        `0x${persistentFootprintGrowth.toString(16)} > 0x${MM_COSMETIC_SHARED_EXPANSION.toString(16)}`
      );
    }

    const adultExpansion = MM_COSMETIC_SHARED_EXPANSION - persistentFootprintGrowth;
    const stockAdultFootprint = align16(adultTemplate.data.length);
    /* 0x40000 is the established runtime Adult Link envelope, not the stock
     * mm_adult_link file size.  Basing the cap on the stock file made the
     * quality-preserving compactor reject models that already fit the normal
     * adult allocation.  Only cosmetic growth beyond that base shares the
     * extra object-bank allowance with gameplay_keep. */
    const adultObjectBudget = MM_ADULT_BASE_OBJECT_BUDGET + adultExpansion;
    this.monitor.log(
      `MM adult cosmetic budget: stock reference 0x${stockAdultFootprint.toString(16)}, ` +
      `runtime base 0x${MM_ADULT_BASE_OBJECT_BUDGET.toString(16)}, ` +
      `gameplay_keep growth 0x${persistentFootprintGrowth.toString(16)}, ` +
      `Adult Link cap 0x${adultObjectBudget.toString(16)} ` +
      `(runtime base + shared extra 0x${adultExpansion.toString(16)}).`
    );

    if (!modelInput) {
      const hasPlayerEquipment = [...equipment.keys()].some((id) => id.startsWith('mm:') && id !== 'mm:sword:kokiri' && id !== 'mm:sword:razor');
      if (!hasPlayerEquipment) return;
      let model = prepareMmModel(adultTemplate.data, vanilla.data, code.data, 'adult', false, adultTemplate.data);
      const equipmentResult = applyEquipmentOverridesToPreparedMmModel(model.data, equipment.values());
      model = { ...model, data: equipmentResult.data };
      const before = model.data.length;
      model = compactMmPlayerModel(model, vanilla.data, 'adult', adultObjectBudget, equipmentResult.preservedPieces);
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
    model = compactMmPlayerModel(model, vanilla.data, 'adult', adultObjectBudget, equipmentResult.preservedPieces);
    if (model.compaction) {
      this.logCompaction('MM', 'adult', before, model.compaction.usedSize, model.compaction.replacedPieces);
      if (equipmentResult.preservedPieces.length > 0) {
        this.monitor.log(`MM adult custom equipment kept in final compacted Link object: ${equipmentResult.preservedPieces.join(', ')}.`);
      }
    }

    patchMmAdultModelTables(adultTables.data);
    this.replaceCustomObject('custom/mm_adult_link', model.data);
  }

  private patchMmGameplayKeepEquipment(equipment: Map<string, EquipmentResolvedOverride>): number {
    const keep = this.builder.fileByNameRequired('mm/objects/gameplay_keep');
    const patched = applyEquipmentOverridesToMmGameplayKeep(keep.data, equipment.values());
    if (patched === keep.data) return 0;

    const originalFootprint = (keep.data.length + 0x0f) & ~0x0f;
    const patchedFootprint = (patched.length + 0x0f) & ~0x0f;
    const growth = Math.max(0, patchedFootprint - originalFootprint);

    const code = this.builder.fileByNameRequired('mm/code');
    const object = this.addNewFile(patched, true, 'custom/cosmetic_mm_gameplay_keep');
    code.data.set(toU32Buffer(object), 0x11cc80 + 8 * 0x01);
    this.builder.removeFile('mm/objects/gameplay_keep');

    this.monitor.log(
      `MM gameplay_keep equipment footprint: 0x${originalFootprint.toString(16)} -> ` +
      `0x${patchedFootprint.toString(16)} (growth 0x${growth.toString(16)}).`
    );
    return growth;
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
    const mmGameplayKeepGrowth = this.patchMmGameplayKeepEquipment(equipment);
    await this.patchMmAdultModel(mmModels.adult, equipment, mmGameplayKeepGrowth);
    await this.patchMmChildModel(mmModels.child, equipment, mmGameplayKeepGrowth);

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
