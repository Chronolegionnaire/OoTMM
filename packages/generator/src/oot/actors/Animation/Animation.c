#include <ultra64.h>
#include <combo.h>
#include <combo/types.h>

typedef struct LinkAnimationHeader LinkAnimationHeader;

/* Player action typedefs */

typedef void (*PlayerActionFunc)(Player*, PlayState*);

typedef void (*PlayerSetupActionPreserveItemActionFunc)(
    PlayState* play,
    Player* link,
    PlayerActionFunc actionFunc,
    s32 flags
);

/* Link animation typedefs */

typedef void (*LinkAnimationSetUpdateFunctionFn)(SkelAnime* skelAnime);

typedef s32 (*LinkAnimationUpdateFn)(
    PlayState* play,
    SkelAnime* skelAnime
);

typedef s32 (*LinkAnimationMorphFn)(
    PlayState* play,
    SkelAnime* skelAnime
);

typedef void (*LinkAnimationAnimateFrameFn)(
    PlayState* play,
    SkelAnime* skelAnime
);

typedef s32 (*LinkAnimationLoopFn)(
    PlayState* play,
    SkelAnime* skelAnime
);

typedef s32 (*LinkAnimationOnceFn)(
    PlayState* play,
    SkelAnime* skelAnime
);

typedef void (*LinkAnimationChangeFn)(
    PlayState* play,
    SkelAnime* skelAnime,
    LinkAnimationHeader* animation,
    f32 playSpeed,
    f32 startFrame,
    f32 endFrame,
    u8 mode,
    f32 morphFrames
);

typedef void (*LinkAnimationPlayOnceFn)(
    PlayState* play,
    SkelAnime* skelAnime,
    LinkAnimationHeader* animation
);

typedef void (*LinkAnimationPlayOnceSetSpeedFn)(
    PlayState* play,
    SkelAnime* skelAnime,
    LinkAnimationHeader* animation,
    f32 playSpeed
);

typedef void (*LinkAnimationPlayLoopFn)(
    PlayState* play,
    SkelAnime* skelAnime,
    LinkAnimationHeader* animation
);

typedef void (*LinkAnimationPlayLoopSetSpeedFn)(
    PlayState* play,
    SkelAnime* skelAnime,
    LinkAnimationHeader* animation,
    f32 playSpeed
);

typedef void (*LinkAnimationCopyJointToMorphFn)(
    PlayState* play,
    SkelAnime* skelAnime
);

typedef void (*LinkAnimationCopyMorphToJointFn)(
    PlayState* play,
    SkelAnime* skelAnime
);

typedef void (*LinkAnimationLoadToMorphFn)(
    PlayState* play,
    SkelAnime* skelAnime,
    LinkAnimationHeader* animation,
    f32 frame
);

typedef void (*LinkAnimationLoadToJointFn)(
    PlayState* play,
    SkelAnime* skelAnime,
    LinkAnimationHeader* animation,
    f32 frame
);

typedef void (*LinkAnimationInterpJointMorphFn)(
    PlayState* play,
    SkelAnime* skelAnime,
    f32 weight
);

typedef void (*LinkAnimationBlendToJointFn)(
    PlayState* play,
    SkelAnime* skelAnime,
    LinkAnimationHeader* animation1,
    f32 frame1,
    LinkAnimationHeader* animation2,
    f32 frame2,
    f32 blendWeight,
    Vec3s* blendTable
);

typedef void (*LinkAnimationBlendToMorphFn)(
    PlayState* play,
    SkelAnime* skelAnime,
    LinkAnimationHeader* animation1,
    f32 frame1,
    LinkAnimationHeader* animation2,
    f32 frame2,
    f32 blendWeight,
    Vec3s* blendTable
);

typedef void (*LinkAnimationEndLoopFn)(SkelAnime* skelAnime);

typedef s32 (*LinkAnimationOnFrameFn)(
    SkelAnime* skelAnime,
    f32 frame
);

/* Player wrappers */

void Player_SetupActionPreserveItemAction(
    PlayState* play,
    Player* link,
    PlayerActionFunc actionFunc,
    s32 flags
) {
    PlayerSetupActionPreserveItemActionFunc fn =
        OverlayAddr(0x80833E8C);

    fn(play, link, actionFunc, flags);
}

/* Link animation wrappers */

void LinkAnimation_SetUpdateFunction(SkelAnime* skelAnime) {
    LinkAnimationSetUpdateFunctionFn fn =
        (LinkAnimationSetUpdateFunctionFn)0x8008BC6C;

    fn(skelAnime);
}

s32 LinkAnimation_Update(PlayState* play, SkelAnime* skelAnime) {
    LinkAnimationUpdateFn fn =
        (LinkAnimationUpdateFn)0x8008BCA4;

    return fn(play, skelAnime);
}

s32 LinkAnimation_Morph(PlayState* play, SkelAnime* skelAnime) {
    LinkAnimationMorphFn fn =
        (LinkAnimationMorphFn)0x8008BCC8;

    return fn(play, skelAnime);
}

void LinkAnimation_AnimateFrame(PlayState* play, SkelAnime* skelAnime) {
    LinkAnimationAnimateFrameFn fn =
        (LinkAnimationAnimateFrameFn)0x8008BD84;

    fn(play, skelAnime);
}

s32 LinkAnimation_Loop(PlayState* play, SkelAnime* skelAnime) {
    LinkAnimationLoopFn fn =
        (LinkAnimationLoopFn)0x8008BE60;

    return fn(play, skelAnime);
}

s32 LinkAnimation_Once(PlayState* play, SkelAnime* skelAnime) {
    LinkAnimationOnceFn fn =
        (LinkAnimationOnceFn)0x8008BF00;

    return fn(play, skelAnime);
}

void LinkAnimation_Change(
    PlayState* play,
    SkelAnime* skelAnime,
    LinkAnimationHeader* animation,
    f32 playSpeed,
    f32 startFrame,
    f32 endFrame,
    u8 mode,
    f32 morphFrames
) {
    LinkAnimationChangeFn fn =
        (LinkAnimationChangeFn)0x8008C000;

    fn(play, skelAnime, animation, playSpeed, startFrame, endFrame, mode, morphFrames);
}

void LinkAnimation_PlayOnce(
    PlayState* play,
    SkelAnime* skelAnime,
    LinkAnimationHeader* animation
) {
    LinkAnimationPlayOnceFn fn =
        (LinkAnimationPlayOnceFn)0x8008C178;

    fn(play, skelAnime, animation);
}

void LinkAnimation_PlayOnceSetSpeed(
    PlayState* play,
    SkelAnime* skelAnime,
    LinkAnimationHeader* animation,
    f32 playSpeed
) {
    LinkAnimationPlayOnceSetSpeedFn fn =
        (LinkAnimationPlayOnceSetSpeedFn)0x8008C1D8;

    fn(play, skelAnime, animation, playSpeed);
}

void LinkAnimation_PlayLoop(
    PlayState* play,
    SkelAnime* skelAnime,
    LinkAnimationHeader* animation
) {
    LinkAnimationPlayLoopFn fn =
        (LinkAnimationPlayLoopFn)0x8008C23C;

    fn(play, skelAnime, animation);
}

void LinkAnimation_PlayLoopSetSpeed(PlayState* play, SkelAnime* skelAnime, LinkAnimationHeader* animation,
                                    f32 playSpeed) {
    LinkAnimation_Change(play, skelAnime, animation, playSpeed, 0.0f, Animation_GetLastFrame(animation), ANIMMODE_LOOP,
                         0.0f);
}

void LinkAnimation_CopyJointToMorph(PlayState* play, SkelAnime* skelAnime) {
    LinkAnimationCopyJointToMorphFn fn =
        (LinkAnimationCopyJointToMorphFn)0x8008C2F8;

    fn(play, skelAnime);
}

void LinkAnimation_CopyMorphToJoint(PlayState* play, SkelAnime* skelAnime) {
    LinkAnimationCopyMorphToJointFn fn =
        (LinkAnimationCopyMorphToJointFn)0x8008C328;

    fn(play, skelAnime);
}

void LinkAnimation_LoadToMorph(
    PlayState* play,
    SkelAnime* skelAnime,
    LinkAnimationHeader* animation,
    f32 frame
) {
    LinkAnimationLoadToMorphFn fn =
        (LinkAnimationLoadToMorphFn)0x8008C358;

    fn(play, skelAnime, animation, frame);
}

void LinkAnimation_LoadToJoint(
    PlayState* play,
    SkelAnime* skelAnime,
    LinkAnimationHeader* animation,
    f32 frame
) {
    LinkAnimationLoadToJointFn fn =
        (LinkAnimationLoadToJointFn)0x8008C39C;

    fn(play, skelAnime, animation, frame);
}

void LinkAnimation_InterpJointMorph(
    PlayState* play,
    SkelAnime* skelAnime,
    f32 weight
) {
    LinkAnimationInterpJointMorphFn fn =
        (LinkAnimationInterpJointMorphFn)0x8008C3E0;

    fn(play, skelAnime, weight);
}

void LinkAnimation_BlendToJoint(
    PlayState* play,
    SkelAnime* skelAnime,
    LinkAnimationHeader* animation1,
    f32 frame1,
    LinkAnimationHeader* animation2,
    f32 frame2,
    f32 blendWeight,
    Vec3s* blendTable
) {
    LinkAnimationBlendToJointFn fn =
        (LinkAnimationBlendToJointFn)0x8008C418;

    fn(play, skelAnime, animation1, frame1, animation2, frame2, blendWeight, blendTable);
}

void LinkAnimation_BlendToMorph(
    PlayState* play,
    SkelAnime* skelAnime,
    LinkAnimationHeader* animation1,
    f32 frame1,
    LinkAnimationHeader* animation2,
    f32 frame2,
    f32 blendWeight,
    Vec3s* blendTable
) {
    LinkAnimationBlendToMorphFn fn =
        (LinkAnimationBlendToMorphFn)0x8008C4B8;

    fn(play, skelAnime, animation1, frame1, animation2, frame2, blendWeight, blendTable);
}

void LinkAnimation_EndLoop(SkelAnime* skelAnime) {
    LinkAnimationEndLoopFn fn =
        (LinkAnimationEndLoopFn)0x8008C558;

    fn(skelAnime);
}

s32 LinkAnimation_OnFrame(SkelAnime* skelAnime, f32 frame) {
    LinkAnimationOnFrameFn fn =
        (LinkAnimationOnFrameFn)0x8008C634;

    return fn(skelAnime, frame);
}