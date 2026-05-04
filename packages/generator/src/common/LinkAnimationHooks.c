#include <combo.h>
#include <combo/patch.h>
#include <combo/imported_animations.h>

#define ANIMTASK_LOAD_PLAYER_FRAME 0

#define COMBO_ANIM_TASK_REQ_OFFSET       0x04
#define COMBO_ANIM_TASK_MSGQUEUE_OFFSET  0x24
#define COMBO_ANIM_TASK_MSG_OFFSET       0x3c

#define COMBO_ARRAY_COUNT(arr) ((s32)(sizeof(arr) / sizeof((arr)[0])))

#define COMBO_IMPORTED_ANIM_NOT_FOUND 0
#define COMBO_IMPORTED_ANIM_SUCCESS   1
#define COMBO_IMPORTED_ANIM_FAIL     -1

typedef void ImportedAnimTaskQueue;
typedef void ImportedAnimTask;

typedef struct ComboDmaRequest {
    u32 vromAddr;
    void* dramAddr;
    u32 size;
    const char* filename;
    s32 line;
    u32 unk_14;
    OSMesgQueue* notifyQueue;
    OSMesg notifyMsg;
} ComboDmaRequest;

typedef struct ComboImportedAnimStaticHeader {
    u32 animation;
    u32 frameCount;
    u32 frameSize;
    u32 offset;
} ComboImportedAnimStaticHeader;

#define COMBO_IMPORTED_ANIM_STATIC_ENTRY(symbol, vrom, headerSegmented, customOffset, frameCount, frameSize) \
    { headerSegmented, frameCount, frameSize, customOffset },

static const ComboImportedAnimStaticHeader kComboImportedAnimStaticHeaders[] = {
    COMBO_IMPORTED_LINK_ANIMATION_LIST(COMBO_IMPORTED_ANIM_STATIC_ENTRY)
    { 0, 0, 0, 0 },
};

#undef COMBO_IMPORTED_ANIM_STATIC_ENTRY

static const ComboImportedAnimStaticHeader* Combo_FindImportedAnimStaticHeader(void* animation) {
    u32 anim;
    s32 i;

    anim = (u32)animation;

    for (i = 0; i < COMBO_ARRAY_COUNT(kComboImportedAnimStaticHeaders); i++) {
        if (kComboImportedAnimStaticHeaders[i].animation == anim) {
            return &kComboImportedAnimStaticHeaders[i];
        }
    }

    return NULL;
}

static ComboDmaRequest* Combo_AnimTaskReq(ImportedAnimTask* task) {
    return (ComboDmaRequest*)((u8*)task + COMBO_ANIM_TASK_REQ_OFFSET);
}

static OSMesgQueue* Combo_AnimTaskMsgQueue(ImportedAnimTask* task) {
    return (OSMesgQueue*)((u8*)task + COMBO_ANIM_TASK_MSGQUEUE_OFFSET);
}

static OSMesg* Combo_AnimTaskMsg(ImportedAnimTask* task) {
    return (OSMesg*)((u8*)task + COMBO_ANIM_TASK_MSG_OFFSET);
}

static int Combo_IsKseg0OrKseg1(void* ptr) {
    u32 p;

    p = (u32)ptr;
    return p >= 0x80000000 && p < 0xc0000000;
}

static int Combo_IsLikelySegmented(void* ptr) {
    u32 p;
    u32 segment;

    p = (u32)ptr;
    segment = p >> 24;

    return segment < 0x10;
}

static int Combo_RangeInsideFile(u32 offset, u32 size, u32 fileSize) {
    u32 end;

    if (size == 0) {
        return 0;
    }

    end = offset + size;

    if (end < offset) {
        return 0;
    }

    return end <= fileSize;
}

static int Combo_ImportedAnimFrameDmaInfo(
    void* animation,
    s32 frame,
    u32* outVrom,
    u32* outSize,
    int ootClampFrame
) {
    const ComboImportedAnimStaticHeader* imported;
    u32 frameCount;
    u32 frameSize;
    u32 offset;

    imported = Combo_FindImportedAnimStaticHeader(animation);

    if (imported == NULL) {
        return COMBO_IMPORTED_ANIM_NOT_FOUND;
    }

    frameCount = imported->frameCount;
    frameSize = imported->frameSize;
    offset = imported->offset;

    if (frame >= (s32)frameCount) {
        if (ootClampFrame) {
            frame = frameCount - 1;
        } else {
            return COMBO_IMPORTED_ANIM_FAIL;
        }
    }

    offset += frameSize * frame;

    *outVrom = COMBO_IMPORTED_LINK_ANIM_VROM + offset;
    *outSize = frameSize;

    return COMBO_IMPORTED_ANIM_SUCCESS;
}

#if defined(GAME_OOT)

#define COMBO_ANIMTASKQUEUE_ADD_LOAD_PLAYER_FRAME_ADDR 0x8008b4c4
#define COMBO_ANIMTASKQUEUE_NEW_TASK_ADDR              0x8008b48c
#define COMBO_DMAMGR_REQUEST_ASYNC_ADDR                0x80000d28

#define COMBO_PLAY_ANIM_TASK_QUEUE_OFFSET 0x10b20

typedef struct ImportedLinkAnimationHeader {
    u16 frameCount;
    u16 frameSize;
    u32 segment;
} ImportedLinkAnimationHeader;

typedef ImportedAnimTask* (*ComboAnimTaskQueueNewTaskFn)(ImportedAnimTaskQueue* queue, s32 type);

typedef s32 (*ComboDmaMgrRequestAsyncFn)(
    ComboDmaRequest* req,
    void* ram,
    u32 vrom,
    u32 size,
    u32 unk,
    OSMesgQueue* queue,
    OSMesg msg,
    const char* file,
    s32 line
);

#define Combo_AnimTaskQueue_NewTask \
    ((ComboAnimTaskQueueNewTaskFn)COMBO_ANIMTASKQUEUE_NEW_TASK_ADDR)

#define Combo_DmaMgr_RequestAsync \
    ((ComboDmaMgrRequestAsyncFn)COMBO_DMAMGR_REQUEST_ASYNC_ADDR)

static ImportedLinkAnimationHeader* Combo_LinkAnimHeaderToVirtual(ImportedLinkAnimationHeader* animation) {
    if (Combo_IsKseg0OrKseg1(animation)) {
        return animation;
    }

    if (Combo_IsLikelySegmented(animation)) {
        return SEGMENTED_TO_VIRTUAL(animation);
    }

    return NULL;
}

static int Combo_LinkAnimFrameDmaInfo(
    ImportedLinkAnimationHeader* animation,
    s32 frame,
    s32 limbCount,
    u32* outVrom,
    u32* outSize
) {
    ImportedLinkAnimationHeader* header;
    u32 segment;
    u32 offset;
    u32 frameSize;
    u32 frameCount;
    int importedResult;

    importedResult = Combo_ImportedAnimFrameDmaInfo(animation, frame, outVrom, outSize, 1);

    if (importedResult == COMBO_IMPORTED_ANIM_SUCCESS) {
        return 1;
    }

    if (importedResult == COMBO_IMPORTED_ANIM_FAIL) {
        return 0;
    }

    header = Combo_LinkAnimHeaderToVirtual(animation);

    frameCount = header->frameCount;
    segment = header->segment >> 24;
    offset = header->segment & 0x00ffffff;

    if (frame >= (s32)frameCount) {
        frame = frameCount - 1;
    }

    /*
     * OoT vanilla ignores header + 0x02.
     * Always compute DMA frame size from runtime limbCount.
     */
    frameSize = sizeof(Vec3s) * limbCount + sizeof(s16);
    offset += frameSize * frame;

    if (segment == COMBO_IMPORTED_LINK_ANIM_SEGMENT) {
        *outVrom = COMBO_IMPORTED_LINK_ANIM_VROM + offset;
        *outSize = frameSize;
        return 1;
    }

    if (segment != 0x07) {
        return 0;
    }

    *outVrom = COMBO_LINK_ANIMETION_VROM + offset;
    *outSize = frameSize;

    return 1;
}

static void Combo_AnimTaskQueue_AddLoadPlayerFrame(
    void* play,
    ImportedLinkAnimationHeader* animation,
    s32 frame,
    s32 limbCount,
    Vec3s* frameTable
) {
    ImportedAnimTaskQueue* queue;
    ImportedAnimTask* task;
    u32 size;
    u32 vrom;

    if (!Combo_LinkAnimFrameDmaInfo(animation, frame, limbCount, &vrom, &size)) {
        return;
    }

    queue = (ImportedAnimTaskQueue*)((u8*)play + COMBO_PLAY_ANIM_TASK_QUEUE_OFFSET);
    task = Combo_AnimTaskQueue_NewTask(queue, ANIMTASK_LOAD_PLAYER_FRAME);

    osCreateMesgQueue(
        Combo_AnimTaskMsgQueue(task),
        Combo_AnimTaskMsg(task),
        1
    );

    Combo_DmaMgr_RequestAsync(
        Combo_AnimTaskReq(task),
        frameTable,
        vrom,
        size,
        0,
        Combo_AnimTaskMsgQueue(task),
        NULL,
        "ComboLinkAnimationHooks",
        __LINE__
    );
}

PATCH_FUNC(
    COMBO_ANIMTASKQUEUE_ADD_LOAD_PLAYER_FRAME_ADDR,
    Combo_AnimTaskQueue_AddLoadPlayerFrame
);

#elif defined(GAME_MM)

#define COMBO_ANIMTASKQUEUE_ADD_LOAD_PLAYER_FRAME_ADDR 0x80135954
#define COMBO_ANIMTASKQUEUE_NEW_TASK_ADDR              0x8013591c
#define COMBO_ANIMATION_GET_LENGTH_ADDR                0x80134724
#define COMBO_ANIMATION_GET_LAST_FRAME_ADDR            0x80134748
#define COMBO_LIB_SEGMENTED_TO_VIRTUAL_ADDR            0x80100504
#define COMBO_DMAMGR_REQUEST_ASYNC_ADDR                0x80080c04

#define COMBO_PLAY_ANIM_TASK_QUEUE_OFFSET 0x17104

typedef struct ImportedPlayerAnimationHeader {
    u16 frameCount;
    s16 frameSize;
    u32 linkAnimSegment;
} ImportedPlayerAnimationHeader;

typedef ImportedAnimTask* (*ComboAnimTaskQueueNewTaskFn)(ImportedAnimTaskQueue* queue, s32 type);
typedef void* (*ComboLibSegmentedToVirtualFn)(void* ptr);

typedef s32 (*ComboDmaMgrRequestAsyncFn)(
    ComboDmaRequest* req,
    void* ram,
    u32 vrom,
    u32 size,
    u32 unk,
    OSMesgQueue* queue,
    OSMesg msg
);

#define Combo_AnimTaskQueue_NewTask \
    ((ComboAnimTaskQueueNewTaskFn)COMBO_ANIMTASKQUEUE_NEW_TASK_ADDR)

#define Combo_Lib_SegmentedToVirtual \
    ((ComboLibSegmentedToVirtualFn)COMBO_LIB_SEGMENTED_TO_VIRTUAL_ADDR)

#define Combo_DmaMgr_RequestAsync \
    ((ComboDmaMgrRequestAsyncFn)COMBO_DMAMGR_REQUEST_ASYNC_ADDR)

static ImportedPlayerAnimationHeader* Combo_LinkAnimHeaderToVirtual(ImportedPlayerAnimationHeader* animation) {
    if (Combo_IsKseg0OrKseg1(animation)) {
        return animation;
    }

    if (Combo_IsLikelySegmented(animation)) {
        return Combo_Lib_SegmentedToVirtual(animation);
    }

    return NULL;
}

static const ComboImportedAnimStaticHeader* Combo_MM_FindImportedAnimStaticHeader(void* animation) {
    const ComboImportedAnimStaticHeader* imported;
    void* virtualAnimation;
    void* importedVirtualAnimation;
    s32 i;

    imported = Combo_FindImportedAnimStaticHeader(animation);

    if (imported != NULL) {
        return imported;
    }

    if (Combo_IsKseg0OrKseg1(animation)) {
        virtualAnimation = animation;
    } else if (Combo_IsLikelySegmented(animation)) {
        virtualAnimation = Combo_Lib_SegmentedToVirtual(animation);
    } else {
        return NULL;
    }

    for (i = 0; i < COMBO_ARRAY_COUNT(kComboImportedAnimStaticHeaders); i++) {
        if (kComboImportedAnimStaticHeaders[i].animation == 0) {
            continue;
        }

        importedVirtualAnimation = Combo_Lib_SegmentedToVirtual(
            (void*)kComboImportedAnimStaticHeaders[i].animation
        );

        if (importedVirtualAnimation == virtualAnimation) {
            return &kComboImportedAnimStaticHeaders[i];
        }
    }

    return NULL;
}

static s16 Combo_MM_Animation_GetLength(void* animation) {
    const ComboImportedAnimStaticHeader* imported;
    ImportedPlayerAnimationHeader* header;

    imported = Combo_MM_FindImportedAnimStaticHeader(animation);

    if (imported != NULL) {
        return imported->frameCount;
    }

    header = Combo_LinkAnimHeaderToVirtual(animation);

    return header->frameCount;
}

static s16 Combo_MM_Animation_GetLastFrame(void* animation) {
    const ComboImportedAnimStaticHeader* imported;
    ImportedPlayerAnimationHeader* header;

    imported = Combo_MM_FindImportedAnimStaticHeader(animation);

    if (imported != NULL) {
        return (u16)imported->frameCount - 1;
    }

    header = Combo_LinkAnimHeaderToVirtual(animation);

    return header->frameCount - 1;
}

static int Combo_MM_LinkAnimFrameDmaInfo(
    ImportedPlayerAnimationHeader* animation,
    s32 frame,
    s32 limbCount,
    u32* outVrom,
    u32* outSize
) {
    const ComboImportedAnimStaticHeader* imported;
    ImportedPlayerAnimationHeader* header;
    u32 segment;
    u32 frameSize;
    u32 frameCount;
    u32 baseOffset;
    u32 finalOffset;

    frameSize = sizeof(Vec3s) * limbCount + sizeof(s16);

    imported = Combo_MM_FindImportedAnimStaticHeader(animation);

    if (imported != NULL) {
        frameCount = imported->frameCount;

        if (frame >= (s32)frameCount) {
            return 0;
        }

        finalOffset = imported->offset + frameSize * frame;

        *outVrom = COMBO_IMPORTED_LINK_ANIM_VROM + finalOffset;
        *outSize = frameSize;

        return 1;
    }

    header = Combo_LinkAnimHeaderToVirtual(animation);

    segment = header->linkAnimSegment >> 24;
    baseOffset = header->linkAnimSegment & 0x00ffffff;
    finalOffset = baseOffset + frameSize * frame;

    if (segment != 0x07) {
        return 0;
    }

    *outVrom = COMBO_LINK_ANIMETION_VROM + finalOffset;
    *outSize = frameSize;

    return 1;
}

static void Combo_AnimTaskQueue_AddLoadPlayerFrame(
    void* play,
    ImportedPlayerAnimationHeader* animation,
    s32 frame,
    s32 limbCount,
    Vec3s* frameTable
) {
    ImportedAnimTaskQueue* queue;
    ImportedAnimTask* task;
    u32 size;
    u32 vrom;

    if (!Combo_MM_LinkAnimFrameDmaInfo(animation, frame, limbCount, &vrom, &size)) {
        return;
    }

    queue = (ImportedAnimTaskQueue*)((u8*)play + COMBO_PLAY_ANIM_TASK_QUEUE_OFFSET);
    task = Combo_AnimTaskQueue_NewTask(queue, ANIMTASK_LOAD_PLAYER_FRAME);

    osCreateMesgQueue(
        Combo_AnimTaskMsgQueue(task),
        Combo_AnimTaskMsg(task),
        1
    );

    Combo_DmaMgr_RequestAsync(
        Combo_AnimTaskReq(task),
        frameTable,
        vrom,
        size,
        0,
        Combo_AnimTaskMsgQueue(task),
        NULL
    );
}

PATCH_FUNC(
    COMBO_ANIMATION_GET_LENGTH_ADDR,
    Combo_MM_Animation_GetLength
);

PATCH_FUNC(
    COMBO_ANIMATION_GET_LAST_FRAME_ADDR,
    Combo_MM_Animation_GetLastFrame
);

PATCH_FUNC(
    COMBO_ANIMTASKQUEUE_ADD_LOAD_PLAYER_FRAME_ADDR,
    Combo_AnimTaskQueue_AddLoadPlayerFrame
);

#endif