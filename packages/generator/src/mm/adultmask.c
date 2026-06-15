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
typedef void (*ActorUpdateFunc)(Actor*, PlayState*);
typedef s32 (*Camera_ChangeModeFunc)(Camera*, s16);

typedef struct struct_8085D910 {
    u8 unk_0;
    u8 unk_1;
    u8 unk_2;
    u8 unk_3;
} struct_8085D910;

typedef void (*Player_UpdateMaskTransformEffectsFunc)(PlayState*, Player*, struct_8085D910**);
typedef void (*Player_DrawMaskTransformEffectsFunc)(PlayState*, Player*, f32, f32, s32);

#ifndef CAM_MODE_NORMAL
#define CAM_MODE_NORMAL 0
#endif

#ifndef CAM_MODE_JUMP
#define CAM_MODE_JUMP 1
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

#ifndef PLAYER_CSACTION_NONE
#define PLAYER_CSACTION_NONE 0
#endif

#ifndef CS_ID_NONE
#define CS_ID_NONE -1
#endif

#ifndef SUB_CAM_ID_DONE
#define SUB_CAM_ID_DONE 0
#endif

#ifndef NA_SE_SY_TRANSFORM_MASK_FLASH
#define NA_SE_SY_TRANSFORM_MASK_FLASH 0x2847
#endif

#ifndef NA_SE_EV_LIGHTNING_HARD
#define NA_SE_EV_LIGHTNING_HARD 0x4800
#endif

#ifndef NA_SE_SY_WHITE_OUT_T
#define NA_SE_SY_WHITE_OUT_T 0x4807
#endif

#define Camera_ChangeMode \
    ((Camera_ChangeModeFunc)(0x800DF840))

#define Player_FormReloadUpdate \
    ((ActorUpdateFunc)(0x8012301C))

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

#define PLAYER_AGE_PROPERTIES_BASE 0x8085BA38
#define PLAYER_AGE_PROPERTIES_SIZE 0xDC

#define PLAYER_AGE_PROPERTIES_FIERCE_DEITY \
    ((PlayerAgeProperties*)OverlayAddr(PLAYER_AGE_PROPERTIES_BASE + PLAYER_AGE_PROPERTIES_SIZE * 0))

#define PLAYER_AGE_PROPERTIES_ZORA \
    ((PlayerAgeProperties*)OverlayAddr(PLAYER_AGE_PROPERTIES_BASE + PLAYER_AGE_PROPERTIES_SIZE * 2))

#define PLAYER_AGE_PROPERTIES_HUMAN \
    ((PlayerAgeProperties*)OverlayAddr(PLAYER_AGE_PROPERTIES_BASE + PLAYER_AGE_PROPERTIES_SIZE * 4))



extern PlayerAnimationHeader gPlayerAnim_cl_setmask;
extern PlayerAnimationHeader gPlayerAnim_cl_maskoff;
extern PlayerAnimationHeader gPlayerAnim_pz_maskoffstart;

extern void Play_EnableMotionBlurPriority(s32 priority);
extern void Play_DisableMotionBlurPriority(void);

extern void ComboPlayer_ApplyAgeModelTables(void);

extern void func_80123140(PlayState* play, Player* player);
extern f32 Player_GetHeight(Player* player);

extern void PlayerCall_Update(Actor* thisx, PlayState* play);
extern void PlayerCall_Draw(Actor* thisx, PlayState* play);

extern AnimatedMaterial gameplay_keep_Matanimheader_054F18[];
extern Gfx gameplay_keep_DL_054C90[];

typedef enum {
    ADULT_MASK_CS_NONE = 0,
    ADULT_MASK_CS_PUT_ON,

    /*
     * Full transformed-form mask-off-start stage:
     * plays gPlayerAnim_pz_maskoffstart, CAM_MODE_JUMP, purple ring,
     * native transform effects, then white fade/reload.
     */
    ADULT_MASK_CS_TAKE_OFF_TRANSFORM,

    /*
     * After reload into child human, play short lower-hand cleanup:
     * gPlayerAnim_cl_maskoff, draw mask in hand.
     */
    ADULT_MASK_CS_TAKE_OFF_LOWER_HAND,
} AdultMaskCutsceneMode;

static AdultMaskCutsceneMode sAdultMaskCutsceneMode = ADULT_MASK_CS_NONE;
static s32 sAdultMaskTargetAdult = 0;
static s32 sAdultMaskCommitted = 0;
static s32 sAdultMaskTimer = 0;
static s32 sAdultMaskPlayedFlashSfx = 0;
static s32 sAdultMaskDrawTransformFace = 0;
static s32 sAdultMaskStartedWhiteCover = 0;
static s32 sAdultMaskPlayerReloadStarted = 0;
static s32 sAdultMaskPostReloadFixFrames = 0;

static void AdultMask_ClearState(void);
static void AdultMask_StartTakeOffLowerHand(Player* player, PlayState* play);
static void AdultMask_PlayerReloadUpdateWrapper(Actor* thisx, PlayState* play);

void AdultMask_Action(Player* player, PlayState* play);

void AdultMask_DrawMaskInHand(PlayState* play, Player* player)
{
    void* obj;

    obj = comboGetObject(CUSTOM_OBJECT_ID_ADULT_MASK_EQUIPMENT | MASK_CUSTOM_OBJECT);
    if (!obj)
        return;

    OPEN_DISPS(play->state.gfxCtx);

    Gfx_SetupDL25_Opa(play->state.gfxCtx);
    gSPSegment(POLY_OPA_DISP++, 0x0a, obj);

    Matrix_Push();

    Matrix_Translate(-323.67f, 412.15f, -969.96f, MTXMODE_APPLY);
    Matrix_RotateZYX(-0x32BE, -0x50DE, -0x7717, MTXMODE_APPLY);

    gSPMatrix(
        POLY_OPA_DISP++,
        Matrix_Finalize(play->state.gfxCtx),
        G_MTX_NOPUSH | G_MTX_LOAD | G_MTX_MODELVIEW
    );

    gSPDisplayList(POLY_OPA_DISP++, CUSTOM_OBJECT_ADULT_MASK_EQUIPMENT_0);

    Matrix_Pop();

    CLOSE_DISPS();

    (void)player;
}

void AdultMask_DrawMaskOnFaceNativeLike(PlayState* play, Player* player)
{
    void* obj;

    obj = comboGetObject(CUSTOM_OBJECT_ID_ADULT_MASK_EQUIPMENT | MASK_CUSTOM_OBJECT);
    if (!obj)
        return;

    OPEN_DISPS(play->state.gfxCtx);

    Gfx_SetupDL25_Opa(play->state.gfxCtx);
    gSPSegment(POLY_OPA_DISP++, 0x0a, obj);

    Matrix_Push();

    Matrix_Scale(
        1.0f,
        1.0f - player->unk_B10[3],
        1.0f - player->unk_B10[2],
        MTXMODE_APPLY
    );

    gSPMatrix(
        POLY_OPA_DISP++,
        Matrix_Finalize(play->state.gfxCtx),
        G_MTX_NOPUSH | G_MTX_LOAD | G_MTX_MODELVIEW
    );

    gSPDisplayList(POLY_OPA_DISP++, CUSTOM_OBJECT_ADULT_MASK_EQUIPMENT_0);

    Matrix_Pop();

    CLOSE_DISPS();
}

void AdultMask_DrawTransformationMaskOnFace(PlayState* play, Player* player)
{
    void* obj;

    obj = comboGetObject(CUSTOM_OBJECT_ID_MASK_ADULT_TRANSFORM_PLAYER);
    if (!obj)
        return;

    OPEN_DISPS(play->state.gfxCtx);

    Gfx_SetupDL25_Opa(play->state.gfxCtx);
    gSPSegment(POLY_OPA_DISP++, 0x0a, obj);

    Matrix_Push();

    gSPMatrix(
        POLY_OPA_DISP++,
        Matrix_Finalize(play->state.gfxCtx),
        G_MTX_NOPUSH | G_MTX_LOAD | G_MTX_MODELVIEW
    );

    gSPDisplayList(POLY_OPA_DISP++, CUSTOM_OBJECT_MASK_ADULT_TRANSFORM_PLAYER_0);

    Matrix_Pop();

    CLOSE_DISPS();

    (void)player;
}

s32 AdultMask_IsActive(void)
{
    return sAdultMaskCutsceneMode != ADULT_MASK_CS_NONE;
}

s32 AdultMask_IsPuttingOn(void)
{
    return sAdultMaskCutsceneMode == ADULT_MASK_CS_PUT_ON;
}

s32 AdultMask_IsTakingOff(void)
{
    return sAdultMaskCutsceneMode == ADULT_MASK_CS_TAKE_OFF_TRANSFORM ||
           sAdultMaskCutsceneMode == ADULT_MASK_CS_TAKE_OFF_LOWER_HAND;
}

s32 AdultMask_IsTakeOffTransform(void)
{
    return sAdultMaskCutsceneMode == ADULT_MASK_CS_TAKE_OFF_TRANSFORM;
}

s32 AdultMask_IsTakeOffLowerHand(void)
{
    return sAdultMaskCutsceneMode == ADULT_MASK_CS_TAKE_OFF_LOWER_HAND;
}

static void AdultMask_LoadHumanAgeProperties(u32 vrom)
{
    LoadFile(
        PLAYER_AGE_PROPERTIES_HUMAN,
        vrom,
        sizeof(PlayerAgeProperties)
    );
}

static void AdultMask_ApplyChildHumanAgeProperties(void)
{
    AdultMask_LoadHumanAgeProperties(CUSTOM_MM_CHILD_HUMAN_AGE_PROPERTIES_VROM);
}

static void AdultMask_ApplyAdultHumanAgeProperties(void)
{
    AdultMask_LoadHumanAgeProperties(CUSTOM_MM_ADULT_HUMAN_AGE_PROPERTIES_VROM);
}

static void AdultMask_ApplyTargetHumanAgeProperties(void)
{
    if (sAdultMaskTargetAdult)
        AdultMask_ApplyAdultHumanAgeProperties();
    else
        AdultMask_ApplyChildHumanAgeProperties();
}

static void AdultMask_ApplyRuntimeAgePropertiesNow(Player* player, PlayState* play)
{
    f32 height;

    AdultMask_ApplyTargetHumanAgeProperties();

    player->ageProperties = PLAYER_AGE_PROPERTIES_HUMAN;

    func_80123140(play, player);

    height = Player_GetHeight(player);

    player->actor.focus.pos.y = player->actor.world.pos.y + height;

    player->cylinder.dim.height = height;
    player->cylinder.dim.yShift = 0;
    player->cylinder.dim.radius = player->ageProperties->wallCheckRadius;

    player->actor.cullingVolumeDistance = 4000.0f;
    player->actor.cullingVolumeScale = height;
    player->actor.cullingVolumeDownward = height;
}

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

s32 AdultMask_ShouldDrawAdultModel(void)
{
    return comboIsLinkAdult();
}

s32 AdultMask_GetTimer(void)
{
    return sAdultMaskTimer;
}

s32 AdultMask_ShouldDrawTransformFace(void)
{
    return sAdultMaskDrawTransformFace;
}

static void AdultMask_ClearState(void)
{
    sAdultMaskCutsceneMode = ADULT_MASK_CS_NONE;
    sAdultMaskTargetAdult = 0;
    sAdultMaskCommitted = 0;
    sAdultMaskTimer = 0;
    sAdultMaskPlayedFlashSfx = 0;
    sAdultMaskDrawTransformFace = 0;
    sAdultMaskStartedWhiteCover = 0;
    sAdultMaskPlayerReloadStarted = 0;
    sAdultMaskPostReloadFixFrames = 0;
}

void AdultMask_ResetDrawStateForNewPlay(void)
{
    AdultMask_ClearState();
}

static void AdultMask_StartWhiteCover(PlayState* play)
{
    if (sAdultMaskStartedWhiteCover)
        return;

    sAdultMaskStartedWhiteCover = 1;

    Play_FillScreen(play, 45, 255, 255, 255, 255);
}

static void AdultMask_ResetVisualState(Player* player)
{
    sAdultMaskTimer = 0;
    sAdultMaskPlayedFlashSfx = 0;
    sAdultMaskDrawTransformFace = 0;
    sAdultMaskStartedWhiteCover = 0;
    sAdultMaskPlayerReloadStarted = 0;
    sAdultMaskPostReloadFixFrames = 0;

    R_PLAY_FILL_SCREEN_ON = 0;
    R_PLAY_FILL_SCREEN_ALPHA = 0;

    player->av1.actionVar1 = 0;
    player->av2.actionVar2 = 0;

    player->unk_B10[2] = 0.0f;
    player->unk_B10[3] = 0.0f;
    player->unk_B10[4] = 0.0f;
    player->unk_B10[5] = 0.0f;
}

static void AdultMask_CommitAge(Player* player, PlayState* play)
{
    if (sAdultMaskCommitted)
        return;

    sAdultMaskCommitted = 1;

    gMmSave.linkAge = sAdultMaskTargetAdult ? OOT_AGE_ADULT : OOT_AGE_CHILD;

    gSaveContext.save.playerForm = MM_PLAYER_FORM_HUMAN;
    player->transformation = MM_PLAYER_FORM_HUMAN;

    player->currentMask = 0;
    gSaveContext.save.equippedMask = 0;
    gCustomSave.customMask = PLAYER_CUSTOM_MASK_NONE;

    (void)play;
}

static void AdultMask_EndCutsceneCamera(Player* player)
{
    Player_StopCutscene(player);
    Player_ClearAttentionAndCameraMode(player);

    player->csMode = PLAYER_CSACTION_NONE;
    player->prevCsAction = PLAYER_CSACTION_NONE;
    player->csId = CS_ID_NONE;
    player->subCamId = SUB_CAM_ID_DONE;
}

static void AdultMask_CommitAgeApplyTablesAndReloadPlayer(Player* player, PlayState* play)
{
    if (sAdultMaskPlayerReloadStarted)
        return;

    sAdultMaskPlayerReloadStarted = 1;

    player->actor.draw = NULL;

    Play_DisableMotionBlurPriority();

    AdultMask_CommitAge(player, play);
    ComboPlayer_ApplyAgeModelTables();
    AdultMask_ApplyTargetHumanAgeProperties();
    AdultMask_EndCutsceneCamera(player);

    gSaveContext.save.playerForm = MM_PLAYER_FORM_HUMAN;
    player->transformation = MM_PLAYER_FORM_HUMAN;

    player->currentMask = 0;
    gSaveContext.save.equippedMask = 0;
    gCustomSave.customMask = PLAYER_CUSTOM_MASK_NONE;

    player->itemAction = PLAYER_IA_NONE;
    player->heldItemAction = PLAYER_IA_NONE;

    player->stateFlags1 &= ~ADULT_MASK_PLAYER_LOCK_FLAGS_1;
    player->stateFlags3 &= ~ADULT_MASK_PLAYER_LOCK_FLAGS_3;

    sAdultMaskPostReloadFixFrames = 0;

    player->av1.actionVar1 = 0;
    player->actor.update = AdultMask_PlayerReloadUpdateWrapper;
    player->actor.draw = NULL;

    /*
     * Preserve TAKE_OFF_TRANSFORM so post-reload can continue into
     * TAKE_OFF_LOWER_HAND.
     */
    if (sAdultMaskCutsceneMode != ADULT_MASK_CS_TAKE_OFF_TRANSFORM)
        sAdultMaskCutsceneMode = ADULT_MASK_CS_NONE;
}

static void AdultMask_PlayerPostReloadUpdateWrapper(Actor* thisx, PlayState* play)
{
    Player* player;

    player = (Player*)thisx;
    AdultMask_ApplyRuntimeAgePropertiesNow(player, play);
    PlayerCall_Update(thisx, play);
    AdultMask_ApplyRuntimeAgePropertiesNow(player, play);

    if (sAdultMaskPostReloadFixFrames > 0)
        sAdultMaskPostReloadFixFrames--;

    if (sAdultMaskPostReloadFixFrames == 0)
    {
        player->actor.update = PlayerCall_Update;
        player->actor.draw = PlayerCall_Draw;

        if (sAdultMaskCutsceneMode == ADULT_MASK_CS_TAKE_OFF_TRANSFORM)
            AdultMask_StartTakeOffLowerHand(player, play);
        else
            AdultMask_ClearState();
    }
}

static void AdultMask_PlayerReloadUpdateWrapper(Actor* thisx, PlayState* play)
{
    Player* player;

    player = (Player*)thisx;

    Player_FormReloadUpdate(thisx, play);

    if (player->actor.update != AdultMask_PlayerReloadUpdateWrapper)
    {
        sAdultMaskPostReloadFixFrames = 5;
        player->actor.update = AdultMask_PlayerPostReloadUpdateWrapper;
        player->actor.draw = PlayerCall_Draw;

        AdultMask_ApplyRuntimeAgePropertiesNow(player, play);
    }
}

static u8 AdultMask_GetFierceDeityRingAlpha(Player* player)
{
    s32 frame;
    s32 ringFrame;

    frame = sAdultMaskTimer;

    if (sAdultMaskCutsceneMode == ADULT_MASK_CS_PUT_ON)
    {
        if (frame < ADULT_MASK_RING_START_TIMER)
            return 0;

        ringFrame = frame - ADULT_MASK_RING_START_TIMER;

        if (ringFrame < 12)
            return 255;

        if (ringFrame < 36)
            return (u8)((36 - ringFrame) * (255.0f / 24.0f));

        return 0;
    }

    if (sAdultMaskCutsceneMode == ADULT_MASK_CS_TAKE_OFF_TRANSFORM)
    {
        if (frame < ADULT_MASK_TAKE_OFF_RING_START_TIMER)
            return 0;

        ringFrame = frame - ADULT_MASK_TAKE_OFF_RING_START_TIMER;

        if (ringFrame < ADULT_MASK_TAKE_OFF_RING_FULL_FRAMES)
            return 255;

        ringFrame -= ADULT_MASK_TAKE_OFF_RING_FULL_FRAMES;

        if (ringFrame < ADULT_MASK_TAKE_OFF_RING_FADE_FRAMES)
        {
            return (u8)((ADULT_MASK_TAKE_OFF_RING_FADE_FRAMES - ringFrame) *
                        (255.0f / ADULT_MASK_TAKE_OFF_RING_FADE_FRAMES));
        }

        return 0;
    }

    (void)player;

    return 0;
}

void AdultMask_DrawTransformRing(PlayState* play, Player* player)
{
    u8 alpha;

    alpha = AdultMask_GetFierceDeityRingAlpha(player);
    if (alpha == 0)
        return;

    OPEN_DISPS(play->state.gfxCtx);

    Matrix_Push();

    AnimatedMat_DrawXlu(play, Lib_SegmentedToVirtual(gameplay_keep_Matanimheader_054F18));
    Matrix_Translate(-230.0f, -520.0f, 0.0f, MTXMODE_APPLY);

    MATRIX_FINALIZE_AND_LOAD(POLY_XLU_DISP++, play->state.gfxCtx);
    gDPSetEnvColor(POLY_XLU_DISP++, 0, 0, 255, alpha);
    gSPDisplayList(POLY_XLU_DISP++, gameplay_keep_DL_054C90);

    Matrix_Pop();

    CLOSE_DISPS();

    (void)player;
}

static void AdultMask_UpdateTransformCameraAndEffects(Player* player, PlayState* play)
{
    struct_8085D910* effectConfig;
    Camera* cam;
    s32 prevPlayerForm;
    s32 prevSaveForm;

    if (sAdultMaskCutsceneMode != ADULT_MASK_CS_PUT_ON)
        return;

    effectConfig = &D_8085D910[ADULT_MASK_TRANSFORM_EFFECT_CONFIG_INDEX];

    Player_StartMaskTransformCs(player, player->csId);

    cam = Play_GetCamera(play, play->activeCamId);
    Camera_ChangeMode(cam, CAM_MODE_NORMAL);

    player->stateFlags2 |= PLAYER_STATE2_MM_40;
    player->actor.shape.rot.y = Camera_GetCamDirYaw(cam) + 0x8000;

    prevPlayerForm = player->transformation;
    prevSaveForm = gSaveContext.save.playerForm;

    player->transformation = MM_PLAYER_FORM_FIERCE_DEITY;
    gSaveContext.save.playerForm = MM_PLAYER_FORM_FIERCE_DEITY;

    Player_UpdateMaskTransformEffects(play, player, &effectConfig);

    player->transformation = prevPlayerForm;
    gSaveContext.save.playerForm = prevSaveForm;

    if (player->av1.actionVar1 == 0x14)
        Play_EnableMotionBlurPriority(100);

    player->av1.actionVar1++;
    sAdultMaskTimer = player->av1.actionVar1;

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

    if (player->av1.actionVar1 >= 0x10)
    {
        if (player->av1.actionVar1 < 0x40)
        {
            Math_StepToF(&player->unk_B10[5], 1.0f, 0.2f);
        }
        else if (player->av1.actionVar1 < 0x37)
        {
            Math_StepToF(&player->unk_B10[5], 2.0f, 1.0f);
        }
        else
        {
            Math_StepToF(&player->unk_B10[5], 3.0f, 0.55f);
        }
    }

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
    if (sAdultMaskTimer >= ADULT_MASK_TRANSFORM_FACE_START_TIMER)
        sAdultMaskDrawTransformFace = 1;

    (void)player;
    (void)play;
}

static void AdultMask_UpdateTakeOffTransformCameraAndEffects(Player* player, PlayState* play)
{
    struct_8085D910* effectConfig;
    Camera* cam;
    s32 prevPlayerForm;
    s32 prevSaveForm;

    if (sAdultMaskCutsceneMode != ADULT_MASK_CS_TAKE_OFF_TRANSFORM)
        return;

    effectConfig = &D_8085D910[ADULT_MASK_TRANSFORM_EFFECT_CONFIG_INDEX];

    /*
     * Native non-human maskoffstart path keeps the mask transformation
     * cutscene alive and uses CAM_MODE_JUMP.
     */
    Player_StartMaskTransformCs(player, play->playerActorCsIds[PLAYER_CS_ID_MASK_TRANSFORMATION]);

    cam = Play_GetCamera(play, play->activeCamId);
    Camera_ChangeMode(cam, CAM_MODE_JUMP);

    player->stateFlags2 |= PLAYER_STATE2_MM_40;
    player->actor.shape.rot.y = Camera_GetCamDirYaw(cam) + 0x8000;

    /*
     * Spoof Zora only while updating native transform effects so the
     * effect path matches gPlayerAnim_pz_maskoffstart.
     */
    prevPlayerForm = player->transformation;
    prevSaveForm = gSaveContext.save.playerForm;

    player->transformation = MM_PLAYER_FORM_ZORA;
    gSaveContext.save.playerForm = MM_PLAYER_FORM_ZORA;

    Player_UpdateMaskTransformEffects(play, player, &effectConfig);

    player->transformation = prevPlayerForm;
    gSaveContext.save.playerForm = prevSaveForm;

    if (player->av1.actionVar1 == 0x14)
        Play_EnableMotionBlurPriority(100);

    player->av1.actionVar1++;
    sAdultMaskTimer = player->av1.actionVar1;

    if (player->av1.actionVar1 >= effectConfig->unk_0)
    {
        if (player->av1.actionVar1 < effectConfig->unk_2)
        {
            Math_StepToF(&player->unk_B10[4], 1.0f, effectConfig->unk_1 / 100.0f);
        }
        else if (player->av1.actionVar1 < effectConfig->unk_3)
        {
            /*
             * Do not play NA_SE_EV_LIGHTNING_HARD here.
             * That thunder is correct for the human put-on path, but wrong
             * for the pz_maskoffstart take-off path.
             */
            Math_StepToF(&player->unk_B10[4], 2.0f, 0.5f);
        }
        else
        {
            Math_StepToF(&player->unk_B10[4], 3.0f, 0.2f);
        }
    }

    if (player->av1.actionVar1 >= 0x10)
    {
        if (player->av1.actionVar1 < 0x40)
        {
            Math_StepToF(&player->unk_B10[5], 1.0f, 0.2f);
        }
        else if (player->av1.actionVar1 < 0x37)
        {
            Math_StepToF(&player->unk_B10[5], 2.0f, 1.0f);
        }
        else
        {
            Math_StepToF(&player->unk_B10[5], 3.0f, 0.55f);
        }
    }

    /*
     * Native non-human transform path uses draw config 1.
     */
    Player_DrawMaskTransformEffects(
        play,
        player,
        player->unk_B10[4],
        player->unk_B10[5],
        1
    );
}

static void AdultMask_UpdateTakeOffTransform(Player* player, PlayState* play)
{
    AdultMask_UpdateTakeOffTransformCameraAndEffects(player, play);

    /*
     * Do not use PlayerAnimation_Update/endFrame here.
     *
     * Native transformed mask-off is driven by actionVar1/effect timing, not
     * by ending gPlayerAnim_pz_maskoffstart. Ending on skelAnime endFrame makes
     * the stage collapse early and causes cl_maskoff/reload ordering bugs.
     */
    if (sAdultMaskTimer >= ADULT_MASK_TAKE_OFF_TRANSFORM_WHITE_COVER_FRAME)
    {
        if (!sAdultMaskPlayedFlashSfx)
        {
            sAdultMaskPlayedFlashSfx = 1;
            Player_PlaySfx(player, NA_SE_SY_TRANSFORM_MASK_FLASH);
        }

        AdultMask_StartWhiteCover(play);
        AdultMask_CommitAgeApplyTablesAndReloadPlayer(player, play);
    }
}

static void AdultMask_UpdateTakeOffLowerHand(Player* player, PlayState* play)
{
    sAdultMaskTimer++;

    Player_UpdateUpperBodyOrHeldItem(player);

    if (sAdultMaskTimer < ADULT_MASK_TAKE_OFF_LOWER_HAND_MIN_FRAMES)
        return;

    if (PlayerAnimation_Update(play, &player->skelAnime))
    {
        Play_DisableMotionBlurPriority();

        AdultMask_EndCutsceneCamera(player);

        player->itemAction = PLAYER_IA_NONE;
        player->heldItemAction = PLAYER_IA_NONE;

        player->stateFlags1 &= ~ADULT_MASK_PLAYER_LOCK_FLAGS_1;
        player->stateFlags3 &= ~ADULT_MASK_PLAYER_LOCK_FLAGS_3;

        Player_ReturnToDefaultAction(player, play);

        AdultMask_ClearState();
    }
}

static void AdultMask_End(Player* player, PlayState* play)
{
    Play_DisableMotionBlurPriority();

    AdultMask_EndCutsceneCamera(player);

    player->stateFlags1 &= ~ADULT_MASK_PLAYER_LOCK_FLAGS_1;
    player->stateFlags3 &= ~ADULT_MASK_PLAYER_LOCK_FLAGS_3;

    Player_ReturnToDefaultAction(player, play);

    AdultMask_ClearState();
}

static void AdultMask_StartTakeOffLowerHand(Player* player, PlayState* play)
{
    sAdultMaskCutsceneMode = ADULT_MASK_CS_TAKE_OFF_LOWER_HAND;

    sAdultMaskTimer = 0;
    sAdultMaskStartedWhiteCover = 0;
    sAdultMaskPlayerReloadStarted = 0;
    sAdultMaskPostReloadFixFrames = 0;

    R_PLAY_FILL_SCREEN_ON = 0;
    R_PLAY_FILL_SCREEN_ALPHA = 0;

    player->av1.actionVar1 = 0;
    player->av2.actionVar2 = 0;

    player->unk_B10[2] = 0.0f;
    player->unk_B10[3] = 0.0f;
    player->unk_B10[4] = 0.0f;
    player->unk_B10[5] = 0.0f;

    player->itemAction = PLAYER_CUSTOM_IA_MASK_ADULT;
    player->heldItemAction = PLAYER_CUSTOM_IA_MASK_ADULT;

    Player_BeforeCsAction(play, player);
    Player_SetAction_PreserveItemAction(play, player, AdultMask_Action, 0);

    /*
     * Short child lower-hand cleanup after the actual take-off transform.
     */
    Player_Anim_PlayOnceAdjusted_Ovl(play, player, &gPlayerAnim_cl_maskoff);

    player->stateFlags1 |= ADULT_MASK_PLAYER_LOCK_FLAGS_1;
    player->stateFlags3 |= ADULT_MASK_PLAYER_LOCK_FLAGS_3;
}

void AdultMask_Action(Player* player, PlayState* play)
{
    player->stateFlags1 |= ADULT_MASK_PLAYER_LOCK_FLAGS_1;
    player->stateFlags3 |= ADULT_MASK_PLAYER_LOCK_FLAGS_3;

    gSaveContext.save.playerForm = MM_PLAYER_FORM_HUMAN;
    player->transformation = MM_PLAYER_FORM_HUMAN;
    player->itemAction = PLAYER_CUSTOM_IA_MASK_ADULT;

    if (sAdultMaskPlayerReloadStarted)
        return;

    if (sAdultMaskCutsceneMode == ADULT_MASK_CS_PUT_ON)
    {
        AdultMask_UpdateTransformCameraAndEffects(player, play);
        AdultMask_UpdatePutOn(player, play);

        if (sAdultMaskTimer >= ADULT_MASK_WHITE_COVER_FRAME)
        {
            if (!sAdultMaskPlayedFlashSfx)
            {
                sAdultMaskPlayedFlashSfx = 1;
                Player_PlaySfx(player, NA_SE_SY_TRANSFORM_MASK_FLASH);
            }

            AdultMask_StartWhiteCover(play);
            AdultMask_CommitAgeApplyTablesAndReloadPlayer(player, play);
            return;
        }
    }
    else if (sAdultMaskCutsceneMode == ADULT_MASK_CS_TAKE_OFF_TRANSFORM)
    {
        AdultMask_UpdateTakeOffTransform(player, play);

        if (sAdultMaskPlayerReloadStarted)
            return;
    }
    else if (sAdultMaskCutsceneMode == ADULT_MASK_CS_TAKE_OFF_LOWER_HAND)
    {
        AdultMask_UpdateTakeOffLowerHand(player, play);
    }
    else
    {
        AdultMask_End(player, play);
        return;
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
    sAdultMaskPlayerReloadStarted = 0;
    sAdultMaskPostReloadFixFrames = 0;

    if (isAdult)
        sAdultMaskCutsceneMode = ADULT_MASK_CS_TAKE_OFF_TRANSFORM;
    else
        sAdultMaskCutsceneMode = ADULT_MASK_CS_PUT_ON;

    Player_BeforeCsAction(play, player);
    Player_SetAction_PreserveItemAction(play, player, AdultMask_Action, 0);

    player->itemAction = PLAYER_CUSTOM_IA_MASK_ADULT;

    AdultMask_ResetVisualState(player);

    if (sAdultMaskCutsceneMode == ADULT_MASK_CS_PUT_ON)
    {
        player->csId = play->playerActorCsIds[PLAYER_CS_ID_MASK_TRANSFORMATION];

        Player_StartMaskTransformCs(player, player->csId);

        {
            Camera* cam;

            cam = Play_GetCamera(play, play->activeCamId);

            Camera_ChangeMode(cam, CAM_MODE_NORMAL);
            player->actor.shape.rot.y = Camera_GetCamDirYaw(cam) + 0x8000;
        }

        Player_Anim_PlayOnceMorphAdjusted_Ovl(play, player, &gPlayerAnim_cl_setmask);
    }
    else
    {
        /*
         * Correct take-off-start animation:
         * transformed-form maskoffstart, CAM_MODE_JUMP.
         */
        player->csId = play->playerActorCsIds[PLAYER_CS_ID_MASK_TRANSFORMATION];

        Player_StartMaskTransformCs(player, player->csId);

        {
            Camera* cam;

            cam = Play_GetCamera(play, play->activeCamId);

            Camera_ChangeMode(cam, CAM_MODE_JUMP);
            player->actor.shape.rot.y = Camera_GetCamDirYaw(cam) + 0x8000;
        }

        Player_Anim_PlayOnceMorphAdjusted_Ovl(play, player, &gPlayerAnim_pz_maskoffstart);
    }

    /*
     * For put-on, this primes the normal hand/mask state.
     * For take-off, this is only the initial setup frame; the action update
     * manually advances pz_maskoffstart after this.
     */
    Player_UpdateUpperBodyOrHeldItem(player);

    player->stateFlags1 |= ADULT_MASK_PLAYER_LOCK_FLAGS_1;
    player->stateFlags3 |= ADULT_MASK_PLAYER_LOCK_FLAGS_3;
}

void AdultMask_AfterStart(Player* player)
{
    /*
     * Adult Mask owns its cutscene camera now.
     * Do not clear camera immediately after starting.
     */
    (void)player;
}