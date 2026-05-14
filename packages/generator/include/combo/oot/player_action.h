#ifndef COMBO_OOT_PLAYER_ACTION_H
#define COMBO_OOT_PLAYER_ACTION_H

#include <combo.h>
#include <combo/oot/player.h>

#include "combo/common/animation.h"

typedef void (*PlayerActionFunc)(Player*, PlayState*);

PlayerActionFunc Player_GetIdleActionOoT(void);

LinkAnimationHeader* Player_GetIdleAnimOoT(Player* link);

s32 Player_SetupActionOoT(PlayState* play, Player* link, PlayerActionFunc actionFunc, s32 flags);
void Player_SetupActionPreserveItemActionOoT(PlayState* play, Player* link, PlayerActionFunc actionFunc, s32 flags);

s32 Player_DecelerateToZeroOoT(Player* link);

#endif