/* adultmask.c */

#include <combo.h>
#include <combo/common/animation.h>
#include <combo/player.h>
#include <combo/custom.h>
#include <combo/mask.h>
#include <combo/global.h>

typedef void (*PlayerActionFunc)(Player*, PlayState*);
typedef void (*Player_SetAction_PreserveItemActionFunc)(PlayState*, Player*, PlayerActionFunc, s32);
typedef void (*Player_BeforeCsActionFunc)(PlayState*, Player*);
typedef void (*Player_ClearAttentionAndCameraModeFunc)(Player*);
typedef void (*Player_UpdateUpperBodyOrHeldItemFunc)(Player*);
typedef void (*Player_DecelerateToZeroFunc)(Player*);
typedef void (*Player_ReturnToDefaultActionFunc)(Player*, PlayState*);
typedef void (*Player_StopCutsceneFunc)(Player*);
typedef void (*Player_Anim_PlayOnceAdjustedFunc)(PlayState*, Player*, PlayerAnimationHeader*);
typedef void (*Player_Anim_PlayOnceMorphAdjustedFunc)(PlayState*, Player*, PlayerAnimationHeader*);
typedef void (*Player_StartMaskTransformCsFunc)(Player*, s16);

typedef struct struct_8085D910 {
    /* 0x0 */ u8 unk_0;
    /* 0x1 */ u8 unk_1;
    /* 0x2 */ u8 unk_2;
    /* 0x3 */ u8 unk_3;
} struct_8085D910;

typedef void (*Player_UpdateMaskTransformEffectsFunc)(PlayState*, Player*, struct_8085D910**);
typedef void (*Player_DrawMaskTransformEffectsFunc)(PlayState*, Player*, f32, f32, s32);
typedef s32 (*Camera_ChangeModeFunc)(Camera*, s16);

#define Camera_ChangeMode \
    ((Camera_ChangeModeFunc)(0x800DF840))

#ifndef CAM_MODE_NORMAL
#define CAM_MODE_NORMAL 0
#endif

#ifndef PLAYER_CS_ID_MASK_TRANSFORMATION
#define PLAYER_CS_ID_MASK_TRANSFORMATION 5
#endif

#ifndef OOT_AGE_CHILD
#define OOT_AGE_CHILD 1
#endif

#ifndef OOT_AGE_ADULT
#define OOT_AGE_ADULT 0
#endif

#ifndef NA_SE_SY_TRANSFORM_MASK_FLASH
#define NA_SE_SY_TRANSFORM_MASK_FLASH 0x2847
#endif

#ifndef NA_SE_EV_LIGHTNING_HARD
#define NA_SE_EV_LIGHTNING_HARD 0x4800
#endif

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

#define Player_StartMaskTransformCs \
    ((Player_StartMaskTransformCsFunc)OverlayAddr(0x808323C0))

#define Player_UpdateMaskTransformEffects \
    ((Player_UpdateMaskTransformEffectsFunc)OverlayAddr(0x80855218))

#define Player_DrawMaskTransformEffects \
    ((Player_DrawMaskTransformEffectsFunc)OverlayAddr(0x808550D0))

#define D_8085D910 \
    ((struct_8085D910*)OverlayAddr(0x8085D910))

extern PlayerAnimationHeader gPlayerAnim_cl_setmask;
extern PlayerAnimationHeader gPlayerAnim_cl_maskoff;

extern void Play_EnableMotionBlurPriority(s32 priority);
extern void Play_DisableMotionBlurPriority(void);

typedef enum {
    ADULT_MASK_CS_NONE = 0,
    ADULT_MASK_CS_PUT_ON,
    ADULT_MASK_CS_TAKE_OFF,
} AdultMaskCutsceneMode;

static AdultMaskCutsceneMode sAdultMaskCutsceneMode = ADULT_MASK_CS_NONE;
static s32 sAdultMaskTargetAdult = 0;
static s32 sAdultMaskCommitted = 0;
static s32 sAdultMaskTimer = 0;
static s32 sAdultMaskPlayedFlashSfx = 0;

/*
 * Lock flags copied from your previous implementation.
 */
#define ADULT_MASK_PLAYER_LOCK_FLAGS_1 0x30000000
#define ADULT_MASK_PLAYER_LOCK_FLAGS_3 0x80

/*
 * The save age changes here, but MM playerForm remains Human.
 */
#define ADULT_MASK_COMMIT_FRAME 30

/*
 * No vanilla R_PLAY_FILL_SCREEN_ON tail.
 * Keep the visual effect pipeline alive long enough for motion blur/ring,
 * then use AdultMask_ReloadCurrentSceneForAge() and TRANS_TYPE_FADE_WHITE_FAST.
 */
#define ADULT_MASK_VISUAL_END_FRAME 0x60

#define ADULT_MASK_DRAW_HAND_END        0x10
#define ADULT_MASK_DRAW_TRANSFORM_START ADULT_MASK_COMMIT_FRAME


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
        PlaySound(0x4806);
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

s32 AdultMask_GetTimer(void)
{
    return sAdultMaskTimer;
}

static int AdultMask_PrepareObject(PlayState* play, u16 objectId)
{
    void* obj;

    obj = comboGetObject(objectId);
    if (!obj)
        return 0;

    OPEN_DISPS(play->state.gfxCtx);
    gSPSegment(POLY_OPA_DISP++, 0x0a, obj);
    CLOSE_DISPS();

    return 1;
}

static void AdultMask_DrawDLsAtMatrix(
    PlayState* play,
    u16 objectId,
    Gfx* dl0,
    Gfx* dl1,
    u32 baseMatrix,
    f32 scale,
    f32 yOffset,
    f32 zOffset
)
{

    if (!AdultMask_PrepareObject(play, objectId))
        return;

    OPEN_DISPS(play->state.gfxCtx);

    Gfx_SetupDL25_Opa(play->state.gfxCtx);

    /*
     * The caller supplies the player matrix slot.
     *
     * 0x0D000300 = right-hand style matrix
     * 0x0D0001C0 = face/head style matrix used by your other custom masks
     */
    gSPMatrix(
        POLY_OPA_DISP++,
        baseMatrix,
        G_MTX_NOPUSH | G_MTX_LOAD | G_MTX_MODELVIEW
    );

    if ((scale != 1.0f) || (yOffset != 0.0f) || (zOffset != 0.0f))
    {
        Matrix_Push();

        /*
         * Clean local delta matrix.
         * Do not inherit whatever the CPU matrix stack currently contains.
         */
        Matrix_Translate(0.0f, 0.0f, 0.0f, MTXMODE_NEW);
        Matrix_Translate(0.0f, yOffset, zOffset, MTXMODE_APPLY);
        Matrix_Scale(scale, scale, scale, MTXMODE_APPLY);

        gSPMatrix(
            POLY_OPA_DISP++,
            Matrix_Finalize(play->state.gfxCtx),
            G_MTX_NOPUSH | G_MTX_MUL | G_MTX_MODELVIEW
        );

        Matrix_Pop();
    }

    if (dl0 != NULL)
        gSPDisplayList(POLY_OPA_DISP++, dl0);

    if (dl1 != NULL)
        gSPDisplayList(POLY_OPA_DISP++, dl1);

    CLOSE_DISPS();
}

static void AdultMask_ResetVisualState(Player* player)
{
    sAdultMaskTimer = 0;
    sAdultMaskPlayedFlashSfx = 0;

    /*
     * Adult Mask does not use vanilla's R_PLAY_FILL_SCREEN_ON tail.
     * Your fast white fade transition handles the final white-out.
     */
    R_PLAY_FILL_SCREEN_ON = 0;
    R_PLAY_FILL_SCREEN_ALPHA = 0;

    player->av1.actionVar1 = 0;
    player->av2.actionVar2 = 0;

    player->unk_B10[2] = 0.0f;
    player->unk_B10[3] = 0.0f;
    player->unk_B10[4] = 0.0f;
    player->unk_B10[5] = 0.0f;
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
    if (!Config_Flag(CFG_MM_CROSS_AGE))
    {
        gMmSave.linkAge = sAdultMaskTargetAdult ? OOT_AGE_ADULT : OOT_AGE_CHILD;
    }
    else
    {
        gMmSave.linkAge = sAdultMaskTargetAdult ? OOT_AGE_ADULT : OOT_AGE_CHILD;
    }

    /*
     * Adult Mask changes OoT age only.
     * MM playerForm must remain Human.
     */
    gSaveContext.save.playerForm = MM_PLAYER_FORM_HUMAN;
    player->transformation = MM_PLAYER_FORM_HUMAN;

    player->currentMask = 0;
    gSaveContext.save.equippedMask = 0;
    gCustomSave.customMask = PLAYER_CUSTOM_MASK_NONE;

    (void)play;
}

static void AdultMask_UpdateTransformCameraAndEffects(Player* player, PlayState* play)
{
    struct_8085D910* effectConfig;
    Camera* cam;

    if (sAdultMaskCutsceneMode != ADULT_MASK_CS_PUT_ON)
        return;
    effectConfig = &D_8085D910[0];

    /*
     * Native Player_Action_86 does this every frame.
     */
    Player_StartMaskTransformCs(player, player->csId);

    cam = Play_GetCamera(play, play->activeCamId);

    Camera_ChangeMode(cam, CAM_MODE_NORMAL);

    player->stateFlags2 |= PLAYER_STATE2_MM_40;
    player->actor.shape.rot.y = Camera_GetCamDirYaw(cam) + 0x8000;

    /*
     * Native helper:
     * - updates cl_setmask / cl_setmaskend
     * - plays animation SFX
     * - drives unk_B10[2/3]
     *
     * Do not call PlayerAnimation_Update again for this same put-on path.
     */
    Player_UpdateMaskTransformEffects(play, player, &effectConfig);

    /*
     * Native Player_Action_86 increments av1.actionVar1 once per frame.
     */
    player->av1.actionVar1++;
    sAdultMaskTimer = player->av1.actionVar1;

    /*
     * Native blue motion blur trigger.
     */
    if (player->av1.actionVar1 == 0x14)
    {
        Play_EnableMotionBlurPriority(100);
    }

    /*
     * Native transform-light buildup using unk_B10[4].
     */
    if (player->av1.actionVar1 >= effectConfig->unk_0)
    {
        if (player->av1.actionVar1 < effectConfig->unk_2)
        {
            Math_StepToF(&player->unk_B10[4], 1.0f, effectConfig->unk_1 / 100.0f);
        }
        else if (player->av1.actionVar1 < effectConfig->unk_3)
        {
            if (player->av1.actionVar1 == effectConfig->unk_2)
                PlaySound(NA_SE_EV_LIGHTNING_HARD);

            Math_StepToF(&player->unk_B10[4], 2.0f, 0.5f);
        }
        else
        {
            Math_StepToF(&player->unk_B10[4], 3.0f, 0.2f);
        }
    }

    /*
     * Native transform-ring/head-light buildup using unk_B10[5].
     */
    if (player->av1.actionVar1 >= 0x10)
    {
        if (player->av1.actionVar1 < 0x40)
        {
            Math_StepToF(&player->unk_B10[5], 1.0f, 0.2f);
        }
        else
        {
            Math_StepToF(&player->unk_B10[5], 3.0f, 0.55f);
        }
    }

    /*
     * Native transform effect draw/update hook.
     * Human putting on a transformation mask passes 0 here.
     */
    Player_DrawMaskTransformEffects(
        play,
        player,
        player->unk_B10[4],
        player->unk_B10[5],
        0
    );
}

static void AdultMask_UpdatePutOn(Player* player, PlayState* play)
{
    if (!sAdultMaskCommitted && sAdultMaskTimer >= ADULT_MASK_COMMIT_FRAME)
        AdultMask_CommitAge(player, play);
}

static void AdultMask_UpdateTakeOff(Player* player, PlayState* play)
{
    /*
     * Commit at the end so adult model plays mask-off first,
     * then reloads as child.
     */
    (void)player;
    (void)play;
}

static void AdultMask_End(Player* player, PlayState* play)
{
    AdultMask_CommitAge(player, play);

    Play_DisableMotionBlurPriority();

    sAdultMaskCutsceneMode = ADULT_MASK_CS_NONE;
    sAdultMaskTargetAdult = 0;
    sAdultMaskCommitted = 0;
    sAdultMaskTimer = 0;
    sAdultMaskPlayedFlashSfx = 0;

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

    gSaveContext.save.playerForm = MM_PLAYER_FORM_HUMAN;
    player->transformation = MM_PLAYER_FORM_HUMAN;
    player->itemAction = PLAYER_CUSTOM_IA_MASK_ADULT;

    if (sAdultMaskCutsceneMode == ADULT_MASK_CS_PUT_ON)
    {
        AdultMask_UpdateTransformCameraAndEffects(player, play);
        AdultMask_UpdatePutOn(player, play);
        if ((sAdultMaskTimer >= 0x54) && !sAdultMaskPlayedFlashSfx)
        {
            sAdultMaskPlayedFlashSfx = 1;
            Player_PlaySfx(player, NA_SE_SY_TRANSFORM_MASK_FLASH);
        }
        if (sAdultMaskTimer >= ADULT_MASK_VISUAL_END_FRAME)
        {
            AdultMask_End(player, play);
            return;
        }
    }
    else
    {
        AdultMask_UpdateTakeOff(player, play);

        if (PlayerAnimation_Update(play, &player->skelAnime))
        {
            AdultMask_End(player, play);
            return;
        }
    }

    Player_DecelerateToZero(player);
    Player_UpdateUpperBodyOrHeldItem(player);
}

void AdultMask_StartCsItem(Player* player, PlayState* play)
{
    s32 isAdult;
    isAdult = comboIsLinkAdult();

    sAdultMaskTargetAdult = !isAdult;
    sAdultMaskCommitted = 0;

    if (isAdult)
        sAdultMaskCutsceneMode = ADULT_MASK_CS_TAKE_OFF;
    else
        sAdultMaskCutsceneMode = ADULT_MASK_CS_PUT_ON;

    Player_BeforeCsAction(play, player);
    Player_SetAction_PreserveItemAction(play, player, AdultMask_Action, 0);

    player->itemAction = PLAYER_CUSTOM_IA_MASK_ADULT;

    AdultMask_ResetVisualState(player);

    if (sAdultMaskCutsceneMode == ADULT_MASK_CS_PUT_ON)
    {
        /*
         * Use the same mask transformation cutscene id native masking uses.
         * If your project names this field playerCsIds instead of playerActorCsIds,
         * switch this line back to playerCsIds.
         */
        player->csId = play->playerActorCsIds[PLAYER_CS_ID_MASK_TRANSFORMATION];

        Player_StartMaskTransformCs(player, player->csId);

        {
            Camera* cam = Play_GetCamera(play, play->activeCamId);

            Camera_ChangeMode(cam, CAM_MODE_NORMAL);
            player->actor.shape.rot.y = Camera_GetCamDirYaw(cam) + 0x8000;
        }

        Player_Anim_PlayOnceMorphAdjusted_Ovl(play, player, &gPlayerAnim_cl_setmask);
    }
    else
    {
        player->csId = 0x7B;
        Player_Anim_PlayOnceAdjusted_Ovl(play, player, &gPlayerAnim_cl_maskoff);
    }

    Player_UpdateUpperBodyOrHeldItem(player);

    player->stateFlags1 |= ADULT_MASK_PLAYER_LOCK_FLAGS_1;
    player->stateFlags3 |= ADULT_MASK_PLAYER_LOCK_FLAGS_3;
}

void AdultMask_AfterStart(Player* player)
{
    if (sAdultMaskCutsceneMode != ADULT_MASK_CS_PUT_ON)
        Player_ClearAttentionAndCameraMode(player);
}