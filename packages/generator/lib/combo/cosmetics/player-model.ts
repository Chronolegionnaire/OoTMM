import { RomBuilder } from '../rom-builder';
import { bufReadU16BE, bufReadU32BE, bufWriteU16BE, bufWriteU32BE } from '../util/buffer';

/* model.ts */
export const OOT_LINK_CHILD_OFFSETS = {
  LUT_DL_SHIELD_DEKU: 0x060050D0,
  LUT_DL_WAIST: 0x060050D8,
  LUT_DL_RTHIGH: 0x060050E0,
  LUT_DL_RSHIN: 0x060050E8,
  LUT_DL_RFOOT: 0x060050F0,
  LUT_DL_LTHIGH: 0x060050F8,
  LUT_DL_LSHIN: 0x06005100,
  LUT_DL_LFOOT: 0x06005108,
  LUT_DL_HEAD: 0x06005110,
  LUT_DL_HAT: 0x06005118,
  LUT_DL_COLLAR: 0x06005120,
  LUT_DL_LSHOULDER: 0x06005128,
  LUT_DL_LFOREARM: 0x06005130,
  LUT_DL_RSHOULDER: 0x06005138,
  LUT_DL_RFOREARM: 0x06005140,
  LUT_DL_TORSO: 0x06005148,
  LUT_DL_LHAND: 0x06005150,
  LUT_DL_LFIST: 0x06005158,
  LUT_DL_LHAND_BOTTLE: 0x06005160,
  LUT_DL_RHAND: 0x06005168,
  LUT_DL_RFIST: 0x06005170,
  LUT_DL_SWORD_SHEATH: 0x06005178,
  LUT_DL_SWORD_HILT: 0x06005180,
  LUT_DL_SWORD_BLADE: 0x06005188,
  LUT_DL_SLINGSHOT: 0x06005190,
  LUT_DL_OCARINA_FAIRY: 0x06005198,
  LUT_DL_OCARINA_TIME: 0x060051A0,
  LUT_DL_DEKU_STICK: 0x060051A8,
  LUT_DL_BOOMERANG: 0x060051B0,
  LUT_DL_SHIELD_HYLIAN_BACK: 0x060051B8,
  LUT_DL_BOTTLE: 0x060051C0,
  LUT_DL_MASTER_SWORD: 0x060051C8,
  LUT_DL_GORON_BRACELET: 0x060051D0,
  LUT_DL_FPS_RIGHT_ARM: 0x060051D8,
  LUT_DL_SLINGSHOT_STRING: 0x060051E0,
  LUT_DL_MASK_BUNNY: 0x060051E8,
  LUT_DL_MASK_GERUDO: 0x060051F0,
  LUT_DL_MASK_GORON: 0x060051F8,
  LUT_DL_MASK_KEATON: 0x06005200,
  LUT_DL_MASK_SPOOKY: 0x06005208,
  LUT_DL_MASK_TRUTH: 0x06005210,
  LUT_DL_MASK_ZORA: 0x06005218,
  LUT_DL_MASK_SKULL: 0x06005220,
  DL_SWORD_SHEATHED: 0x06005228,
  LUT_DL_SWORD_SHEATHED: 0x06005248,
  DL_SHIELD_DEKU_ODD: 0x06005250,
  LUT_DL_SHIELD_DEKU_ODD: 0x06005260,
  DL_SHIELD_DEKU_BACK: 0x06005268,
  LUT_DL_SHIELD_DEKU_BACK: 0x06005278,
  DL_SWORD_SHIELD_HYLIAN: 0x06005280,
  LUT_DL_SWORD_SHIELD_HYLIAN: 0x06005290,
  DL_SWORD_SHIELD_DEKU: 0x06005298,
  LUT_DL_SWORD_SHIELD_DEKU: 0x060052A8,
  DL_SHEATH0_HYLIAN: 0x060052B0,
  LUT_DL_SHEATH0_HYLIAN: 0x060052C0,
  DL_SHEATH0_DEKU: 0x060052C8,
  LUT_DL_SHEATH0_DEKU: 0x060052D8,
  DL_LFIST_SWORD: 0x060052E0,
  LUT_DL_LFIST_SWORD: 0x060052F8,
  DL_LHAND_PEDESTALSWORD: 0x06005300,
  LUT_DL_LHAND_PEDESTALSWORD: 0x06005310,
  DL_LFIST_BOOMERANG: 0x06005318,
  LUT_DL_LFIST_BOOMERANG: 0x06005328,
  DL_RFIST_SHIELD_DEKU: 0x06005330,
  LUT_DL_RFIST_SHIELD_DEKU: 0x06005340,
  DL_RFIST_SLINGSHOT: 0x06005348,
  LUT_DL_RFIST_SLINGSHOT: 0x06005358,
  DL_RHAND_OCARINA_FAIRY: 0x06005360,
  LUT_DL_RHAND_OCARINA_FAIRY: 0x06005370,
  DL_RHAND_OCARINA_TIME: 0x06005378,
  LUT_DL_RHAND_OCARINA_TIME: 0x06005388,
  DL_FPS_RARM_SLINGSHOT: 0x06005390,
  LUT_DL_FPS_RARM_SLINGSHOT: 0x060053A0,
  HIERARCHY: 0x060053A8,
};

export const OOT_LINK_ADULT_OFFSETS = {
  LUT_DL_WAIST: 0x06005090,
  LUT_DL_RTHIGH: 0x06005098,
  LUT_DL_RSHIN: 0x060050A0,
  LUT_DL_RFOOT: 0x060050A8,
  LUT_DL_LTHIGH: 0x060050B0,
  LUT_DL_LSHIN: 0x060050B8,
  LUT_DL_LFOOT: 0x060050C0,
  LUT_DL_HEAD: 0x060050C8,
  LUT_DL_HAT: 0x060050D0,
  LUT_DL_COLLAR: 0x060050D8,
  LUT_DL_LSHOULDER: 0x060050E0,
  LUT_DL_LFOREARM: 0x060050E8,
  LUT_DL_RSHOULDER: 0x060050F0,
  LUT_DL_RFOREARM: 0x060050F8,
  LUT_DL_TORSO: 0x06005100,
  LUT_DL_LHAND: 0x06005108,
  LUT_DL_LFIST: 0x06005110,
  LUT_DL_LHAND_BOTTLE: 0x06005118,
  LUT_DL_RHAND: 0x06005120,
  LUT_DL_RFIST: 0x06005128,
  LUT_DL_SWORD_SHEATH: 0x06005130,
  LUT_DL_SWORD_HILT: 0x06005138,
  LUT_DL_SWORD_BLADE: 0x06005140,
  LUT_DL_LONGSWORD_HILT: 0x06005148,
  LUT_DL_LONGSWORD_BLADE: 0x06005150,
  LUT_DL_LONGSWORD_BROKEN: 0x06005158,
  LUT_DL_SHIELD_HYLIAN: 0x06005160,
  LUT_DL_SHIELD_MIRROR: 0x06005168,
  LUT_DL_HAMMER: 0x06005170,
  LUT_DL_BOTTLE: 0x06005178,
  LUT_DL_BOW: 0x06005180,
  LUT_DL_OCARINA_TIME: 0x06005188,
  LUT_DL_HOOKSHOT: 0x06005190,
  LUT_DL_UPGRADE_LFOREARM: 0x06005198,
  LUT_DL_UPGRADE_LHAND: 0x060051A0,
  LUT_DL_UPGRADE_LFIST: 0x060051A8,
  LUT_DL_UPGRADE_RFOREARM: 0x060051B0,
  LUT_DL_UPGRADE_RHAND: 0x060051B8,
  LUT_DL_UPGRADE_RFIST: 0x060051C0,
  LUT_DL_BOOT_LIRON: 0x060051C8,
  LUT_DL_BOOT_RIRON: 0x060051D0,
  LUT_DL_BOOT_LHOVER: 0x060051D8,
  LUT_DL_BOOT_RHOVER: 0x060051E0,
  LUT_DL_FPS_LFOREARM: 0x060051E8,
  LUT_DL_FPS_LHAND: 0x060051F0,
  LUT_DL_FPS_RFOREARM: 0x060051F8,
  LUT_DL_FPS_RHAND: 0x06005200,
  LUT_DL_FPS_HOOKSHOT: 0x06005208,
  LUT_DL_HOOKSHOT_CHAIN: 0x06005210,
  LUT_DL_HOOKSHOT_HOOK: 0x06005218,
  LUT_DL_HOOKSHOT_AIM: 0x06005220,
  LUT_DL_BOW_STRING: 0x06005228,
  LUT_DL_BLADEBREAK: 0x06005230,
  LUT_DL_SWORD_SHEATHED: 0x06005238,
  LUT_DL_SHIELD_HYLIAN_BACK: 0x06005258,
  LUT_DL_SHIELD_MIRROR_BACK: 0x06005268,
  LUT_DL_SWORD_SHIELD_HYLIAN: 0x06005278,
  LUT_DL_SWORD_SHIELD_MIRROR: 0x06005288,
  LUT_DL_SHEATH0_HYLIAN: 0x06005298,
  LUT_DL_SHEATH0_MIRROR: 0x060052A8,
  LUT_DL_LFIST_SWORD: 0x060052B8,
  LUT_DL_LFIST_LONGSWORD: 0x060052D0,
  LUT_DL_LFIST_LONGSWORD_BROKEN: 0x060052E8,
  LUT_DL_LFIST_HAMMER: 0x06005300,
  LUT_DL_RFIST_SHIELD_HYLIAN: 0x06005310,
  LUT_DL_RFIST_SHIELD_MIRROR: 0x06005320,
  LUT_DL_RFIST_BOW: 0x06005330,
  LUT_DL_RFIST_HOOKSHOT: 0x06005340,
  LUT_DL_RHAND_OCARINA_TIME: 0x06005350,
  LUT_DL_FPS_RHAND_BOW: 0x06005360,
  LUT_DL_FPS_LHAND_HOOKSHOT: 0x06005370,
  HIERARCHY: 0x06005380,
};

function patchPtrHi(file: Uint8Array, offset: number, value: number) {
  bufWriteU16BE(file, offset, value >>> 16);
}

function patchPtrLo(file: Uint8Array, offset: number, value: number) {
  bufWriteU16BE(file, offset, value & 0xffff);
}

function patchPtr16(file: Uint8Array, offset: number, value: number) {
  bufWriteU16BE(file, offset, value);
}

function patchPtr(file: Uint8Array, offset: number, value: number) {
  bufWriteU32BE(file, offset, value);
}

export function enableModelOotLinkChild(builder: RomBuilder, dfAddr: number) {
  dfAddr |= 0x06000000;
  let base: number;

  /* Patch code */
  const fileCode = builder.fileByNameRequired('oot/code');
  const fileEffStick = builder.fileByNameRequired('oot/actors/ovl_Effect_Ss_Stick');
  const fileItemShield = builder.fileByNameRequired('oot/actors/ovl_Item_Shield'); /* Isn't this unused? */
  const filePlayer = builder.fileByNameRequired('oot/ovl_player_actor');
  const fileEnCs = builder.fileByNameRequired('oot/actors/ovl_En_Cs');
  const fileEnHeishi2 = builder.fileByNameRequired('oot/actors/ovl_En_Heishi2');
  const fileEnMm = builder.fileByNameRequired('oot/actors/ovl_En_Mm');

  base = 0xe671c;
  patchPtr(fileCode.data, base + 0x0000, OOT_LINK_CHILD_OFFSETS.LUT_DL_RFIST);
  patchPtr(fileCode.data, base + 0x0008, OOT_LINK_CHILD_OFFSETS.LUT_DL_RFIST);
  patchPtr(fileCode.data, base + 0x0010, OOT_LINK_CHILD_OFFSETS.LUT_DL_RFIST);
  patchPtr(fileCode.data, base + 0x0018, OOT_LINK_CHILD_OFFSETS.LUT_DL_RFIST);
  patchPtr(fileCode.data, base + 0x0010, OOT_LINK_CHILD_OFFSETS.LUT_DL_RFIST_SHIELD_DEKU);
  patchPtr(fileCode.data, base + 0x0018, OOT_LINK_CHILD_OFFSETS.LUT_DL_RFIST_SHIELD_DEKU);
  patchPtr(fileCode.data, base + 0x0020, OOT_LINK_CHILD_OFFSETS.LUT_DL_RFIST);
  patchPtr(fileCode.data, base + 0x0028, OOT_LINK_CHILD_OFFSETS.LUT_DL_RFIST);
  patchPtr(fileCode.data, base + 0x0030, dfAddr);
  patchPtr(fileCode.data, base + 0x0038, dfAddr);
  patchPtr(fileCode.data, base + 0x0040, OOT_LINK_CHILD_OFFSETS.LUT_DL_SWORD_SHEATHED);
  patchPtr(fileCode.data, base + 0x0048, OOT_LINK_CHILD_OFFSETS.LUT_DL_SWORD_SHEATHED);
  patchPtr(fileCode.data, base + 0x0050, OOT_LINK_CHILD_OFFSETS.LUT_DL_SWORD_SHIELD_DEKU);
  patchPtr(fileCode.data, base + 0x0058, OOT_LINK_CHILD_OFFSETS.LUT_DL_SWORD_SHIELD_DEKU);
  patchPtr(fileCode.data, base + 0x0060, OOT_LINK_CHILD_OFFSETS.LUT_DL_SWORD_SHIELD_HYLIAN);
  patchPtr(fileCode.data, base + 0x0068, OOT_LINK_CHILD_OFFSETS.LUT_DL_SWORD_SHIELD_HYLIAN);
  patchPtr(fileCode.data, base + 0x0070, dfAddr);
  patchPtr(fileCode.data, base + 0x0078, dfAddr);
  patchPtr(fileCode.data, base + 0x0080, 0x00000000);
  patchPtr(fileCode.data, base + 0x0088, 0x00000000);
  patchPtr(fileCode.data, base + 0x0090, OOT_LINK_CHILD_OFFSETS.LUT_DL_SHIELD_DEKU_BACK);
  patchPtr(fileCode.data, base + 0x0098, OOT_LINK_CHILD_OFFSETS.LUT_DL_SHIELD_DEKU_BACK);
  patchPtr(fileCode.data, base + 0x00a0, OOT_LINK_CHILD_OFFSETS.LUT_DL_SWORD_SHEATH);
  patchPtr(fileCode.data, base + 0x00a8, OOT_LINK_CHILD_OFFSETS.LUT_DL_SWORD_SHEATH);
  patchPtr(fileCode.data, base + 0x00b0, OOT_LINK_CHILD_OFFSETS.LUT_DL_SHEATH0_DEKU);
  patchPtr(fileCode.data, base + 0x00b8, OOT_LINK_CHILD_OFFSETS.LUT_DL_SHEATH0_DEKU);
  patchPtr(fileCode.data, base + 0x00c0, OOT_LINK_CHILD_OFFSETS.LUT_DL_SHEATH0_HYLIAN);
  patchPtr(fileCode.data, base + 0x00c8, OOT_LINK_CHILD_OFFSETS.LUT_DL_SHEATH0_HYLIAN);
  patchPtr(fileCode.data, base + 0x00d0, dfAddr);
  patchPtr(fileCode.data, base + 0x00d8, dfAddr);
  patchPtr(fileCode.data, base + 0x00e0, 0x00000000);
  patchPtr(fileCode.data, base + 0x00e8, 0x00000000);
  patchPtr(fileCode.data, base + 0x00f0, OOT_LINK_CHILD_OFFSETS.LUT_DL_SHIELD_DEKU_BACK);
  patchPtr(fileCode.data, base + 0x00f8, OOT_LINK_CHILD_OFFSETS.LUT_DL_SHIELD_DEKU_BACK);
  patchPtr(fileCode.data, base + 0x0100, OOT_LINK_CHILD_OFFSETS.LUT_DL_LHAND_PEDESTALSWORD);
  patchPtr(fileCode.data, base + 0x0108, OOT_LINK_CHILD_OFFSETS.LUT_DL_LHAND_PEDESTALSWORD);
  patchPtr(fileCode.data, base + 0x0110, OOT_LINK_CHILD_OFFSETS.LUT_DL_LHAND_PEDESTALSWORD);
  patchPtr(fileCode.data, base + 0x0118, OOT_LINK_CHILD_OFFSETS.LUT_DL_LHAND_PEDESTALSWORD);
  patchPtr(fileCode.data, base + 0x0120, OOT_LINK_CHILD_OFFSETS.LUT_DL_LHAND);
  patchPtr(fileCode.data, base + 0x0128, OOT_LINK_CHILD_OFFSETS.LUT_DL_LHAND);
  patchPtr(fileCode.data, base + 0x0130, OOT_LINK_CHILD_OFFSETS.LUT_DL_LFIST);
  patchPtr(fileCode.data, base + 0x0138, OOT_LINK_CHILD_OFFSETS.LUT_DL_LFIST);
  patchPtr(fileCode.data, base + 0x0140, OOT_LINK_CHILD_OFFSETS.LUT_DL_LFIST_SWORD);
  patchPtr(fileCode.data, base + 0x0148, OOT_LINK_CHILD_OFFSETS.LUT_DL_LFIST_SWORD);
  patchPtr(fileCode.data, base + 0x0150, OOT_LINK_CHILD_OFFSETS.LUT_DL_LFIST_SWORD);
  patchPtr(fileCode.data, base + 0x0158, OOT_LINK_CHILD_OFFSETS.LUT_DL_LFIST_SWORD);
  patchPtr(fileCode.data, base + 0x0160, OOT_LINK_CHILD_OFFSETS.LUT_DL_RHAND);
  patchPtr(fileCode.data, base + 0x0168, OOT_LINK_CHILD_OFFSETS.LUT_DL_RHAND);
  patchPtr(fileCode.data, base + 0x0170, OOT_LINK_CHILD_OFFSETS.LUT_DL_RFIST);
  patchPtr(fileCode.data, base + 0x0178, OOT_LINK_CHILD_OFFSETS.LUT_DL_RFIST);
  patchPtr(fileCode.data, base + 0x0180, OOT_LINK_CHILD_OFFSETS.LUT_DL_RFIST_SLINGSHOT);
  patchPtr(fileCode.data, base + 0x0188, OOT_LINK_CHILD_OFFSETS.LUT_DL_RFIST_SLINGSHOT);
  patchPtr(fileCode.data, base + 0x0190, OOT_LINK_CHILD_OFFSETS.LUT_DL_SWORD_SHEATHED);
  patchPtr(fileCode.data, base + 0x0198, OOT_LINK_CHILD_OFFSETS.LUT_DL_SWORD_SHEATHED);
  patchPtr(fileCode.data, base + 0x01a0, OOT_LINK_CHILD_OFFSETS.LUT_DL_SWORD_SHEATH);
  patchPtr(fileCode.data, base + 0x01a8, OOT_LINK_CHILD_OFFSETS.LUT_DL_SWORD_SHEATH);
  patchPtr(fileCode.data, base + 0x01b0, OOT_LINK_CHILD_OFFSETS.LUT_DL_WAIST);
  patchPtr(fileCode.data, base + 0x01b8, OOT_LINK_CHILD_OFFSETS.LUT_DL_WAIST);
  patchPtr(fileCode.data, base + 0x01c0, OOT_LINK_CHILD_OFFSETS.LUT_DL_RFIST_SLINGSHOT);
  patchPtr(fileCode.data, base + 0x01c8, OOT_LINK_CHILD_OFFSETS.LUT_DL_RFIST_SLINGSHOT);
  patchPtr(fileCode.data, base + 0x01d0, OOT_LINK_CHILD_OFFSETS.LUT_DL_RHAND_OCARINA_FAIRY);
  patchPtr(fileCode.data, base + 0x01d8, OOT_LINK_CHILD_OFFSETS.LUT_DL_RHAND_OCARINA_FAIRY);
  patchPtr(fileCode.data, base + 0x01e0, OOT_LINK_CHILD_OFFSETS.LUT_DL_RHAND_OCARINA_TIME);
  patchPtr(fileCode.data, base + 0x01e8, OOT_LINK_CHILD_OFFSETS.LUT_DL_RHAND_OCARINA_TIME);
  patchPtr(fileCode.data, base + 0x01f0, OOT_LINK_CHILD_OFFSETS.LUT_DL_RFIST);
  patchPtr(fileCode.data, base + 0x01f8, OOT_LINK_CHILD_OFFSETS.LUT_DL_RFIST);
  patchPtr(fileCode.data, base + 0x0200, OOT_LINK_CHILD_OFFSETS.LUT_DL_LFIST);
  patchPtr(fileCode.data, base + 0x0208, OOT_LINK_CHILD_OFFSETS.LUT_DL_LFIST);
  patchPtr(fileCode.data, base + 0x0210, OOT_LINK_CHILD_OFFSETS.LUT_DL_LFIST_BOOMERANG);
  patchPtr(fileCode.data, base + 0x0218, OOT_LINK_CHILD_OFFSETS.LUT_DL_LFIST_BOOMERANG);
  patchPtr(fileCode.data, base + 0x0220, OOT_LINK_CHILD_OFFSETS.LUT_DL_LHAND_BOTTLE);
  patchPtr(fileCode.data, base + 0x0228, OOT_LINK_CHILD_OFFSETS.LUT_DL_LHAND_BOTTLE);
  patchPtr(fileCode.data, base + 0x0230, 0x00000000);
  patchPtr(fileCode.data, base + 0x0238, 0x00000000);
  patchPtr(fileCode.data, base + 0x0240, OOT_LINK_CHILD_OFFSETS.LUT_DL_RSHOULDER);
  patchPtr(fileCode.data, base + 0x0248, 0x00000000);
  patchPtr(fileCode.data, base + 0x0250, OOT_LINK_CHILD_OFFSETS.LUT_DL_FPS_RARM_SLINGSHOT);

  base = 0xe6b2c;
  patchPtr(fileCode.data, base + 0x0000, OOT_LINK_CHILD_OFFSETS.LUT_DL_BOTTLE);

  base = 0xe6b74;
  patchPtr(fileCode.data, base + 0x0000, OOT_LINK_CHILD_OFFSETS.LUT_DL_SLINGSHOT_STRING);
  patchPtr(fileCode.data, base + 0x0004, 0x44178000);
  patchPtr(fileCode.data, base + 0x0008, 0x436C0000);

  patchPtrHi(fileCode.data, 0x6922e, OOT_LINK_CHILD_OFFSETS.LUT_DL_GORON_BRACELET);
  patchPtrLo(fileCode.data, 0x69232, OOT_LINK_CHILD_OFFSETS.LUT_DL_GORON_BRACELET);
  patchPtrHi(fileCode.data, 0x6a80e, OOT_LINK_CHILD_OFFSETS.LUT_DL_DEKU_STICK);
  patchPtrLo(fileCode.data, 0x6a812, OOT_LINK_CHILD_OFFSETS.LUT_DL_DEKU_STICK);

  patchPtr(fileEffStick.data, 0x334, OOT_LINK_CHILD_OFFSETS.LUT_DL_DEKU_STICK);
  patchPtr16(fileEffStick.data, 0x330, 0x0015);

  patchPtrHi(fileItemShield.data, 0x7ee, OOT_LINK_CHILD_OFFSETS.LUT_DL_SHIELD_DEKU_ODD);
  patchPtrLo(fileItemShield.data, 0x7f2, OOT_LINK_CHILD_OFFSETS.LUT_DL_SHIELD_DEKU_ODD);

  base = 0x2253c;
  patchPtr(filePlayer.data, base + 0x0000, OOT_LINK_CHILD_OFFSETS.LUT_DL_MASK_KEATON);
  patchPtr(filePlayer.data, base + 0x0004, OOT_LINK_CHILD_OFFSETS.LUT_DL_MASK_SKULL);
  patchPtr(filePlayer.data, base + 0x0008, OOT_LINK_CHILD_OFFSETS.LUT_DL_MASK_SPOOKY);
  patchPtr(filePlayer.data, base + 0x000c, OOT_LINK_CHILD_OFFSETS.LUT_DL_MASK_BUNNY);
  patchPtr(filePlayer.data, base + 0x0010, OOT_LINK_CHILD_OFFSETS.LUT_DL_MASK_GORON);
  patchPtr(filePlayer.data, base + 0x0014, OOT_LINK_CHILD_OFFSETS.LUT_DL_MASK_ZORA);
  patchPtr(filePlayer.data, base + 0x0018, OOT_LINK_CHILD_OFFSETS.LUT_DL_MASK_GERUDO);
  patchPtr(filePlayer.data, base + 0x001c, OOT_LINK_CHILD_OFFSETS.LUT_DL_MASK_TRUTH);

  patchPtrHi(fileEnCs.data, 0xe62, OOT_LINK_CHILD_OFFSETS.LUT_DL_MASK_SPOOKY);
  patchPtrLo(fileEnCs.data, 0xe66, OOT_LINK_CHILD_OFFSETS.LUT_DL_MASK_SPOOKY);

  patchPtrHi(fileEnHeishi2.data, 0x1ea2, OOT_LINK_CHILD_OFFSETS.LUT_DL_MASK_KEATON);
  patchPtrLo(fileEnHeishi2.data, 0x1ea6, OOT_LINK_CHILD_OFFSETS.LUT_DL_MASK_KEATON);

  patchPtrHi(fileEnMm.data, 0x1142, OOT_LINK_CHILD_OFFSETS.LUT_DL_MASK_BUNNY);
  patchPtrLo(fileEnMm.data, 0x1146, OOT_LINK_CHILD_OFFSETS.LUT_DL_MASK_BUNNY);

  patchPtr(fileCode.data, 0xe65a4, OOT_LINK_CHILD_OFFSETS.HIERARCHY);
}

export function enableModelOotLinkAdult(builder: RomBuilder, dfAddr: number) {
  dfAddr |= 0x06000000;
  let base: number;

  const fileCode = builder.fileByNameRequired('oot/code');
  const fileArmsHook = builder.fileByNameRequired('oot/actors/ovl_Arms_Hook');
  const fileEffStick = builder.fileByNameRequired('oot/actors/ovl_Effect_Ss_Stick');

  base = 0xe6718;
  patchPtr(fileCode.data, base + 0x0000, OOT_LINK_ADULT_OFFSETS.LUT_DL_RFIST);
  patchPtr(fileCode.data, base + 0x0008, OOT_LINK_ADULT_OFFSETS.LUT_DL_RFIST);
  patchPtr(fileCode.data, base + 0x0010, dfAddr);
  patchPtr(fileCode.data, base + 0x0018, dfAddr);
  patchPtr(fileCode.data, base + 0x0020, OOT_LINK_ADULT_OFFSETS.LUT_DL_RFIST_SHIELD_HYLIAN);
  patchPtr(fileCode.data, base + 0x0028, OOT_LINK_ADULT_OFFSETS.LUT_DL_RFIST_SHIELD_HYLIAN);
  patchPtr(fileCode.data, base + 0x0030, OOT_LINK_ADULT_OFFSETS.LUT_DL_RFIST_SHIELD_MIRROR);
  patchPtr(fileCode.data, base + 0x0038, OOT_LINK_ADULT_OFFSETS.LUT_DL_RFIST_SHIELD_MIRROR);
  patchPtr(fileCode.data, base + 0x0040, OOT_LINK_ADULT_OFFSETS.LUT_DL_SWORD_SHEATHED);
  patchPtr(fileCode.data, base + 0x0048, OOT_LINK_ADULT_OFFSETS.LUT_DL_SWORD_SHEATHED);
  patchPtr(fileCode.data, base + 0x0050, dfAddr);
  patchPtr(fileCode.data, base + 0x0058, dfAddr);
  patchPtr(fileCode.data, base + 0x0060, OOT_LINK_ADULT_OFFSETS.LUT_DL_SWORD_SHIELD_HYLIAN);
  patchPtr(fileCode.data, base + 0x0068, OOT_LINK_ADULT_OFFSETS.LUT_DL_SWORD_SHIELD_HYLIAN);
  patchPtr(fileCode.data, base + 0x0070, OOT_LINK_ADULT_OFFSETS.LUT_DL_SWORD_SHIELD_MIRROR);
  patchPtr(fileCode.data, base + 0x0078, OOT_LINK_ADULT_OFFSETS.LUT_DL_SWORD_SHIELD_MIRROR);
  patchPtr(fileCode.data, base + 0x0080, 0x00000000);
  patchPtr(fileCode.data, base + 0x0088, 0x00000000);
  patchPtr(fileCode.data, base + 0x0090, 0x00000000);
  patchPtr(fileCode.data, base + 0x0098, 0x00000000);
  patchPtr(fileCode.data, base + 0x00a0, OOT_LINK_ADULT_OFFSETS.LUT_DL_SWORD_SHEATH);
  patchPtr(fileCode.data, base + 0x00a8, OOT_LINK_ADULT_OFFSETS.LUT_DL_SWORD_SHEATH);
  patchPtr(fileCode.data, base + 0x00b0, dfAddr);
  patchPtr(fileCode.data, base + 0x00b8, dfAddr);
  patchPtr(fileCode.data, base + 0x00c0, OOT_LINK_ADULT_OFFSETS.LUT_DL_SHEATH0_HYLIAN);
  patchPtr(fileCode.data, base + 0x00c8, OOT_LINK_ADULT_OFFSETS.LUT_DL_SHEATH0_HYLIAN);
  patchPtr(fileCode.data, base + 0x00d0, OOT_LINK_ADULT_OFFSETS.LUT_DL_SHEATH0_MIRROR);
  patchPtr(fileCode.data, base + 0x00d8, OOT_LINK_ADULT_OFFSETS.LUT_DL_SHEATH0_MIRROR);
  patchPtr(fileCode.data, base + 0x00e0, 0x00000000);
  patchPtr(fileCode.data, base + 0x00e8, 0x00000000);
  patchPtr(fileCode.data, base + 0x00f0, 0x00000000);
  patchPtr(fileCode.data, base + 0x00f8, 0x00000000);
  patchPtr(fileCode.data, base + 0x0100, OOT_LINK_ADULT_OFFSETS.LUT_DL_LFIST_LONGSWORD);
  patchPtr(fileCode.data, base + 0x0108, OOT_LINK_ADULT_OFFSETS.LUT_DL_LFIST_LONGSWORD);
  patchPtr(fileCode.data, base + 0x0110, OOT_LINK_ADULT_OFFSETS.LUT_DL_LFIST_LONGSWORD_BROKEN);
  patchPtr(fileCode.data, base + 0x0118, OOT_LINK_ADULT_OFFSETS.LUT_DL_LFIST_LONGSWORD_BROKEN);
  patchPtr(fileCode.data, base + 0x0120, OOT_LINK_ADULT_OFFSETS.LUT_DL_LHAND);
  patchPtr(fileCode.data, base + 0x0128, OOT_LINK_ADULT_OFFSETS.LUT_DL_LHAND);
  patchPtr(fileCode.data, base + 0x0130, OOT_LINK_ADULT_OFFSETS.LUT_DL_LFIST);
  patchPtr(fileCode.data, base + 0x0138, OOT_LINK_ADULT_OFFSETS.LUT_DL_LFIST);
  patchPtr(fileCode.data, base + 0x0140, dfAddr);
  patchPtr(fileCode.data, base + 0x0148, dfAddr);
  patchPtr(fileCode.data, base + 0x0150, OOT_LINK_ADULT_OFFSETS.LUT_DL_LFIST_SWORD);
  patchPtr(fileCode.data, base + 0x0158, OOT_LINK_ADULT_OFFSETS.LUT_DL_LFIST_SWORD);
  patchPtr(fileCode.data, base + 0x0160, OOT_LINK_ADULT_OFFSETS.LUT_DL_RHAND);
  patchPtr(fileCode.data, base + 0x0168, OOT_LINK_ADULT_OFFSETS.LUT_DL_RHAND);
  patchPtr(fileCode.data, base + 0x0170, OOT_LINK_ADULT_OFFSETS.LUT_DL_RFIST);
  patchPtr(fileCode.data, base + 0x0178, OOT_LINK_ADULT_OFFSETS.LUT_DL_RFIST);
  patchPtr(fileCode.data, base + 0x0180, OOT_LINK_ADULT_OFFSETS.LUT_DL_RFIST_BOW);
  patchPtr(fileCode.data, base + 0x0188, OOT_LINK_ADULT_OFFSETS.LUT_DL_RFIST_BOW);
  patchPtr(fileCode.data, base + 0x0190, OOT_LINK_ADULT_OFFSETS.LUT_DL_SWORD_SHEATHED);
  patchPtr(fileCode.data, base + 0x0198, OOT_LINK_ADULT_OFFSETS.LUT_DL_SWORD_SHEATHED);
  patchPtr(fileCode.data, base + 0x01a0, OOT_LINK_ADULT_OFFSETS.LUT_DL_SWORD_SHEATH);
  patchPtr(fileCode.data, base + 0x01a8, OOT_LINK_ADULT_OFFSETS.LUT_DL_SWORD_SHEATH);
  patchPtr(fileCode.data, base + 0x01b0, OOT_LINK_ADULT_OFFSETS.LUT_DL_WAIST);
  patchPtr(fileCode.data, base + 0x01b8, OOT_LINK_ADULT_OFFSETS.LUT_DL_WAIST);
  patchPtr(fileCode.data, base + 0x01c0, OOT_LINK_ADULT_OFFSETS.LUT_DL_RFIST_BOW);
  patchPtr(fileCode.data, base + 0x01c8, OOT_LINK_ADULT_OFFSETS.LUT_DL_RFIST_BOW);
  patchPtr(fileCode.data, base + 0x01d0, OOT_LINK_ADULT_OFFSETS.LUT_DL_RHAND_OCARINA_TIME);
  patchPtr(fileCode.data, base + 0x01d8, OOT_LINK_ADULT_OFFSETS.LUT_DL_RHAND_OCARINA_TIME);
  patchPtr(fileCode.data, base + 0x01e0, OOT_LINK_ADULT_OFFSETS.LUT_DL_RHAND_OCARINA_TIME);
  patchPtr(fileCode.data, base + 0x01e8, OOT_LINK_ADULT_OFFSETS.LUT_DL_RHAND_OCARINA_TIME);
  patchPtr(fileCode.data, base + 0x01f0, OOT_LINK_ADULT_OFFSETS.LUT_DL_RFIST_HOOKSHOT);
  patchPtr(fileCode.data, base + 0x01f8, OOT_LINK_ADULT_OFFSETS.LUT_DL_RFIST_HOOKSHOT);
  patchPtr(fileCode.data, base + 0x0200, OOT_LINK_ADULT_OFFSETS.LUT_DL_LFIST_HAMMER);
  patchPtr(fileCode.data, base + 0x0208, OOT_LINK_ADULT_OFFSETS.LUT_DL_LFIST_HAMMER);
  patchPtr(fileCode.data, base + 0x0210, dfAddr);
  patchPtr(fileCode.data, base + 0x0218, dfAddr);
  patchPtr(fileCode.data, base + 0x0220, OOT_LINK_ADULT_OFFSETS.LUT_DL_LHAND_BOTTLE);
  patchPtr(fileCode.data, base + 0x0228, OOT_LINK_ADULT_OFFSETS.LUT_DL_LHAND_BOTTLE);
  patchPtr(fileCode.data, base + 0x0230, OOT_LINK_ADULT_OFFSETS.LUT_DL_FPS_LFOREARM);
  patchPtr(fileCode.data, base + 0x0238, OOT_LINK_ADULT_OFFSETS.LUT_DL_FPS_LHAND);
  patchPtr(fileCode.data, base + 0x0240, OOT_LINK_ADULT_OFFSETS.LUT_DL_RSHOULDER);
  patchPtr(fileCode.data, base + 0x0248, OOT_LINK_ADULT_OFFSETS.LUT_DL_FPS_RFOREARM);
  patchPtr(fileCode.data, base + 0x0250, OOT_LINK_ADULT_OFFSETS.LUT_DL_FPS_RHAND_BOW);

  base = 0xe6a4c;
  patchPtr(fileCode.data, base + 0x0000, OOT_LINK_ADULT_OFFSETS.LUT_DL_BOOT_LIRON);
  patchPtr(fileCode.data, base + 0x0004, OOT_LINK_ADULT_OFFSETS.LUT_DL_BOOT_RIRON);
  patchPtr(fileCode.data, base + 0x0008, OOT_LINK_ADULT_OFFSETS.LUT_DL_BOOT_LHOVER);
  patchPtr(fileCode.data, base + 0x000c, OOT_LINK_ADULT_OFFSETS.LUT_DL_BOOT_RHOVER);

  patchPtr(fileCode.data, 0xe6b28, OOT_LINK_ADULT_OFFSETS.LUT_DL_BOTTLE);

  base = 0xe6b64;
  patchPtr(fileCode.data, base + 0x0000, OOT_LINK_ADULT_OFFSETS.LUT_DL_BOW_STRING);
  patchPtr(fileCode.data, base + 0x0004, 0x00000000);
  patchPtr(fileCode.data, base + 0x0008, 0xC3B43333);

  patchPtrHi(fileCode.data, 0x69112, OOT_LINK_ADULT_OFFSETS.LUT_DL_UPGRADE_LFOREARM);
  patchPtrLo(fileCode.data, 0x69116, OOT_LINK_ADULT_OFFSETS.LUT_DL_UPGRADE_LFOREARM);
  patchPtrHi(fileCode.data, 0x6912E, OOT_LINK_ADULT_OFFSETS.LUT_DL_UPGRADE_RFOREARM);
  patchPtrLo(fileCode.data, 0x69132, OOT_LINK_ADULT_OFFSETS.LUT_DL_UPGRADE_RFOREARM);
  patchPtrHi(fileCode.data, 0x6914E, OOT_LINK_ADULT_OFFSETS.LUT_DL_UPGRADE_LFIST);
  patchPtrLo(fileCode.data, 0x69162, OOT_LINK_ADULT_OFFSETS.LUT_DL_UPGRADE_LFIST);
  patchPtrHi(fileCode.data, 0x69166, OOT_LINK_ADULT_OFFSETS.LUT_DL_UPGRADE_LHAND);
  patchPtrLo(fileCode.data, 0x69172, OOT_LINK_ADULT_OFFSETS.LUT_DL_UPGRADE_LHAND);
  patchPtrHi(fileCode.data, 0x6919E, OOT_LINK_ADULT_OFFSETS.LUT_DL_UPGRADE_RFIST);
  patchPtrLo(fileCode.data, 0x691A2, OOT_LINK_ADULT_OFFSETS.LUT_DL_UPGRADE_RFIST);
  patchPtrHi(fileCode.data, 0x691AE, OOT_LINK_ADULT_OFFSETS.LUT_DL_UPGRADE_RHAND);
  patchPtrLo(fileCode.data, 0x691B2, OOT_LINK_ADULT_OFFSETS.LUT_DL_UPGRADE_RHAND);
  patchPtrHi(fileCode.data, 0x69DEA, OOT_LINK_ADULT_OFFSETS.LUT_DL_FPS_LHAND_HOOKSHOT);
  patchPtrLo(fileCode.data, 0x69DEE, OOT_LINK_ADULT_OFFSETS.LUT_DL_FPS_LHAND_HOOKSHOT);
  patchPtrHi(fileCode.data, 0x6A666, OOT_LINK_ADULT_OFFSETS.LUT_DL_HOOKSHOT_AIM);
  patchPtrLo(fileCode.data, 0x6A66A, OOT_LINK_ADULT_OFFSETS.LUT_DL_HOOKSHOT_AIM);

  patchPtrHi(fileArmsHook.data, 0xa72, OOT_LINK_ADULT_OFFSETS.LUT_DL_HOOKSHOT_HOOK);
  patchPtrLo(fileArmsHook.data, 0xa76, OOT_LINK_ADULT_OFFSETS.LUT_DL_HOOKSHOT_HOOK);
  patchPtrHi(fileArmsHook.data, 0xb66, OOT_LINK_ADULT_OFFSETS.LUT_DL_HOOKSHOT_CHAIN);
  patchPtrLo(fileArmsHook.data, 0xb6a, OOT_LINK_ADULT_OFFSETS.LUT_DL_HOOKSHOT_CHAIN);
  patchPtr16(fileArmsHook.data, 0xba8, 0x0014);

  patchPtr(fileEffStick.data, 0x32C, OOT_LINK_ADULT_OFFSETS.LUT_DL_BLADEBREAK);
  patchPtr16(fileEffStick.data, 0x328, 0x0014);

  patchPtr(fileCode.data, 0xe65a0, OOT_LINK_ADULT_OFFSETS.HIERARCHY);
}

/* model-pak.ts */
export type PlayerModelGame = 'oot' | 'mm';
export type PlayerModelAge = 'adult' | 'child';

export type PakPlayerModel = {
  name: string;
  data: Uint8Array;
  game: PlayerModelGame | null;
  age: PlayerModelAge | null;
};

type PakEntry = {
  name: string;
  compression: string;
  dataStart: number;
  dataEnd: number;
};

type ModelHint = {
  file: string;
  game: PlayerModelGame;
  age: PlayerModelAge | null;
  order: number;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const PAK_MAGIC = encoder.encode('ModLoader64\0');
const MODEL_MAGIC = encoder.encode('MODLOADER64');
const PAK_VERSION = 3;
const MAX_FILES = 0x10000;
const MAX_MODEL_SIZE = 0x400000;
const MAX_JSON_SIZE = 0x100000;

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
  return value.replace(/\\/g, '/').replace(/^\.\//, '').toLowerCase();
}

function basename(value: string) {
  const normalized = value.replace(/\\/g, '/');
  const index = normalized.lastIndexOf('/');
  return index === -1 ? normalized : normalized.slice(index + 1);
}

function dirname(value: string) {
  const normalized = value.replace(/\\/g, '/');
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
  if (!isPlayerModelPak(data)) {
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
    const name = decoder.decode(data.subarray(nameOffset, nameEnd));

    entries.push({
      name,
      compression,
      dataStart,
      dataEnd,
    });
  }

  return entries;
}

async function decompress(entry: PakEntry, pak: Uint8Array, maxSize: number) {
  const input = pak.subarray(entry.dataStart, entry.dataEnd);

  if (entry.compression === 'DEFL') {
    const blobInput = new Uint8Array(input);
    const stream = new Blob([blobInput])
        .stream()
        .pipeThrough(new DecompressionStream('deflate'));

    const output = new Uint8Array(await new Response(stream).arrayBuffer());

    if (output.length > maxSize) {
      throw new Error(`Pak file ${entry.name} is too large after decompression`);
    }

    return output;
  }

  if (
      entry.compression === 'UNCO' ||
      entry.compression === 'NONE' ||
      entry.compression === 'RAW ' ||
      entry.compression === '\0\0\0\0'
  ) {
    if (input.length > maxSize) {
      throw new Error(`Pak file ${entry.name} is too large`);
    }

    return new Uint8Array(input);
  }

  throw new Error(
      `Unsupported pak compression ${entry.compression} for ${entry.name}`
  );
}

function readModelReference(value: unknown) {
  if (typeof value === 'string') {
    return value.toLowerCase().endsWith('.zobj') && value !== '' ? [value] : [];
  }

  if (Array.isArray(value)) {
    const out: string[] = [];
    for (const item of value) {
      if (typeof item === 'string') {
        if (item.toLowerCase().endsWith('.zobj')) {
          out.push(item);
        }
      } else if (item && typeof item === 'object') {
        const file = (item as Record<string, unknown>).file;
        if (typeof file === 'string' && file.toLowerCase().endsWith('.zobj') && file !== '') {
          out.push(file);
        }
      }
    }
    return out;
  }

  if (value && typeof value === 'object') {
    const file = (value as Record<string, unknown>).file;
    if (typeof file === 'string' && file.toLowerCase().endsWith('.zobj') && file !== '') {
      return [file];
    }
  }

  return [];
}

function findProperty(value: Record<string, unknown>, names: string[]) {
  const lowered = new Map<string, unknown>();
  for (const [key, item] of Object.entries(value)) {
    lowered.set(key.toLowerCase(), item);
  }

  for (const name of names) {
    const item = lowered.get(name.toLowerCase());
    if (item !== undefined) {
      return item;
    }
  }

  return undefined;
}

function getObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function packageHints(value: unknown) {
  const root = getObject(value);
  if (!root) {
    return [];
  }

  const zzplayas = getObject(findProperty(root, ['zzplayas']));
  if (!zzplayas) {
    return [];
  }

  const hints: Omit<ModelHint, 'order'>[] = [];
  const oot = getObject(findProperty(zzplayas, ['OOT', 'OcarinaOfTime', 'OcarinaofTime']));
  const mm = getObject(findProperty(zzplayas, ['MM', 'MajorasMask']));

  if (oot) {
    for (const file of readModelReference(findProperty(oot, ['adult_model']))) {
      hints.push({ file, game: 'oot', age: 'adult' });
    }
    for (const file of readModelReference(findProperty(oot, ['child_model']))) {
      hints.push({ file, game: 'oot', age: 'child' });
    }
  }

  if (mm) {
    for (const file of readModelReference(findProperty(mm, ['adult_model']))) {
      hints.push({ file, game: 'mm', age: 'adult' });
    }
    for (const file of readModelReference(findProperty(mm, ['child_model']))) {
      hints.push({ file, game: 'mm', age: null });
    }
  }

  return hints;
}

export function isProcessedPlayerModel(data: Uint8Array) {
  return data.length >= 0x5010 && bytesEqual(data, 0x5000, MODEL_MAGIC);
}

export function classifyPlayerModel(data: Uint8Array): { game: PlayerModelGame | null, age: PlayerModelAge | null } {
  if (isProcessedPlayerModel(data)) {
    const type = data[0x500b];
    const hierarchy = bufReadU32BE(data, 0x500c);

    switch (type) {
    case 0x00:
      return { game: 'oot', age: 'adult' };
    case 0x01:
      return { game: 'oot', age: 'child' };
    case 0x04:
      return { game: 'mm', age: 'child' };
    case 0x68:
      return { game: 'mm', age: 'adult' };
    }

    if (hierarchy === 0x06005380) {
      return { game: 'oot', age: 'adult' };
    }
    if (hierarchy === 0x060053a8) {
      return { game: 'oot', age: 'child' };
    }
    if (hierarchy === 0x06005420) {
      return { game: 'mm', age: null };
    }
  }

  const manifest = decoder.decode(data.subarray(Math.max(0, data.length - 0x4000)));
  if (!manifest.includes('!PlayAsManifest0')) {
    return { game: null, age: null };
  }

  if (
    manifest.includes('Shield.2.Face') ||
    manifest.includes('Sword.4') ||
    manifest.includes('Sheath.3')
  ) {
    return { game: 'mm', age: null };
  }

  if (
    manifest.includes('Hammer') ||
    manifest.includes('Shield.3') ||
    manifest.includes('Gauntlet.') ||
    manifest.includes('Foot.3.L')
  ) {
    return { game: 'oot', age: 'adult' };
  }

  if (
    manifest.includes('Slingshot') ||
    manifest.includes('Boomerang') ||
    manifest.includes('Mask.Bunny') ||
    manifest.includes('DekuStick') ||
    manifest.includes('GoronBracelet') ||
    manifest.includes('Ocarina.1') ||
    manifest.includes('Blade.1') ||
    manifest.includes('Hilt.1')
  ) {
    return { game: 'oot', age: 'child' };
  }

  if (
    manifest.includes('Limb 1') &&
    manifest.includes('Limb 10') &&
    manifest.includes('Limb 19') &&
    manifest.includes('Limb 20') &&
    manifest.includes('Fist.L') &&
    manifest.includes('Fist.R')
  ) {
    return { game: 'mm', age: null };
  }

  return { game: null, age: null };
}

function matchHint(entryName: string, hints: ModelHint[]) {
  const normalized = normalizePath(entryName);
  const base = basename(normalized);

  for (const hint of hints) {
    const file = normalizePath(hint.file);
    if (normalized === file || normalized.endsWith('/' + file)) {
      return hint;
    }
  }

  for (const hint of hints) {
    if (basename(normalizePath(hint.file)) === base) {
      return hint;
    }
  }

  return null;
}

export function isPlayerModelPak(data: Uint8Array) {
  return bytesEqual(data, 0, PAK_MAGIC);
}

export async function readPakPlayerModels(data: Uint8Array): Promise<PakPlayerModel[]> {
  const entries = readPakEntries(data);
  const jsonEntries = entries.filter((entry) => basename(entry.name).toLowerCase() === 'package.json');
  const hints: ModelHint[] = [];
  let order = 0;

  for (const entry of jsonEntries) {
    const jsonData = await decompress(entry, data, MAX_JSON_SIZE);
    let json: unknown;

    try {
      json = JSON.parse(decoder.decode(jsonData));
    } catch {
      continue;
    }

    for (const hint of packageHints(json)) {
      const root = dirname(entry.name);
      hints.push({
        ...hint,
        file: root ? `${root}/${hint.file}` : hint.file,
        order: order++,
      });
    }
  }

  const zobjEntries = entries.filter((entry) => entry.name.toLowerCase().endsWith('.zobj'));
  const orderedEntries = zobjEntries.map((entry, index) => {
    const hint = matchHint(entry.name, hints);
    return {
      entry,
      hint,
      index,
      priority: hint ? hint.order : 0x100000 + index,
    };
  }).sort((a, b) => a.priority - b.priority);

  const models: PakPlayerModel[] = [];

  for (const { entry, hint } of orderedEntries) {
    const model = await decompress(entry, data, MAX_MODEL_SIZE);
    const classified = classifyPlayerModel(model);

    models.push({
      name: entry.name,
      data: model,
      game: classified.game ?? hint?.game ?? null,
      age: classified.age ?? hint?.age ?? null,
    });
  }

  if (models.length === 0) {
    throw new Error('ModLoader64 pak contains no player model zobj files');
  }

  return models;
}



export type PakZobj = {
  name: string;
  data: Uint8Array;
};

export async function readPakZobjs(data: Uint8Array): Promise<PakZobj[]> {
  const entries = readPakEntries(data);
  const zobjEntries = entries.filter((entry) => entry.name.toLowerCase().endsWith('.zobj'));
  const out: PakZobj[] = [];

  for (const entry of zobjEntries) {
    out.push({
      name: entry.name,
      data: await decompress(entry, data, MAX_MODEL_SIZE),
    });
  }

  return out;
}

/* model-input.ts */
export type ResolvedPlayerModel = {
  data: Uint8Array;
  sourceGame: PlayerModelGame | null;
};

export type PlayerModelPair = {
  adult: ResolvedPlayerModel | null;
  child: ResolvedPlayerModel | null;
};

function emptyPair(): PlayerModelPair {
  return {
    adult: null,
    child: null,
  };
}

function resolvedModel(model: PakPlayerModel): ResolvedPlayerModel {
  return {
    data: model.data,
    sourceGame: model.game,
  };
}

export async function resolvePlayerModelInput(
  data: Uint8Array | null,
  game: PlayerModelGame,
  slotAge: PlayerModelAge,
): Promise<PlayerModelPair> {
  const out = emptyPair();

  if (data === null) {
    return out;
  }

  if (!isPlayerModelPak(data)) {
    const classified = classifyPlayerModel(data);

    out[slotAge] = {
      data,
      sourceGame: classified.game,
    };

    return out;
  }

  const models = await readPakPlayerModels(data);
  let relevant = models.filter((model) => model.game === game);
  if (relevant.length === 0) {
    relevant = models.filter((model) => model.game === null);
  }

  if (relevant.length === 0) {
    const crossGame = models.filter(
      (model) => model.game !== null && model.game !== game,
    );

    const rawCrossGame = crossGame.filter(
      (model) => !isProcessedPlayerModel(model.data),
    );

    relevant = rawCrossGame.length > 0 ? rawCrossGame : crossGame;
  }

  if (relevant.length === 0) {
    throw new Error(`Model pak contains no player models usable by ${game.toUpperCase()}`);
  }

  const adult = relevant.find((model) => model.age === 'adult');
  const child = relevant.find((model) => model.age === 'child');
  const unknown = relevant.filter((model) => model.age === null);

  if (adult) {
    out.adult = resolvedModel(adult);
  }

  if (child) {
    out.child = resolvedModel(child);
  }

  if (unknown.length === 1) {
    const model = resolvedModel(unknown[0]);

    if (out.adult !== null && out.child === null) {
      out.child = model;
    } else if (out.child !== null && out.adult === null) {
      out.adult = model;
    } else if (out[slotAge] === null) {
      out[slotAge] = model;
    }
  } else if (unknown.length > 1) {
    throw new Error(`Model pak contains multiple unclassified ${game.toUpperCase()} player models`);
  }

  if (out.adult === null && out.child === null) {
    throw new Error(`Unable to determine player model age from ${game.toUpperCase()} pak`);
  }

  return out;
}

export function mergePlayerModelInputs(
  childSlot: PlayerModelPair,
  adultSlot: PlayerModelPair,
): PlayerModelPair {
  return {
    child: childSlot.child ?? adultSlot.child,
    adult: adultSlot.adult ?? childSlot.adult,
  };
}

/* player-model-compat.ts */
const CROSS_GAME_PLAYER_PIECES = new Set<string>([
  'Limb 1','Limb 3','Limb 4','Limb 5','Limb 6','Limb 7','Limb 8',
  'Limb 10','Limb 11','Limb 12','Limb 13','Limb 14','Limb 15',
  'Limb 16','Limb 17','Limb 18','Limb 19','Limb 20',
  'Waist','Thigh.R','Shin.R','Foot.R','Thigh.L','Shin.L','Foot.L',
  'Head','Hat','Collar','Shoulder.L','Forearm.L','Hand.L',
  'Shoulder.R','Forearm.R','Hand.R','Torso',
  'Fist.L','Fist.R',
]);

export function isCrossGamePlayerPiece(name: string) {
  return CROSS_GAME_PLAYER_PIECES.has(name);
}

export function crossGamePieceDefaultLimb(name: string): number | null {
  switch (name) {
    case 'Fist.L': return 15;
    case 'Fist.R': return 18;
    default: return null;
  }
}

/* player-model-retarget.ts */
const SEGMENT_MODEL = 0x06;
const SEGMENT_MATRIX = 0x0d;
const LIMB_COUNT = 21;

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
    dlistCount: number;
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
        if (data[hierarchyOffset + 4] !== LIMB_COUNT) {
            continue;
        }
        const headerDlistCount = data[hierarchyOffset + 8];
        if (headerDlistCount === 0 || headerDlistCount > LIMB_COUNT) {
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

            const child = data[recordOffset + 6];
            const sibling = data[recordOffset + 7];
            const dlistNear = bufReadU32BE(data, recordOffset + 8);
            const dlistFar = bufReadU32BE(data, recordOffset + 12);

            if (
                (child !== 0xff && child >= LIMB_COUNT) ||
                (sibling !== 0xff && sibling >= LIMB_COUNT)
            ) {
                valid = false;
                break;
            }

            for (const address of [dlistNear, dlistFar]) {
                if (
                    address !== 0 &&
                    (
                        (address >>> 24) !== SEGMENT_MODEL ||
                        (address & 0x00ffffff) >= data.length
                    )
                ) {
                    valid = false;
                    break;
                }
            }
            if (!valid) {
                break;
            }

            limbs.push({
                recordOffset,
                translation: [
                    signed16(bufReadU16BE(data, recordOffset + 0)),
                    signed16(bufReadU16BE(data, recordOffset + 2)),
                    signed16(bufReadU16BE(data, recordOffset + 4)),
                ],
                child,
                sibling,
                dlistNear,
                dlistFar,
            });
        }

        if (!valid) {
            continue;
        }

        const actualDlistCount = limbs.filter(
            (limb) => limb.dlistNear !== 0 || limb.dlistFar !== 0
        ).length;
        if (actualDlistCount === 0 || actualDlistCount > LIMB_COUNT) {
            continue;
        }

        return {
            hierarchyOffset,
            limbTableOffset,
            dlistCount: actualDlistCount,
            limbs,
        };
    }

    throw new Error('Failed to find valid 21-limb player flex skeleton');
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

function matrixSlotToLimb(skeleton: Skeleton) {
    const out: number[] = [];

    for (let i = 0; i < skeleton.limbs.length; ++i) {
        const limb = skeleton.limbs[i];
        if (limb.dlistNear !== 0 || limb.dlistFar !== 0) {
            out.push(i);
        }
    }

    if (out.length !== skeleton.dlistCount) {
        throw new Error(
            `Unexpected player skeleton display-list count: ` +
            `${out.length} != ${skeleton.dlistCount}`
        );
    }

    return out;
}

function matrixSlotByLimb(target: ReadonlyArray<number>) {
    const out = new Map<number, number>();

    for (let slot = 0; slot < target.length; ++slot) {
        const limb = target[slot];
        if (!Number.isInteger(limb) || limb < 0 || limb >= LIMB_COUNT) {
            throw new Error(`Invalid target player matrix-slot limb ${limb}`);
        }
        if (out.has(limb)) {
            throw new Error(`Duplicate target player matrix-slot limb ${limb}`);
        }
        out.set(limb, slot);
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

export function readPlayerSkeletonMatrixSlotLimbs(data: Uint8Array): number[] {
    return matrixSlotToLimb(findSkeleton(data));
}

export function retargetPlayerModelBindPose(
    input: Uint8Array,
    targetTranslationsInput: ReadonlyArray<ReadonlyArray<number>>,
    extraLists: RetargetExtraList[] = [],
    targetMatrixSlotLimbs?: ReadonlyArray<number>,
): Uint8Array {
    const source = findSkeleton(input);
    const sourceTranslations = source.limbs.map((limb) => [...limb.translation] as Vec3);
    const targetTranslations = normalizeTargetTranslations(targetTranslationsInput);
    const geometryTargetTranslations = targetTranslations.map((v) => [...v] as Vec3);
    /* Root motion is not part of zzconvert's per-limb bind compensation. */
    geometryTargetTranslations[0] = [...sourceTranslations[0]] as Vec3;
    const parents = makeParents(source.limbs);
    const sourceGlobals = globalTranslations(sourceTranslations, parents);
    const targetGlobals = globalTranslations(geometryTargetTranslations, parents);
    const slotToLimb = matrixSlotToLimb(source);
    const targetSlotByLimb = targetMatrixSlotLimbs === undefined
        ? null
        : matrixSlotByLimb(targetMatrixSlotLimbs);

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
    const matrixSlotPatches = new Map<number, number>();
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
                        if (targetSlotByLimb !== null) {
                            const targetSlot = targetSlotByLimb.get(currentLimb);
                            if (targetSlot === undefined) {
                                throw new Error(
                                    `Target player skeleton has no matrix slot for source limb ${currentLimb}`
                                );
                            }

                            const previous = matrixSlotPatches.get(offset);
                            if (previous !== undefined && previous !== targetSlot) {
                                throw new Error(
                                    `Cross-game matrix command 0x${offset.toString(16)} ` +
                                    `maps to incompatible target slots`
                                );
                            }
                            matrixSlotPatches.set(offset, targetSlot);
                        }
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

    for (const [commandOffset, targetSlot] of matrixSlotPatches) {
        bufWriteU32BE(
            output,
            commandOffset + 4,
            (SEGMENT_MATRIX << 24) | (targetSlot << 6),
        );
    }

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

/* player-model-compactor.ts */
export type PlayerModelByteRange = {
  start: number;
  end: number;
};

type ByteRange = PlayerModelByteRange;

type MappedRange = ByteRange & {
  mappedStart: number;
};

type DedupeKind = 'list' | 'vertex' | 'matrix' | 'texture' | 'palette';

type DedupeRange = ByteRange & {
  kind: DedupeKind;
};

type AliasRange = DedupeRange & {
  canonicalStart: number;
};

export type PlayerModelDataPatch = {
  offset: number;
  data: Uint8Array;
};

export type PlayerModelCompactionStats = {
  deduplicatedBytes: number;
  holePackedBytes: number;
  ci4TextureCount: number;
  reducedIntensityTextureCount: number;
  downsampledTextureCount: number;
  textureBytesSaved: number;
  vertexBytesSaved: number;
  geometryMergedVertexCount: number;
  geometryCompactedListCount: number;
};

export type PlayerModelPointerPatch = {
  offset: number;
  value: number;
};

export type PlayerModelGraphBuild = {
  data: Uint8Array;
  fixedDataPatches: PlayerModelDataPatch[];
  fixedPointerPatches: PlayerModelPointerPatch[];
  stats: PlayerModelCompactionStats;
  mapAddress(address: number): number;
};

export type PlayerModelGraphRootOptions = {
  preserveCi8?: boolean;
  preserveTextureDimensions?: boolean;
  preserveGeometry?: boolean;
};

export type PlayerModelGraphCompactorOptions = {
  quantizeCi8ToCi4?: boolean;
  reduceIntensityTextures?: boolean;
  downsampleTextureLevels?: number;
  downsampleMinBytes?: number;
  downsampleMinDimension?: number;
  downsampleTargetBytesToSave?: number;
  geometryPositionStep?: number;
  segment?: number;
  allowProtectedCi4UpToBytes?: number;
  deduplicate?: boolean;
  packIntoPreservedHoles?: boolean;
  reservedPreservedRanges?: readonly PlayerModelByteRange[];
};

type TextureReference = {
  listOffset: number;
  commandOffset: number;
  address: number;
  byteLength: number;
};

type VertexReference = {
  listOffset: number;
  commandOffset: number;
  address: number;
  count: number;
  v0: number;
};

type PaletteReference = {
  listOffset: number;
  commandOffset: number;
  address: number;
  count: number;
};

type StandardTexturePair = {
  listOffset: number;
  textureCommand: number;
  loadBlockCommand: number;
  renderTileCommand: number;
  tileSizeCommand: number | null;
  textureAddress: number;
  textureByteLength: number;
  width: number;
  height: number;
};

type DirectTexturePair = {
  listOffset: number;
  textureCommand: number;
  loadBlockCommand: number;
  renderTileCommand: number;
  tileSizeCommand: number | null;
  textureAddress: number;
  textureByteLength: number;
  format: number;
  sourceSize: number;
  targetSize: number;
  width: number;
  height: number;
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

const G_IM_FMT_CI = 2;
const G_IM_FMT_RGBA = 0;
const G_IM_FMT_IA = 3;
const G_IM_FMT_I = 4;
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
  private readonly options: {
    quantizeCi8ToCi4: boolean;
    reduceIntensityTextures: boolean;
    downsampleTextureLevels: number;
    downsampleMinBytes: number;
    downsampleMinDimension: number;
    downsampleTargetBytesToSave: number;
    geometryPositionStep: number;
    segment: number;
    allowProtectedCi4UpToBytes: number;
    deduplicate: boolean;
    packIntoPreservedHoles: boolean;
    reservedPreservedRanges: PlayerModelByteRange[];
  };

  private readonly seenLists = new Set<number>();
  private readonly protectedLists = new Set<number>();
  private readonly dimensionProtectedLists = new Set<number>();
  private readonly geometryProtectedLists = new Set<number>();
  private readonly listsWithCalls = new Set<number>();
  private readonly listChildren = new Map<number, number[]>();
  private readonly listSizes = new Map<number, number>();
  private readonly ranges: ByteRange[] = [];
  private readonly dedupeCandidates: DedupeRange[] = [];

  private readonly vertexReferences: VertexReference[] = [];
  private readonly textureReferences: TextureReference[] = [];
  private readonly paletteReferences: PaletteReference[] = [];
  private readonly ci8Pairs: Ci8Pair[] = [];
  private readonly directTexturePairs: DirectTexturePair[] = [];
  private readonly standardTexturePairs: StandardTexturePair[] = [];

  private geometryFinalized = false;
  private imagesFinalized = false;
  private ci4TextureCount = 0;
  private reducedIntensityTextureCount = 0;
  private downsampledTextureCount = 0;
  private textureBytesSaved = 0;
  private vertexBytesSaved = 0;
  private geometryMergedVertexCount = 0;
  private geometryCompactedLists = new Set<number>();

  constructor(
      source: Uint8Array,
      preserveBefore: number,
      options: PlayerModelGraphCompactorOptions = {},
  ) {
    /* Work on a private clone because CI4 conversion rewrites texture data and GBI. */
    this.source = new Uint8Array(source);
    this.preserveBefore = preserveBefore;
    this.options = {
      quantizeCi8ToCi4: options.quantizeCi8ToCi4 ?? false,
      reduceIntensityTextures: options.reduceIntensityTextures ?? false,
      downsampleTextureLevels: clamp(Math.floor(options.downsampleTextureLevels ?? 0), 0, 5),
      downsampleMinBytes: Math.max(0, Math.floor(options.downsampleMinBytes ?? 0x400)),
      downsampleMinDimension: clamp(Math.floor(options.downsampleMinDimension ?? 8), 1, 64),
      downsampleTargetBytesToSave: Math.max(0, Math.floor(options.downsampleTargetBytesToSave ?? 0)),
      geometryPositionStep: Math.max(0, Math.floor(options.geometryPositionStep ?? 0)),
      segment: clamp(Math.floor(options.segment ?? 0x06), 0, 0xff),
      allowProtectedCi4UpToBytes: options.allowProtectedCi4UpToBytes ?? 0,
      deduplicate: options.deduplicate ?? false,
      packIntoPreservedHoles: options.packIntoPreservedHoles ?? false,
      reservedPreservedRanges: [...(options.reservedPreservedRanges ?? [])],
    };
  }

  addDisplayListRoot(
      address: number,
      options: PlayerModelGraphRootOptions = {},
  ) {
    this.visitDisplayList(
        address,
        options.preserveCi8 ?? false,
        options.preserveTextureDimensions ?? false,
        options.preserveGeometry ?? false,
    );
  }

  private segmentOffset(address: number) {
    return address & 0x00ffffff;
  }

  private isLocalAddress(address: number) {
    return address !== 0 && (address >>> 24) === this.options.segment;
  }

  private addRange(address: number, size: number, dedupeKind?: DedupeKind) {
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

    if (dedupeKind) {
      this.dedupeCandidates.push({ start, end, kind: dedupeKind });
    }
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

  private tryParseStandardTexturePair(
      listOffset: number,
      command: number,
      end: number,
  ): StandardTexturePair | null {
    const prefix = [0xfd, 0xf5, 0xe6, 0xf3, 0xe7, 0xf5];
    if (command + prefix.length * 8 > end) {
      return null;
    }
    for (let i = 0; i < prefix.length; ++i) {
      if (this.source[command + i * 8] !== prefix[i]) {
        return null;
      }
    }

    const textureAddress = bufReadU32BE(this.source, command + 4);
    if (!this.isLocalAddress(textureAddress)) {
      return null;
    }

    const textureByteLength = this.textureByteLength(command, end);
    const renderTileCommand = command + 5 * 8;
    const renderTileWord = bufReadU32BE(this.source, renderTileCommand);
    const renderSize = (renderTileWord >>> 19) & 3;
    const bpp = [4, 8, 16, 32][renderSize];

    let tileSizeCommand: number | null = null;
    let width: number;
    let height: number;
    const cursor = command + 6 * 8;

    if (cursor + 8 <= end && this.source[cursor] === 0xf2) {
      tileSizeCommand = cursor;
      const dimensions = bufReadU32BE(this.source, tileSizeCommand + 4);
      const rawWidth = (dimensions >>> 12) & 0xfff;
      const rawHeight = dimensions & 0xfff;
      if ((rawWidth & 3) !== 0 || (rawHeight & 3) !== 0) {
        return null;
      }
      width = (rawWidth >>> 2) + 1;
      height = (rawHeight >>> 2) + 1;
    } else {
      const renderWord1 = bufReadU32BE(this.source, renderTileCommand + 4);
      const cmT = (renderWord1 >>> 18) & 3;
      const cmS = (renderWord1 >>> 8) & 3;
      if ((cmT & 2) !== 0 || (cmS & 2) !== 0) {
        return null;
      }

      const line = (renderTileWord >>> 9) & 0x1ff;
      const rowBits = line * 64;
      if (line === 0 || rowBits % bpp !== 0) {
        return null;
      }
      width = rowBits / bpp;
      const pixelCount = Math.floor((textureByteLength * 8) / bpp);
      if (width === 0 || pixelCount % width !== 0) {
        return null;
      }
      height = pixelCount / width;
    }

    if (width <= 0 || height <= 0 || !Number.isInteger(width) || !Number.isInteger(height)) {
      return null;
    }

    return {
      listOffset,
      textureCommand: command,
      loadBlockCommand: command + 3 * 8,
      renderTileCommand,
      tileSizeCommand,
      textureAddress,
      textureByteLength,
      width,
      height,
    };
  }

  private tryParseDirectTexturePair(
      listOffset: number,
      command: number,
      end: number,
  ): DirectTexturePair | null {
    const prefix = [0xfd, 0xf5, 0xe6, 0xf3, 0xe7, 0xf5];
    if (command + prefix.length * 8 > end) {
      return null;
    }
    for (let i = 0; i < prefix.length; ++i) {
      if (this.source[command + i * 8] !== prefix[i]) {
        return null;
      }
    }

    const textureCommand = command;
    const loadBlockCommand = command + 3 * 8;
    const renderTileCommand = command + 5 * 8;
    let cursor = command + 6 * 8;
    let tileSizeCommand: number | null = null;
    if (cursor + 8 <= end && this.source[cursor] === 0xf2) {
      tileSizeCommand = cursor;
      cursor += 8;
    }

    const renderTileWord = bufReadU32BE(this.source, renderTileCommand);
    const format = (renderTileWord >>> 21) & 7;
    const sourceSize = (renderTileWord >>> 19) & 3;
    let targetSize: number;

    if (format === G_IM_FMT_IA && sourceSize === G_IM_SIZ_16B) {
      targetSize = G_IM_SIZ_8B;
    } else if (format === G_IM_FMT_IA && sourceSize === G_IM_SIZ_8B) {
      targetSize = G_IM_SIZ_4B;
    } else if (format === G_IM_FMT_I && sourceSize === G_IM_SIZ_8B) {
      targetSize = G_IM_SIZ_4B;
    } else {
      return null;
    }

    const textureAddress = bufReadU32BE(this.source, textureCommand + 4);
    if (!this.isLocalAddress(textureAddress)) {
      return null;
    }

    const textureByteLength = this.textureByteLength(textureCommand, end);
    const sourceBpp = [4, 8, 16, 32][sourceSize];

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
      const rowBits = line * 64;
      if (line === 0 || rowBits % sourceBpp !== 0) {
        return null;
      }
      width = rowBits / sourceBpp;
      const pixels = Math.floor((textureByteLength * 8) / sourceBpp);
      if (width === 0 || pixels % width !== 0) {
        return null;
      }
      height = pixels / width;
    }

    if (width <= 0 || height <= 0 || !Number.isInteger(width) || !Number.isInteger(height)) {
      return null;
    }

    const expectedSourceBytes = Math.ceil((width * height * sourceBpp) / 8);
    if (expectedSourceBytes !== textureByteLength) {
      return null;
    }

    return {
      listOffset,
      textureCommand,
      loadBlockCommand,
      renderTileCommand,
      tileSizeCommand,
      textureAddress,
      textureByteLength,
      format,
      sourceSize,
      targetSize,
      width,
      height,
    };
  }

  private calcDxt(width: number, bpp: number) {
    const words = Math.max(1, Math.floor((width * bpp) / 64));
    return clamp(Math.floor((0x800 + words - 1) / words), 0, 0xfff);
  }

  private rewriteDirectTexturePair(pair: DirectTexturePair, byteLength: number) {
    const targetBpp = [4, 8, 16, 32][pair.targetSize];
    const loadUnits16 = Math.max(1, Math.ceil(byteLength / 2));
    const newLrs = loadUnits16 - 1;
    const newDxt = this.calcDxt(pair.width, targetBpp);

    const oldLoad = bufReadU32BE(this.source, pair.loadBlockCommand + 4);
    bufWriteU32BE(
        this.source,
        pair.loadBlockCommand + 4,
        (oldLoad & 0xff000000) | ((newLrs & 0xfff) << 12) | (newDxt & 0xfff),
    );

    const oldRender0 = bufReadU32BE(this.source, pair.renderTileCommand);
    const line = Math.max(1, Math.ceil((pair.width * targetBpp) / 64)) & 0x1ff;
    bufWriteU32BE(
        this.source,
        pair.renderTileCommand,
        (oldRender0 & ~((3 << 19) | (0x1ff << 9))) |
        ((pair.targetSize & 3) << 19) |
        (line << 9),
    );
  }

  private reduceDirectTexture(pair: DirectTexturePair): Uint8Array {
    const offset = this.segmentOffset(pair.textureAddress);
    const pixels = pair.width * pair.height;

    if (pair.format === G_IM_FMT_IA && pair.sourceSize === G_IM_SIZ_16B) {
      const out = new Uint8Array(pixels);
      for (let i = 0; i < pixels; ++i) {
        const intensity = this.source[offset + i * 2];
        const alpha = this.source[offset + i * 2 + 1];
        out[i] = (intensity & 0xf0) | (alpha >>> 4);
      }
      return out;
    }

    const out = new Uint8Array(Math.ceil(pixels / 2));
    for (let i = 0; i < pixels; i += 2) {
      const encode = (value: number) => {
        if (pair.format === G_IM_FMT_IA) {
          const intensity3 = (value >>> 5) & 0x07;
          const alpha1 = (value & 0x0f) >= 8 ? 1 : 0;
          return (intensity3 << 1) | alpha1;
        }
        return (value >>> 4) & 0x0f;
      };
      const hi = encode(this.source[offset + i]);
      const lo = i + 1 < pixels ? encode(this.source[offset + i + 1]) : 0;
      out[i >>> 1] = (hi << 4) | lo;
    }
    return out;
  }

  private markListProtected(offset: number) {
    if (this.protectedLists.has(offset)) {
      return;
    }

    this.protectedLists.add(offset);
    for (const child of this.listChildren.get(offset) ?? []) {
      this.visitDisplayList(child, true, false, false);
    }
  }

  private markListDimensionProtected(offset: number) {
    if (this.dimensionProtectedLists.has(offset)) {
      return;
    }

    this.dimensionProtectedLists.add(offset);
    for (const child of this.listChildren.get(offset) ?? []) {
      this.visitDisplayList(child, false, true, false);
    }
  }

  private markListGeometryProtected(offset: number) {
    if (this.geometryProtectedLists.has(offset)) {
      return;
    }

    this.geometryProtectedLists.add(offset);
    for (const child of this.listChildren.get(offset) ?? []) {
      this.visitDisplayList(child, false, false, true);
    }
  }

  private visitDisplayList(
      address: number,
      preserveCi8: boolean,
      preserveTextureDimensions: boolean,
      preserveGeometry: boolean,
  ) {
    if (!this.isLocalAddress(address)) {
      return;
    }

    const offset = this.segmentOffset(address);
    if (this.seenLists.has(offset)) {
      if (preserveCi8) {
        this.markListProtected(offset);
      }
      if (preserveTextureDimensions) {
        this.markListDimensionProtected(offset);
      }
      if (preserveGeometry) {
        this.markListGeometryProtected(offset);
      }
      return;
    }

    this.seenLists.add(offset);
    if (preserveCi8) {
      this.protectedLists.add(offset);
    }
    if (preserveTextureDimensions) {
      this.dimensionProtectedLists.add(offset);
    }
    if (preserveGeometry) {
      this.geometryProtectedLists.add(offset);
    }

    const size = this.displayListSize(address);
    this.addRange(address, size, 'list');

    const children: number[] = [];
    const end = offset + size;

    for (let command = offset; command < end; command += 8) {
      const word = bufReadU32BE(this.source, command);
      const op = word >>> 24;
      const target = bufReadU32BE(this.source, command + 4);

      if (op === 0x01 && this.isLocalAddress(target)) {
        const count = (word >>> 12) & 0xff;
        const vend = (word >>> 1) & 0x7f;
        const v0 = vend - count;
        if (count <= 0 || count > 32 || v0 < 0 || v0 + count > 32) {
          throw new Error(`Invalid G_VTX at 0x${command.toString(16)}`);
        }
        this.vertexReferences.push({
          listOffset: offset,
          commandOffset: command,
          address: target,
          count,
          v0,
        });
        continue;
      }

      if (op === 0xda && this.isLocalAddress(target)) {
        this.addRange(target, 0x40, 'matrix');
        continue;
      }

      if (op === 0xde) {
        this.listsWithCalls.add(offset);
        if (this.isLocalAddress(target)) {
          children.push(target);
          this.visitDisplayList(target, preserveCi8, preserveTextureDimensions, preserveGeometry);
        }
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

        const directPair = this.tryParseDirectTexturePair(offset, command, end);
        if (directPair !== null) {
          this.directTexturePairs.push(directPair);
        }

        const standardPair = this.tryParseStandardTexturePair(offset, command, end);
        if (standardPair !== null) {
          this.standardTexturePairs.push(standardPair);
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

  private nibbleAt(data: Uint8Array, pixel: number) {
    const value = data[pixel >>> 1];
    return (pixel & 1) === 0 ? (value >>> 4) & 0x0f : value & 0x0f;
  }

  private setNibble(data: Uint8Array, pixel: number, value: number) {
    const index = pixel >>> 1;
    if ((pixel & 1) === 0) {
      data[index] = ((value & 0x0f) << 4) | (data[index] & 0x0f);
    } else {
      data[index] = (data[index] & 0xf0) | (value & 0x0f);
    }
  }

  private downsampleNearest(
      address: number,
      format: number,
      size: number,
      width: number,
      height: number,
      levels: number,
  ) {
    const factor = 1 << levels;
    const newWidth = width / factor;
    const newHeight = height / factor;
    if (!Number.isInteger(newWidth) || !Number.isInteger(newHeight) || newWidth < 1 || newHeight < 1) {
      return null;
    }

    const bpp = [4, 8, 16, 32][size];
    const sourceBytes = Math.ceil((width * height * bpp) / 8);
    const outputBytes = Math.ceil((newWidth * newHeight * bpp) / 8);
    const offset = this.segmentOffset(address);
    if (offset + sourceBytes > this.source.length || outputBytes >= sourceBytes) {
      return null;
    }

    const input = new Uint8Array(this.source.subarray(offset, offset + sourceBytes));
    const output = new Uint8Array(outputBytes);

    for (let y = 0; y < newHeight; ++y) {
      for (let x = 0; x < newWidth; ++x) {
        const srcPixel = (y * factor) * width + (x * factor);
        const dstPixel = y * newWidth + x;

        if (size === G_IM_SIZ_4B) {
          this.setNibble(output, dstPixel, this.nibbleAt(input, srcPixel));
        } else if (size === G_IM_SIZ_8B) {
          output[dstPixel] = input[srcPixel];
        } else if (size === G_IM_SIZ_16B) {
          output[dstPixel * 2] = input[srcPixel * 2];
          output[dstPixel * 2 + 1] = input[srcPixel * 2 + 1];
        } else {
          /* RGBA32 and other 32-bit player textures are left untouched. */
          return null;
        }
      }
    }

    return { data: output, newWidth, newHeight, bpp };
  }

  private shiftedTileWord(word: number, levels: number) {
    const maskT = (word >>> 14) & 0x0f;
    const shiftT = (word >>> 10) & 0x0f;
    const maskS = (word >>> 4) & 0x0f;
    const shiftS = word & 0x0f;

    /* Values above 10 are the special left-shift encoding. Don't guess. */
    if (shiftS > 10 - levels || shiftT > 10 - levels) {
      return null;
    }

    const newMaskT = maskT === 0 ? 0 : Math.max(0, maskT - levels);
    const newMaskS = maskS === 0 ? 0 : Math.max(0, maskS - levels);
    const newShiftT = shiftT + levels;
    const newShiftS = shiftS + levels;

    return (
        (word & ~((0x0f << 14) | (0x0f << 10) | (0x0f << 4) | 0x0f)) |
        (newMaskT << 14) |
        (newShiftT << 10) |
        (newMaskS << 4) |
        newShiftS
    ) >>> 0;
  }

  private rewriteDownsampledPair(
      pair: StandardTexturePair,
      width: number,
      height: number,
      byteLength: number,
      size: number,
      levels: number,
  ) {
    const bpp = [4, 8, 16, 32][size];
    const loadUnits16 = Math.max(1, Math.ceil(byteLength / 2));
    const oldLoad = bufReadU32BE(this.source, pair.loadBlockCommand + 4);
    bufWriteU32BE(
        this.source,
        pair.loadBlockCommand + 4,
        (oldLoad & 0xff000000) |
        (((loadUnits16 - 1) & 0xfff) << 12) |
        (this.calcDxt(width, bpp) & 0xfff),
    );

    const oldRender0 = bufReadU32BE(this.source, pair.renderTileCommand);
    const line = Math.max(1, Math.ceil((width * bpp) / 64)) & 0x1ff;
    bufWriteU32BE(
        this.source,
        pair.renderTileCommand,
        (oldRender0 & ~(0x1ff << 9)) | (line << 9),
    );

    const oldRender1 = bufReadU32BE(this.source, pair.renderTileCommand + 4);
    const shifted = this.shiftedTileWord(oldRender1, levels);
    if (shifted === null) {
      return false;
    }
    bufWriteU32BE(this.source, pair.renderTileCommand + 4, shifted);

    if (pair.tileSizeCommand !== null) {
      const oldSize1 = bufReadU32BE(this.source, pair.tileSizeCommand + 4);
      const rawWidth = ((width - 1) << 2) & 0xfff;
      const rawHeight = ((height - 1) << 2) & 0xfff;
      bufWriteU32BE(
          this.source,
          pair.tileSizeCommand + 4,
          (oldSize1 & 0xff000000) | (rawWidth << 12) | rawHeight,
      );
    }
    return true;
  }

  private readS16BE(offset: number) {
    const value = readU16BE(this.source, offset);
    return (value & 0x8000) !== 0 ? value - 0x10000 : value;
  }

  private rewriteTriangleWord(word: number, indices: readonly number[]) {
    const mask = ((0x7f << 17) | (0x7f << 9) | (0x7f << 1)) >>> 0;
    return (
      (word & ~mask) |
      ((indices[0] & 0x7f) << 17) |
      ((indices[1] & 0x7f) << 9) |
      ((indices[2] & 0x7f) << 1)
    ) >>> 0;
  }

  /**
   * Emergency lossy geometry compaction for leaf display lists.
   *
   * N64 vertices are fixed at 16 bytes, so texture pressure cannot reclaim
   * geometry RAM. This pass merges nearby vertices inside each G_VTX load,
   * keeps one original vertex as the representative, and rewrites TRI1/TRI2
   * cache indices to that representative. G_VTX starts are not moved, only
   * counts shrink, so later cache-overwrite behavior remains conservative.
   *
   * Lists that call another display list, use unusual vertex-dependent GBI,
   * share/overlap a vertex block, or are explicitly protected are left alone.
   */
  private finalizeGeometry() {
    if (this.geometryFinalized) {
      return;
    }
    this.geometryFinalized = true;

    const step = this.options.geometryPositionStep;
    if (step <= 0) {
      for (const ref of this.vertexReferences) {
        this.addRange(ref.address, ref.count * 16, 'vertex');
      }
      return;
    }

    const refsByList = new Map<number, VertexReference[]>();
    for (const ref of this.vertexReferences) {
      const list = refsByList.get(ref.listOffset) ?? [];
      list.push(ref);
      refsByList.set(ref.listOffset, list);
    }

    /* Mutating a shared vertex source would affect another load. */
    const unsafeRefs = new Set<VertexReference>();
    for (let i = 0; i < this.vertexReferences.length; ++i) {
      const a = this.vertexReferences[i];
      const aStart = this.segmentOffset(a.address);
      const aEnd = aStart + a.count * 16;
      for (let j = i + 1; j < this.vertexReferences.length; ++j) {
        const b = this.vertexReferences[j];
        const bStart = this.segmentOffset(b.address);
        const bEnd = bStart + b.count * 16;
        if (aStart < bEnd && bStart < aEnd) {
          unsafeRefs.add(a);
          unsafeRefs.add(b);
        }
      }
    }

    for (const [listOffset, refs] of refsByList) {
      if (this.geometryProtectedLists.has(listOffset) || this.listsWithCalls.has(listOffset)) {
        continue;
      }

      const listSize = this.listSizes.get(listOffset);
      if (listSize === undefined) {
        continue;
      }

      const refByCommand = new Map(refs.map((ref) => [ref.commandOffset, ref]));
      let unsupported = false;
      for (let command = listOffset; command < listOffset + listSize; command += 8) {
        const op = this.source[command];
        /* MODIFYVTX/CULLDL/BRANCH_Z/QUAD/LINE3D make cache remapping risky. */
        if (op === 0x02 || op === 0x03 || op === 0x04 || op === 0x07 || op === 0x08 || op === 0xb1 || op === 0xbf) {
          unsupported = true;
          break;
        }
      }
      if (unsupported) {
        continue;
      }

      type GeometryMap = {
        ref: VertexReference;
        sourceToCompact: number[];
        representatives: number[];
      };
      const geometryMaps = new Map<VertexReference, GeometryMap>();

      for (const ref of refs) {
        const start = this.segmentOffset(ref.address);
        if (unsafeRefs.has(ref) || start < this.preserveBefore || start + ref.count * 16 > this.source.length) {
          continue;
        }

        const keyToIndex = new Map<string, number>();
        const sourceToCompact = new Array<number>(ref.count);
        const representatives: number[] = [];

        for (let i = 0; i < ref.count; ++i) {
          const vertex = start + i * 16;
          const x = this.readS16BE(vertex + 0);
          const y = this.readS16BE(vertex + 2);
          const z = this.readS16BE(vertex + 4);
          const key = `${Math.round(x / step)},${Math.round(y / step)},${Math.round(z / step)}`;
          let compact = keyToIndex.get(key);
          if (compact === undefined) {
            compact = representatives.length;
            keyToIndex.set(key, compact);
            representatives.push(i);
          }
          sourceToCompact[i] = compact;
        }

        if (representatives.length < ref.count) {
          geometryMaps.set(ref, { ref, sourceToCompact, representatives });
        }
      }

      if (geometryMaps.size === 0) {
        continue;
      }

      /* Build triangle patches from the ORIGINAL cache ownership. */
      const cache: Array<{ ref: VertexReference; sourceIndex: number } | null> = new Array(32).fill(null);
      const trianglePatches: Array<{ offset: number; value: number }> = [];
      let valid = true;

      const remapIndex = (index: number) => {
        const owner = cache[index];
        if (!owner) {
          valid = false;
          return index;
        }
        const map = geometryMaps.get(owner.ref);
        if (!map) {
          return index;
        }
        return owner.ref.v0 + map.sourceToCompact[owner.sourceIndex];
      };

      for (let command = listOffset; command < listOffset + listSize; command += 8) {
        const word0 = bufReadU32BE(this.source, command);
        const op = word0 >>> 24;
        if (op === 0x01) {
          const ref = refByCommand.get(command);
          if (!ref) {
            valid = false;
            break;
          }
          for (let i = 0; i < ref.count; ++i) {
            cache[ref.v0 + i] = { ref, sourceIndex: i };
          }
          continue;
        }

        if (op === 0x05) {
          const indices = [
            (word0 >>> 17) & 0x7f,
            (word0 >>> 9) & 0x7f,
            (word0 >>> 1) & 0x7f,
          ];
          if (indices.some((index) => index >= 32)) {
            valid = false;
            break;
          }
          trianglePatches.push({
            offset: command,
            value: this.rewriteTriangleWord(word0, indices.map(remapIndex)),
          });
          continue;
        }

        if (op === 0x06) {
          const word1 = bufReadU32BE(this.source, command + 4);
          const first = [
            (word0 >>> 17) & 0x7f,
            (word0 >>> 9) & 0x7f,
            (word0 >>> 1) & 0x7f,
          ];
          const second = [
            (word1 >>> 17) & 0x7f,
            (word1 >>> 9) & 0x7f,
            (word1 >>> 1) & 0x7f,
          ];
          if ([...first, ...second].some((index) => index >= 32)) {
            valid = false;
            break;
          }
          trianglePatches.push(
              { offset: command, value: this.rewriteTriangleWord(word0, first.map(remapIndex)) },
              { offset: command + 4, value: this.rewriteTriangleWord(word1, second.map(remapIndex)) },
          );
        }
      }

      if (!valid) {
        continue;
      }

      let listChanged = false;
      for (const map of geometryMaps.values()) {
        const ref = map.ref;
        const oldCount = ref.count;
        const newCount = map.representatives.length;
        if (newCount >= oldCount) {
          continue;
        }

        const start = this.segmentOffset(ref.address);
        const snapshot = new Uint8Array(this.source.subarray(start, start + oldCount * 16));
        for (let i = 0; i < newCount; ++i) {
          const sourceIndex = map.representatives[i];
          this.source.set(snapshot.subarray(sourceIndex * 16, sourceIndex * 16 + 16), start + i * 16);
        }

        const word = bufReadU32BE(this.source, ref.commandOffset);
        const fieldMask = ((0xff << 12) | (0x7f << 1)) >>> 0;
        const vend = ref.v0 + newCount;
        bufWriteU32BE(
            this.source,
            ref.commandOffset,
            ((word & ~fieldMask) | ((newCount & 0xff) << 12) | ((vend & 0x7f) << 1)) >>> 0,
        );

        this.vertexBytesSaved += (oldCount - newCount) * 16;
        this.geometryMergedVertexCount += oldCount - newCount;
        ref.count = newCount;
        listChanged = true;
      }

      if (listChanged) {
        for (const patch of trianglePatches) {
          bufWriteU32BE(this.source, patch.offset, patch.value);
        }
        this.geometryCompactedLists.add(listOffset);
      }
    }

    for (const ref of this.vertexReferences) {
      this.addRange(ref.address, ref.count * 16, 'vertex');
    }
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
        const textureOffset = this.segmentOffset(pair.textureAddress);
        const paletteOffset = this.segmentOffset(pair.paletteAddress);
        if (
            textureOffset < this.preserveBefore ||
            paletteOffset < this.preserveBefore ||
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
        this.textureBytesSaved += 0x1e0;

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
          this.ci4TextureCount++;
          this.textureBytesSaved += Math.max(0, pair.textureByteLength - packedSize);
        }

        for (const pair of pairs) {
          this.rewriteCi8PairAsCi4(pair);
        }
      }
    }

    if (this.options.reduceIntensityTextures) {
      const pairByCommand = new Map<number, DirectTexturePair>();
      for (const pair of this.directTexturePairs) {
        pairByCommand.set(pair.textureCommand, pair);
      }

      const unsafe = new Set<number>();
      for (const ref of this.textureReferences) {
        const pair = pairByCommand.get(ref.commandOffset);
        if (!pair || pair.textureAddress !== ref.address) {
          if (!this.ci8Pairs.some(ci => ci.textureCommand === ref.commandOffset)) {
            unsafe.add(ref.address);
          }
        }
      }

      const groups = new Map<number, DirectTexturePair[]>();
      for (const pair of this.directTexturePairs) {
        if (unsafe.has(pair.textureAddress)) {
          continue;
        }
        const group = groups.get(pair.textureAddress) ?? [];
        group.push(pair);
        groups.set(pair.textureAddress, group);
      }

      for (const [address, pairs] of groups) {
        if (this.segmentOffset(address) < this.preserveBefore) {
          continue;
        }
        /* A protected root is expected to remain visually exact. CI8 and
         * downsampling already honor root protection; do the same for IA/I
         * reductions so imported equipment cannot be altered by a pressure
         * pass. */
        if (this.textureReferences.some(ref =>
            ref.address === address &&
            (this.protectedLists.has(ref.listOffset) ||
             this.dimensionProtectedLists.has(ref.listOffset)))) {
          continue;
        }
        const first = pairs[0];
        if (!pairs.every(pair =>
            pair.format === first.format &&
            pair.sourceSize === first.sourceSize &&
            pair.targetSize === first.targetSize &&
            pair.width === first.width &&
            pair.height === first.height &&
            pair.textureByteLength === first.textureByteLength
        )) {
          continue;
        }

        const offset = this.segmentOffset(address);
        if (offset + first.textureByteLength > this.source.length) {
          continue;
        }

        const reduced = this.reduceDirectTexture(first);
        if (reduced.length >= first.textureByteLength) {
          continue;
        }

        this.source.set(reduced, offset);
        textureSizes.set(address, reduced.length);
        this.reducedIntensityTextureCount++;
        this.textureBytesSaved += first.textureByteLength - reduced.length;
        for (const pair of pairs) {
          this.rewriteDirectTexturePair(pair, reduced.length);
        }
      }
    }

    if (this.options.downsampleTextureLevels > 0) {
      const byCommand = new Map<number, StandardTexturePair>();
      for (const pair of this.standardTexturePairs) {
        byCommand.set(pair.textureCommand, pair);
      }

      const unsafe = new Set<number>();
      for (const ref of this.textureReferences) {
        const pair = byCommand.get(ref.commandOffset);
        if (!pair || pair.textureAddress !== ref.address) {
          unsafe.add(ref.address);
        }
      }

      const groups = new Map<number, StandardTexturePair[]>();
      for (const pair of this.standardTexturePairs) {
        if (unsafe.has(pair.textureAddress)) {
          continue;
        }
        const group = groups.get(pair.textureAddress) ?? [];
        group.push(pair);
        groups.set(pair.textureAddress, group);
      }

      type DownsampleCandidate = {
        address: number;
        pairs: StandardTexturePair[];
        size: number;
        currentBytes: number;
        reduced: { data: Uint8Array; newWidth: number; newHeight: number; bpp: number };
        savings: number;
      };
      const candidates: DownsampleCandidate[] = [];

      for (const [address, pairs] of groups) {
        if (this.segmentOffset(address) < this.preserveBefore) {
          continue;
        }
        if (this.textureReferences.some(ref =>
            ref.address === address && this.dimensionProtectedLists.has(ref.listOffset))) {
          continue;
        }

        const first = pairs[0];
        if (!pairs.every(pair => pair.width === first.width && pair.height === first.height)) {
          continue;
        }

        const renderWords = pairs.map(pair => bufReadU32BE(this.source, pair.renderTileCommand));
        const format = (renderWords[0] >>> 21) & 7;
        const size = (renderWords[0] >>> 19) & 3;
        if (!renderWords.every(word => ((word >>> 21) & 7) === format && ((word >>> 19) & 3) === size)) {
          continue;
        }
        if (![G_IM_FMT_RGBA, G_IM_FMT_CI, G_IM_FMT_IA, G_IM_FMT_I].includes(format)) {
          continue;
        }
        if (format === G_IM_FMT_RGBA && size !== G_IM_SIZ_16B) {
          continue;
        }
        if (size === 3) {
          continue;
        }

        const currentBytes = textureSizes.get(address) ?? first.textureByteLength;
        if (currentBytes < this.options.downsampleMinBytes) {
          continue;
        }

        const factor = 1 << this.options.downsampleTextureLevels;
        if (
            first.width % factor !== 0 || first.height % factor !== 0 ||
            first.width / factor < this.options.downsampleMinDimension ||
            first.height / factor < this.options.downsampleMinDimension
        ) {
          continue;
        }

        /* Verify all tile shifts can be compensated before mutating the texture. */
        if (pairs.some(pair =>
            this.shiftedTileWord(
                bufReadU32BE(this.source, pair.renderTileCommand + 4),
                this.options.downsampleTextureLevels,
            ) === null
        )) {
          continue;
        }

        const reduced = this.downsampleNearest(
            address,
            format,
            size,
            first.width,
            first.height,
            this.options.downsampleTextureLevels,
        );
        if (!reduced || reduced.data.length >= currentBytes) {
          continue;
        }

        candidates.push({
          address,
          pairs,
          size,
          currentBytes,
          reduced,
          savings: currentBytes - reduced.data.length,
        });
      }
      candidates.sort((a, b) => b.savings - a.savings || b.currentBytes - a.currentBytes || a.address - b.address);
      let selectedSavings = 0;
      for (const candidate of candidates) {
        if (
            this.options.downsampleTargetBytesToSave > 0 &&
            selectedSavings >= this.options.downsampleTargetBytesToSave
        ) {
          break;
        }

        const { address, pairs, size, currentBytes, reduced, savings } = candidate;
        const offset = this.segmentOffset(address);
        this.source.set(reduced.data, offset);
        textureSizes.set(address, reduced.data.length);
        for (const pair of pairs) {
          this.rewriteDownsampledPair(
              pair,
              reduced.newWidth,
              reduced.newHeight,
              reduced.data.length,
              size,
              this.options.downsampleTextureLevels,
          );
        }
        this.downsampledTextureCount++;
        this.textureBytesSaved += savings;
        selectedSavings += savings;
      }
    }
    for (const ref of this.textureReferences) {
      this.addRange(
          ref.address,
          textureSizes.get(ref.address) ?? ref.byteLength,
          'texture',
      );
    }
    for (const ref of this.paletteReferences) {
      this.addRange(
          ref.address,
          paletteSizes.get(ref.address) ?? ref.count * 2,
          'palette',
      );
    }
  }

  private rangeKey(range: ByteRange) {
    return `${range.start}:${range.end}`;
  }

  private hashRange(start: number, end: number) {
    let hash = 0x811c9dc5;
    for (let i = start; i < end; ++i) {
      hash ^= this.source[i];
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash >>> 0;
  }

  private equalRange(aStart: number, bStart: number, size: number) {
    for (let i = 0; i < size; ++i) {
      if (this.source[aStart + i] !== this.source[bStart + i]) {
        return false;
      }
    }
    return true;
  }

  private buildAliases() {
    const aliases: AliasRange[] = [];
    if (!this.options.deduplicate) {
      return aliases;
    }
    const unique = new Map<string, DedupeRange>();
    for (const candidate of this.dedupeCandidates) {
      const key = `${candidate.kind}:${candidate.start}:${candidate.end}`;
      if (!unique.has(key)) {
        unique.set(key, candidate);
      }
    }

    const groups = new Map<string, DedupeRange[]>();
    for (const candidate of unique.values()) {
      const size = candidate.end - candidate.start;
      if (size <= 0) {
        continue;
      }
      const hash = this.hashRange(candidate.start, candidate.end);
      const key = `${candidate.kind}:${size}:${hash}`;
      const group = groups.get(key) ?? [];
      group.push(candidate);
      groups.set(key, group);
    }

    for (const group of groups.values()) {
      if (group.length < 2) {
        continue;
      }
      group.sort((a, b) => {
        const aFixed = a.start < this.preserveBefore ? 0 : 1;
        const bFixed = b.start < this.preserveBefore ? 0 : 1;
        return aFixed - bFixed || a.start - b.start || a.end - b.end;
      });

      const canonicals: DedupeRange[] = [];

      for (const candidate of group) {
        const size = candidate.end - candidate.start;
        let canonical: DedupeRange | undefined;

        for (const existing of canonicals) {
          if (this.equalRange(candidate.start, existing.start, size)) {
            canonical = existing;
            break;
          }
        }

        if (!canonical) {
          canonicals.push(candidate);
          continue;
        }

        if (candidate.start === canonical.start) {
          continue;
        }

        aliases.push({
          ...candidate,
          canonicalStart: canonical.start,
        });
      }
    }

    aliases.sort((a, b) => a.start - b.start || a.end - b.end);
    return aliases;
  }

  private mergeRanges(ranges: ByteRange[], mergeAdjacent = true) {
    const sorted = ranges
        .filter((range) => range.end > range.start)
        .sort((a, b) => a.start - b.start || a.end - b.end);

    const merged: ByteRange[] = [];
    for (const range of sorted) {
      const last = merged[merged.length - 1];

      const separated = mergeAdjacent
          ? range.start > (last?.end ?? -1)
          : range.start >= (last?.end ?? -1);

      if (!last || separated) {
        merged.push({ ...range });
      } else if (range.end > last.end) {
        last.end = range.end;
      }
    }
    return merged;
  }

  private clippedPreservedOccupancy(
      aliases: AliasRange[],
      outBase: number,
  ) {
    const aliasedKeys = new Set(aliases.map((alias) => this.rangeKey(alias)));

    const occupied: ByteRange[] = [];
    for (const range of this.ranges) {
      if (aliasedKeys.has(this.rangeKey(range))) {
        continue;
      }
      if (range.start >= outBase || range.end <= 0) {
        continue;
      }
      occupied.push({
        start: Math.max(0, range.start),
        end: Math.min(outBase, range.end),
      });
    }

    for (const range of this.options.reservedPreservedRanges) {
      if (range.start >= outBase || range.end <= 0) {
        continue;
      }
      occupied.push({
        start: Math.max(0, range.start),
        end: Math.min(outBase, range.end),
      });
    }

    return this.mergeRanges(occupied);
  }

  private buildHoles(occupied: ByteRange[], outBase: number) {
    const holes: ByteRange[] = [];
    let cursor = 0;

    for (const range of occupied) {
      if (cursor < range.start) {
        const start = align16(cursor);
        const end = range.start;
        if (end > start) {
          holes.push({ start, end });
        }
      }
      cursor = Math.max(cursor, range.end);
    }

    if (cursor < outBase) {
      const start = align16(cursor);
      if (outBase > start) {
        holes.push({ start, end: outBase });
      }
    }

    return holes;
  }

  build(outBase: number): PlayerModelGraphBuild {
    this.finalizeGeometry();
    this.finalizeImages();

    const aliases = this.buildAliases();
    const aliasByExactStart = new Map<number, AliasRange>();
    const listAliases: AliasRange[] = [];
    const aliasedKeys = new Set<string>();

    let deduplicatedBytes = 0;
    for (const alias of aliases) {
      const previous = aliasByExactStart.get(alias.start);
      if (!previous ||
          (previous.end - previous.start) <= (alias.end - alias.start)) {
        aliasByExactStart.set(alias.start, alias);
      }
      if (alias.kind === 'list') {
        listAliases.push(alias);
      }
      aliasedKeys.add(this.rangeKey(alias));
      if (alias.start >= this.preserveBefore) {
        deduplicatedBytes += alias.end - alias.start;
      }
    }

    const activeRanges = this.ranges.filter(
        (range) => !aliasedKeys.has(this.rangeKey(range)),
    );

    const movable = this.mergeRanges(
        activeRanges
            .filter((range) => range.end > this.preserveBefore)
            .map((range) => ({
              start: Math.max(range.start, this.preserveBefore),
              end: range.end,
            })),
        !this.options.packIntoPreservedHoles,
    );

    const placements = new Map<number, number>();
    let holePackedBytes = 0;

    if (this.options.packIntoPreservedHoles && outBase > 0) {
      const occupied = this.clippedPreservedOccupancy(aliases, outBase);
      const holes = this.buildHoles(occupied, outBase);
      const bySize = movable.slice().sort((a, b) => {
        const sizeA = a.end - a.start;
        const sizeB = b.end - b.start;
        return sizeB - sizeA || a.start - b.start;
      });

      for (const range of bySize) {
        const size = range.end - range.start;

        for (let i = 0; i < holes.length; ++i) {
          const hole = holes[i];
          const mappedStart = align16(hole.start);
          if (mappedStart + size > hole.end) {
            continue;
          }

          placements.set(range.start, mappedStart);
          holePackedBytes += size;

          const remainingStart = align16(mappedStart + size);
          if (remainingStart < hole.end) {
            holes[i] = { start: remainingStart, end: hole.end };
          } else {
            holes.splice(i, 1);
          }
          break;
        }
      }
    }

    const mapped: MappedRange[] = [];
    let cursor = outBase;

    for (const range of movable) {
      const holeStart = placements.get(range.start);
      if (holeStart !== undefined) {
        mapped.push({ ...range, mappedStart: holeStart });
        continue;
      }

      cursor = align16(cursor);
      mapped.push({ ...range, mappedStart: cursor });
      cursor += range.end - range.start;
    }
    cursor = align16(cursor);

    const data = new Uint8Array(Math.max(0, cursor - outBase));
    const fixedDataPatches: PlayerModelDataPatch[] = [];
    for (const range of this.mergeRanges(
        activeRanges
            .filter((range) => range.start < outBase && range.end > 0)
            .map((range) => ({
              start: Math.max(0, range.start),
              end: Math.min(outBase, range.end),
            })),
    )) {
      fixedDataPatches.push({
        offset: range.start,
        data: new Uint8Array(this.source.subarray(range.start, range.end)),
      });
    }

    for (const range of mapped) {
      const bytes = this.source.subarray(range.start, range.end);
      if (range.mappedStart < outBase) {
        fixedDataPatches.push({
          offset: range.mappedStart,
          data: new Uint8Array(bytes),
        });
      } else {
        data.set(bytes, range.mappedStart - outBase);
      }
    }

    const aliasForListInterior = (offset: number) => {
      for (const alias of listAliases) {
        if (alias.start <= offset && offset < alias.end) {
          return alias.canonicalStart + (offset - alias.start);
        }
      }
      return offset;
    };

    const mapOffset = (inputOffset: number): number => {
      const exactAlias = aliasByExactStart.get(inputOffset);
      if (exactAlias) {
        return mapOffset(exactAlias.canonicalStart);
      }
      const listOffset = aliasForListInterior(inputOffset);
      if (listOffset !== inputOffset) {
        return mapOffset(listOffset);
      }

      if (inputOffset < this.preserveBefore) {
        return inputOffset;
      }

      for (const range of mapped) {
        if (range.start <= inputOffset && inputOffset < range.end) {
          return range.mappedStart + (inputOffset - range.start);
        }
      }

      throw new Error(
          `Reachable player-model data at 0x${inputOffset.toString(16)} was not packed`,
      );
    };

    const mapAddress = (address: number) => {
      if (!this.isLocalAddress(address)) {
        return address;
      }
      return (this.options.segment << 24) | mapOffset(this.segmentOffset(address));
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
        const mappedCommand = mapOffset(command);

        if (newTarget === oldTarget && mappedCommand === command) {
          continue;
        }

        if (mappedCommand < outBase) {
          fixedPointerPatches.push({
            offset: mappedCommand + 4,
            value: newTarget,
          });
        } else {
          bufWriteU32BE(data, mappedCommand - outBase + 4, newTarget);
        }
      }
    }

    return {
      data,
      fixedDataPatches,
      fixedPointerPatches,
      stats: {
        deduplicatedBytes,
        holePackedBytes,
        ci4TextureCount: this.ci4TextureCount,
        reducedIntensityTextureCount: this.reducedIntensityTextureCount,
        downsampledTextureCount: this.downsampledTextureCount,
        textureBytesSaved: this.textureBytesSaved,
        vertexBytesSaved: this.vertexBytesSaved,
        geometryMergedVertexCount: this.geometryMergedVertexCount,
        geometryCompactedListCount: this.geometryCompactedLists.size,
      },
      mapAddress,
    };
  }
}
