#ifndef COMBO_COMMON_KALEIDO_SCOPE_H
#define COMBO_COMMON_KALEIDO_SCOPE_H
#include "combo/item.h"

int KaleidoScope_CanSave(PlayState* play);

extern u8 gAmmoItems[];
extern s16 gVtxPageMapWorldQuadsWidth[];
extern s16 gVtxPageMapWorldQuadsHeight[];
extern char gSlotAgeReqs[];
extern char gEquipAgeReqs[EQUIP_TYPE_MAX][4];
extern char gItemAgeReqs[];
extern u8 gAreaGsFlags[];

#define AGE_REQ_ADULT LINK_AGE_ADULT
#define AGE_REQ_CHILD LINK_AGE_CHILD
#define AGE_REQ_NONE 9

#define CHECK_AGE_REQ_SLOT(slot) \
((gSlotAgeReqs[slot] == AGE_REQ_NONE) || gSlotAgeReqs[slot] == ((void)0, gSaveContext.save.linkAge))

#define CHECK_AGE_REQ_EQUIP(y, x) \
((gEquipAgeReqs[y][x] == AGE_REQ_NONE) || (gEquipAgeReqs[y][x] == ((void)0, gSaveContext.save.linkAge)))

#define CHECK_AGE_REQ_ITEM(item) \
((gItemAgeReqs[item] == AGE_REQ_NONE) || (gItemAgeReqs[item] == ((void)0, gSaveContext.save.linkAge)))

#define PAGE_BG_COLS 3
#define PAGE_BG_ROWS 5
#define PAGE_BG_QUADS (PAGE_BG_COLS * PAGE_BG_ROWS)
#define PAGE_BG_QUAD_WIDTH 80
#define PAGE_BG_QUAD_HEIGHT 32
#define PAGE_BG_QUAD_TEX_WIDTH 80
#define PAGE_BG_QUAD_TEX_HEIGHT 32
#define PAUSE_EQUIP_PLAYER_WIDTH 64
#define PAUSE_EQUIP_PLAYER_HEIGHT 112
#define TMEM_SIZE 0x1000
#define PAUSE_EQUIP_PLAYER_FRAG_HEIGHT (TMEM_SIZE / (PAUSE_EQUIP_PLAYER_WIDTH * G_IM_SIZ_16b_BYTES))
#define PAUSE_EQUIP_PLAYER_FRAG_NUM (((PAUSE_EQUIP_PLAYER_HEIGHT - 1) / PAUSE_EQUIP_PLAYER_FRAG_HEIGHT) + 1)

typedef enum EquipQuad {
    // Grid of upgrades and equips, left column is upgrades, others are equips, with one row per equip type
    // Row 0
    /*  0 */ EQUIP_QUAD_UPG_BULLETBAG_QUIVER,
    /*  1 */ EQUIP_QUAD_SWORD_KOKIRI,
    /*  2 */ EQUIP_QUAD_SWORD_MASTER,
    /*  3 */ EQUIP_QUAD_SWORD_BIGGORON,
    // Row 1
    /*  4 */ EQUIP_QUAD_UPG_BOMB_BAG,
    /*  5 */ EQUIP_QUAD_SHIELD_DEKU,
    /*  6 */ EQUIP_QUAD_SHIELD_HYLIAN,
    /*  7 */ EQUIP_QUAD_SHIELD_MIRROR,
    // Row 2
    /*  8 */ EQUIP_QUAD_UPG_STRENGTH,
    /*  9 */ EQUIP_QUAD_TUNIC_KOKIRI,
    /* 10 */ EQUIP_QUAD_TUNIC_GORON,
    /* 11 */ EQUIP_QUAD_TUNIC_ZORA,
    // Row 3
    /* 12 */ EQUIP_QUAD_UPG_SCALE,
    /* 13 */ EQUIP_QUAD_BOOTS_KOKIRI,
    /* 14 */ EQUIP_QUAD_BOOTS_IRON,
    /* 15 */ EQUIP_QUAD_BOOTS_HOVER,
    // Markers indicating the currently selected equip
    /* 16 */ EQUIP_QUAD_SELECTED_SWORD,
    /* 17 */ EQUIP_QUAD_SELECTED_SHIELD,
    /* 18 */ EQUIP_QUAD_SELECTED_TUNIC,
    /* 19 */ EQUIP_QUAD_SELECTED_BOOTS,
    // Player prerender
    /* 20 */ EQUIP_QUAD_PLAYER_FIRST,
    /* 23 */ EQUIP_QUAD_PLAYER_LAST = EQUIP_QUAD_PLAYER_FIRST + PAUSE_EQUIP_PLAYER_FRAG_NUM - 1,
    // 24..27 are unused, probably meant for player prerender
    /* 28 */ EQUIP_QUAD_MAX = EQUIP_QUAD_PLAYER_LAST + 4 + 1
} EquipQuad;

#endif
