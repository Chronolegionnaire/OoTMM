/* adultmask.c */

#include <combo.h>
#include <combo/common/animation.h>
#include <combo/player.h>
#include <combo/custom.h>
#include <combo/mask.h>
#include <combo/global.h>

typedef void (*Player_SetAction_PreserveItemActionFunc)(PlayState*, Player*, void (*)(Player*, PlayState*), s32);
typedef void (*Player_BeforeCsActionFunc)(PlayState*, Player*);
typedef void (*Player_ClearAttentionAndCameraModeFunc)(Player*);
typedef void (*Player_UpdateUpperBodyOrHeldItemFunc)(Player*);
typedef void (*Player_DecelerateToZeroFunc)(Player*);
typedef void (*Player_ReturnToDefaultActionFunc)(Player*, PlayState*);
typedef void (*Player_StopCutsceneFunc)(Player*);
typedef void (*Player_Anim_PlayOnceAdjustedFunc)(PlayState*, Player*, PlayerAnimationHeader*);
typedef void (*Player_Anim_PlayOnceMorphAdjustedFunc)(PlayState*, Player*, PlayerAnimationHeader*);
typedef void (*Player_Anim_PlayOnceAdjustedFunc)(
    PlayState* play,
    Player* player,
    PlayerAnimationHeader* anim
);

typedef void (*Player_Anim_PlayOnceMorphAdjustedFunc)(
    PlayState* play,
    Player* player,
    PlayerAnimationHeader* anim
);

#define Player_Anim_PlayOnceAdjusted_Ovl \
((Player_Anim_PlayOnceAdjustedFunc)OverlayAddr(0x8082DB90))

#define Player_Anim_PlayOnceMorphAdjusted_Ovl \
((Player_Anim_PlayOnceMorphAdjustedFunc)OverlayAddr(0x8082E4A4))

#define Player_SetAction_PreserveItemAction \
((Player_SetAction_PreserveItemActionFunc)OverlayAddr(0x80831760))
#define Player_BeforeCsAction \
((Player_BeforeCsActionFunc)OverlayAddr(0x8082DE50))
#define Player_ClearAttentionAndCameraMode \
((Player_ClearAttentionAndCameraModeFunc)OverlayAddr(0x8082DAD4))
#define Player_UpdateUpperBodyOrHeldItem \
((Player_UpdateUpperBodyOrHeldItemFunc)OverlayAddr(0x8083249C))
#define Player_DecelerateToZero \
((Player_DecelerateToZeroFunc)OverlayAddr(0x80832F24))
#define Player_ReturnToDefaultAction \
((Player_ReturnToDefaultActionFunc)OverlayAddr(0x808369F4))
#define Player_StopCutscene \
((Player_StopCutsceneFunc)OverlayAddr(0x80838760))
#define Player_Anim_PlayOnceAdjusted_Ovl \
((Player_Anim_PlayOnceAdjustedFunc)OverlayAddr(0x8082DB90))
#define Player_Anim_PlayOnceMorphAdjusted_Ovl \
((Player_Anim_PlayOnceMorphAdjustedFunc)OverlayAddr(0x8082E4A4))

extern PlayerAnimationHeader gPlayerAnim_cl_setmask;
extern PlayerAnimationHeader gPlayerAnim_cl_maskoff;

typedef enum {
    ADULT_MASK_CS_NONE = 0,
    ADULT_MASK_CS_PUT_ON,
    ADULT_MASK_CS_TAKE_OFF,
} AdultMaskCutsceneMode;

static AdultMaskCutsceneMode sAdultMaskCutsceneMode = ADULT_MASK_CS_NONE;
static s32 sAdultMaskTargetAdult = 0;
static s32 sAdultMaskCommitted = 0;

#ifndef OOT_AGE_CHILD
#define OOT_AGE_CHILD 1
#endif

#ifndef OOT_AGE_ADULT
#define OOT_AGE_ADULT 0
#endif

#define ADULT_MASK_PLAYER_LOCK_FLAGS_1 0x30000000
#define ADULT_MASK_PLAYER_LOCK_FLAGS_3 0x80

#define ADULT_MASK_COMMIT_FRAME 30.0f

static s32 AdultMask_CanUse(Player* player, PlayState* play)
{
    if (player->transformation != MM_PLAYER_FORM_HUMAN)
        return 0;

    if (player->actor.draw == NULL)
        return 0;

    if (Player_InCsMode(play))
        return 0;

    if (player->stateFlags1 & 0x207c7080)
        return 0;

    if (player->stateFlags3 & 0x1000)
        return 0;

    return 1;
}

s32 AdultMask_TryUse(Player* player, PlayState* play, s32 itemAction)
{
    if (itemAction != PLAYER_CUSTOM_IA_MASK_ADULT)
        return 0;

    if (!AdultMask_CanUse(player, play))
    {
        PlaySound(0x4806); /* NA_SE_SY_ERROR */
        return 1;
    }

    player->unk_AA5 = 5;
    player->itemAction = itemAction;

    gCustomSave.customMask = PLAYER_CUSTOM_MASK_NONE;
    gSaveContext.save.equippedMask = 0;
    player->currentMask = 0;

    return 1;
}

s32 AdultMask_IsCsItem(Player* player)
{
    return player->itemAction == PLAYER_CUSTOM_IA_MASK_ADULT;
}

s32 AdultMask_IsPuttingOn(void)
{
    return sAdultMaskCutsceneMode == ADULT_MASK_CS_PUT_ON;
}

s32 AdultMask_IsActive(void)
{
    return sAdultMaskCutsceneMode != ADULT_MASK_CS_NONE;
}

s32 AdultMask_ShouldDrawAdultModel(void)
{
    return comboIsLinkAdult() || AdultMask_IsPuttingOn();
}

static void AdultMask_ReloadCurrentSceneForAge(PlayState* play)
{
    Play_SetupRespawnPoint(play, 1, 0xdff);

    gSaveContext.respawnFlag = 2;

    play->nextEntrance = gSave.entrance;
    play->transitionTrigger = TRANS_TRIGGER_START;
    play->transitionType = TRANS_TYPE_FADE_WHITE_FAST;
}

static void AdultMask_CommitAge(Player* player, PlayState* play)
{
    if (sAdultMaskCommitted)
        return;

    sAdultMaskCommitted = 1;

    if (sAdultMaskTargetAdult)
        gOotSave.age = OOT_AGE_ADULT;
    else
        gOotSave.age = OOT_AGE_CHILD;

    gSaveContext.save.playerForm = MM_PLAYER_FORM_HUMAN;
    player->transformation = MM_PLAYER_FORM_HUMAN;

    player->currentMask = 0;
    gSaveContext.save.equippedMask = 0;
    gCustomSave.customMask = PLAYER_CUSTOM_MASK_NONE;
}

static void AdultMask_UpdatePutOn(Player* player, PlayState* play)
{
    if (PlayerAnimation_OnFrame(&player->skelAnime, ADULT_MASK_COMMIT_FRAME))
        AdultMask_CommitAge(player, play);
}

static void AdultMask_UpdateTakeOff(Player* player, PlayState* play)
{
    /*
     * Commit at the end for take-off so the adult model plays the mask-off
     * animation, then returns to child.
     */
    (void)player;
    (void)play;
}

static void AdultMask_End(Player* player, PlayState* play)
{
    AdultMask_CommitAge(player, play);

    sAdultMaskCutsceneMode = ADULT_MASK_CS_NONE;
    sAdultMaskTargetAdult = 0;
    sAdultMaskCommitted = 0;

    Player_ReturnToDefaultAction(player, play);
    Player_StopCutscene(player);

    player->stateFlags1 &= ~ADULT_MASK_PLAYER_LOCK_FLAGS_1;
    player->stateFlags3 &= ~ADULT_MASK_PLAYER_LOCK_FLAGS_3;

    AdultMask_ReloadCurrentSceneForAge(play);
}

void AdultMask_Action(Player* player, PlayState* play)
{
    player->stateFlags1 |= ADULT_MASK_PLAYER_LOCK_FLAGS_1;
    player->stateFlags3 |= ADULT_MASK_PLAYER_LOCK_FLAGS_3;

    if (sAdultMaskCutsceneMode == ADULT_MASK_CS_PUT_ON)
    {
        AdultMask_UpdatePutOn(player, play);
    }
    else if (sAdultMaskCutsceneMode == ADULT_MASK_CS_TAKE_OFF)
    {
        AdultMask_UpdateTakeOff(player, play);
    }

    if (PlayerAnimation_Update(play, &player->skelAnime))
    {
        AdultMask_End(player, play);
        return;
    }

    Player_DecelerateToZero(player);
    Player_UpdateUpperBodyOrHeldItem(player);
}

void AdultMask_StartCsItem(Player* player, PlayState* play)
{
    s32 isAdult = comboIsLinkAdult();

    sAdultMaskTargetAdult = !isAdult;
    sAdultMaskCommitted = 0;

    if (isAdult)
        sAdultMaskCutsceneMode = ADULT_MASK_CS_TAKE_OFF;
    else
        sAdultMaskCutsceneMode = ADULT_MASK_CS_PUT_ON;

    Player_BeforeCsAction(play, player);
    Player_SetAction_PreserveItemAction(play, player, AdultMask_Action, 0);

    player->av1.actionVar1 = sAdultMaskTargetAdult;
    player->av2.actionVar2 = 0;

    if (sAdultMaskCutsceneMode == ADULT_MASK_CS_PUT_ON)
    {
        Player_Anim_PlayOnceMorphAdjusted_Ovl(play, player, &gPlayerAnim_cl_setmask);
    }
    else
    {
        Player_Anim_PlayOnceAdjusted_Ovl(play, player, &gPlayerAnim_cl_maskoff);
    }

    player->csId = 0x7B; /* CS_ID_GLOBAL_TALK */

    Player_UpdateUpperBodyOrHeldItem(player);

    player->stateFlags1 |= ADULT_MASK_PLAYER_LOCK_FLAGS_1;
    player->stateFlags3 |= ADULT_MASK_PLAYER_LOCK_FLAGS_3;
}

void AdultMask_AfterStart(Player* player)
{
    Player_ClearAttentionAndCameraMode(player);
}