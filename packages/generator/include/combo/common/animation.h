#ifndef COMBO_COMMON_ANIMATION_H
#define COMBO_COMMON_ANIMATION_H


int Combo_CustomDmaContains(u32 vrom, u32 size);

void AnimTaskQueue_AddLoadPlayerFrame(struct PlayState* play, PlayerAnimationHeader* animation, s32 frame, s32 limbCount, Vec3s* frameTable);

void AnimTaskQueue_AddInterp(struct PlayState* play, s32 vecCount, Vec3s* base, Vec3s* mod, f32 weight);

void AnimTaskQueue_AddCopy(struct PlayState* play, s32 vecCount, Vec3s* dest, Vec3s* src);

void SkelAnime_CopyFrameTableTrue(SkelAnime* skelAnime, Vec3s* dst, Vec3s* src, u8* copyFlag);

s32 PlayerAnimation_OnFrame(SkelAnime* skelAnime, f32 frame);

#if defined(GAME_MM)

void PlayerAnimation_SetUpdateFunction(SkelAnime* skelAnime);
s32 PlayerAnimation_Update(PlayState* play, SkelAnime* skelAnime);
s32 PlayerAnimation_Morph(PlayState* play, SkelAnime* skelAnime);
void PlayerAnimation_AnimateFrame(PlayState* play, SkelAnime* skelAnime);
s32 PlayerAnimation_Loop(PlayState* play, SkelAnime* skelAnime);
s32 PlayerAnimation_Once(PlayState* play, SkelAnime* skelAnime);

void PlayerAnimation_Change(
    PlayState* play,
    SkelAnime* skelAnime,
    PlayerAnimationHeader* animation,
    f32 playSpeed,
    f32 startFrame,
    f32 endFrame,
    u8 mode,
    f32 morphFrames
);

void PlayerAnimation_PlayOnce(PlayState* play, SkelAnime* skelAnime, PlayerAnimationHeader* animation);
void PlayerAnimation_PlayOnceSetSpeed(PlayState* play, SkelAnime* skelAnime, PlayerAnimationHeader* animation, f32 playSpeed);
void PlayerAnimation_PlayLoop(PlayState* play, SkelAnime* skelAnime, PlayerAnimationHeader* animation);
void PlayerAnimation_PlayLoopSetSpeed(PlayState* play, SkelAnime* skelAnime, PlayerAnimationHeader* animation, f32 playSpeed);

void PlayerAnimation_CopyJointToMorph(PlayState* play, SkelAnime* skelAnime);
void PlayerAnimation_CopyMorphToJoint(PlayState* play, SkelAnime* skelAnime);

void PlayerAnimation_LoadToMorph(PlayState* play, SkelAnime* skelAnime, PlayerAnimationHeader* animation, f32 frame);
void PlayerAnimation_LoadToJoint(PlayState* play, SkelAnime* skelAnime, PlayerAnimationHeader* animation, f32 frame);

void PlayerAnimation_InterpJointMorph(PlayState* play, SkelAnime* skelAnime, f32 weight);

void PlayerAnimation_BlendToJoint(
    PlayState* play,
    SkelAnime* skelAnime,
    PlayerAnimationHeader* animation1,
    f32 frame1,
    PlayerAnimationHeader* animation2,
    f32 frame2,
    f32 blendWeight,
    void* blendTableBuffer
);

void PlayerAnimation_BlendToMorph(
    PlayState* play,
    SkelAnime* skelAnime,
    PlayerAnimationHeader* animation1,
    f32 frame1,
    PlayerAnimationHeader* animation2,
    f32 frame2,
    f32 blendWeight,
    void* blendTableBuffer
);

void PlayerAnimation_EndLoop(SkelAnime* skelAnime);
s32 PlayerAnimation_OnFrame(SkelAnime* skelAnime, f32 frame);

#endif

#if defined(GAME_OOT)
typedef struct LinkAnimationHeader LinkAnimationHeader;

void LinkAnimation_Change(PlayState* play, SkelAnime* skelAnime, LinkAnimationHeader* animation,
                          f32 playSpeed, f32 startFrame, f32 endFrame, u8 mode, f32 morphFrames);
void LinkAnimation_PlayOnce(PlayState* play, SkelAnime* skelAnime, LinkAnimationHeader* animation);

void LinkAnimation_PlayOnceSetSpeed(PlayState* play, SkelAnime* skelAnime,
                                    LinkAnimationHeader* animation, f32 playSpeed);
void LinkAnimation_PlayLoop(PlayState* play, SkelAnime* skelAnime, LinkAnimationHeader* animation);

void LinkAnimation_PlayLoopSetSpeed(PlayState* play, SkelAnime* skelAnime,
                                    LinkAnimationHeader* animation, f32 playSpeed);
void LinkAnimation_EndLoop(SkelAnime* skelAnime);

void LinkAnimation_LoadToJoint(PlayState* play, SkelAnime* skelAnime,
                               LinkAnimationHeader* animation, f32 frame);

void LinkAnimation_CopyJointToMorph(PlayState* play, SkelAnime* skelAnime);

void LinkAnimation_CopyMorphToJoint(PlayState* play, SkelAnime* skelAnime);

void LinkAnimation_LoadToMorph(PlayState* play, SkelAnime* skelAnime,
                               LinkAnimationHeader* animation, f32 frame);

void LinkAnimation_InterpJointMorph(PlayState* play, SkelAnime* skelAnime, f32 weight);

void LinkAnimation_BlendToJoint(PlayState* play, SkelAnime* skelAnime,
                                LinkAnimationHeader* animation1, f32 frame1,
                                LinkAnimationHeader* animation2, f32 frame2,
                                f32 blendWeight, Vec3s* blendTable);

void LinkAnimation_BlendToMorph(PlayState* play, SkelAnime* skelAnime,
                                LinkAnimationHeader* animation1, f32 frame1,
                                LinkAnimationHeader* animation2, f32 frame2,
                                f32 blendWeight, Vec3s* blendTable);

s32 LinkAnimation_Update(PlayState* play, SkelAnime* skelAnime);

s32 LinkAnimation_OnFrame(SkelAnime* skelAnime, f32 frame);

#endif

#endif
