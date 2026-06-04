#include "combo/common/Kaleido_Scope.h"
#include "combo/types.h"
#include "combo/mm/play.h"
#include "combo/mm/save.h"
#include "combo/oot/pause_state_defs.h"

static u8 sChildUpgrades[] = {
    UPG_BULLET_BAG, // EQUIP_QUAD_UPG_BULLETBAG_QUIVER
    UPG_BOMB_BAG,   // EQUIP_QUAD_UPG_BOMB_BAG
    UPG_STRENGTH,   // EQUIP_QUAD_UPG_STRENGTH
    UPG_SCALE,      // EQUIP_QUAD_UPG_SCALE
};

static u8 sAdultUpgrades[] = {
    UPG_QUIVER,   // EQUIP_QUAD_UPG_BULLETBAG_QUIVER
    UPG_BOMB_BAG, // EQUIP_QUAD_UPG_BOMB_BAG
    UPG_STRENGTH, // EQUIP_QUAD_UPG_STRENGTH
    UPG_SCALE,    // EQUIP_QUAD_UPG_SCALE
};

static u8 sChildUpgradeItemBases[] = {
    ITEM_MM_BULLET_BAG,     // EQUIP_QUAD_UPG_BULLETBAG_QUIVER
    ITEM_MM_BOMB_BAG,       // EQUIP_QUAD_UPG_BOMB_BAG
    ITEM_MM_GORON_BRACELET, // EQUIP_QUAD_UPG_STRENGTH
    ITEM_MM_SILVER_SCALE,   // EQUIP_QUAD_UPG_SCALE
};

static u8 sAdultUpgradeItemBases[] = {
    ITEM_MM_QUIVER,         // EQUIP_QUAD_UPG_BULLETBAG_QUIVER
    ITEM_MM_BOMB_BAG,       // EQUIP_QUAD_UPG_BOMB_BAG
    ITEM_MM_GORON_BRACELET, // EQUIP_QUAD_UPG_STRENGTH
    ITEM_MM_SILVER_SCALE,   // EQUIP_QUAD_UPG_SCALE
};

static u8 sUpgradeItemOffsets[] = {
    0,                                       // unused / UPG_QUIVER
    ITEM_MM_BOMB_BAG - ITEM_MM_QUIVER,       // UPG_BOMB_BAG
    ITEM_MM_GORON_BRACELET - ITEM_MM_QUIVER, // UPG_STRENGTH
    ITEM_MM_SILVER_SCALE - ITEM_MM_QUIVER,   // UPG_SCALE
};

static u8 sEquipmentItemOffsets[] = {
    // EQUIP_TYPE_SWORD
    0,                                               // unused
    ITEM_MM_SWORD_KOKIRI - ITEM_MM_SWORD_KOKIRI,     // EQUIP_VALUE_SWORD_KOKIRI
    ITEM_MM_SWORD_RAZOR - ITEM_MM_SWORD_KOKIRI,      // EQUIP_VALUE_SWORD_MASTER
    ITEM_MM_SWORD_GILDED - ITEM_MM_SWORD_KOKIRI,     // EQUIP_VALUE_SWORD_BIGGORON

    // EQUIP_TYPE_SHIELD
    0,                                               // unused
    ITEM_MM_SHIELD_DEKU - ITEM_MM_SWORD_KOKIRI,      // EQUIP_VALUE_SHIELD_DEKU
    ITEM_MM_SHIELD_HERO - ITEM_MM_SWORD_KOKIRI,      // EQUIP_VALUE_SHIELD_HYLIAN
    ITEM_MM_SHIELD_MIRROR - ITEM_MM_SWORD_KOKIRI,    // EQUIP_VALUE_SHIELD_MIRROR

    // EQUIP_TYPE_TUNIC
    0,                                               // unused
    ITEM_MM_TUNIC_KOKIRI - ITEM_MM_SWORD_KOKIRI,     // EQUIP_VALUE_TUNIC_KOKIRI
    ITEM_MM_TUNIC_GORON - ITEM_MM_SWORD_KOKIRI,      // EQUIP_VALUE_TUNIC_GORON
    ITEM_MM_TUNIC_ZORA - ITEM_MM_SWORD_KOKIRI,       // EQUIP_VALUE_TUNIC_ZORA

    // EQUIP_TYPE_BOOTS
    0,                                               // unused
    ITEM_MM_BOOTS_KOKIRI - ITEM_MM_SWORD_KOKIRI,     // EQUIP_VALUE_BOOTS_KOKIRI
    ITEM_MM_BOOTS_IRON - ITEM_MM_SWORD_KOKIRI,       // EQUIP_VALUE_BOOTS_IRON
    ITEM_MM_BOOTS_HOVER - ITEM_MM_SWORD_KOKIRI,      // EQUIP_VALUE_BOOTS_HOVER
};

void KaleidoScope_DrawEquipmentImage(PlayState* play, void* texture, u32 width, u32 height) {
    PauseContext* pauseCtx = &play->pauseCtx;
    u8* curTexture;
    s32 vtxIndex;
    s32 textureCount;
    s32 textureHeight;
    s32 remainingSize;
    s32 textureSize;
    s32 i;

    OPEN_DISPS(play->state.gfxCtx);

    gDPPipeSync(POLY_OPA_DISP++);
    gDPSetCombineMode(POLY_OPA_DISP++, G_CC_MODULATEIA_PRIM, G_CC_MODULATEIA_PRIM);
    gDPSetTextureFilter(POLY_OPA_DISP++, G_TF_POINT);
    gDPSetPrimColor(POLY_OPA_DISP++, 0, 0, 255, 255, 255, pauseCtx->alpha);

    curTexture = texture;
    remainingSize = width * height * G_IM_SIZ_16b_BYTES;
    textureHeight = TMEM_SIZE / (width * G_IM_SIZ_16b_BYTES);
    textureSize = width * textureHeight * G_IM_SIZ_16b_BYTES;
    textureCount = remainingSize / textureSize;

    if ((remainingSize % textureSize) != 0) {
        textureCount += 1;
    }

    vtxIndex = EQUIP_QUAD_PLAYER_FIRST * 4;

    gDPSetTileCustom(POLY_OPA_DISP++, G_IM_FMT_RGBA, G_IM_SIZ_16b, 0, 0, width - 1, textureHeight - 1, 0,
                     G_TX_NOMIRROR | G_TX_CLAMP, G_TX_NOMIRROR | G_TX_CLAMP, G_TX_NOMASK, G_TX_NOMASK, G_TX_NOLOD,
                     G_TX_NOLOD);

    remainingSize -= textureSize;

    for (i = 0; i < textureCount; i++) {
        gSPVertex(POLY_OPA_DISP++, &pauseCtx->maskVtx[vtxIndex], 4, 0);

        gDPSetTextureImage(POLY_OPA_DISP++, G_IM_FMT_RGBA, G_IM_SIZ_16b, width, curTexture);

        gDPLoadSync(POLY_OPA_DISP++);
        gDPLoadTile(POLY_OPA_DISP++, G_TX_LOADTILE, 0, 0, (width - 1) << 2, (textureHeight - 1) << 2);

        gSP1Quadrangle(POLY_OPA_DISP++, 0, 2, 3, 1, 0);

        curTexture += textureSize;

        if ((remainingSize - textureSize) < 0) {
            if (remainingSize > 0) {
                textureHeight = remainingSize / (s32)(width * G_IM_SIZ_16b_BYTES);
                remainingSize -= textureSize;

                gDPSetTileCustom(POLY_OPA_DISP++, G_IM_FMT_RGBA, G_IM_SIZ_16b, 0, 0, width - 1, textureHeight - 1, 0,
                                 G_TX_NOMIRROR | G_TX_CLAMP, G_TX_NOMIRROR | G_TX_CLAMP, G_TX_NOMASK, G_TX_NOMASK,
                                 G_TX_NOLOD, G_TX_NOLOD);
            }
        } else {
            remainingSize -= textureSize;
        }

        vtxIndex += 4;
    }

    CLOSE_DISPS(play->state.gfxCtx);
}

void KaleidoScope_DrawPlayerWork(PlayState* play) {
    PauseContext* pauseCtx = &play->pauseCtx;
    Vec3f pos;
    Vec3s rot;
    f32 scale;

    if (LINK_AGE_IN_YEARS == YEARS_CHILD) {
        pos.x = 2.0f;
        pos.y = -130.0f;
        pos.z = -150.0f;
        scale = 0.046f;
    } else if (CUR_EQUIP_VALUE(EQUIP_TYPE_SWORD) != EQUIP_VALUE_SWORD_RAZOR) {
        pos.x = 25.0f;
        pos.y = -228.0f;
        pos.z = 60.0f;
        scale = 0.056f;
    } else {
        pos.x = 20.0f;
        pos.y = -180.0f;
        pos.z = -40.0f;
        scale = 0.047f;
    }

    rot.y = 32300;
    rot.x = rot.z = 0;

    Player_DrawPause(play, pauseCtx->playerSegment, &pauseCtx->playerSkelAnime, &pos, &rot, scale,
                     SWORD_EQUIP_TO_PLAYER(CUR_EQUIP_VALUE(EQUIP_TYPE_SWORD)),
                     TUNIC_EQUIP_TO_PLAYER(CUR_EQUIP_VALUE(EQUIP_TYPE_TUNIC)),
                     SHIELD_EQUIP_TO_PLAYER(CUR_EQUIP_VALUE(EQUIP_TYPE_SHIELD)),
                     BOOTS_EQUIP_TO_PLAYER(CUR_EQUIP_VALUE(EQUIP_TYPE_BOOTS)));
}

#ifndef AVOID_UB
// Wrong prototype; this function is called with `play` even though it has no arguments
void KaleidoScope_ProcessPlayerPreRender(PlayState* play);
#endif

void KaleidoScope_DrawEquipment(PlayState* play) {
    static s16 sEquipTimer = 0;
    PauseContext* pauseCtx = &play->pauseCtx;
    InterfaceContext* interfaceCtx = &play->interfaceCtx;
    Input* input = CONTROLLER1(&play->state);
    u16 i;
    u16 j;
    u16 k;
    u16 bit;
    u16 rowStart;
    u16 temp;
    u16 point;
    s16 cursorMoveResult;
    u16 cursorSlot;
    u16 cursorItem;
    s16 cursorX;
    s16 cursorY;
    s16 oldCursorPoint;
    s16 cursorPoint;

    OPEN_DISPS(play->state.gfxCtx);

    gDPPipeSync(POLY_OPA_DISP++);
    gDPSetPrimColor(POLY_OPA_DISP++, 0, 0, ZREG(39), ZREG(40), ZREG(41), pauseCtx->alpha);
    gDPSetEnvColor(POLY_OPA_DISP++, ZREG(43), ZREG(44), ZREG(45), 0);

    // Draw EQUIP_QUAD_SELECTED_SWORD, EQUIP_QUAD_SELECTED_SHIELD, EQUIP_QUAD_SELECTED_TUNIC, EQUIP_QUAD_SELECTED_BOOTS
    for (i = 0, j = EQUIP_QUAD_SELECTED_SWORD * 4; i < EQUIP_TYPE_MAX; i++, j += 4) {
        if (CUR_EQUIP_VALUE(i) != 0) {
            gDPPipeSync(POLY_OPA_DISP++);
            gSPVertex(POLY_OPA_DISP++, &pauseCtx->maskVtx[j], 4, 0);

            POLY_OPA_DISP = Gfx_DrawTexQuadIA8(POLY_OPA_DISP, gEquippedItemOutlineTex, 32, 32, 0);
        }
    }

    if ((pauseCtx->state == PAUSE_STATE_MAIN) && (pauseCtx->mainState == PAUSE_MAIN_STATE_IDLE) &&
        (pauseCtx->pageIndex == PAUSE_MASK)) {
        oldCursorPoint = pauseCtx->cursorPoint[PAUSE_MASK];
        pauseCtx->cursorColorSet = PAUSE_CURSOR_COLOR_SET_WHITE;

        // Handle moving the cursor with stick input
        if (pauseCtx->cursorSpecialPos == 0) {
            pauseCtx->nameColorSet = PAUSE_NAME_COLOR_SET_WHITE;

            cursorItem = pauseCtx->cursorItem[PAUSE_MASK];
            if ((cursorItem >= ITEM_MM_SWORD_KOKIRI) && (cursorItem <= ITEM_MM_BOOTS_HOVER)) {
                pauseCtx->cursorColorSet = PAUSE_CURSOR_COLOR_SET_BLUE;
            }

            cursorPoint = pauseCtx->cursorPoint[PAUSE_MASK];
            cursorX = pauseCtx->cursorXIndex[PAUSE_MASK];
            cursorY = pauseCtx->cursorYIndex[PAUSE_MASK];

            cursorMoveResult = 0;
            do {
                if (pauseCtx->stickAdjX < -30) {
                    if (pauseCtx->cursorXIndex[PAUSE_MASK] != EQUIP_CURSOR_X_UPG) {
                        pauseCtx->cursorXIndex[PAUSE_MASK]--;
                        pauseCtx->cursorPoint[PAUSE_MASK] -= 1;

                        if (pauseCtx->cursorXIndex[PAUSE_MASK] == EQUIP_CURSOR_X_UPG) {
                            if (pauseCtx->cursorYIndex[PAUSE_MASK] == EQUIP_CURSOR_Y_BULLETBAG_QUIVER) {
                                if (CUR_UPG_VALUE(UPG_BULLET_BAG) != 0) {
                                    cursorMoveResult = 1;
                                }
                            } else {
                                if (CUR_UPG_VALUE(pauseCtx->cursorYIndex[PAUSE_MASK]) != 0) {
                                    cursorMoveResult = 1;
                                }
                            }
                        } else {
                            if (gBitFlags[pauseCtx->cursorPoint[PAUSE_MASK] - 1] &
                                gSaveContext.save.saveInfo.inventory.equipment) {
                                cursorMoveResult = 2;
                            }
                        }
                    } else {
                        pauseCtx->cursorXIndex[PAUSE_MASK] = cursorX;
                        pauseCtx->cursorYIndex[PAUSE_MASK]++;

                        if (pauseCtx->cursorYIndex[PAUSE_MASK] >= 4) {
                            pauseCtx->cursorYIndex[PAUSE_MASK] = 0;
                        }

                        pauseCtx->cursorPoint[PAUSE_MASK] =
                            pauseCtx->cursorXIndex[PAUSE_MASK] + (pauseCtx->cursorYIndex[PAUSE_MASK] * 4);

                        if (pauseCtx->cursorPoint[PAUSE_MASK] >= 16) {
                            pauseCtx->cursorPoint[PAUSE_MASK] = pauseCtx->cursorXIndex[PAUSE_MASK];
                        }

                        if (cursorY == pauseCtx->cursorYIndex[PAUSE_MASK]) {
                            pauseCtx->cursorXIndex[PAUSE_MASK] = cursorX;
                            pauseCtx->cursorPoint[PAUSE_MASK] = cursorPoint;
                            KaleidoScope_MoveCursorToSpecialPos(play, PAUSE_CURSOR_PAGE_LEFT);
                            cursorMoveResult = 3;
                        }
                    }
                } else if (pauseCtx->stickAdjX > 30) {
                    if (pauseCtx->cursorXIndex[PAUSE_MASK] < 3) {
                        pauseCtx->cursorXIndex[PAUSE_MASK]++;
                        pauseCtx->cursorPoint[PAUSE_MASK] += 1;

                        if (pauseCtx->cursorXIndex[PAUSE_MASK] == EQUIP_CURSOR_X_UPG) {
                            if (CUR_UPG_VALUE(pauseCtx->cursorYIndex[PAUSE_MASK]) != 0) {
                                cursorMoveResult = 1;
                            }
                        } else {
                            if (gBitFlags[pauseCtx->cursorPoint[PAUSE_MASK] - 1] &
                                gSaveContext.save.saveInfo.inventory.equipment) {
                                cursorMoveResult = 2;
                            }
                        }
                    } else {
                        pauseCtx->cursorXIndex[PAUSE_MASK] = cursorX;
                        pauseCtx->cursorYIndex[PAUSE_MASK]++;

                        if (pauseCtx->cursorYIndex[PAUSE_MASK] >= 4) {
                            pauseCtx->cursorYIndex[PAUSE_MASK] = 0;
                        }

                        pauseCtx->cursorPoint[PAUSE_MASK] =
                            pauseCtx->cursorXIndex[PAUSE_MASK] + (pauseCtx->cursorYIndex[PAUSE_MASK] * 4);

                        if (pauseCtx->cursorPoint[PAUSE_MASK] >= 16) {
                            pauseCtx->cursorPoint[PAUSE_MASK] = pauseCtx->cursorXIndex[PAUSE_MASK];
                        }

                        if (cursorY == pauseCtx->cursorYIndex[PAUSE_MASK]) {
                            pauseCtx->cursorXIndex[PAUSE_MASK] = cursorX;
                            pauseCtx->cursorPoint[PAUSE_MASK] = cursorPoint;
                            KaleidoScope_MoveCursorToSpecialPos(play, PAUSE_CURSOR_PAGE_RIGHT);
                            cursorMoveResult = 3;
                        }
                    }
                } else {
                    cursorMoveResult = 4;
                }
            } while (cursorMoveResult == 0);

            cursorPoint = pauseCtx->cursorPoint[PAUSE_MASK];
            cursorY = pauseCtx->cursorYIndex[PAUSE_MASK];

            cursorMoveResult = 0;
            do {
                if (pauseCtx->stickAdjY > 30) {
                    if (pauseCtx->cursorYIndex[PAUSE_MASK] != 0) {
                        pauseCtx->cursorYIndex[PAUSE_MASK]--;
                        pauseCtx->cursorPoint[PAUSE_MASK] -= 4;

                        if (pauseCtx->cursorXIndex[PAUSE_MASK] == EQUIP_CURSOR_X_UPG) {
                            if (pauseCtx->cursorYIndex[PAUSE_MASK] == EQUIP_CURSOR_Y_BULLETBAG_QUIVER) {
                                if (CUR_UPG_VALUE(UPG_BULLET_BAG) != 0) {
                                    cursorMoveResult = 1;
                                }
                            } else {
                                if (CUR_UPG_VALUE(pauseCtx->cursorYIndex[PAUSE_MASK]) != 0) {
                                    cursorMoveResult = 1;
                                }
                            }
                        } else {
                            if (gBitFlags[pauseCtx->cursorPoint[PAUSE_MASK] - 1] &
                                gSaveContext.save.saveInfo.inventory.equipment) {
                                cursorMoveResult = 2;
                            }
                        }
                    } else {
                        pauseCtx->cursorYIndex[PAUSE_MASK] = cursorY;
                        pauseCtx->cursorPoint[PAUSE_MASK] = cursorPoint;
                        cursorMoveResult = 3;
                    }
                } else if (pauseCtx->stickAdjY < -30) {
                    if (pauseCtx->cursorYIndex[PAUSE_MASK] < 3) {
                        pauseCtx->cursorYIndex[PAUSE_MASK]++;
                        pauseCtx->cursorPoint[PAUSE_MASK] += 4;

                        if (pauseCtx->cursorXIndex[PAUSE_MASK] == EQUIP_CURSOR_X_UPG) {
                            if (CUR_UPG_VALUE(pauseCtx->cursorYIndex[PAUSE_MASK]) != 0) {
                                cursorMoveResult = 1;
                            }
                        } else {
                            if (gBitFlags[pauseCtx->cursorPoint[PAUSE_MASK] - 1] &
                                gSaveContext.save.saveInfo.inventory.equipment) {
                                cursorMoveResult = 2;
                            }
                        }
                    } else {
                        pauseCtx->cursorYIndex[PAUSE_MASK] = cursorY;
                        pauseCtx->cursorPoint[PAUSE_MASK] = cursorPoint;
                        cursorMoveResult = 3;
                    }
                } else {
                    cursorMoveResult = 4;
                }
            } while (cursorMoveResult == 0);
        } else if (pauseCtx->cursorSpecialPos == PAUSE_CURSOR_PAGE_LEFT) {
            if (pauseCtx->stickAdjX > 30) {
                KaleidoScope_MoveCursorFromSpecialPos(play);

                cursorPoint = cursorX = cursorY = 0;
                while (true) {
                    if (cursorX == EQUIP_CURSOR_X_UPG) {
                        if (cursorY == EQUIP_CURSOR_Y_BULLETBAG_QUIVER) {
                            if (CUR_UPG_VALUE(UPG_BULLET_BAG) != 0) {
                                pauseCtx->cursorPoint[PAUSE_MASK] = cursorPoint;
                                pauseCtx->cursorXIndex[PAUSE_MASK] = cursorX;
                                pauseCtx->cursorYIndex[PAUSE_MASK] = cursorY;
                                break;
                            }
                        } else {
                            if (CUR_UPG_VALUE(cursorY) != 0) {
                                pauseCtx->cursorPoint[PAUSE_MASK] = cursorPoint;
                                pauseCtx->cursorXIndex[PAUSE_MASK] = cursorX;
                                pauseCtx->cursorYIndex[PAUSE_MASK] = cursorY;
                                break;
                            }
                        }
                    } else {
                        if (gBitFlags[cursorPoint - 1] & gSaveContext.save.saveInfo.inventory.equipment) {
                            pauseCtx->cursorPoint[PAUSE_MASK] = cursorPoint;
                            pauseCtx->cursorXIndex[PAUSE_MASK] = cursorX;
                            pauseCtx->cursorYIndex[PAUSE_MASK] = cursorY;
                            break;
                        }
                    }

                    cursorY++;
                    cursorPoint += 4;

                    if (cursorY >= 4) {
                        cursorY = 0;
                        cursorPoint = cursorX + 1;
                        cursorX = cursorPoint;

                        if (cursorX >= 4) {
                            KaleidoScope_MoveCursorToSpecialPos(play, PAUSE_CURSOR_PAGE_RIGHT);
                            break;
                        }
                    }
                }
            }
        } else { // cursorSpecialPos == PAUSE_CURSOR_PAGE_RIGHT
            if (pauseCtx->stickAdjX < -30) {
                KaleidoScope_MoveCursorFromSpecialPos(play);

                cursorPoint = cursorX = 3;
                cursorY = 0;

                while (true) {
                    if (cursorX == EQUIP_CURSOR_X_UPG) {
                        if (CUR_UPG_VALUE(cursorY) != 0) {
                            pauseCtx->cursorPoint[PAUSE_MASK] = cursorPoint;
                            pauseCtx->cursorXIndex[PAUSE_MASK] = cursorX;
                            pauseCtx->cursorYIndex[PAUSE_MASK] = cursorY;
                            break;
                        }
                    } else {
                        if (gBitFlags[cursorPoint - 1] & gSaveContext.save.saveInfo.inventory.equipment) {
                            pauseCtx->cursorPoint[PAUSE_MASK] = cursorPoint;
                            pauseCtx->cursorXIndex[PAUSE_MASK] = cursorX;
                            pauseCtx->cursorYIndex[PAUSE_MASK] = cursorY;
                            break;
                        }
                    }

                    cursorY++;
                    cursorPoint += 4;

                    if (cursorY >= 4) {
                        cursorY = 0;
                        cursorPoint = cursorX - 1;
                        cursorX = cursorPoint;

                        if (cursorX < 0) {
                            KaleidoScope_MoveCursorToSpecialPos(play, PAUSE_CURSOR_PAGE_LEFT);
                            break;
                        }
                    }
                }
            }
        }

        // Set cursorItem
        if (pauseCtx->cursorXIndex[PAUSE_MASK] == EQUIP_CURSOR_X_UPG) {
            pauseCtx->cursorColorSet = PAUSE_CURSOR_COLOR_SET_WHITE;

            if (LINK_AGE_IN_YEARS == YEARS_CHILD) {
                if ((pauseCtx->cursorYIndex[PAUSE_MASK] == EQUIP_CURSOR_Y_BULLETBAG_QUIVER) &&
                    (CUR_UPG_VALUE(UPG_BULLET_BAG) != 0)) {
                    cursorItem = ITEM_MM_BULLET_BAG + CUR_UPG_VALUE(UPG_BULLET_BAG) - 1;
                } else {
                    cursorItem = ITEM_MM_QUIVER + sUpgradeItemOffsets[pauseCtx->cursorYIndex[PAUSE_MASK]] +
                                 CUR_UPG_VALUE(pauseCtx->cursorYIndex[PAUSE_MASK]) - 1;
                }
            } else {
                if ((pauseCtx->cursorYIndex[PAUSE_MASK] == EQUIP_CURSOR_Y_BULLETBAG_QUIVER) &&
                    (CUR_UPG_VALUE(UPG_QUIVER) == 0)) {
                    cursorItem = ITEM_MM_BULLET_BAG + CUR_UPG_VALUE(UPG_BULLET_BAG) - 1;
                } else {
                    cursorItem = ITEM_MM_QUIVER + sUpgradeItemOffsets[pauseCtx->cursorYIndex[PAUSE_MASK]] +
                                 CUR_UPG_VALUE(pauseCtx->cursorYIndex[PAUSE_MASK]) - 1;
                }
            }
        } else {
            cursorItem = ITEM_MM_SWORD_KOKIRI + sEquipmentItemOffsets[pauseCtx->cursorPoint[PAUSE_MASK]];

            if (pauseCtx->cursorSpecialPos == 0) {
                pauseCtx->cursorColorSet = PAUSE_CURSOR_COLOR_SET_BLUE;
            }
        }

        cursorSlot = pauseCtx->cursorPoint[PAUSE_MASK];

        pauseCtx->cursorSlot[PAUSE_MASK] = cursorSlot;
        pauseCtx->cursorItem[PAUSE_MASK] = cursorItem;

        // Handle age particularities
        if (!CHECK_AGE_REQ_EQUIP(pauseCtx->cursorYIndex[PAUSE_MASK], pauseCtx->cursorXIndex[PAUSE_MASK])) {
            pauseCtx->nameColorSet = PAUSE_NAME_COLOR_SET_GREY;
        }

        if (pauseCtx->cursorItem[PAUSE_MASK] == ITEM_MM_GORON_BRACELET) {
            if (LINK_AGE_IN_YEARS == YEARS_CHILD) {
                pauseCtx->nameColorSet = PAUSE_NAME_COLOR_SET_WHITE;
            } else {
                pauseCtx->nameColorSet = PAUSE_NAME_COLOR_SET_GREY;
            }
        }

        if ((pauseCtx->cursorXIndex[PAUSE_MASK] == EQUIP_CURSOR_X_UPG) &&
            (pauseCtx->cursorYIndex[PAUSE_MASK] == EQUIP_CURSOR_Y_BULLETBAG_QUIVER)) {
            if (LINK_AGE_IN_YEARS != YEARS_CHILD) {
                if ((cursorItem >= ITEM_MM_BULLET_BAG) && (cursorItem < ITEM_MM_QUIVER)) {
                    pauseCtx->nameColorSet = PAUSE_NAME_COLOR_SET_GREY;
                } else {
                    pauseCtx->nameColorSet = PAUSE_NAME_COLOR_SET_WHITE;
                }
            } else {
                pauseCtx->nameColorSet = PAUSE_NAME_COLOR_SET_WHITE;
            }
        }

        // Set cursor position
        KaleidoScope_SetCursorVtxPos(pauseCtx, cursorSlot * 4, pauseCtx->maskVtx);

        // Handle input for changing equipment
        if ((pauseCtx->cursorSpecialPos == 0) && (cursorItem != PAUSE_ITEM_NONE) &&
            (pauseCtx->state == PAUSE_STATE_MAIN) && (pauseCtx->mainState == PAUSE_MAIN_STATE_IDLE) &&
            CHECK_BTN_ALL(input->press.button, BTN_A) &&
            (pauseCtx->cursorXIndex[PAUSE_MASK] != EQUIP_CURSOR_X_UPG)) {
            if (CHECK_AGE_REQ_EQUIP(pauseCtx->cursorYIndex[PAUSE_MASK], pauseCtx->cursorXIndex[PAUSE_MASK])) {
                Inventory_ChangeEquipment(pauseCtx->cursorYIndex[PAUSE_MASK], pauseCtx->cursorXIndex[PAUSE_MASK]);

                if (pauseCtx->cursorYIndex[PAUSE_MASK] == EQUIP_TYPE_SWORD) {
                    BUTTON_ITEM_EQUIP(0, EQUIP_SLOT_B) = cursorItem;
                    Interface_LoadItemIconImpl(play, EQUIP_SLOT_B);
                }

                Audio_PlaySfx(NA_SE_SY_DECIDE);

                // Wait 10 frames before accepting input again
                pauseCtx->mainState = PAUSE_MAIN_STATE_EQUIP_CHANGED;
                sEquipTimer = 10;
            } else {
                Audio_PlaySfx(NA_SE_SY_ERROR);
            }
        }

        if (oldCursorPoint != pauseCtx->cursorPoint[PAUSE_MASK]) {
            Audio_PlaySfx(NA_SE_SY_CURSOR);
        }
    } else if ((pauseCtx->mainState == PAUSE_MAIN_STATE_EQUIP_CHANGED) && (pauseCtx->pageIndex == PAUSE_MASK)) {
        KaleidoScope_SetCursorVtxPos(pauseCtx, pauseCtx->cursorSlot[PAUSE_MASK] * 4, pauseCtx->maskVtx);
        pauseCtx->cursorColorSet = PAUSE_CURSOR_COLOR_SET_BLUE;

        sEquipTimer--;
        if (sEquipTimer == 0) {
            pauseCtx->mainState = PAUSE_MAIN_STATE_IDLE;
        }
    }

    // Enlarge the equip item at the current cursor position, if it can be equipped
    for (rowStart = 0, i = 0, point = EQUIP_QUAD_SWORD_KOKIRI * 4; i < EQUIP_TYPE_MAX;
         i++, rowStart += 4, point += 4 * 4) {
        for (k = 0, temp = rowStart + 1, bit = rowStart, j = point; k < 3; k++, bit++, j += 4, temp++) {
            if ((gBitFlags[bit] & gSaveContext.save.saveInfo.inventory.equipment) &&
                (pauseCtx->cursorSpecialPos == 0)) {
                if (CHECK_AGE_REQ_EQUIP(i, k + 1)) {
                    if (temp == cursorSlot) {
                        pauseCtx->maskVtx[j].v.ob[0] = pauseCtx->maskVtx[j + 2].v.ob[0] =
                            pauseCtx->maskVtx[j].v.ob[0] - 2;
                        pauseCtx->maskVtx[j + 1].v.ob[0] = pauseCtx->maskVtx[j + 3].v.ob[0] =
                            pauseCtx->maskVtx[j + 1].v.ob[0] + 4;
                        pauseCtx->maskVtx[j].v.ob[1] = pauseCtx->maskVtx[j + 1].v.ob[1] =
                            pauseCtx->maskVtx[j].v.ob[1] + 2;
                        pauseCtx->maskVtx[j + 2].v.ob[1] = pauseCtx->maskVtx[j + 3].v.ob[1] =
                            pauseCtx->maskVtx[j + 2].v.ob[1] - 4;
                    }
                }
            }
        }
    }

    // Draw upgrades and equips
    Gfx_SetupDL42_Opa(play->state.gfxCtx);

    gDPSetCombineMode(POLY_OPA_DISP++, G_CC_MODULATEIA_PRIM, G_CC_MODULATEIA_PRIM);
    gDPSetPrimColor(POLY_OPA_DISP++, 0, 0, 255, 255, 255, pauseCtx->alpha);

    for (rowStart = 0, j = 0, temp = 0, i = 0; i < 4; i++, rowStart += 4, j += 4 * 4) {
        gSPVertex(POLY_OPA_DISP++, &pauseCtx->maskVtx[j], 4 * 4, 0);

        // Draw upgrade `i`
        if (LINK_AGE_IN_YEARS == YEARS_CHILD) {
            point = CUR_UPG_VALUE(sChildUpgrades[i]);
            if (point != 0) {
                KaleidoScope_DrawTexQuadRGBA32(play->state.gfxCtx,
                                               gItemIcons[sChildUpgradeItemBases[i] + point - 1], ITEM_ICON_WIDTH,
                                               ITEM_ICON_HEIGHT, 0);
            }
        } else {
            if ((i == 0) && (CUR_UPG_VALUE(sAdultUpgrades[i]) == 0)) {
                // Show bullet bag instead of quiver if player has no quiver
                if (CUR_UPG_VALUE(sChildUpgrades[i]) != 0) {
                    KaleidoScope_DrawTexQuadRGBA32(
                        play->state.gfxCtx,
                        gItemIcons[sChildUpgradeItemBases[i] + CUR_UPG_VALUE(sChildUpgrades[i]) - 1], ITEM_ICON_WIDTH,
                        ITEM_ICON_HEIGHT, 0);
                }
            } else if (CUR_UPG_VALUE(sAdultUpgrades[i]) != 0) {
                KaleidoScope_DrawTexQuadRGBA32(
                    play->state.gfxCtx, gItemIcons[sAdultUpgradeItemBases[i] + CUR_UPG_VALUE(sAdultUpgrades[i]) - 1],
                    ITEM_ICON_WIDTH, ITEM_ICON_HEIGHT, 0);
            }
        }

        // Draw owned equips of type `i`
        for (k = 0, bit = rowStart, point = 4; k < 3; k++, point += 4, temp++, bit++) {
            if (gBitFlags[bit] & gSaveContext.save.saveInfo.inventory.equipment) {
                KaleidoScope_DrawTexQuadRGBA32(play->state.gfxCtx, gItemIcons[ITEM_MM_SWORD_KOKIRI + temp],
                                               ITEM_ICON_WIDTH, ITEM_ICON_HEIGHT, point);
            }
        }
    }

    // Draw player to the player prerender buffer
    KaleidoScope_DrawPlayerWork(play);

    if ((pauseCtx->mainState == PAUSE_MAIN_STATE_EQUIP_CHANGED) && (sEquipTimer == 10)) {
        KaleidoScope_SetupPlayerPreRender(play);
    }

    if ((pauseCtx->mainState == PAUSE_MAIN_STATE_EQUIP_CHANGED) && (sEquipTimer == 9)) {
#ifndef AVOID_UB
        //! @bug: This function shouldn't take any arguments
        KaleidoScope_ProcessPlayerPreRender(play);
#else
        KaleidoScope_ProcessPlayerPreRender();
#endif
    }

    gSPSegment(POLY_OPA_DISP++, 0x07, PAUSE_PLAYER_SEGMENT_RENDER_TEXTURE(pauseCtx->playerSegment));
    gSPSegment(POLY_OPA_DISP++, 0x08, pauseCtx->iconItemSegment);
    gSPSegment(POLY_OPA_DISP++, 0x09, pauseCtx->iconItem24Segment);
    gSPSegment(POLY_OPA_DISP++, 0x0A, pauseCtx->nameSegment);
    gSPSegment(POLY_OPA_DISP++, 0x0B, interfaceCtx->mapSegment);
    gSPSegment(POLY_OPA_DISP++, 0x0C, pauseCtx->iconItemAltSegment);

    // Draw player prerender onto the mask/equipment page
    Gfx_SetupDL42_Opa(play->state.gfxCtx);
    KaleidoScope_DrawEquipmentImage(play, PAUSE_PLAYER_SEGMENT_RENDER_TEXTURE(pauseCtx->playerSegment),
                                    PAUSE_EQUIP_PLAYER_WIDTH, PAUSE_EQUIP_PLAYER_HEIGHT);

    CLOSE_DISPS(play->state.gfxCtx);
}