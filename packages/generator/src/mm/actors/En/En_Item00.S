#include <combo.h>

/* Resize */
PATCH_START 0x801adecc
.int 0x1b0
PATCH_END

/* Use our init */
PATCH_START 0x801aded0
.int EnItem00_InitWrapper
PATCH_END

UpdateEnd:
  /* Original */
  sh    zero,0x14a(s0)

  j EnItem00_SetXflagCollectedHandler
   move  a0,s0

/* Use our xflag post-collection handler */
PATCH_START 0x800a7108
  sh    zero,0x14a(s0)
  jal   EnItem00_SetXflagCollectedHandler
   move  a0,s0
PATCH_END

/* Use our xflag add handler */
PATCH_START 0x800a6e38
  move a0,s0
  jal EnItem00_AddXflag
   nop
PATCH_END

/* Patch DrawGI */
PATCH_START 0x800a7248
  li a1,(DRAWGI_RECOVERY_HEART - 1)
PATCH_END

PATCH_START 0x800a7284
  li a1,(DRAWGI_MAP - 1)
PATCH_END

PATCH_START 0x800a7298
  li a1,(DRAWGI_COMPASS - 1)
PATCH_END

PATCH_START 0x800a6348
  nop
PATCH_END

/* GI renumbering */
PATCH_START 0x800a6300
  li t4,GI_MM_NUT
PATCH_END

PATCH_START 0x800a630c
  li t5,GI_MM_NUTS_10
PATCH_END

PATCH_START 0x800a6f78
  li t3,GI_MM_HEART_PIECE
PATCH_END

PATCH_START 0x800a6f84
  li t4,GI_MM_HEART_CONTAINER
PATCH_END

PATCH_START 0x800a6ebc
  li t9,GI_MM_STICK
PATCH_END

PATCH_START 0x800a6ec8
  li t0,GI_MM_NUT
PATCH_END

PATCH_START 0x800a6f6c
  li t2,GI_MM_SMALL_KEY
PATCH_END

PATCH_START 0x800a6fb8
  li t5,GI_MM_SHIELD_HERO
PATCH_END

PATCH_START 0x800a6ed4
  li t1,GI_MM_NUTS_10
PATCH_END

PATCH_START 0x800a6fc4
  li t6,GI_MM_MAP
PATCH_END

PATCH_START 0x800a6fd0
  li t7,GI_MM_COMPASS
PATCH_END

/* Bombchu drops GFX */
PATCH_START 0x800a740e
.short 0xa
PATCH_END

PATCH_START 0x801adf6c
.int 0x0405d6f0
PATCH_END

/* Bombchu drops effect */
EnItem00_Init_BombchuCase:
  lw    a0,0x4c(sp)
  jal   AddItem
   li   a1,ITEM_MM_BOMBCHU_5
  j     0x800a6318
   lw   t6,0x34(sp)

PATCH_START 0x801dbf08
.int EnItem00_Init_BombchuCase
PATCH_END

EnItem00_Update_BombchuCase:
  move  a0,a2
  jal   AddItem
   li   a1,ITEM_MM_BOMBCHU_5
  j     0x800a6fd8
   lw   a2,0x4c(sp)

PATCH_START 0x801dbf88
.int EnItem00_Update_BombchuCase
PATCH_END

/* Use our sound effect handler */
PATCH_START 0x800a7080
  jal EnItem00_PlaySoundXflag
   move a0,s0
PATCH_END

PATCH_START 0x800a5e54
  or    a0, s0, zero
  lw    a1, 0x004c (sp)
  addiu a2, sp, 0x003c
  addiu a3, sp, 0x0038
  addiu at, sp, 0x0030
  jal   EnItem00_InitType
   sw   at, 0x0010 (sp)
  b     .+0x2a0
   nop
PATCH_END

PATCH_START 0x800a6198
  mtc1    zero, $f0
  sh      t1, 0x0152 (s0)
  sh      t2, 0x014c (s0)
  swc1    $f0, 0x0070 (s0)
  swc1    $f0, 0x0068 (s0)
  swc1    $f0, 0x0074 (s0)
  or      a0, s0, zero
  lw      a1, 0x004c (sp)
  jal     EnItem00_InitGiveItem
   addiu  a2, sp, 0x0034
  b       .+0x154
   nop
PATCH_END

PATCH_START 0x800a6e0c
  or      a0, s0, zero
  lw      a1, 0x004c (sp)
  jal     EnItem00_UpdateGiveItem
   addiu  a2, sp, 0x0034
  b       .+0x1bc
   lw     a2, 0x004c (sp)
PATCH_END

PATCH_START 0x800a6898
  jal     EnItem00_SetSpawningRotation
   or     a0, s0, zero
  b       .+0x50
   nop
PATCH_END
