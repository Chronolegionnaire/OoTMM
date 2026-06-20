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
typedef PlayerAnimationHeader* (*Player_GetIdleAnimFunc)(Player*);

typedef struct struct_8085D910 { u8 unk_0, unk_1, unk_2, unk_3; } struct_8085D910;
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

#define ADULT_MASK_PLAYER_LOCK_FLAGS_1 0x30000000
#define ADULT_MASK_PLAYER_LOCK_FLAGS_3 0x80
#define ADULT_MASK_WHITE_COVER_FRAME 0x54
#define ADULT_MASK_TRANSFORM_EFFECT_CONFIG_INDEX 0
#define ADULT_MASK_NATIVE_EFFECT_START_FRAME 0x10
#define ADULT_MASK_TRANSFORM_FACE_START_TIMER 51
#define ADULT_MASK_RING_START_TIMER 54
#define ADULT_MASK_TAKE_OFF_TRANSFORM_WHITE_COVER_FRAME 0x45
#define ADULT_MASK_TAKE_OFF_RING_START_TIMER 0x10
#define ADULT_MASK_TAKE_OFF_RING_FULL_FRAMES 0x28
#define ADULT_MASK_TAKE_OFF_RING_FADE_FRAMES 0x0C
#define ADULT_MASK_SKIP_BUTTONS (BTN_A | BTN_B | BTN_CUP | BTN_CLEFT | BTN_CDOWN | BTN_CRIGHT)
#define ADULT_MASK_WHITE_FILL_STEP 45
#define ADULT_MASK_ENDING_HIDDEN_FRAMES 0
#define PLAYER_AGE_PROPERTIES_BASE 0x8085BA38
#define PLAYER_AGE_PROPERTIES_SIZE 0xDC

#define OVL_FUNC(type, addr) ((type)OverlayAddr(addr))
#define Player_GetIdleAnim OVL_FUNC(Player_GetIdleAnimFunc, 0x8082ED20)
#define Player_SetAction_PreserveItemAction OVL_FUNC(Player_SetAction_PreserveItemActionFunc, 0x80831760)
#define Player_BeforeCsAction OVL_FUNC(Player_BeforeCsActionFunc, 0x8082DE50)
#define Player_ClearAttentionAndCameraMode OVL_FUNC(Player_ClearAttentionAndCameraModeFunc, 0x8082DAD4)
#define Player_UpdateUpperBodyOrHeldItem OVL_FUNC(Player_UpdateUpperBodyOrHeldItemFunc, 0x8083249C)
#define Player_DecelerateToZero OVL_FUNC(Player_DecelerateToZeroFunc, 0x80832F24)
#define Player_ReturnToDefaultAction OVL_FUNC(Player_ReturnToDefaultActionFunc, 0x808369F4)
#define Player_StopCutscene OVL_FUNC(Player_StopCutsceneFunc, 0x80838760)
#define Player_Anim_PlayOnceAdjusted_Ovl OVL_FUNC(Player_Anim_PlayOnceAdjustedFunc, 0x8082DB90)
#define Player_Anim_PlayOnceMorphAdjusted_Ovl OVL_FUNC(Player_Anim_PlayOnceMorphAdjustedFunc, 0x8082E4A4)
#define Player_StartMaskTransformCs OVL_FUNC(Player_StartMaskTransformCsFunc, 0x808323C0)
#define Player_UpdateMaskTransformEffects OVL_FUNC(Player_UpdateMaskTransformEffectsFunc, 0x80855218)
#define Player_DrawMaskTransformEffects OVL_FUNC(Player_DrawMaskTransformEffectsFunc, 0x808550D0)
#define D_8085D910 ((struct_8085D910*)OverlayAddr(0x8085D910))
#define PLAYER_AGE_PROPERTIES_HUMAN ((PlayerAgeProperties*)OverlayAddr(PLAYER_AGE_PROPERTIES_BASE + PLAYER_AGE_PROPERTIES_SIZE * 4))
#define AdultMask_DrawObject(play, obj, dl) do { OPEN_DISPS((play)->state.gfxCtx); Gfx_SetupDL25_Opa((play)->state.gfxCtx); gSPSegment(POLY_OPA_DISP++, 0x0a, (obj)); gSPMatrix(POLY_OPA_DISP++, Matrix_Finalize((play)->state.gfxCtx), G_MTX_NOPUSH | G_MTX_LOAD | G_MTX_MODELVIEW); gSPDisplayList(POLY_OPA_DISP++, (Gfx*)(dl)); CLOSE_DISPS(); } while (0)

extern PlayerAnimationHeader gPlayerAnim_cl_setmask;
extern PlayerAnimationHeader gPlayerAnim_cl_setmaskend;
extern PlayerAnimationHeader gPlayerAnim_pz_maskoffstart;
extern PlayerAnimationHeader gPlayerAnim_cl_maskoff;
extern void Play_EnableMotionBlurPriority(s32 priority);
extern void Play_DisableMotionBlurPriority(void);
extern void ComboPlayer_ApplyAgeModelTables(void);
extern void Player_FormReloadUpdate(Actor* thisx, PlayState* play);
extern s32 Camera_ChangeMode(Camera* camera, s16 mode);
extern void func_80123140(PlayState* play, Player* player);
extern f32 Player_GetHeight(Player* player);
extern void PlayerCall_Update(Actor* thisx, PlayState* play);
extern void PlayerCall_Draw(Actor* thisx, PlayState* play);
extern void AudioSfx_StopById(u16 sfxId);
extern AnimatedMaterial gameplay_keep_Matanimheader_054F18[];
extern Gfx gameplay_keep_DL_054C90[];

void AdultMask_Action(Player* player, PlayState* play);

typedef enum {
    ADULT_MASK_CS_NONE,
    ADULT_MASK_CS_PUT_ON,
    ADULT_MASK_CS_TAKE_OFF_TRANSFORM,
    ADULT_MASK_CS_ENDING_ANIM,
} AdultMaskCutsceneMode;

typedef enum {
    ADULT_MASK_WHITE_FILL_NONE,
    ADULT_MASK_WHITE_FILL_IN,
    ADULT_MASK_WHITE_FILL_HOLD,
    ADULT_MASK_WHITE_FILL_OUT,
} AdultMaskWhiteFillMode;

static AdultMaskCutsceneMode sAdultMaskCutsceneMode;
static AdultMaskWhiteFillMode sAdultMaskWhiteFillMode;
static AdjLightSettings sAdultMaskSavedAdjLightSettings;
static s32 sAdultMaskSavedAdjLightSettingsValid;
static s32 sAdultMaskTargetAdult;
static s32 sAdultMaskCommitted;
static s32 sAdultMaskTimer;
static s32 sAdultMaskPlayedFlashSfx;
static s32 sAdultMaskDrawTransformFace;
static s32 sAdultMaskStartedWhiteCover;
static s32 sAdultMaskPlayerReloadStarted;
static s32 sAdultMaskPostReloadFixFrames;
static s32 sAdultMaskEndingAnimReturnToIdle;
static s32 sAdultMaskWhiteFillTimer;
static s32 sAdultMaskPendingReloadAfterWhiteIn;
static s32 sAdultMaskEndingHiddenTimer;
static s32 sAdultMaskInterrupted;

static void AdultMask_ClearState(void);
static void AdultMask_StartEndingAnim(Player* player, PlayState* play);
static void AdultMask_PlayerReloadUpdateWrapper(Actor* thisx, PlayState* play);

void AdultMask_DrawMaskInHand(PlayState* play, Player* player)
{
    void* obj = comboGetObject(CUSTOM_OBJECT_ID_ADULT_MASK_EQUIPMENT | MASK_CUSTOM_OBJECT);
    if (!obj)
        return;

    Matrix_Push();
    Matrix_Translate(-323.67f, 412.15f, -969.96f, MTXMODE_APPLY);
    Matrix_RotateZYX(-0x32BE, -0x50DE, -0x7717, MTXMODE_APPLY);
    AdultMask_DrawObject(play, obj, CUSTOM_OBJECT_ADULT_MASK_EQUIPMENT_0);
    Matrix_Pop();
    (void)player;
}

void AdultMask_DrawMaskOnFaceNativeLike(PlayState* play, Player* player)
{
    void* obj = comboGetObject(CUSTOM_OBJECT_ID_ADULT_MASK_EQUIPMENT | MASK_CUSTOM_OBJECT);
    if (!obj)
        return;

    Matrix_Push();
    Matrix_Scale(1.0f, 1.0f - player->unk_B10[3], 1.0f - player->unk_B10[2], MTXMODE_APPLY);
    AdultMask_DrawObject(play, obj, CUSTOM_OBJECT_ADULT_MASK_EQUIPMENT_0);
    Matrix_Pop();
}

void AdultMask_DrawTransformationMaskOnFace(PlayState* play, Player* player)
{
    void* obj = comboGetObject(CUSTOM_OBJECT_ID_MASK_ADULT_TRANSFORM_PLAYER);
    if (!obj)
        return;

    Matrix_Push();
    AdultMask_DrawObject(play, obj, CUSTOM_OBJECT_MASK_ADULT_TRANSFORM_PLAYER_0);
    Matrix_Pop();
    (void)player;
}

s32 AdultMask_IsActive(void) { return sAdultMaskCutsceneMode != ADULT_MASK_CS_NONE; }
s32 AdultMask_IsPuttingOn(void) { return sAdultMaskCutsceneMode == ADULT_MASK_CS_PUT_ON; }
s32 AdultMask_IsTakeOffTransform(void) { return sAdultMaskCutsceneMode == ADULT_MASK_CS_TAKE_OFF_TRANSFORM; }
s32 AdultMask_IsTakeOffChild(void) { return sAdultMaskCutsceneMode == ADULT_MASK_CS_ENDING_ANIM; }
s32 AdultMask_IsTakingOff(void) { return AdultMask_IsTakeOffTransform() || AdultMask_IsTakeOffChild(); }
s32 AdultMask_IsCsItem(Player* player) { return player->itemAction == PLAYER_CUSTOM_IA_MASK_ADULT; }
s32 AdultMask_ShouldDrawAdultModel(void) { return comboIsLinkAdult(); }
s32 AdultMask_GetTimer(void) { return sAdultMaskTimer; }
s32 AdultMask_ShouldDrawTransformFace(void) { return sAdultMaskDrawTransformFace; }

static void AdultMask_SetB10(Player* player, f32 value)
{
    player->unk_B10[2] = value;
    player->unk_B10[3] = value;
    player->unk_B10[4] = value;
    player->unk_B10[5] = value;
}

static void AdultMask_StopTransformLoopSfx(void)
{
    AudioSfx_StopById(NA_SE_PL_TRANSFORM_VOICE);
    AudioSfx_StopById(NA_SE_IT_TRANSFORM_MASK_BROKEN);
    AudioSfx_StopById(NA_SE_PL_FACE_CHANGE);
    Play_DisableMotionBlurPriority();
}

static void AdultMask_SaveEnvVisualState(PlayState* play)
{
    if (!sAdultMaskSavedAdjLightSettingsValid) {
        sAdultMaskSavedAdjLightSettings = play->envCtx.adjLightSettings;
        sAdultMaskSavedAdjLightSettingsValid = 1;
    }
}

static void AdultMask_RestoreEnvVisualState(PlayState* play)
{
    if (sAdultMaskSavedAdjLightSettingsValid)
        play->envCtx.adjLightSettings = sAdultMaskSavedAdjLightSettings;
}

static void AdultMask_ApplyTargetHumanAgeProperties(void)
{
    LoadFile(
        PLAYER_AGE_PROPERTIES_HUMAN,
        sAdultMaskTargetAdult ? CUSTOM_MM_ADULT_HUMAN_AGE_PROPERTIES_VROM : CUSTOM_MM_CHILD_HUMAN_AGE_PROPERTIES_VROM,
        sizeof(PlayerAgeProperties)
    );
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
    return player->transformation == MM_PLAYER_FORM_HUMAN &&
           player->actor.draw != NULL &&
           !Player_InCsMode(play) &&
           !(player->stateFlags1 & 0x207c7080) &&
           !(player->stateFlags3 & 0x1000);
}

s32 AdultMask_TryUse(Player* player, PlayState* play, s32 itemAction)
{
    if (itemAction != PLAYER_CUSTOM_IA_MASK_ADULT)
        return 0;

    if (!AdultMask_CanUse(player, play)) {
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

static void AdultMask_SetWhiteFillAlpha(PlayState* play, s32 alpha)
{
    if (alpha < 0)
        alpha = 0;
    if (alpha > 255)
        alpha = 255;
    if (alpha > 0)
        Play_FillScreen(play, ADULT_MASK_WHITE_FILL_STEP, 220, 220, 220, alpha);
    else {
        R_PLAY_FILL_SCREEN_ON = 0;
        R_PLAY_FILL_SCREEN_ALPHA = 0;
    }
}

static void AdultMask_StartWhiteFillIn(void)
{
    if (sAdultMaskWhiteFillMode == ADULT_MASK_WHITE_FILL_IN || sAdultMaskWhiteFillMode == ADULT_MASK_WHITE_FILL_HOLD)
        return;

    sAdultMaskStartedWhiteCover = 1;
    sAdultMaskWhiteFillMode = ADULT_MASK_WHITE_FILL_IN;
    sAdultMaskWhiteFillTimer = 0;
    R_PLAY_FILL_SCREEN_ON = ADULT_MASK_WHITE_FILL_STEP;
    R_PLAY_FILL_SCREEN_R = R_PLAY_FILL_SCREEN_G = R_PLAY_FILL_SCREEN_B = 220;
    R_PLAY_FILL_SCREEN_ALPHA = 0;
}

static void AdultMask_StartWhiteFillOut(void)
{
    sAdultMaskWhiteFillMode = ADULT_MASK_WHITE_FILL_OUT;
    sAdultMaskWhiteFillTimer = 0;
    R_PLAY_FILL_SCREEN_ON = ADULT_MASK_WHITE_FILL_STEP;
    R_PLAY_FILL_SCREEN_R = R_PLAY_FILL_SCREEN_G = R_PLAY_FILL_SCREEN_B = 220;
    R_PLAY_FILL_SCREEN_ALPHA = 255;
}

static s32 AdultMask_UpdateWhiteFill(PlayState* play)
{
    s32 alpha;

    if (sAdultMaskWhiteFillMode == ADULT_MASK_WHITE_FILL_IN) {
        alpha = R_PLAY_FILL_SCREEN_ALPHA + ADULT_MASK_WHITE_FILL_STEP;
        if (alpha >= 255) {
            sAdultMaskWhiteFillMode = ADULT_MASK_WHITE_FILL_HOLD;
            sAdultMaskWhiteFillTimer = 0;
            AdultMask_SetWhiteFillAlpha(play, 255);
            return 1;
        }
        AdultMask_SetWhiteFillAlpha(play, alpha);
    } else if (sAdultMaskWhiteFillMode == ADULT_MASK_WHITE_FILL_OUT) {
        alpha = R_PLAY_FILL_SCREEN_ALPHA - ADULT_MASK_WHITE_FILL_STEP;
        if (alpha <= 0) {
            sAdultMaskWhiteFillMode = ADULT_MASK_WHITE_FILL_NONE;
            sAdultMaskWhiteFillTimer = 0;
            AdultMask_SetWhiteFillAlpha(play, 0);
            return 1;
        }
        AdultMask_SetWhiteFillAlpha(play, alpha);
    }

    return 0;
}

static void AdultMask_ClearFill(void)
{
    sAdultMaskWhiteFillMode = ADULT_MASK_WHITE_FILL_NONE;
    sAdultMaskWhiteFillTimer = 0;
    R_PLAY_FILL_SCREEN_ON = 0;
    R_PLAY_FILL_SCREEN_ALPHA = 0;
}

static void AdultMask_ResetRunState(void)
{
    sAdultMaskTimer = 0;
    sAdultMaskPlayedFlashSfx = 0;
    sAdultMaskDrawTransformFace = 0;
    sAdultMaskStartedWhiteCover = 0;
    sAdultMaskPlayerReloadStarted = 0;
    sAdultMaskPostReloadFixFrames = 0;
    sAdultMaskEndingAnimReturnToIdle = 0;
    sAdultMaskPendingReloadAfterWhiteIn = 0;
    sAdultMaskEndingHiddenTimer = 0;
    sAdultMaskInterrupted = 0;
    AdultMask_ClearFill();
}

static void AdultMask_ClearState(void)
{
    sAdultMaskCutsceneMode = ADULT_MASK_CS_NONE;
    sAdultMaskTargetAdult = 0;
    sAdultMaskCommitted = 0;
    sAdultMaskSavedAdjLightSettingsValid = 0;
    AdultMask_ResetRunState();
}

void AdultMask_ResetDrawStateForNewPlay(void) { AdultMask_ClearState(); }

static void AdultMask_ResetVisualState(Player* player)
{
    AdultMask_ResetRunState();
    player->av1.actionVar1 = 0;
    player->av2.actionVar2 = 0;
    AdultMask_SetB10(player, 0.0f);
}

static void AdultMask_CommitAge(Player* player)
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

static void AdultMask_ClearHeldMaskAndUnlock(Player* player)
{
    player->itemAction = PLAYER_IA_NONE;
    player->heldItemAction = PLAYER_IA_NONE;
    player->stateFlags1 &= ~ADULT_MASK_PLAYER_LOCK_FLAGS_1;
    player->stateFlags3 &= ~ADULT_MASK_PLAYER_LOCK_FLAGS_3;
}

static void AdultMask_CommitAgeApplyTablesAndReloadPlayer(Player* player, PlayState* play)
{
    if (sAdultMaskPlayerReloadStarted)
        return;

    sAdultMaskPlayerReloadStarted = 1;
    player->actor.draw = NULL;
    AdultMask_StopTransformLoopSfx();
    AdultMask_RestoreEnvVisualState(play);
    AdultMask_CommitAge(player);
    ComboPlayer_ApplyAgeModelTables();
    AdultMask_ApplyTargetHumanAgeProperties();
    AdultMask_EndCutsceneCamera(player);

    gSaveContext.save.playerForm = MM_PLAYER_FORM_HUMAN;
    player->transformation = MM_PLAYER_FORM_HUMAN;
    player->currentMask = 0;
    gSaveContext.save.equippedMask = 0;
    gCustomSave.customMask = PLAYER_CUSTOM_MASK_NONE;
    AdultMask_ClearHeldMaskAndUnlock(player);

    sAdultMaskPostReloadFixFrames = 0;
    player->av1.actionVar1 = 0;
    player->actor.update = AdultMask_PlayerReloadUpdateWrapper;
    player->actor.draw = NULL;

    if (sAdultMaskCutsceneMode != ADULT_MASK_CS_TAKE_OFF_TRANSFORM && sAdultMaskCutsceneMode != ADULT_MASK_CS_PUT_ON)
        sAdultMaskCutsceneMode = ADULT_MASK_CS_NONE;
}

static void AdultMask_PlayerPostReloadUpdateWrapper(Actor* thisx, PlayState* play)
{
    Player* player = (Player*)thisx;

    AdultMask_ApplyRuntimeAgePropertiesNow(player, play);
    PlayerCall_Update(thisx, play);
    AdultMask_ApplyRuntimeAgePropertiesNow(player, play);

    if (sAdultMaskPostReloadFixFrames > 0)
        sAdultMaskPostReloadFixFrames--;

    if (sAdultMaskPostReloadFixFrames == 0) {
        player->actor.update = PlayerCall_Update;
        player->actor.draw = PlayerCall_Draw;
        if (sAdultMaskCutsceneMode == ADULT_MASK_CS_TAKE_OFF_TRANSFORM || sAdultMaskCutsceneMode == ADULT_MASK_CS_PUT_ON)
            AdultMask_StartEndingAnim(player, play);
        else
            AdultMask_ClearState();
    }
}

static void AdultMask_PlayerReloadUpdateWrapper(Actor* thisx, PlayState* play)
{
    Player* player = (Player*)thisx;

    func_8012301C(thisx, play);
    if (player->actor.update != AdultMask_PlayerReloadUpdateWrapper) {
        sAdultMaskPostReloadFixFrames = 0;
        player->actor.update = AdultMask_PlayerPostReloadUpdateWrapper;
        player->actor.draw = PlayerCall_Draw;
        AdultMask_ApplyRuntimeAgePropertiesNow(player, play);
    }
}

static u8 AdultMask_GetFierceDeityRingAlpha(Player* player)
{
    s32 ringFrame;

    if (sAdultMaskCutsceneMode == ADULT_MASK_CS_PUT_ON) {
        if (sAdultMaskTimer < ADULT_MASK_RING_START_TIMER)
            return 0;
        ringFrame = sAdultMaskTimer - ADULT_MASK_RING_START_TIMER;
        if (ringFrame < 12)
            return 255;
        return ringFrame < 36 ? (u8)((36 - ringFrame) * (255.0f / 24.0f)) : 0;
    }

    if (sAdultMaskCutsceneMode == ADULT_MASK_CS_TAKE_OFF_TRANSFORM) {
        if (sAdultMaskTimer < ADULT_MASK_TAKE_OFF_RING_START_TIMER)
            return 0;
        ringFrame = sAdultMaskTimer - ADULT_MASK_TAKE_OFF_RING_START_TIMER;
        if (ringFrame < ADULT_MASK_TAKE_OFF_RING_FULL_FRAMES)
            return 255;
        ringFrame -= ADULT_MASK_TAKE_OFF_RING_FULL_FRAMES;
        return ringFrame < ADULT_MASK_TAKE_OFF_RING_FADE_FRAMES
            ? (u8)((ADULT_MASK_TAKE_OFF_RING_FADE_FRAMES - ringFrame) * (255.0f / ADULT_MASK_TAKE_OFF_RING_FADE_FRAMES))
            : 0;
    }

    (void)player;
    return 0;
}

void AdultMask_DrawTransformRing(PlayState* play, Player* player)
{
    u8 alpha = AdultMask_GetFierceDeityRingAlpha(player);
    if (!alpha)
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

static void AdultMask_UpdateEffectSteps(Player* player, struct_8085D910* cfg, s32 playLightningSfx)
{
    if (player->av1.actionVar1 >= cfg->unk_0) {
        if (player->av1.actionVar1 < cfg->unk_2) {
            Math_StepToF(&player->unk_B10[4], 1.0f, cfg->unk_1 / 100.0f);
        } else if (player->av1.actionVar1 < cfg->unk_3) {
            if (playLightningSfx && player->av1.actionVar1 == cfg->unk_2)
                PlaySound(NA_SE_EV_LIGHTNING_HARD);
            Math_StepToF(&player->unk_B10[4], 2.0f, 0.5f);
        } else {
            Math_StepToF(&player->unk_B10[4], 3.0f, 0.2f);
        }
    }

    if (player->av1.actionVar1 >= ADULT_MASK_NATIVE_EFFECT_START_FRAME) {
        if (player->av1.actionVar1 < 0x40)
            Math_StepToF(&player->unk_B10[5], 1.0f, 0.2f);
        else if (player->av1.actionVar1 < 0x37)
            Math_StepToF(&player->unk_B10[5], 2.0f, 1.0f);
        else
            Math_StepToF(&player->unk_B10[5], 3.0f, 0.55f);
    }
}

static void AdultMask_UpdateTransformCameraAndEffects(Player* player, PlayState* play, s32 form, s32 camMode, s32 drawArg, s32 playLightningSfx)
{
    struct_8085D910* cfg = &D_8085D910[ADULT_MASK_TRANSFORM_EFFECT_CONFIG_INDEX];
    Camera* cam;
    s32 prevPlayerForm;
    s32 prevSaveForm;

    Player_StartMaskTransformCs(player, player->csId);
    cam = Play_GetCamera(play, play->activeCamId);
    Camera_ChangeMode(cam, camMode);
    player->stateFlags2 |= PLAYER_STATE2_MM_40;
    player->actor.shape.rot.y = Camera_GetCamDirYaw(cam) + 0x8000;

    prevPlayerForm = player->transformation;
    prevSaveForm = gSaveContext.save.playerForm;
    player->transformation = form;
    gSaveContext.save.playerForm = form;
    Player_UpdateMaskTransformEffects(play, player, &cfg);
    player->transformation = prevPlayerForm;
    gSaveContext.save.playerForm = prevSaveForm;

    if (!sAdultMaskInterrupted && player->av1.actionVar1 == 0x14)
        Play_EnableMotionBlurPriority(100);

    sAdultMaskTimer = ++player->av1.actionVar1;
    AdultMask_UpdateEffectSteps(player, cfg, playLightningSfx);
    Player_DrawMaskTransformEffects(play, player, player->unk_B10[4], player->unk_B10[5], drawArg);
}

static s32 AdultMask_ShouldSkipTransformLoop(PlayState* play)
{
    return CHECK_BTN_ANY(play->state.input[0].press.button, ADULT_MASK_SKIP_BUTTONS);
}

static void AdultMask_SkipTransformLoopToFlash(Player* player, s32 flashFrame)
{
    if (player->av1.actionVar1 >= flashFrame)
        return;

    sAdultMaskInterrupted = 1;
    AdultMask_StopTransformLoopSfx();
    AdultMask_SetB10(player, 0.0f);
    player->av1.actionVar1 = flashFrame;
    sAdultMaskTimer = flashFrame;
}

static s32 AdultMask_TryStartReloadFlash(Player* player, PlayState* play)
{
    if (!sAdultMaskPlayedFlashSfx) {
        sAdultMaskPlayedFlashSfx = 1;
        AdultMask_StopTransformLoopSfx();
        Player_PlaySfx(player, NA_SE_SY_TRANSFORM_MASK_FLASH);
    }

    AdultMask_StartWhiteFillIn();
    sAdultMaskPendingReloadAfterWhiteIn = 1;
    (void)play;
    return 1;
}

static void AdultMask_UpdatePutOn(Player* player, PlayState* play)
{
    if (AdultMask_ShouldSkipTransformLoop(play))
        AdultMask_SkipTransformLoopToFlash(player, ADULT_MASK_WHITE_COVER_FRAME);

    if (player->skelAnime.animation == &gPlayerAnim_cl_setmask && player->skelAnime.curFrame >= ADULT_MASK_TRANSFORM_FACE_START_TIMER)
        sAdultMaskDrawTransformFace = 1;

    if (sAdultMaskTimer < ADULT_MASK_WHITE_COVER_FRAME && sAdultMaskWhiteFillMode == ADULT_MASK_WHITE_FILL_NONE)
        AdultMask_UpdateTransformCameraAndEffects(player, play, MM_PLAYER_FORM_FIERCE_DEITY, CAM_MODE_NORMAL, 0, 1);

    if (sAdultMaskTimer >= ADULT_MASK_WHITE_COVER_FRAME)
        AdultMask_TryStartReloadFlash(player, play);
}

static s32 AdultMask_UpdateTakeOffTransform(Player* player, PlayState* play)
{
    if (AdultMask_ShouldSkipTransformLoop(play))
        AdultMask_SkipTransformLoopToFlash(player, ADULT_MASK_TAKE_OFF_TRANSFORM_WHITE_COVER_FRAME);

    if (sAdultMaskTimer < ADULT_MASK_TAKE_OFF_TRANSFORM_WHITE_COVER_FRAME && sAdultMaskWhiteFillMode == ADULT_MASK_WHITE_FILL_NONE)
        AdultMask_UpdateTransformCameraAndEffects(player, play, MM_PLAYER_FORM_ZORA, CAM_MODE_JUMP, 1, 0);

    return sAdultMaskTimer >= ADULT_MASK_TAKE_OFF_TRANSFORM_WHITE_COVER_FRAME && AdultMask_TryStartReloadFlash(player, play);
}

static void AdultMask_UpdateEndingAnim(Player* player, PlayState* play)
{
    sAdultMaskTimer++;

    if (sAdultMaskWhiteFillMode == ADULT_MASK_WHITE_FILL_HOLD) {
        if (sAdultMaskEndingHiddenTimer > 0) {
            sAdultMaskEndingHiddenTimer--;
            if (sAdultMaskEndingHiddenTimer == 0)
                AdultMask_StartWhiteFillOut();
        } else {
            AdultMask_StartWhiteFillOut();
        }
    }

    if (sAdultMaskWhiteFillMode == ADULT_MASK_WHITE_FILL_OUT)
        AdultMask_UpdateWhiteFill(play);

    if (!PlayerAnimation_Update(play, &player->skelAnime))
        return;

    Play_DisableMotionBlurPriority();
    if (sAdultMaskEndingAnimReturnToIdle) {
        PlayerAnimation_Change(play, &player->skelAnime, Player_GetIdleAnim(player), 1, 0.0f, 20.0f, ANIMMODE_ONCE, 20.0f);
    }

    AdultMask_EndCutsceneCamera(player);
    AdultMask_ClearHeldMaskAndUnlock(player);
    Player_ReturnToDefaultAction(player, play);
    AdultMask_RestoreEnvVisualState(play);
    AdultMask_ClearState();
}

static void AdultMask_End(Player* player, PlayState* play)
{
    Play_DisableMotionBlurPriority();
    AdultMask_EndCutsceneCamera(player);
    AdultMask_ClearHeldMaskAndUnlock(player);
    Player_ReturnToDefaultAction(player, play);
    AdultMask_RestoreEnvVisualState(play);
    AdultMask_ClearState();
}

static void AdultMask_StartEndingAnim(Player* player, PlayState* play)
{
    PlayerAnimationHeader* endingAnim = sAdultMaskTargetAdult ? &gPlayerAnim_cl_setmaskend : &gPlayerAnim_cl_maskoff;

    sAdultMaskEndingAnimReturnToIdle = 1;
    sAdultMaskCutsceneMode = ADULT_MASK_CS_ENDING_ANIM;
    sAdultMaskTimer = 0;
    sAdultMaskStartedWhiteCover = 0;
    sAdultMaskPlayerReloadStarted = 0;
    sAdultMaskPostReloadFixFrames = 0;
    sAdultMaskEndingHiddenTimer = ADULT_MASK_ENDING_HIDDEN_FRAMES;
    sAdultMaskWhiteFillMode = ADULT_MASK_WHITE_FILL_HOLD;
    sAdultMaskWhiteFillTimer = 0;
    AdultMask_SetWhiteFillAlpha(play, 255);

    player->av1.actionVar1 = 0;
    player->av2.actionVar2 = 0;
    AdultMask_SetB10(player, 0.0f);
    player->itemAction = PLAYER_CUSTOM_IA_MASK_ADULT;
    player->heldItemAction = PLAYER_CUSTOM_IA_MASK_ADULT;

    Player_BeforeCsAction(play, player);
    Player_SetAction_PreserveItemAction(play, player, AdultMask_Action, 0);
    Player_Anim_PlayOnceAdjusted_Ovl(play, player, endingAnim);
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

    if (sAdultMaskWhiteFillMode != ADULT_MASK_WHITE_FILL_NONE) {
        Play_DisableMotionBlurPriority();
        AdultMask_SetB10(player, 0.0f);
    }

    if ((sAdultMaskWhiteFillMode == ADULT_MASK_WHITE_FILL_IN || sAdultMaskWhiteFillMode == ADULT_MASK_WHITE_FILL_OUT) &&
        AdultMask_UpdateWhiteFill(play) &&
        sAdultMaskPendingReloadAfterWhiteIn &&
        sAdultMaskWhiteFillMode == ADULT_MASK_WHITE_FILL_HOLD) {
        sAdultMaskPendingReloadAfterWhiteIn = 0;
        AdultMask_CommitAgeApplyTablesAndReloadPlayer(player, play);
        return;
    }

    if (sAdultMaskCutsceneMode == ADULT_MASK_CS_PUT_ON) {
        AdultMask_UpdatePutOn(player, play);
        if (sAdultMaskPendingReloadAfterWhiteIn)
            return;
    } else if (sAdultMaskCutsceneMode == ADULT_MASK_CS_TAKE_OFF_TRANSFORM) {
        if (AdultMask_UpdateTakeOffTransform(player, play) || sAdultMaskPlayerReloadStarted)
            return;
    } else if (sAdultMaskCutsceneMode == ADULT_MASK_CS_ENDING_ANIM) {
        AdultMask_UpdateEndingAnim(player, play);
    } else {
        AdultMask_End(player, play);
        return;
    }

    Player_DecelerateToZero(player);
    if (sAdultMaskCutsceneMode != ADULT_MASK_CS_ENDING_ANIM)
        Player_UpdateUpperBodyOrHeldItem(player);
}

static void AdultMask_SetStartCamera(Player* player, PlayState* play, s32 camMode)
{
    Camera* cam;

    player->csId = play->playerActorCsIds[PLAYER_CS_ID_MASK_TRANSFORMATION];
    Player_StartMaskTransformCs(player, player->csId);
    cam = Play_GetCamera(play, play->activeCamId);
    Camera_ChangeMode(cam, camMode);
    player->actor.shape.rot.y = Camera_GetCamDirYaw(cam) + 0x8000;
}

void AdultMask_StartCsItem(Player* player, PlayState* play)
{
    s32 isAdult = comboIsLinkAdult();

    sAdultMaskTargetAdult = !isAdult;
    sAdultMaskCommitted = 0;
    sAdultMaskCutsceneMode = isAdult ? ADULT_MASK_CS_TAKE_OFF_TRANSFORM : ADULT_MASK_CS_PUT_ON;
    AdultMask_ResetRunState();
    AdultMask_SaveEnvVisualState(play);
    Player_BeforeCsAction(play, player);
    Player_SetAction_PreserveItemAction(play, player, AdultMask_Action, 0);
    player->itemAction = PLAYER_CUSTOM_IA_MASK_ADULT;
    AdultMask_ResetVisualState(player);

    if (sAdultMaskCutsceneMode == ADULT_MASK_CS_PUT_ON) {
        AdultMask_SetStartCamera(player, play, CAM_MODE_NORMAL);
        Player_Anim_PlayOnceMorphAdjusted_Ovl(play, player, &gPlayerAnim_cl_setmask);
    } else {
        AdultMask_SetStartCamera(player, play, CAM_MODE_JUMP);
        Player_Anim_PlayOnceMorphAdjusted_Ovl(play, player, &gPlayerAnim_pz_maskoffstart);
    }

    Player_UpdateUpperBodyOrHeldItem(player);
    player->stateFlags1 |= ADULT_MASK_PLAYER_LOCK_FLAGS_1;
    player->stateFlags3 |= ADULT_MASK_PLAYER_LOCK_FLAGS_3;
}

void AdultMask_AfterStart(Player* player) { (void)player; }
