#include <combo.h>
#include <combo/oot/player.h>
#include <combo/oot/player_action.h>

typedef s32 (*PlayerSetupActionFunc)(PlayState*, Player*, PlayerActionFunc, s32);
typedef void (*PlayerSetupActionPreserveItemActionFunc)(PlayState*, Player*, PlayerActionFunc, s32);
typedef LinkAnimationHeader* (*PlayerGetIdleAnimFunc)(Player*);

#define OOT_PLAYER_ACTION_IDLE_ADDR                         0x8083ec4c
#define OOT_PLAYER_SETUP_ACTION_ADDR                        0x80833cfc
#define OOT_PLAYER_SETUP_ACTION_PRESERVE_ITEM_ACTION_ADDR   0x80833e8c
#define OOT_PLAYER_GET_IDLE_ANIM_ADDR                       0x80831328

PlayerActionFunc Player_GetIdleActionOoT(void)
{
    return OverlayAddr(OOT_PLAYER_ACTION_IDLE_ADDR);
}

LinkAnimationHeader* Player_GetIdleAnimOoT(Player* link)
{
    PlayerGetIdleAnimFunc fn;

    fn = OverlayAddr(OOT_PLAYER_GET_IDLE_ANIM_ADDR);
    return fn(link);
}

s32 Player_SetupActionOoT(PlayState* play, Player* link, PlayerActionFunc actionFunc, s32 flags)
{
    PlayerSetupActionFunc fn;

    fn = OverlayAddr(OOT_PLAYER_SETUP_ACTION_ADDR);
    return fn(play, link, actionFunc, flags);
}

void Player_SetupActionPreserveItemActionOoT(PlayState* play, Player* link, PlayerActionFunc actionFunc, s32 flags)
{
    PlayerSetupActionPreserveItemActionFunc fn;

    fn = OverlayAddr(OOT_PLAYER_SETUP_ACTION_PRESERVE_ITEM_ACTION_ADDR);
    fn(play, link, actionFunc, flags);
}

s32 Player_DecelerateToZeroOoT(Player* link)
{
    return Math_StepToF(&link->speedXZ, 0.0f, R_DECELERATE_RATE / 100.0f);
}