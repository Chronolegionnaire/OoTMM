#include <combo.h>

/* Hook into out menu handler */
KaleidoScope_AfterSetCutsorColor_Trampoline:
  lw      a0,0x40(sp)
  lw      s0,0x14(sp)
  lw      s1,0x18(sp)
  j       KaleidoScope_AfterSetCutsorColor
   addiu  sp,0x40

PATCH_START 0x8081c674
  j KaleidoScope_AfterSetCutsorColor_Trampoline
   nop
PATCH_END

KaleidoScope_AfterSetCutsorColor_Mask_Trampoline:
  lw      a0, 0x50(sp)
  lw      s0, 0x18(sp)
  j       KaleidoScope_AfterSetCutsorColor
   addiu  sp, sp, 0x50

PATCH_START 0x80820F94
  j KaleidoScope_AfterSetCutsorColor_Mask_Trampoline
   nop
PATCH_END

/* Relocs */
PATCH_START 0x8082cea4
.int 0
.int 0
PATCH_END

PATCH_START 0x8082cf50
.int 0
.int 0
PATCH_END

PATCH_START 0x8082d8f8
.int 0
PATCH_END

PATCH_START 0x8082d8fc
.int 0
PATCH_END

PATCH_START 0x8082c948
.int 0
PATCH_END

/* Hide dummy sun song from quest screen */
KaleidoScope_HideDummySunSong:
  lui at,0x0002
  not at
  and s3,at
  li at,0x1
  jr ra
    and t8,v1,s3

PATCH_START 0x80816878
  jal  KaleidoScope_HideDummySunSong
   nop
PATCH_END

/*
==================================================================================================
 Handle OoT Hookshot name
==================================================================================================
*/

PATCH_START 0x80824818
  jal KaleidoScope_LoadNamedItemCustom
PATCH_END

PATCH_START 0x808160A0 + 0x1703c
.int 0
PATCH_END

PATCH_START 0x8081c604
  jal   KaleidoScope_ShowItemMessage
PATCH_END

PATCH_START 0x8081c5e4
  jal   KaleidoScope_ShowItemMessage
PATCH_END

PATCH_START 0x80820F00
  jal KaleidoScope_ShowItemMessage
PATCH_END

PATCH_START 0x80820F20
  jal KaleidoScope_ShowItemMessage
PATCH_END

KaleidoScope_LoadIcons_Hook:
  addiu   sp, sp, -0x20
  sw      ra, 0x0014 (sp)

  jal     KaleidoScope_LoadIcons
   addiu  a2, sp, 0x4c

  lw      ra, 0x0014 (sp)
  jr      ra
  addiu   sp, sp, 0x20

/*
Replaces:
  jal   CmpDma_LoadAllFiles
*/
PATCH_START 0x80828ac4
  jal   KaleidoScope_LoadIcons_Hook
PATCH_END

/*
==================================================================================================
 Pause Menu (Select Item subscreen) - Icon Draw
==================================================================================================
*/

KaleidoScope_DrawIconCustom_Hook:
  addiu   sp, sp, -0x20
  sw      ra, 0x001C (sp)

  // Parameter 5 (inventory slot index)
  sw      s1, 0x0010 (sp)

  // Parameter 6 (vertices index for Quadrangle)
  lw      at, 0x0030 (sp)
  sw      at, 0x0014 (sp)

  // Parameter 7 (Vertex buffer index)
  sw      s2, 0x0018 (sp)

  jal     KaleidoScope_DrawIconCustom
  // Overwrite A1 with item Id in V0 (we can calculate A1 with it later)
   or     a1, v0, zero

  lw      ra, 0x001C (sp)

  jr      ra
   addiu  sp, sp, 0x20

/*
Hook draw for item textures on "Select Item" screen.
Replaces:
  jal     KaleidoScope_DrawTexQuadRGBA32
*/
PATCH_START 0x8081BB70
  jal     KaleidoScope_DrawIconCustom_Hook
PATCH_END

/* Remove relocations. */
PATCH_START 0x8082C944
.int 0x00000000 // Removes: 0x44005AD0
PATCH_END

/*
==================================================================================================
 Pause Menu (Select Mask subscreen) - Icon Draw
==================================================================================================
*/

KaleidoScope_DrawMaskCustom_Hook:
  addiu   sp, sp, -0x20
  sw      ra, 0x001C (sp)

  // Parameter 5: unused by KaleidoScope_DrawMaskIconCustom,
  // since it derives the mask slot from vertIdx.
  sw      zero, 0x0010 (sp)

  // Parameter 6: vertices index for Quadrangle
  lw      at, 0x0030 (sp)
  sw      at, 0x0014 (sp)

  // Parameter 7: vertex buffer index
  sw      s4, 0x0018 (sp)

  jal     KaleidoScope_DrawMaskIconCustom
   or     a1, v0, zero

  lw      ra, 0x001C (sp)

  jr      ra
   addiu  sp, sp, 0x20

/*
Hook draw for item textures on "Select Mask" screen.
Replaces:
  jal     KaleidoScope_DrawTexQuadRGBA32
*/
PATCH_START 0x80820458
  jal     KaleidoScope_DrawMaskCustom_Hook
PATCH_END

/* Remove relocations. */
PATCH_START 0x8082cc34
.int 0x00000000 // Removes: 0x4400a3b8
PATCH_END

/* Fast magical arrow */

PATCH_START 0x8081c6d0
  slti at, t8, 0
PATCH_END

PATCH_START 0x8081c6b8
  li t9, 0xff
PATCH_END

PATCH_START 0x8081c6cc
  li t4, 0x1
PATCH_END

PATCH_START 0x8081cb10
  li v1, 0x1
PATCH_END

PATCH_START 0x8081c744
  li t8, 0x5
PATCH_END

PATCH_START 0x80163bc4
  jal   KaleidoScope_UpdateWrapper
   move a1, t9
PATCH_END

PATCH_START 0x808240d0
  li    t9, -0x2b
PATCH_END

PATCH_START 0x80824114
  addiu   v1, v1, 0x16
PATCH_END

PATCH_START 0x80824134
  addiu   v1, v1, 0x40
PATCH_END

PATCH_START 0x80824150
  li    t7, 0x800
PATCH_END

PATCH_START 0x808241e4
  li    a3, 0x40
PATCH_END

PATCH_START 0x808219d4
  nop
PATCH_END

PATCH_START 0x80821a50
  nop
PATCH_END

PATCH_START 0x80821d54
  nop
PATCH_END

PATCH_START 0x808288c4
  nop
PATCH_END

/*
  Long series of patches for shifting magic arrow unique select item ID to allow more custom items
*/

PATCH_START 0x8081B9AA
  .short (0x017A - ((ITEM_MM_CUSTOM_MAX - 0xB5)) * 2) 
PATCH_END

PATCH_START 0x8081B9AE
  .short (0x017A - ((ITEM_MM_CUSTOM_MAX - 0xB5)) * 2) 
PATCH_END

PATCH_START 0x8081B9B6
  .short (0x017A - ((ITEM_MM_CUSTOM_MAX - 0xB5)) * 2) 
PATCH_END

PATCH_START 0x8081C536
  .short ITEM_MM_CUSTOM_MAX
PATCH_END

PATCH_START 0x8081C92E
  .short ITEM_MM_CUSTOM_MAX
PATCH_END

PATCH_START 0x8081CC0A
  .short ITEM_MM_CUSTOM_MAX
PATCH_END

PATCH_START 0x8081CC82
  .short ITEM_MM_CUSTOM_MAX
PATCH_END

PATCH_START 0x8081CDBA
  .short ITEM_MM_CUSTOM_MAX
PATCH_END

PATCH_START 0x8081CE5A
  .short ITEM_MM_CUSTOM_MAX
PATCH_END

PATCH_START 0x8081CED2
  .short ITEM_MM_CUSTOM_MAX
PATCH_END

PATCH_START 0x8081CFEE
  .short ITEM_MM_CUSTOM_MAX
PATCH_END

PATCH_START 0x8081D08E
  .short ITEM_MM_CUSTOM_MAX
PATCH_END

PATCH_START 0x8081D106
  .short ITEM_MM_CUSTOM_MAX
PATCH_END

PATCH_START 0x8081CB6A
  .short ITEM_MM_CUSTOM_MAX
PATCH_END

PATCH_START 0x8081C73A
  .short (0 - (ITEM_MM_CUSTOM_MAX - ITEM_MM_BOW_ARROW_FIRE))
PATCH_END

PATCH_START 0x8081CC32
  .short (0 - (ITEM_MM_CUSTOM_MAX - ITEM_MM_BOW_ARROW_FIRE))
PATCH_END

PATCH_START 0x8081CC9E
  .short (0 - (ITEM_MM_CUSTOM_MAX - ITEM_MM_BOW_ARROW_FIRE))
PATCH_END

PATCH_START 0x8081CDE2
  .short (0 - (ITEM_MM_CUSTOM_MAX - ITEM_MM_BOW_ARROW_FIRE))
PATCH_END

PATCH_START 0x8081CE82
  .short (0 - (ITEM_MM_CUSTOM_MAX - ITEM_MM_BOW_ARROW_FIRE))
PATCH_END

PATCH_START 0x8081CEEE
  .short (0 - (ITEM_MM_CUSTOM_MAX - ITEM_MM_BOW_ARROW_FIRE))
PATCH_END

PATCH_START 0x8081D016
  .short (0 - (ITEM_MM_CUSTOM_MAX - ITEM_MM_BOW_ARROW_FIRE))
PATCH_END

PATCH_START 0x8081D0B6
  .short (0 - (ITEM_MM_CUSTOM_MAX - ITEM_MM_BOW_ARROW_FIRE))
PATCH_END

PATCH_START 0x8081D122
  .short (0 - (ITEM_MM_CUSTOM_MAX - ITEM_MM_BOW_ARROW_FIRE))
PATCH_END

PATCH_START 0x8081CB92
  .short (0 - (ITEM_MM_CUSTOM_MAX - ITEM_MM_BOW_ARROW_FIRE))
PATCH_END

PATCH_START 0x8081CC12
  .short ITEM_MM_CUSTOM_MAX + 3
PATCH_END

PATCH_START 0x8081CC8E
  .short ITEM_MM_CUSTOM_MAX + 3
PATCH_END

PATCH_START 0x8081CDC2
  .short ITEM_MM_CUSTOM_MAX + 3
PATCH_END

PATCH_START 0x8081CE62
  .short ITEM_MM_CUSTOM_MAX + 3
PATCH_END

PATCH_START 0x8081CEDE
  .short ITEM_MM_CUSTOM_MAX + 3
PATCH_END

PATCH_START 0x8081CFF6
  .short ITEM_MM_CUSTOM_MAX + 3
PATCH_END

PATCH_START 0x8081D096
  .short ITEM_MM_CUSTOM_MAX + 3
PATCH_END

PATCH_START 0x8081D112
  .short ITEM_MM_CUSTOM_MAX + 3
PATCH_END

PATCH_START 0x8081CB72
  .short ITEM_MM_CUSTOM_MAX + 3
PATCH_END

/*
==================================================================================================
 MM item equip age gate
==================================================================================================
*/

/*
 * Called from:
 *   8081c2a0: jal KaleidoScope_MmEquipAgeGate_ButtonMask
 *   8081c2a4: nop
 *   8081c2a8: beqz t5,8081c56c
 *   8081c2ac: lbu  v1,0x20(t1)    ; original instruction, branch delay slot
 *
 * Inputs at hook point:
 *   a0 = button press bits loaded from controller
 *   s1 = cursorItem
 *   t1 = vanilla pointer used immediately after the gate
 *
 * Output:
 *   t5 = nonzero to continue into equip logic
 *   t5 = zero to skip equip logic
 */
KaleidoScope_MmEquipAgeGate_ButtonMask:
  addiu   sp, sp, -0x20
  sw      ra, 0x001c(sp)
  sw      a0, 0x0018(sp)
  sw      t1, 0x0014(sp)
  sw      s1, 0x0010(sp)

  /*
   * Preserve vanilla C-button gate first.
   * If no C button was pressed, return t5 = 0 with no error sound.
   */
  andi    t5, a0, 0x0007
  beqz    t5, .L_mm_agegate_restore
   nop

  /*
   * Age check uses cursorItem in s1.
   */
  jal     KaleidoScope_CheckMmSlotAgeReq
   lhu    a0, 0x0268(s0)

  bnez    v0, .L_mm_agegate_allow
   nop

  jal     Audio_PlaySfx
   li     a0, 0x4806

  b       .L_mm_agegate_block
   nop

.L_mm_agegate_allow:
  li      t5, 0x1
  b       .L_mm_agegate_restore
   nop

.L_mm_agegate_block:
  move    t5, zero

.L_mm_agegate_restore:
  lw      s1, 0x0010(sp)
  lw      t1, 0x0014(sp)
  lw      a0, 0x0018(sp)
  lw      ra, 0x001c(sp)
  jr      ra
   addiu  sp, sp, 0x20

/*
 * Patch:
 *   8081c2a0: jal hook
 *   8081c2a4: nop
 *   8081c2a8: beqz t5,8081c56c
 *
 * Branch encoding:
 *   PC      = 0x8081c2a8
 *   PC + 4  = 0x8081c2ac
 *   target  = 0x8081c56c
 *   offset  = (0x8081c56c - 0x8081c2ac) / 4 = 0xb0
 *   beq t5,zero,0xb0 = 0x11a000b0
 *
 * 0x8081c2ac is intentionally not patched; it remains:
 *   lbu v1,0x20(t1)
 * and serves as the branch delay slot.
 */
PATCH_START 0x8081c2a0
  jal     KaleidoScope_MmEquipAgeGate_ButtonMask
   nop
  .int    0x11a000b0
PATCH_END

/*
==================================================================================================
 MM mask equip age gate
==================================================================================================
*/

/*
 * Patch point is after vanilla mask-specific checks have passed,
 * immediately before equipTargetItem/equipTargetSlot/mainState are written.
 *
 * Original:
 *
 *   80820e0c: lhu   t5,0x40(sp)      ; cursorItem
 *   80820e10: lw    t6,0x019c(s0)
 *   80820e14: addiu t8,v1,0x18       ; full mask slot
 *   80820e18: sll   t7,v1,0x2
 *   80820e1c: sh    t5,0x0272(s0)    ; equipTargetItem
 *   80820e20: sh    t8,0x0274(s0)    ; equipTargetSlot
 *
 * Patched:
 *
 *   80820e0c: jal   KaleidoScope_MmMaskEquipAgeGate_Accept
 *   80820e10: nop
 *   80820e14: beqz  t9,80820c50      ; vanilla error path
 *   80820e18: nop
 *
 * The hook replays the overwritten vanilla register setup.
 */

KaleidoScope_MmMaskEquipAgeGate_Accept:
  addiu   sp, sp, -0x30

  sw      ra, 0x002c(sp)
  sw      a0, 0x0028(sp)
  sw      v0, 0x0024(sp)
  sw      v1, 0x0020(sp)
  sw      s0, 0x001c(sp)
  sw      t4, 0x0018(sp)

  /*
   * v1 = mask-local cursorSlot, 0..23.
   * Full inventory slot = v1 + ITEM_NUM_SLOTS = v1 + 0x18.
   */
  jal     KaleidoScope_CheckMmSlotAgeReq
   addiu  a0, v1, 0x0018

  /*
   * Save allow/block result.
   */
  sw      v0, 0x0014(sp)

  /*
   * Restore values that vanilla still needs.
   */
  lw      t4, 0x0018(sp)
  lw      s0, 0x001c(sp)
  lw      v1, 0x0020(sp)
  lw      v0, 0x0024(sp)
  lw      a0, 0x0028(sp)
  lw      ra, 0x002c(sp)

  /*
   * Replay overwritten vanilla setup:
   *
   *   lhu   t5,0x40(original sp)
   *   lw    t6,0x019c(s0)
   *   addiu t8,v1,0x18
   *   sll   t7,v1,0x2
   *
   * Current sp is original sp - 0x30, so original 0x40(sp)
   * is now 0x70(sp).
   */
  lhu     t5, 0x0070(sp)
  lw      t6, 0x019c(s0)
  addiu   t8, v1, 0x0018
  sll     t7, v1, 0x2

  /*
   * Return flag for the inline branch:
   *   t9 = nonzero allow
   *   t9 = zero block
   */
  lw      t9, 0x0014(sp)

  jr      ra
   addiu  sp, sp, 0x30

/*
 * Branch encoding:
 *
 *   branch PC = 0x80820e14
 *   PC + 4   = 0x80820e18
 *   target   = 0x80820c50
 *   offset   = (0x80820c50 - 0x80820e18) / 4 = -0x72
 *
 *   beq t9,zero,-0x72 = 0x1320ff8e
 */
PATCH_START 0x80820e0c
  jal     KaleidoScope_MmMaskEquipAgeGate_Accept
   nop
  .int    0x1320ff8e
  nop
PATCH_END

/*
==================================================================================================
 MM native icon age greying
==================================================================================================
*/

/*
 * Replaces:
 *   80828b14: lbu t9,0x2410(t9)
 *
 * 80828b18 remains:
 *   lui a0,0x801c
 * and becomes the jal delay slot.
 *
 * Inputs:
 *   a2 = itemId
 *   t9 = address base produced by previous vanilla instructions:
 *        0x801c0000 + form/item offset
 *
 * Output:
 *   t9 = formAllowed && ageAllowed
 *
 * Vanilla after return is untouched:
 *   80828b1c: addu  a0,a0,t6
 *   80828b20: bnezl t9,80828b48
 */
KaleidoScope_NativeItemAgeAndFormCheck_Hook:
  addiu   sp, sp, -0x20
  sw      ra, 0x001c(sp)
  sw      a0, 0x0018(sp)
  sw      a2, 0x0014(sp)
  sw      v0, 0x0010(sp)

  /*
   * Replay overwritten vanilla load:
   *   t9 = gPlayerFormItemRestrictions[GET_PLAYER_FORM][itemId]
   */
  lbu     t9, 0x2410(t9)

  /*
   * If form already disallows, return t9 = 0.
   * This preserves vanilla behavior and avoids unnecessary age call.
   */
  beqz    t9, .L_native_age_form_restore
   nop

  /*
   * Form allows. Now require age too.
   */
  jal     KaleidoScope_CheckMmItemAgeReq
   andi   a0, a2, 0xffff

  /*
   * t9 becomes ageAllowed.
   * Since we only get here when formAllowed != 0,
   * this is equivalent to formAllowed && ageAllowed.
   */
  move    t9, v0

.L_native_age_form_restore:
  lw      v0, 0x0010(sp)
  lw      a2, 0x0014(sp)
  lw      a0, 0x0018(sp)
  lw      ra, 0x001c(sp)
  jr      ra
   addiu  sp, sp, 0x20

PATCH_START 0x80828b14
  jal     KaleidoScope_NativeItemAgeAndFormCheck_Hook
PATCH_END