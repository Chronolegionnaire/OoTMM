#ifndef COMBO_MM_ADULT_MASK_H
#define COMBO_MM_ADULT_MASK_H

#include <combo/types.h>
#include "play.h"
#include "player.h"

s32 AdultMask_TryUse(Player* player, PlayState* play, s32 itemAction);
s32 AdultMask_IsCsItem(Player* player);
void AdultMask_StartCsItem(Player* player, PlayState* play);
void AdultMask_AfterStart(Player* player);
s32 AdultMask_IsPuttingOn(void);
s32 AdultMask_IsTakeOffTransform(void);
s32 AdultMask_IsTakeOffChild(void);
s32 AdultMask_ShouldDrawTransformFace(void);
s32 AdultMask_GetTimer(void);
void AdultMask_DrawTransformationMaskOnFace(PlayState* play, Player* player);
void AdultMask_DrawMaskOnFaceNativeLike(PlayState* play, Player* player);
void AdultMask_DrawMaskInHand(PlayState* play, Player* player);
void AdultMask_DrawTransformRing(PlayState* play, Player* player);


#endif