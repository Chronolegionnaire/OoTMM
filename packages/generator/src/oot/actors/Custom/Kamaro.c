#include <combo.h>
#include <combo/player.h>
#include <combo/mask.h>
#include <combo/oot/player_action.h>
#include "combo/oot/player.h"
#include <combo/common/animation.h>
#include <combo/imported_animations.h>
#define KAMARO_DANCE_STATE_FRAME PLAYER_STATE2_5

#define PLAYER_CUSTOM_STATE2_KAMARO_DANCE (1 << 0)

#define KAMARO_DANCE_START_FRAME 0.0f
#define KAMARO_DANCE_END_FRAME   144.0f
#define KAMARO_DANCE_FRAME_COUNT 145.0f
#define KAMARO_DANCE_SPEED       1.0f

static Player* sPlayerCustomStateOwner;
static u32 sPlayerCustomState2;
static s32 sKamaroMusicActive;
static f32 sKamaroDanceFrame;

static s8 sKamaroSavedHeldItemAction;
static s8 sKamaroSavedItemAction;
static s32 sKamaroHasSavedItemAction;

static void Player_KamaroDanceActionOoT(Player* link, PlayState* play);

void Player_SetModels(Player* this, s32 modelGroup);
s32 Player_ActionToModelGroup(Player* this, s32 itemAction);

static void Player_CustomState2_ResetIfStale(Player* link)
{
    if (sPlayerCustomStateOwner != link)
    {
        sPlayerCustomStateOwner = link;
        sPlayerCustomState2 = 0;
    }
}

static void Player_CustomState2_Set(Player* link, u32 flags)
{
    Player_CustomState2_ResetIfStale(link);
    sPlayerCustomState2 |= flags;
}

static void Player_CustomState2_Clear(Player* link, u32 flags)
{
    Player_CustomState2_ResetIfStale(link);
    sPlayerCustomState2 &= ~flags;
}

static s32 Player_CustomState2_Has(Player* link, u32 flags)
{
    Player_CustomState2_ResetIfStale(link);
    return (sPlayerCustomState2 & flags) != 0;
}

static void Player_CustomState2_ClearAll(Player* link)
{
    if (sPlayerCustomStateOwner == link)
    {
        sPlayerCustomState2 = 0;
    }
}

static void Player_SaveKamaroItemActionOoT(Player* link)
{
    sKamaroSavedHeldItemAction = link->heldItemAction;
    sKamaroSavedItemAction = link->itemAction;
    sKamaroHasSavedItemAction = true;
}

static void Player_RestoreKamaroItemActionOoT(Player* link)
{
    if (!sKamaroHasSavedItemAction)
    {
        return;
    }

    link->heldItemAction = sKamaroSavedHeldItemAction;
    link->itemAction = sKamaroSavedItemAction;

    sKamaroHasSavedItemAction = false;
}

static void Player_ClearKamaroSavedItemActionOoT(void)
{
    sKamaroSavedHeldItemAction = PLAYER_IA_NONE;
    sKamaroSavedItemAction = PLAYER_IA_NONE;
    sKamaroHasSavedItemAction = false;
}

static void Player_RefreshKamaroHeldItemModelOoT(Player* link)
{
    if (link->heldItemAction != PLAYER_IA_NONE)
    {
        Player_SetModels(link, Player_ActionToModelGroup(link, link->heldItemAction));
    }
}

s32 Player_IsKamaroMaskActiveOoT(Player* link)
{
    return Player_CustomState2_Has(link, PLAYER_CUSTOM_STATE2_KAMARO_DANCE) ||
           (link->actionFunc == Player_KamaroDanceActionOoT);
}

static void Player_ClearKamaroStateOoT(Player* link)
{
    link->stateFlags2 &= ~KAMARO_DANCE_STATE_FRAME;
    Player_CustomState2_Clear(link, PLAYER_CUSTOM_STATE2_KAMARO_DANCE);
}

static void Player_StopKamaroMusicOoT(void)
{
    if (sKamaroMusicActive)
    {
        AudioSeq_QueueSeqCmd((1 << 28) | 0xff | (1 << 24) | (0 << 16));
        sKamaroMusicActive = false;
    }
}

static void Player_EndKamaroDanceOoT(PlayState* play, Player* link)
{
    Player_ClearKamaroStateOoT(link);
    Player_StopKamaroMusicOoT();

    Player_RestoreKamaroItemActionOoT(link);

    Player_SetupActionPreserveItemActionOoT(play, link, Player_GetIdleActionOoT(), 1);
    LinkAnimation_PlayOnce(play, &link->skelAnime, Player_GetIdleAnimOoT(link));

    Player_RefreshKamaroHeldItemModelOoT(link);

    link->yaw = link->actor.shape.rot.y;
}

void Player_StopKamaroMaskOoT(PlayState* play, Player* link)
{
    if (Player_IsKamaroMaskActiveOoT(link))
    {
        Player_EndKamaroDanceOoT(play, link);
    }
}

void Player_ResetKamaroMaskStateOoT(Player* link)
{
    link->stateFlags2 &= ~KAMARO_DANCE_STATE_FRAME;
    Player_CustomState2_ClearAll(link);

    sKamaroMusicActive = false;
    sKamaroDanceFrame = KAMARO_DANCE_START_FRAME;

    Player_ClearKamaroSavedItemActionOoT();
}

static s32 Player_CanStartKamaroDanceOoT(Player* link)
{
    if (link->mask != MASK_KAMARO)
    {
        return false;
    }

    if (Player_IsKamaroMaskActiveOoT(link))
    {
        return false;
    }

    if (!(link->actor.bgCheckFlags & BGCHECKFLAG_GROUND))
    {
        return false;
    }

    if (link->stateFlags1 & PLAYER_ACTOR_STATE_CUTSCENE_FROZEN)
    {
        return false;
    }

    if (link->stateFlags1 & PLAYER_ACTOR_STATE_HOLD_ITEM)
    {
        return false;
    }

    if (link->stateFlags1 & PLAYER_STATE1_DEAD)
    {
        return false;
    }

    if (link->stateFlags1 & PLAYER_STATE1_TALKING)
    {
        return false;
    }

    if (Player_UsingItem(link))
    {
        return false;
    }

    return true;
}

static void Player_ApplyKamaroAnimRangeOoT(Player* link)
{
    link->skelAnime.startFrame = KAMARO_DANCE_START_FRAME;
    link->skelAnime.endFrame = KAMARO_DANCE_END_FRAME;
    link->skelAnime.animLength = KAMARO_DANCE_FRAME_COUNT;
    link->skelAnime.playSpeed = KAMARO_DANCE_SPEED;
}

static void Player_KamaroDanceActionOoT(Player* link, PlayState* play)
{
    link->stateFlags2 |= KAMARO_DANCE_STATE_FRAME;

    Player_DecelerateToZeroOoT(link);
    link->actor.speed = link->speedXZ;
}

static void Player_UpdateKamaroDanceAnimOoT(PlayState* play, Player* link)
{
    f32 oldPlaySpeed;

    link->stateFlags2 |= KAMARO_DANCE_STATE_FRAME;

    Player_ApplyKamaroAnimRangeOoT(link);

    sKamaroDanceFrame += KAMARO_DANCE_SPEED;

    while (sKamaroDanceFrame >= KAMARO_DANCE_FRAME_COUNT)
    {
        sKamaroDanceFrame -= KAMARO_DANCE_FRAME_COUNT;
    }

    while (sKamaroDanceFrame < KAMARO_DANCE_START_FRAME)
    {
        sKamaroDanceFrame += KAMARO_DANCE_FRAME_COUNT;
    }

    oldPlaySpeed = link->skelAnime.playSpeed;

    link->skelAnime.curFrame = sKamaroDanceFrame;
    link->skelAnime.playSpeed = 0.0f;

    LinkAnimation_Update(play, &link->skelAnime);

    link->skelAnime.curFrame = sKamaroDanceFrame;
    link->skelAnime.playSpeed = oldPlaySpeed;

    Player_DecelerateToZeroOoT(link);
    link->actor.speed = link->speedXZ;
}

static void Player_StartKamaroDanceOoT(PlayState* play, Player* link)
{
    if (!Player_CanStartKamaroDanceOoT(link))
    {
        return;
    }

    Player_SaveKamaroItemActionOoT(link);

    link->heldItemAction = PLAYER_IA_NONE;
    link->itemAction = PLAYER_IA_NONE;

    Player_SetupActionPreserveItemActionOoT(play, link, Player_KamaroDanceActionOoT, 0);

    LinkAnimation_PlayLoopSetSpeed(
        play,
        &link->skelAnime,
        (LinkAnimationHeader*)&gPlayerAnim_alink_dance_loop,
        KAMARO_DANCE_SPEED
    );

    Player_ApplyKamaroAnimRangeOoT(link);

    sKamaroDanceFrame = KAMARO_DANCE_START_FRAME;
    link->skelAnime.curFrame = sKamaroDanceFrame;

    Player_CustomState2_Set(link, PLAYER_CUSTOM_STATE2_KAMARO_DANCE);

    sKamaroMusicActive = true;
    Audio_PlayFanfare(FANFARE_KAMARO);
}

void Player_UpdateKamaroMaskOoT(PlayState* play, Player* link, Input* input)
{
    if (input == NULL)
    {
        return;
    }

    if (Player_IsKamaroMaskActiveOoT(link) && link->mask != MASK_KAMARO)
    {
        Player_EndKamaroDanceOoT(play, link);
        return;
    }

    if (Player_CustomState2_Has(link, PLAYER_CUSTOM_STATE2_KAMARO_DANCE))
    {
        if (!(input->cur.button & B_BUTTON))
        {
            Player_EndKamaroDanceOoT(play, link);
            return;
        }

        if (link->actionFunc != Player_KamaroDanceActionOoT)
        {
            Player_SetupActionPreserveItemActionOoT(play, link, Player_KamaroDanceActionOoT, 0);
        }

        input->press.button &= ~B_BUTTON;

        Player_UpdateKamaroDanceAnimOoT(play, link);
        return;
    }

    if ((input->press.button & B_BUTTON) && Player_CanStartKamaroDanceOoT(link))
    {
        input->press.button &= ~B_BUTTON;

        Player_StartKamaroDanceOoT(play, link);

        Player_UpdateKamaroDanceAnimOoT(play, link);
    }
}