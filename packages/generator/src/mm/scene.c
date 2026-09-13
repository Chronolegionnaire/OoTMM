#include <combo.h>
#include <combo/custom.h>
#include <combo/common/scene.h>
#include <combo/common/cosmetics.h>

#define MM_OBJECT_BANK_EXTRA 0x00020000u

static EntranceTableEntry defaultEntrance = {
    0, /* Southern Swamp (Clear) */
    0, /* From Road to Southern Swamp */
    TRANS_TYPE_FADE_BLACK
};

static u32 Object_GetExpandedSpaceSize(s16 sceneId)
{
    u32 size;

    switch (sceneId)
    {
    case SCE_MM_CLOCK_TOWN_EAST:
    case SCE_MM_CLOCK_TOWN_WEST:
    case SCE_MM_CLOCK_TOWN_NORTH:
    case SCE_MM_CLOCK_TOWN_SOUTH:
        size = 1530 * 1024;
        break;

    case SCE_MM_MILK_BAR:
        size = 1580 * 1024;
        break;

    case SCE_MM_TERMINA_FIELD:
        size = 1470 * 1024;
        break;

    default:
        size = 1380 * 1024;
        break;
    }

    return size + MM_OBJECT_BANK_EXTRA;
}

static int Object_CheckBankRange(ObjectContext* objectCtx, const void* start, u32 size, const char* where)
{
    uintptr_t first;
    uintptr_t last;

    first = (uintptr_t)start;
    last = ALIGN16(first + size);

    if (last < first ||
        first < (uintptr_t)objectCtx->spaceStart ||
        last > (uintptr_t)objectCtx->spaceEnd)
    {
        Fault_AddHungupAndCrashImpl("MM object bank overflow", where);
        return 0;
    }

    return 1;
}

static u32 Object_GetPersistentReserveSize(s16 id, u32 objectSize)
{
    u32 adultSize;

    if (id != OBJECT_LINK_CHILD)
        return objectSize;

    adultSize = comboLoadObject(NULL, CUSTOM_OBJECT_ID_MM_ADULT_LINK);
    if (adultSize > objectSize)
        return adultSize;

    return objectSize;
}
static uintptr_t Object_GetSlotLimit(ObjectContext* objectCtx, s32 slot)
{
    uintptr_t start;
    uintptr_t next;
    uintptr_t limit;

    start = (uintptr_t)objectCtx->slots[slot].segment;
    limit = (uintptr_t)objectCtx->spaceEnd;

    if (slot + 1 < ARRAY_COUNT(objectCtx->slots))
    {
        next = (uintptr_t)objectCtx->slots[slot + 1].segment;

        if (next > start && next <= limit)
            limit = next;
    }

    return limit;
}

EntranceTableEntry* Entrance_GetTableEntryCustom(u16 entrance)
{
    if (entrance >= 0xF000)
    {
        return &defaultEntrance;
    }

    return Entrance_GetTableEntry(entrance);
}

PATCH_CALL(0x8013231c, Entrance_GetTableEntryCustom);
PATCH_CALL(0x80132348, Entrance_GetTableEntryCustom);
PATCH_CALL(0x80132384, Entrance_GetTableEntryCustom);
PATCH_CALL(0x801323b0, Entrance_GetTableEntryCustom);

s32 Scene_LoadHumanLinkObject(ObjectContext* objectCtx, s16 id)
{
    if (comboIsLinkAdult())
    {
        id = CUSTOM_OBJECT_ID_MM_ADULT_LINK;
    }
    return Object_SpawnPersistent(objectCtx, id);
}

PATCH_CALL(0x8012f854, Scene_LoadHumanLinkObject);

s32 Object_SpawnPersistentCustom(ObjectContext* objectCtx, s16 id)
{
    u32 size;
    u32 reserveSize;
    void* segment;

    if (objectCtx->num >= ARRAY_COUNT(objectCtx->slots))
    {
        Fault_AddHungupAndCrashImpl("MM object slot overflow", "Object_SpawnPersistent");
        return -1;
    }

    segment = objectCtx->slots[objectCtx->num].segment;
    size = comboLoadObject(NULL, id);
    reserveSize = Object_GetPersistentReserveSize(id, size);

    if (!Object_CheckBankRange(
            objectCtx,
            segment,
            reserveSize,
            "Object_SpawnPersistent"))
    {
        return -1;
    }

    objectCtx->slots[objectCtx->num].id = id;

    if (size != 0)
        comboLoadObject(segment, id);

    if (objectCtx->num < ARRAY_COUNT(objectCtx->slots) - 1)
    {
        objectCtx->slots[objectCtx->num + 1].segment =
            (void*)ALIGN16((uintptr_t)segment + reserveSize);
    }

    objectCtx->num++;
    objectCtx->numPersistentEntries = objectCtx->num;

    return objectCtx->num - 1;
}

PATCH_FUNC(0x8012f2e0, Object_SpawnPersistentCustom);

void Scene_ApplyHumanAgeGameplayKeep(ObjectContext* objectCtx, s32 isAdult)
{
    u8* gameplayKeep;
    u32* spinAttackChargingDL1;
    u32* maskMatrixDL;

    if (!isAdult)
        return;

    gameplayKeep = objectCtx->slots[objectCtx->mainKeepIndex].segment;

    comboLoadObject(
        gameplayKeep + 0x25510,
        CUSTOM_OBJECT_ID_MM_ADULT_LINK_SPIN_ATTACK_VTX_1
    );

    comboLoadObject(
        gameplayKeep + 0x25A90,
        CUSTOM_OBJECT_ID_MM_ADULT_LINK_SPIN_ATTACK_VTX_2
    );

    comboLoadObject(
        gameplayKeep + 0x26810,
        CUSTOM_OBJECT_ID_MM_ADULT_LINK_SPIN_ATTACK_VTX_3
    );

    comboLoadObject(
        gameplayKeep + 0x5A2A0,
        CUSTOM_OBJECT_ID_MM_ADULT_LINK_MASK_MTX
    );

    spinAttackChargingDL1 = (u32*)(gameplayKeep + 0x268F0);
    spinAttackChargingDL1[0] = 0xDE000000;
    spinAttackChargingDL1[1] = 0x0405A2E0;

    maskMatrixDL = (u32*)(gameplayKeep + 0x5A2E0);
    maskMatrixDL[0] = 0xE7000000;
    maskMatrixDL[1] = 0x00000000;
    maskMatrixDL[2] = 0xDA380001;
    maskMatrixDL[3] = 0x0405A2A0;
    maskMatrixDL[4] = 0xDF000000;
    maskMatrixDL[5] = 0x00000000;
}

void Object_LoadAllCustom(ObjectContext* objectCtx)
{
    s32 i;
    s32 id;
    u32 size;

    for (i = 0; i < objectCtx->num; i++)
    {
        id = objectCtx->slots[i].id;

        if (id <= 0)
            continue;

        size = comboLoadObject(NULL, id);
        if (!Object_CheckBankRange(
                objectCtx,
                objectCtx->slots[i].segment,
                size,
                "Object_LoadAll"))
        {
            continue;
        }

        comboLoadObject(objectCtx->slots[i].segment, id);
    }

    Scene_ApplyHumanAgeGameplayKeep(objectCtx, comboIsLinkAdult());
}

PATCH_FUNC(0x8012f698, Object_LoadAllCustom);

void* Object_AllocateSlotCustom(ObjectContext* objectCtx, s32 slot, s16 id)
{
    uintptr_t addr;
    uintptr_t slotLimit;
    u32 vromSize;
    const ObjectData* fileTableEntry;
    s32 isAdultLink;

    /* Patch the human-form load to the custom Adult Link object. */
    if (comboIsLinkAdult() && id == OBJECT_LINK_CHILD)
        id = CUSTOM_OBJECT_ID_MM_ADULT_LINK;

    if (slot < 0 || slot >= ARRAY_COUNT(objectCtx->slots))
    {
        Fault_AddHungupAndCrashImpl("MM object slot overflow", "Object_AllocateSlot");
        return objectCtx->spaceEnd;
    }

    objectCtx->slots[slot].dmaRequest.vromAddr = 0;

    if (!id)
    {
        objectCtx->slots[slot].id = 0;
        return NULL;
    }

    fileTableEntry = comboGetObjectData(id);
    vromSize = fileTableEntry->vromEnd - fileTableEntry->vromStart;

    if (!Object_CheckBankRange(
            objectCtx,
            objectCtx->slots[slot].segment,
            vromSize,
            "Object_AllocateSlot"))
    {
        objectCtx->slots[slot].id = 0;
        return objectCtx->spaceEnd;
    }

    addr = ALIGN16(
        (uintptr_t)objectCtx->slots[slot].segment + vromSize
    );

    isAdultLink = (id == CUSTOM_OBJECT_ID_MM_ADULT_LINK);

    if (isAdultLink)
    {
        slotLimit = Object_GetSlotLimit(objectCtx, slot);
        if (addr > slotLimit)
        {
            Fault_AddHungupAndCrashImpl(
                "MM adult player slot overflow",
                "Object_AllocateSlot"
            );
            objectCtx->slots[slot].id = 0;
            return (void*)slotLimit;
        }
        comboLoadObject(objectCtx->slots[slot].segment, id);
        objectCtx->slots[slot].id = id;
        return (void*)addr;
    }
    objectCtx->slots[slot].id = -id;
    return (void*)addr;
}

PATCH_FUNC(0x8012f73c, Object_AllocateSlotCustom);

void Object_UpdateEntriesCustom(ObjectContext* objectCtx)
{
    s32 i;
    ObjectStatus* entry = &objectCtx->slots[0];
    const ObjectData* objectFile;
    u32 size;

    for (i = 0; i < objectCtx->num; i++)
    {
        if (entry->id < 0)
        {
            s16 id = -entry->id;

            if (entry->dmaRequest.vromAddr == 0)
            {
                objectFile = comboGetObjectData(id);
                size = objectFile->vromEnd - objectFile->vromStart;

                if (size == 0)
                {
                    entry->id = 0;
                }
                else if (!Object_CheckBankRange(
                             objectCtx,
                             entry->segment,
                             size,
                             "Object_UpdateEntries"))
                {
                    entry->id = 0;
                }
                else
                {
                    osCreateMesgQueue(&entry->loadQueue, &entry->loadMsg, 1);
                    RequestDma(
                        &entry->dmaRequest,
                        entry->segment,
                        objectFile->vromStart,
                        size,
                        0,
                        &entry->loadQueue,
                        NULL
                    );
                }
            }
            else if (!osRecvMesg(&entry->loadQueue, NULL, OS_MESG_NOBLOCK))
            {
                entry->id = id;
            }
        }

        entry++;
    }
}

PATCH_FUNC(0x8012F4FC, Object_UpdateEntriesCustom);

void Object_InitContextExpanded(GameState* gameState, ObjectContext* objectCtx)
{
    PlayState* play = (PlayState*)gameState;
    u32 spaceSize;
    s32 i;

    spaceSize = Object_GetExpandedSpaceSize(play->sceneId);

    objectCtx->num = 0;
    objectCtx->numPersistentEntries = 0;
    objectCtx->mainKeepIndex = 0;
    objectCtx->subKeepIndex = 0;

    for (i = 0; i < ARRAY_COUNT(objectCtx->slots); i++)
    {
        objectCtx->slots[i].id = 0;
        objectCtx->slots[i].segment = NULL;
        objectCtx->slots[i].dmaRequest.vromAddr = 0;
    }

    objectCtx->spaceStart = objectCtx->slots[0].segment =
        THA_AllocTailAlign16(&gameState->tha, spaceSize);

    if (THA_IsCrash(&gameState->tha))
    {
        Fault_AddHungupAndCrashImpl("MM object bank THA overflow", "Object_InitContext");
        return;
    }

    objectCtx->spaceEnd =
        (void*)((uintptr_t)objectCtx->spaceStart + spaceSize);

    objectCtx->mainKeepIndex =
        Object_SpawnPersistent(objectCtx, OBJECT_GAMEPLAY_KEEP);

    if (objectCtx->mainKeepIndex < 0)
    {
        Fault_AddHungupAndCrashImpl("MM gameplay_keep load failed", "Object_InitContext");
        return;
    }

    gSegments[0x04] = OS_K0_TO_PHYSICAL(
        objectCtx->slots[objectCtx->mainKeepIndex].segment
    );
}

PATCH_FUNC(0x8012F3D0, Object_InitContextExpanded);

void Object_AfterInitContext(void)
{
    Scene_ApplyHumanAgeGameplayKeep(&gPlay->objectCtx, comboIsLinkAdult());
}

u8 gNightBgm;
EXPORT_SYMBOL(NIGHT_BGM, gNightBgm);

void Scene_CommandSoundSettings(PlayState* play, SceneCmd* cmd)
{
    u8 ambienceId;

    ambienceId = cmd->soundSettings.ambienceId;
    if (gNightBgm)
    {
        switch (play->sceneId)
        {
        case SCE_MM_MOON:
        case SCE_MM_MOON_DEKU:
        case SCE_MM_MOON_GORON:
        case SCE_MM_MOON_ZORA:
        case SCE_MM_MOON_LINK:
        case SCE_MM_IKANA_GRAVEYARD:
            break;
        default:
            ambienceId = 0x13;
        }
    }

    play->sceneSequences.seqId = cmd->soundSettings.seqId;
    play->sceneSequences.ambienceId = ambienceId;

    if (gSaveContext.seqId == (u8)NA_BGM_DISABLED ||
        // Should be AudioSeq_GetActiveSeqId(u8), but apparently we've defined it as Audio_GetActiveSeqId
        Audio_GetActiveSeqId(SEQ_PLAYER_BGM_MAIN) == NA_BGM_FINAL_HOURS)
    {
        Audio_SetSpec(cmd->soundSettings.specId);
    }
}

PATCH_FUNC(0x801303e0, Scene_CommandSoundSettings);
