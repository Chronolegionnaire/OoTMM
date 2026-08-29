#include <combo.h>
#include <combo/dma.h>
#include <combo/dungeon.h>
#include <combo/menu.h>
#include <combo/item.h>
#include <combo/player.h>
#include <combo/global.h>
#include <combo/dpad.h>
#include <combo/inventory.h>
#include <combo/entrance.h>
#include <combo/misc.h>
#include <combo/common/Kaleido_Scope.h>
#include "combo/custom.h"
#include "combo/mask.h"


static u32 comboResolvePauseSlot(PlayState* play, u32 slot)
{
    if (play && play->pauseCtx.pageIndex == PAUSE_MASK)
        return slot + ITEM_NUM_SLOTS;
    return slot;
}

static int KaleidoScope_NormalizeMoonMaskSlot(u32 slot);
static void KaleidoScope_ToggleMaskSlotSkipHidden(u32 slot);

static Vtx* KaleidoScope_GetQuestVtx(PlayState* play)
{
    return *(Vtx**)((u8*)&play->pauseCtx + MM_PAUSE_QUEST_VTX_OFFSET);
}

static void KaleidoScope_InvalidateNamedItem(PlayState* play)
{
    *(u16*)((u8*)&play->pauseCtx + MM_PAUSE_NAMED_ITEM_OFFSET) =
        MM_PAUSE_ITEM_NONE;
}

static s32 sQuestEquipProxyActive;

static void KaleidoScope_BeginQuestEquipProxy(PlayState* play)
{
    MmSwordExt sword;
    MmShieldExt shield;

    if (!play || play->pauseCtx.state == 0)
        return;

    MmSword_EnsureState();
    MmShield_EnsureState();

    sword = MmSword_GetSelected();
    shield = MmShield_GetSelected();

    if (sword == MM_SWORD_EXT_NONE)
        gMmSave.info.itemEquips.sword = 0;
    else if (sword <= MM_SWORD_EXT_GILDED)
        gMmSave.info.itemEquips.sword = (u8)sword;
    else
        gMmSave.info.itemEquips.sword = MM_SWORD_EXT_GILDED;

    switch (shield)
    {
    case MM_SHIELD_EXT_DEKU:
    case MM_SHIELD_EXT_HERO:
    case MM_SHIELD_EXT_HYLIAN:
        gMmSave.info.itemEquips.shield = 1;
        break;
    case MM_SHIELD_EXT_MIRROR:
        gMmSave.info.itemEquips.shield = 2;
        break;
    default:
        gMmSave.info.itemEquips.shield = 0;
        break;
    }

    sQuestEquipProxyActive = 1;
}

static void KaleidoScope_EndQuestEquipProxy(void)
{
    if (!sQuestEquipProxyActive)
        return;

    MmSword_RefreshNativeEquip(NULL);
    MmShield_RefreshNativeEquip(NULL);
    sQuestEquipProxyActive = 0;
}

void MmShield_Unequip(PlayState* play)
{
    MmShield_EnsureState();

    gSharedCustomSave.mmShieldEquipped = MM_SHIELD_EXT_NONE;
    gSharedCustomSave.mm
        .humanAgeLoadouts[gMmSave.linkAge]
        .shield = MM_SHIELD_EXT_NONE;

    MmShield_RefreshNativeEquip(play);
}

void KaleidoScope_BeforeUpdateCustomMm(PlayState* play)
{
    PauseContext* pauseCtx;
    u16 press;
    u16 slot;

    pauseCtx = &play->pauseCtx;
    press = play->state.input[0].press.button;

    if (pauseCtx->state != 0)
        KaleidoScope_BeginQuestEquipProxy(play);
    else
        KaleidoScope_EndQuestEquipProxy();

    if (pauseCtx->state != 6 ||
        pauseCtx->mainState != 0 ||
        pauseCtx->pageIndex != PAUSE_QUEST)
    {
        return;
    }

    slot = pauseCtx->cursorSlot[PAUSE_QUEST];

    if (slot == MM_QUEST_SWORD_SLOT)
    {
        MmSwordExt selected;
        MmSwordExt next;

        MmSword_EnsureState();
        if (MmSword_GetSelected() == MM_SWORD_EXT_NONE)
            return;

        pauseCtx->cursorColorIndex = 4;

        if (press & (L_TRIG | U_CBUTTONS))
        {
            selected = MmSword_GetSelected();
            next = MmSword_GetNextOwned(selected);

            if (next != selected)
            {
                MmSword_SetSelected(next);
                KaleidoScope_BeginQuestEquipProxy(play);
                KaleidoScope_InvalidateNamedItem(play);
                PlaySound(0x4809);
            }
            else
            {
                PlaySound(0x4806);
            }

            play->state.input[0].press.button &=
                ~(L_TRIG | U_CBUTTONS);
            return;
        }

        if (press & A_BUTTON)
        {
            selected = MmSword_GetSelected();

            if (selected != MmSword_GetEquipped())
            {
                KaleidoScope_EndQuestEquipProxy();
                MmSword_Equip(play, selected);
                KaleidoScope_BeginQuestEquipProxy(play);
                KaleidoScope_InvalidateNamedItem(play);
            }

            PlaySound(0x4808);
            play->state.input[0].press.button &= ~A_BUTTON;
        }

        return;
    }

    if (slot == MM_QUEST_SHIELD_SLOT)
    {
        MmShieldExt selected;
        MmShieldExt next;
        u16 held;

        MmShield_EnsureState();
        if (MmShield_GetSelected() == MM_SHIELD_EXT_NONE)
            return;

        pauseCtx->cursorColorIndex = 4;
        held = play->state.input[0].cur.button;

        if ((press & U_CBUTTONS) && (held & L_TRIG))
        {
            if (MmShield_GetEquipped() != MM_SHIELD_EXT_NONE)
            {
                KaleidoScope_EndQuestEquipProxy();
                MmShield_Unequip(play);
                KaleidoScope_BeginQuestEquipProxy(play);
                KaleidoScope_InvalidateNamedItem(play);
                PlaySound(0x4808);
            }
            else
            {
                PlaySound(0x4806);
            }

            play->state.input[0].press.button &=
                ~(L_TRIG | U_CBUTTONS);
            return;
        }

        if (press & U_CBUTTONS)
        {
            selected = MmShield_GetSelected();
            next = MmShield_GetNextOwned(selected);

            if (next != selected)
            {
                MmShield_SetSelected(next);
                KaleidoScope_BeginQuestEquipProxy(play);
                KaleidoScope_InvalidateNamedItem(play);
                PlaySound(0x4809);
            }
            else
            {
                PlaySound(0x4806);
            }

            play->state.input[0].press.button &= ~U_CBUTTONS;
            return;
        }

        if (press & A_BUTTON)
        {
            selected = MmShield_GetSelected();

            if (selected != MmShield_GetEquipped())
            {
                KaleidoScope_EndQuestEquipProxy();
                MmShield_Equip(play, selected);
                KaleidoScope_BeginQuestEquipProxy(play);
                KaleidoScope_InvalidateNamedItem(play);
            }

            PlaySound(0x4808);
            play->state.input[0].press.button &= ~A_BUTTON;
        }
    }
}

void KaleidoScope_AfterUpdateCustomMm(PlayState* play)
{
    PauseContext* pauseCtx;
    u16 slot;

    pauseCtx = &play->pauseCtx;

    if (pauseCtx->state == 6 && pauseCtx->mainState == 0 && pauseCtx->pageIndex == PAUSE_QUEST)
    {
        slot = pauseCtx->cursorSlot[PAUSE_QUEST];

        if (slot == MM_QUEST_SWORD_SLOT)
        {
            MmSword_EnsureState();
            if (MmSword_GetSelected() != MM_SWORD_EXT_NONE)
                pauseCtx->cursorColorIndex = 4;
        }
        else if (slot == MM_QUEST_SHIELD_SLOT)
        {
            MmShield_EnsureState();
            if (MmShield_GetSelected() != MM_SHIELD_EXT_NONE)
                pauseCtx->cursorColorIndex = 4;
        }
    }

    if (sQuestEquipProxyActive && pauseCtx->state == 0)
        KaleidoScope_EndQuestEquipProxy();
}

static u8 KaleidoScope_CustomMaskToItem(s32 customMask)
{
    switch (customMask)
    {
    case PLAYER_CUSTOM_MASK_GERUDO:
        return ITEM_MM_MASK_GERUDO;
    case PLAYER_CUSTOM_MASK_SKULL:
        return ITEM_MM_MASK_SKULL;
    case PLAYER_CUSTOM_MASK_SPOOKY:
        return ITEM_MM_MASK_SPOOKY;
    default:
        return ITEM_NONE;
    }
}

static s32 KaleidoScope_IsWornCustomMaskSlot(u32 slot)
{
    s32 i;
    u8 wornItem;
    u32 flags;
    const u8* table;
    u32 tableSize;
    u8* itemPtr;

    wornItem = KaleidoScope_CustomMaskToItem(gCustomSave.customMask);
    if (wornItem == ITEM_NONE)
        return 0;

    for (i = EQUIP_SLOT_C_LEFT; i <= EQUIP_SLOT_C_RIGHT; i++)
    {
        if (BUTTON_ITEM_EQUIP(0, i) == wornItem && C_SLOT_EQUIP(0, i) == slot)
            return 1;
    }
    if (comboGetSlotExtras(slot, &itemPtr, &flags, &table, &tableSize) >= 0)
        return *itemPtr == wornItem;

    return 0;
}

s32 Player_GetCurMaskItemId_Custom(PlayState* play)
{
    Player* player;
    s32 customItem;

    customItem = KaleidoScope_CustomMaskToItem(gCustomSave.customMask);
    if (customItem != ITEM_NONE)
        return customItem;

    player = GET_PLAYER(play);

    if (player->currentMask != PLAYER_MASK_NONE)
        return Player_MaskIdToItemId(player->currentMask - 1);

    return ITEM_NONE;
}

PATCH_FUNC(0x80122eec, Player_GetCurMaskItemId_Custom);

void KaleidoScope_AfterSetCutsorColor(PlayState* play)
{
    u16 cursorSlot;
    int press;
    int effect;

    /* Update Dpad */
    Dpad_Update(play);

    if (play->pauseCtx.pageIndex == PAUSE_MASK)
    {
        u16 slot = play->pauseCtx.cursorSlot[PAUSE_MASK];
        if (slot >= MASK_NUM_SLOTS || gSave.info.inventory.items[ITEM_NUM_SLOTS + slot] == ITEM_NONE)
        {
            play->pauseCtx.cursorItem[PAUSE_MASK] = 999;
            if (play->pauseCtx.nameSegment)
                bzero(play->pauseCtx.nameSegment, 0x400);
        }
    }

    cursorSlot = play->pauseCtx.cursorSlot[play->pauseCtx.pageIndex];
    cursorSlot = comboResolvePauseSlot(play, cursorSlot);
    press = !!(play->state.input[0].press.button & (L_TRIG | U_CBUTTONS));
    effect = 0;

    u8* itemPtr;
    u32 flags;
    const u8* table;
    u32 tableSize;

    if (comboGetSlotExtras(cursorSlot, &itemPtr, &flags, &table, &tableSize) >= 0 && play->pauseCtx.cursorItem[play->pauseCtx.pageIndex] != 999 && popcount(flags) > 1)
    {
        if (play->pauseCtx.pageIndex == PAUSE_MASK)
        {
            if (KaleidoScope_NormalizeMoonMaskSlot(cursorSlot))
                effect = 1;
        }

        play->pauseCtx.cursorColorIndex = 4;

        if (press)
        {
            if (KaleidoScope_IsWornCustomMaskSlot(cursorSlot))
            {
                PlaySound(0x4806); /* NA_SE_SY_ERROR */
                return;
            }

            if (play->pauseCtx.pageIndex == PAUSE_MASK)
                KaleidoScope_ToggleMaskSlotSkipHidden(cursorSlot);
            else
                comboToggleSlot(cursorSlot);

            effect = 1;
        }
    }

    if (cursorSlot >= ITS_MM_BOTTLE && cursorSlot <= ITS_MM_BOTTLE6 && gSave.info.inventory.items[cursorSlot] == ITEM_MM_SPRING_WATER_HOT)
    {
        play->pauseCtx.cursorColorIndex = 4;
        if (press)
        {
            gSave.info.inventory.items[cursorSlot] = ITEM_MM_SPRING_WATER;
            reloadSlotMm(gPlay, cursorSlot);
            effect = 1;
        }
    }

    if (effect)
    {
        PlaySound(0x4809);
    }
}

void KaleidoScope_LoadNamedItemCustom(void* segment, u32 texIndex)
{
    DmaEntry dma;
    u32 isForeign = 0;
    if (gPlay &&
            gPlay->pauseCtx.pageIndex == PAUSE_QUEST &&
            gPlay->pauseCtx.cursorSlot[PAUSE_QUEST] == MM_QUEST_SWORD_SLOT) {
        MmSwordExt sword;
        MmSword_EnsureState();
        sword = MmSword_GetSelected();
        switch (sword)
        {
            case MM_SWORD_EXT_KOKIRI:
                LoadIcon(0x00A27660, ITEM_MM_SWORD_KOKIRI, segment,0x400);
                return;
            case MM_SWORD_EXT_RAZOR:
                LoadIcon(0x00A27660,ITEM_MM_SWORD_RAZOR,segment,0x400);
                return;
            case MM_SWORD_EXT_GILDED:
                LoadIcon(0x00A27660,ITEM_MM_SWORD_GILDED,segment,0x400);
                return;
            case MM_SWORD_EXT_MASTER:
                texIndex = 0x7b + ITEM_OOT_SWORD_MASTER;
                isForeign = 1;
                break;
            case MM_SWORD_EXT_GIANTS_KNIFE:
                if (MmSword_GetGiantsKnifeHealth() == 0)
                    texIndex = 0x7b + ITEM_OOT_SWORD_KNIFE_BROKEN;
                else
                    texIndex = 0x7b + ITEM_OOT_SWORD_KNIFE_BIGGORON;
                isForeign = 1;
                break;
            case MM_SWORD_EXT_BIGGORON:
                texIndex = 0x7b + 0x7a;
                isForeign = 1;
                break;
            default:
                break;
        }
    }
    if (isForeign)
    {
        comboDmaLookupForeignId(&dma, 0xf);
        DMARomToRam((dma.pstart + 0x400 * texIndex) | PI_DOM1_ADDR2,segment,0x400);
        return;
    }
    if (gPlay && gPlay->pauseCtx.pageIndex == PAUSE_QUEST && gPlay->pauseCtx.cursorSlot[PAUSE_QUEST] == MM_QUEST_SHIELD_SLOT)
    {
        MmShieldExt shield;
        MmShield_EnsureState();
        shield = MmShield_GetSelected();
        switch (shield)
        {
            case MM_SHIELD_EXT_DEKU:
                texIndex = 0x7b + ITEM_OOT_SHIELD_DEKU;
                isForeign = 1;
                break;
            case MM_SHIELD_EXT_HYLIAN:
                texIndex = 0x7b + ITEM_OOT_SHIELD_HYLIAN;
                isForeign = 1;
                break;
            case MM_SHIELD_EXT_HERO:
                LoadIcon(0x00A27660, ITEM_MM_SHIELD_HERO, segment,0x400);
                return;
            case MM_SHIELD_EXT_MIRROR:
                LoadIcon(0x00A27660, ITEM_MM_SHIELD_MIRROR, segment,0x400);
                return;
            default:
                break;
        }

        if (isForeign)
        {
            comboDmaLookupForeignId(&dma, 0xf);
            DMARomToRam((dma.pstart + 0x400 * texIndex) | PI_DOM1_ADDR2, segment,0x400);
            return;
        }
    }
    switch (texIndex)
    {
        case ITEM_MM_MASK_ADULT:
        {
            void* src = comboCacheGetFile(CUSTOM_ADULT_MASK_TEXT_ADDR);
            if (src)
                memcpy(segment, src, 0x400);
            else
                bzero(segment, 0x400);
            return;
        }
    case ITEM_MM_OCARINA_FAIRY:
        isForeign = 1;
        texIndex = 0x7b + ITEM_OOT_OCARINA_FAIRY;
        break;
    case ITEM_MM_HOOKSHOT_SHORT:
        isForeign = 1;
        texIndex = 0x7b + ITEM_OOT_HOOKSHOT;
        break;
    case ITEM_MM_SPELL_FIRE:
        isForeign = 1;
        texIndex = 0x7b + ITEM_OOT_SPELL_FIRE;
        break;
    case ITEM_MM_SPELL_WIND:
        isForeign = 1;
        texIndex = 0x7b + ITEM_OOT_SPELL_WIND;
        break;
    case ITEM_MM_SPELL_LOVE:
        isForeign = 1;
        texIndex = 0x7b + ITEM_OOT_SPELL_LOVE;
        break;
    case ITEM_MM_BOOTS_IRON:
        isForeign = 1;
        texIndex = 0x7b + ITEM_OOT_BOOTS_IRON;
        break;
    case ITEM_MM_BOOTS_HOVER:
        isForeign = 1;
        texIndex = 0x7b + ITEM_OOT_BOOTS_HOVER;
        break;
    case ITEM_MM_TUNIC_GORON:
        isForeign = 1;
        texIndex = 0x7b + ITEM_OOT_TUNIC_GORON;
        break;
    case ITEM_MM_TUNIC_ZORA:
        isForeign = 1;
        texIndex = 0x7b + ITEM_OOT_TUNIC_ZORA;
        break;
    case ITEM_MM_HAMMER:
        isForeign = 1;
        texIndex = 0x7b + ITEM_OOT_HAMMER;
        break;
    case ITEM_MM_BOOMERANG:
        isForeign = 1;
        texIndex = 0x7b + ITEM_OOT_BOOMERANG;
        break;
    case ITEM_MM_SLINGSHOT:
        isForeign = 1;
        texIndex = 0x7b + ITEM_OOT_SLINGSHOT;
        break;
    case ITEM_MM_RUTO_LETTER:
        isForeign = 1;
        texIndex = 0x7b + ITEM_OOT_RUTO_LETTER;
        break;
    case ITEM_MM_MASK_GERUDO:
        isForeign = 1;
        texIndex = 0x7b + ITEM_OOT_GERUDO_MASK;
        break;
    case ITEM_MM_MASK_SKULL:
        isForeign = 1;
        texIndex = 0x7b + ITEM_OOT_SKULL_MASK;
        break;
    case ITEM_MM_MASK_SPOOKY:
        isForeign = 1;
        texIndex = 0x7b + ITEM_OOT_SPOOKY_MASK;
        break;
    }
    if (isForeign)
    {
        comboDmaLookupForeignId(&dma, 0xf);
        u32 textureFileAddress = dma.pstart;
        u32 textureOffset = 0x400 * texIndex;
        DMARomToRam((textureFileAddress + textureOffset) | PI_DOM1_ADDR2, segment, 0x400);
    }
    else
    {
        LoadIcon(0x00A27660, texIndex, segment, 0x400);
    }

}

void KaleidoScope_ShowItemMessage(PlayState* play, u16 messageId, u8 yPosition)
{
    char* b;
    if (messageId == 0x1711)
    {
        messageId = 0x170f; /* Use Hookshot message instead of broken OoT Hookshot message */
    }
    Message_ShowMessageAtYPosition(play, messageId, yPosition);
    s16 itemId = messageId - 0x1700;
    switch (itemId)
    {
    case ITEM_MM_OCARINA_FAIRY:
        b = play->msgCtx.font.textBuffer.schar;
        b[2] = 0x4C; /* Use Ocarina of Time icon. */
        b += 11;
        comboTextAppendStr(&b, TEXT_COLOR_RED "Fairy Ocarina" TEXT_NL);
        comboTextAppendClearColor(&b);
        comboTextAppendStr(&b, "This is a memento from" TEXT_NL "Saria." TEXT_NL TEXT_BOX_BREAK_2 "Play it with \xB0 and the four \xB2" TEXT_NL "Buttons. Press \xB1 to stop." TEXT_END);
        break;
    case ITEM_MM_SPELL_WIND:
        b = play->msgCtx.font.textBuffer.schar;
        b[2] = 0xFE; /* Use No Icon */
        b += 11;
        comboTextAppendStr(&b, TEXT_COLOR_RED "Farore's Wind" TEXT_NL);
        comboTextAppendClearColor(&b);
        comboTextAppendStr(&b, "This is warp magic you can use" TEXT_NL "with \xB2. Warp when you are in" TEXT_NL "danger!" TEXT_END);
        break;
    case ITEM_MM_SPELL_LOVE:
        b = play->msgCtx.font.textBuffer.schar;
        b[2] = 0xFE; /* Use No Icon */
        b += 11;
        comboTextAppendStr(&b, TEXT_COLOR_RED "Nayru's Love" TEXT_NL);
        comboTextAppendClearColor(&b);
        comboTextAppendStr(&b, "Cast this to create a powerful" TEXT_NL "protective barrier. It's defensive" TEXT_NL "magic you can use with \xB2." TEXT_END);
        break;
    case ITEM_MM_SPELL_FIRE:
        b = play->msgCtx.font.textBuffer.schar;
        b[2] = 0xFE; /* Use No Icon */
        b += 11;
        comboTextAppendStr(&b, TEXT_COLOR_RED "Din's Fire" TEXT_NL);
        comboTextAppendClearColor(&b);
        comboTextAppendStr(&b, "Its fireball engulfs everything!" TEXT_NL "It's attack magic you can use" TEXT_NL "with \xB2." TEXT_END);
        break;
    case ITEM_MM_BOOTS_IRON:
        b = play->msgCtx.font.textBuffer.schar;
        b[2] = 0xFE; /* Use No Icon */
        b += 11;
        comboTextAppendStr(&b, TEXT_COLOR_RED "Iron Boots" TEXT_NL);
        comboTextAppendClearColor(&b);
        comboTextAppendStr(&b, "So heavy, you can't run." TEXT_NL "So heavy, you can't float." TEXT_END);
        break;
    case ITEM_MM_BOOTS_HOVER:
        b = play->msgCtx.font.textBuffer.schar;
        b[2] = 0xFE; /* Use No Icon */
        b += 11;
        comboTextAppendStr(&b, TEXT_COLOR_RED "Hover Boots" TEXT_NL);
        comboTextAppendClearColor(&b);
        comboTextAppendStr(&b, "With these mysterious boots" TEXT_NL "you can hover above the ground." TEXT_NL "The downside? No traction!" TEXT_END);
        break;
    case ITEM_MM_TUNIC_GORON:
        b = play->msgCtx.font.textBuffer.schar;
        b[2] = 0xFE; /* Use No Icon */
        b += 11;
        comboTextAppendStr(&b, TEXT_COLOR_RED "Goron Tunic" TEXT_NL);
        comboTextAppendClearColor(&b);
        comboTextAppendStr(&b, "Wearing this heat-resistant tunic" TEXT_NL "allows you to go to hot places." TEXT_END);
        break;
    case ITEM_MM_TUNIC_ZORA:
        b = play->msgCtx.font.textBuffer.schar;
        b[2] = 0xFE; /* Use No Icon */
        b += 11;
        comboTextAppendStr(&b, TEXT_COLOR_RED "Zora Tunic" TEXT_NL);
        comboTextAppendClearColor(&b);
        comboTextAppendStr(&b, "Wear this diving suit and you" TEXT_NL "won't drown underwater." TEXT_END);
        break;
    case ITEM_MM_HAMMER:
        b = play->msgCtx.font.textBuffer.schar;
        b[2] = 0xFE; /* Use No Icon */
        b += 11;
        comboTextAppendStr(&b, TEXT_COLOR_RED "Megaton Hammer" TEXT_NL);
        comboTextAppendClearColor(&b);
        comboTextAppendStr(&b, "Press " TEXT_COLOR_YELLOW "\xB2");
        comboTextAppendClearColor(&b);
        comboTextAppendStr(&b, " to smash and break " TEXT_NL "junk! It's so heavy, you need to " TEXT_NL "use two hands to swing it!" TEXT_END);
        break;
    case ITEM_MM_BOOMERANG:
        b = play->msgCtx.font.textBuffer.schar;
        b[2] = 0xFE; /* Use No Icon */
        b += 11;
        comboTextAppendStr(&b, TEXT_COLOR_RED "Boomerang" TEXT_NL);
        comboTextAppendClearColor(&b);
        comboTextAppendStr(&b, "Press " TEXT_COLOR_YELLOW "\xB2");
        comboTextAppendClearColor(&b);
        comboTextAppendStr(&b, " to throw and watch it come" TEXT_NL "back! The boomerang can stun or" TEXT_NL "defeat enemies!" TEXT_END);
        break;
    case ITEM_MM_SLINGSHOT:
        b = play->msgCtx.font.textBuffer.schar;
        b[2] = 0xFE; /* Use No Icon */
        b += 11;
        comboTextAppendStr(&b, TEXT_COLOR_RED "Fairy Slingshot" TEXT_NL);
        comboTextAppendClearColor(&b);
        comboTextAppendStr(&b, "Press " TEXT_COLOR_YELLOW "\xB2");
        comboTextAppendClearColor(&b);
        comboTextAppendStr(&b, " to unleash a deku seed" TEXT_NL "at your target!" TEXT_END);
        break;
    case ITEM_MM_BLUE_FIRE:
        b = play->msgCtx.font.textBuffer.schar;
        b[2] = 0xFE; /* Use No Icon */
        b += 11;
        comboTextAppendStr(&b, TEXT_COLOR_RED "Blue Fire" TEXT_NL);
        comboTextAppendClearColor(&b);
        comboTextAppendStr(&b, "This is a cool flame you can" TEXT_NL "use with \xB2." TEXT_END);
        break;
    case ITEM_MM_RUTO_LETTER:
        b = play->msgCtx.font.textBuffer.schar;
        b[2] = 0xFE; /* Use No Icon */
        b += 11;
        comboTextAppendStr(&b, TEXT_COLOR_RED "Letter" TEXT_NL);
        comboTextAppendClearColor(&b);
        comboTextAppendStr(&b, "It looks like there is something" TEXT_NL "already inside this bottle." TEXT_END);
        break;
    case ITEM_MM_MASK_GERUDO:
        b = play->msgCtx.font.textBuffer.schar;
        b[2] = 0xFE; /* Use No Icon */
        b += 11;
        comboTextAppendStr(&b, TEXT_COLOR_RED "Gerudo Mask" TEXT_NL);
        comboTextAppendClearColor(&b);
        comboTextAppendStr(&b, "With its charming eyes, it makes" TEXT_NL "a great lady's disguise." TEXT_END);
        break;
    case ITEM_MM_MASK_SKULL:
            b = play->msgCtx.font.textBuffer.schar;
        b[2] = 0xFE; /* Use No Icon */
        b += 11;
        comboTextAppendStr(&b, TEXT_COLOR_RED "Skull Mask" TEXT_NL);
        comboTextAppendClearColor(&b);
        comboTextAppendStr(&b, "A mysterious aura emanates from" TEXT_NL "this mask." TEXT_END);
        break;
    case ITEM_MM_MASK_SPOOKY:
            b = play->msgCtx.font.textBuffer.schar;
        b[2] = 0xFE; /* Use No Icon */
        b += 11;
        comboTextAppendStr(&b, TEXT_COLOR_RED "Spooky Mask" TEXT_NL);
        comboTextAppendClearColor(&b);
        comboTextAppendStr(&b, "This mask was manufactured from" TEXT_NL "the plank of a coffin." TEXT_END);
        break;
    case ITEM_MM_MASK_ADULT:
            b = play->msgCtx.font.textBuffer.schar;
        b[2] = 0xFE; /* Use No Icon */
        b += 11;
        comboTextAppendStr(&b, TEXT_COLOR_RED "Adult Mask" TEXT_NL);
        comboTextAppendClearColor(&b);
        comboTextAppendStr(&b, "Wear it with " TEXT_COLOR_YELLOW "\xB2");
        comboTextAppendClearColor(&b);
        comboTextAppendStr(&b, " to assume Adult" TEXT_NL);
        comboTextAppendStr(&b, "form. Use " TEXT_COLOR_YELLOW "\xB2");
        comboTextAppendClearColor(&b);
        comboTextAppendStr(&b, " to change back." TEXT_END);
        break;
    }
}

typedef void (*KaleidoScopeHandler)(PlayState*);

static void KaleidoScope_DrawMapDungeonMenu(PlayState* play, u32 overlayAddr)
{
    KaleidoScopeHandler handler;

    if (g.menuScreen)
    {
        comboMenuDraw(play);
    }
    else
    {
        handler = OverlayAddr(overlayAddr);
        handler(play);
    }
}

static void KaleidoScope_UpdateMapDungeonMenu(PlayState* play, u32 overlayAddr)
{
    KaleidoScopeHandler handler;

    if (play->state.input[0].press.button & (L_TRIG | U_CBUTTONS))
        comboMenuNext();

    if (g.menuScreen)
    {
        comboMenuUpdate(play);
    }
    else
    {
        handler = OverlayAddr(overlayAddr);
        handler(play);
    }
}

static void KaleidoScope_DrawMapMenu(PlayState *play)
{
    KaleidoScope_DrawMapDungeonMenu(play, 0x8081e7d8);
}

PATCH_CALL(0x80822a14, KaleidoScope_DrawMapMenu);
PATCH_CALL(0x808230e4, KaleidoScope_DrawMapMenu);

static void KaleidoScope_DrawDungeonMenu(PlayState *play)
{
    KaleidoScope_DrawMapDungeonMenu(play, 0x8081d6dc);
}

PATCH_CALL(0x808229cc, KaleidoScope_DrawDungeonMenu);
PATCH_CALL(0x80822f34, KaleidoScope_DrawDungeonMenu);

static void KaleidoScope_UpdateMapMenu(PlayState* play)
{
    KaleidoScope_UpdateMapDungeonMenu(play, 0x8081fb1c);
}

PATCH_CALL(0x8082ae00, KaleidoScope_UpdateMapMenu);

static void KaleidoScope_UpdateDungeonMenu(PlayState* play)
{
    KaleidoScope_UpdateMapDungeonMenu(play, 0x8081e118);
}

PATCH_CALL(0x8082adf0, KaleidoScope_UpdateDungeonMenu);

static void KaleidoScope_DrawDungeonUnk1(void* unk)
{
    if (!g.menuScreen)
        Gfx_SetupDL_42Opa(unk);
}

PATCH_CALL(0x808229d4, KaleidoScope_DrawDungeonUnk1);
PATCH_CALL(0x80822f3c, KaleidoScope_DrawDungeonUnk1);

static void KaleidoScope_DrawDungeonUnk2(void* unk)
{
    if (!g.menuScreen)
        DrawDungeonUnk2(unk);
}

PATCH_CALL(0x80822a00, KaleidoScope_DrawDungeonUnk2);
PATCH_CALL(0x80822f68, KaleidoScope_DrawDungeonUnk2);

u32 gCustomIconAddr;
static u32 gCustomEquipIconAddr;

static u32 sCustomIcons[] = {
    ITEM_MM_SPELL_WIND,
    ITEM_MM_SPELL_LOVE,
    ITEM_MM_SPELL_FIRE,
    ITEM_MM_BOOTS_IRON,
    ITEM_MM_BOOTS_HOVER,
    ITEM_MM_TUNIC_GORON,
    ITEM_MM_TUNIC_ZORA,
    ITEM_MM_HAMMER,
    ITEM_MM_BOOMERANG,
    ITEM_MM_SLINGSHOT,
    ITEM_MM_RUTO_LETTER,
    ITEM_MM_MASK_GERUDO,
    ITEM_MM_MASK_SKULL,
    ITEM_MM_MASK_SPOOKY,
    ITEM_MM_MASK_ADULT,
};

s8 gPlayerFormCustomItemRestrictions[5][ITEM_MM_CUSTOM_USABLE_MAX - ITEM_MM_CUSTOM_MIN] =
{
    { 0, 0, 0,  0,  0,  0,  0, 0, 0, 0, 1, 0, 0, 0, 0 },
    { 0, 0, 0,  0,  0,  0,  0, 0, 0, 0, 1, 0, 0, 0, 0 },
    { 0, 0, 0,  0,  0,  0,  0, 0, 0, 0, 1, 0, 0, 0, 0 },
    { 0, 0, 0,  0,  0,  0,  0, 0, 0, 0, 1, 0, 0, 0, 0 },
    { 1, 1, 1, -1, -1, -1, -1, 1, 1, 1, 1, 1, 1, 1, 1 },
};

typedef void (*KaleidoScope_GrayOutTextureRGBA32)(u32*, u16);

const size_t customIconSize = 0x1000;

void MmSword_RefreshHudIcon(PlayState* play)
{
    if (!play)
        return;

    Interface_LoadItemIconImpl(
        play,
        EQUIP_SLOT_B);
}

void KaleidoScope_LoadIcons(u32 vrom, void* dst, size_t* size)
{
    DmaEntry dma;
    KaleidoScope_GrayOutTextureRGBA32 KaleidoScope_GrayOutTextureRGBA32 = OverlayAddr(0x808286D8);

    CmpDma_LoadAllFiles(vrom, dst, *size);

    gCustomIconAddr = (u32)dst + *size;

    comboDmaLookupForeignId(&dma, 8);
    u32 textureFileAddress = dma.pstart;

    for (u32 i = 0; i < ARRAY_COUNT(sCustomIcons); i++)
    {
        u32 icon = sCustomIcons[i];
        u32 foreignIcon;
        switch (icon)
        {
        case ITEM_MM_SPELL_FIRE:
            foreignIcon = ITEM_OOT_SPELL_FIRE;
            break;
        case ITEM_MM_SPELL_WIND:
            foreignIcon = ITEM_OOT_SPELL_WIND;
            break;
        case ITEM_MM_SPELL_LOVE:
            foreignIcon = ITEM_OOT_SPELL_LOVE;
            break;
        case ITEM_MM_BOOTS_IRON:
            foreignIcon = ITEM_OOT_BOOTS_IRON;
            break;
        case ITEM_MM_BOOTS_HOVER:
            foreignIcon = ITEM_OOT_BOOTS_HOVER;
            break;
        case ITEM_MM_TUNIC_GORON:
            foreignIcon = ITEM_OOT_TUNIC_GORON;
            break;
        case ITEM_MM_TUNIC_ZORA:
            foreignIcon = ITEM_OOT_TUNIC_ZORA;
            break;
        case ITEM_MM_HAMMER:
            foreignIcon = ITEM_OOT_HAMMER;
            break;
        case ITEM_MM_BOOMERANG:
            foreignIcon = ITEM_OOT_BOOMERANG;
            break;
        case ITEM_MM_SLINGSHOT:
            foreignIcon = ITEM_OOT_SLINGSHOT;
            break;
        case ITEM_MM_RUTO_LETTER:
            foreignIcon = ITEM_OOT_RUTO_LETTER;
            break;
        case ITEM_MM_MASK_GERUDO:
            foreignIcon = ITEM_OOT_GERUDO_MASK;
            break;
        case ITEM_MM_MASK_SKULL:
            foreignIcon = ITEM_OOT_SKULL_MASK;
            break;
        case ITEM_MM_MASK_SPOOKY:
            foreignIcon = ITEM_OOT_SPOOKY_MASK;
            break;
        case ITEM_MM_MASK_ADULT:
        {
            void* src;
            u32 customDestination;

            customDestination = gCustomIconAddr + (i * customIconSize);
            src = comboCacheGetFile(CUSTOM_ADULT_MASK_ICON_ADDR);

            if (src)
                memcpy((void*)customDestination, src, customIconSize);

            *size += customIconSize;
            continue;
        }
        default:
            continue;
        }
        u32 textureOffset = customIconSize * foreignIcon;
        u32 customDestination = gCustomIconAddr + (i * customIconSize);
        DMARomToRam((textureFileAddress + textureOffset) | PI_DOM1_ADDR2, (void*)customDestination, customIconSize);

        u8 customItemIndex = icon - ITEM_MM_CUSTOM_MIN;
        if (customItemIndex >= (ITEM_MM_CUSTOM_USABLE_MAX - ITEM_MM_CUSTOM_MIN) || !gPlayerFormCustomItemRestrictions[gSaveContext.save.playerForm][customItemIndex])
        {
            KaleidoScope_GrayOutTextureRGBA32((u32*)customDestination, customIconSize);
        }

        *size += customIconSize;
    }
    gCustomEquipIconAddr = (u32)dst + *size;
    for (u32 i = 0; i < ARRAY_COUNT(sCustomEquipForeignIcons); i++)
    {
        u32 foreignIcon = sCustomEquipForeignIcons[i];
        u32 textureOffset = customIconSize * foreignIcon;
        u32 customDestination = gCustomEquipIconAddr + i * customIconSize;
        DMARomToRam((textureFileAddress + textureOffset) | PI_DOM1_ADDR2, (void*)customDestination, customIconSize);
        *size += customIconSize;
    }
}

static u32 MmShield_GetPauseTexture(MmShieldExt shield)
{
    u32* gItemIcons = (u32*)0x801c1e6c;

    switch (shield)
    {
        case MM_SHIELD_EXT_DEKU:
            return
                gCustomEquipIconAddr +
                MM_EQ_ICON_SHIELD_DEKU * customIconSize;

        case MM_SHIELD_EXT_HERO:
            return gItemIcons[ITEM_MM_SHIELD_HERO];

        case MM_SHIELD_EXT_HYLIAN:
            return
                gCustomEquipIconAddr +
                MM_EQ_ICON_SHIELD_HYLIAN * customIconSize;

        case MM_SHIELD_EXT_MIRROR:
            return gItemIcons[ITEM_MM_SHIELD_MIRROR];

        default:
            return 0;
    }
}

static u32 GetItemTexture(u8 item)
{
    u32* gItemIcons = (u32*)0x801c1e6c;
    if (item < ITEM_MM_CUSTOM_MIN)
        return gItemIcons[item];
    return gCustomIconAddr + (customIconSize * (item - ITEM_MM_CUSTOM_MIN));
}

static u32 MmSword_GetPauseTexture(MmSwordExt sword)
{
    u32* gItemIcons = (u32*)0x801c1e6c;
    switch (sword)
    {
    case MM_SWORD_EXT_KOKIRI:
        return gItemIcons[ITEM_MM_SWORD_KOKIRI];
    case MM_SWORD_EXT_RAZOR:
        return gItemIcons[ITEM_MM_SWORD_RAZOR];
    case MM_SWORD_EXT_GILDED:
        return gItemIcons[ITEM_MM_SWORD_GILDED];
    case MM_SWORD_EXT_MASTER:
        return gCustomEquipIconAddr + MM_EQ_ICON_MASTER * customIconSize;
    case MM_SWORD_EXT_GIANTS_KNIFE:
        if (MmSword_GetGiantsKnifeHealth() == 0)
            return gCustomEquipIconAddr + MM_EQ_ICON_BIGGORON_BROKEN * customIconSize;
        return gCustomEquipIconAddr + MM_EQ_ICON_BIGGORON * customIconSize;
    case MM_SWORD_EXT_BIGGORON:
        return gCustomEquipIconAddr + MM_EQ_ICON_BIGGORON * customIconSize;
    default:
        return 0;
    }
}

static u8 GetNextItem(u32 slot, s32* outTableIndex)
{
    u32 flags;
    const u8* table;
    u32 tableSize;
    u8* itemPtr;
    *outTableIndex = comboGetSlotExtras(slot, &itemPtr, &flags, &table, &tableSize);
    if (*outTableIndex >= 0)
    {
        return comboGetNextTrade(*itemPtr, flags, table, tableSize);
    }
    return ITEM_NONE;
}

static void KaleidoScope_DrawTexQuadRGBA32Raw(GraphicsContext* gfxCtx, u32 texture, u16 width, u16 height, u16 point)
{
    OPEN_DISPS(gfxCtx);
    gDPLoadTextureBlock(POLY_OPA_DISP++, texture, G_IM_FMT_RGBA, G_IM_SIZ_32b, width, height, 0, G_TX_NOMIRROR | G_TX_WRAP, G_TX_NOMIRROR | G_TX_WRAP, G_TX_NOMASK, G_TX_NOMASK, G_TX_NOLOD, G_TX_NOLOD);
    gSP1Quadrangle(POLY_OPA_DISP++, point, point + 2, point + 3, point + 1, 0);
    CLOSE_DISPS();
}

/* Vertex buffers. */
static Vtx gVertexBufs[(4 * 12) * 2];

/* Vertex buffer pointers. */
static Vtx* gVertex[12] = {
    &gVertexBufs[(4 * 0) * 2],
    &gVertexBufs[(4 * 1) * 2],
    &gVertexBufs[(4 * 2) * 2],
    &gVertexBufs[(4 * 3) * 2],
    &gVertexBufs[(4 * 4) * 2],
    &gVertexBufs[(4 * 5) * 2],
    &gVertexBufs[(4 * 6) * 2],
    &gVertexBufs[(4 * 7) * 2],
    &gVertexBufs[(4 * 8) * 2],
    &gVertexBufs[(4 * 9) * 2],
    &gVertexBufs[(4 * 10) * 2],
    &gVertexBufs[(4 * 11) * 2],
};

static Vtx* GetVtxBuffer(PlayState* play, u32 vertIdx, u32 slot) {
    /* Get vertex of current icon drawing to Item Select screen */
    const Vtx* srcVtx = play->pauseCtx.vtxBuf + vertIdx;

    /* Get dest Vtx (factor in frame counter) */
    int framebufIdx = play->state.gfxCtx->displayListCounter & 1;
    Vtx* dstVtx = gVertex[slot] + (framebufIdx * 4);

    /* Copy source Vtx over to dest Vtx */
    for (int i = 0; i < 4; i++) {
        dstVtx[i] = srcVtx[i];
    }

    /* Adjust X position */
    dstVtx[0].v.ob[0] += 0x10;
    dstVtx[2].v.ob[0] += 0x10;

    /* Adjust Y position */
    dstVtx[0].v.ob[1] -= 0x10;
    dstVtx[1].v.ob[1] -= 0x10;

    return dstVtx;
}

static void DrawIcon(GraphicsContext* gfxCtx, const Vtx* vtx, u32 segAddr, u16 width, u16 height, u16 qidx) {
    OPEN_DISPS(gfxCtx);
    /* Instructions that happen before function */
    gDPSetPrimColor(POLY_OPA_DISP++, 0, 0, 0xFF, 0xFF, 0xFF, gfxCtx->play->pauseCtx.itemAlpha & 0xFF);
    gSPVertex(POLY_OPA_DISP++, vtx, 4, 0); /* Loads 4 vertices from RDRAM */
    /* Instructions that happen during function. */
    gDPLoadTextureBlock(POLY_OPA_DISP++, segAddr, G_IM_FMT_RGBA, G_IM_SIZ_32b, width, height, 0,
                        G_TX_NOMIRROR | G_TX_WRAP, G_TX_NOMIRROR | G_TX_WRAP, G_TX_NOMASK, G_TX_NOMASK, G_TX_NOLOD,
                        G_TX_NOLOD);
    gSP1Quadrangle(POLY_OPA_DISP++, qidx + 0, qidx + 2, qidx + 3, qidx + 1, 0);
    CLOSE_DISPS();
}

void KaleidoScope_DrawIconCustom(GraphicsContext* gfxCtx, u8 item, u16 width, u16 height, u32 slot, u16 point, u16 vertIdx)
{
    u32 texture = GetItemTexture(item);
    KaleidoScope_DrawTexQuadRGBA32Raw(gfxCtx, texture, width, height, point);
    s32 tableIndex;
    u8 next = GetNextItem(slot, &tableIndex);
    if (next != ITEM_NONE && next != item)
    {
        texture = GetItemTexture(next);
        Vtx* vtx = GetVtxBuffer(gfxCtx->play, vertIdx, tableIndex);
        DrawIcon(gfxCtx, vtx, texture, width, height, point);
    }
}

static Vtx sQuestEquipVtx[MM_QUEST_EQUIP_MAX][MM_QUEST_VTX_MAX][8];

static Vtx* KaleidoScope_GetQuestEquipVtx(PlayState* play, s32 equipType, u32 slot, s32 vtxType)
{
    Vtx* questVtx;
    const Vtx* src;
    Vtx* dst;
    s32 frame;

    questVtx = KaleidoScope_GetQuestVtx(play);
    if (!questVtx)
        return NULL;

    frame = play->state.gfxCtx->displayListCounter & 1;
    dst = &sQuestEquipVtx[equipType][vtxType][frame * 4];

    if (vtxType == MM_QUEST_VTX_SMALL_OUTLINE)
        src = &sQuestEquipVtx[equipType][MM_QUEST_VTX_SMALL][frame * 4];
    else
        src = questVtx + slot * 4;

    for (s32 i = 0; i < 4; i++)
        dst[i] = src[i];

    if (vtxType == MM_QUEST_VTX_SMALL)
    {
        dst[0].v.ob[0] += 16;
        dst[2].v.ob[0] += 16;
        dst[0].v.ob[1] -= 16;
        dst[1].v.ob[1] -= 16;
    }
    else if (vtxType == MM_QUEST_VTX_PRIMARY_OUTLINE)
    {
        dst[0].v.ob[0] -= 2;
        dst[2].v.ob[0] -= 2;
        dst[1].v.ob[0] += 2;
        dst[3].v.ob[0] += 2;
        dst[0].v.ob[1] += 2;
        dst[1].v.ob[1] += 2;
        dst[2].v.ob[1] -= 2;
        dst[3].v.ob[1] -= 2;
    }
    else if (vtxType == MM_QUEST_VTX_SMALL_OUTLINE)
    {
        dst[0].v.ob[0] -= 1;
        dst[2].v.ob[0] -= 1;
        dst[1].v.ob[0] += 1;
        dst[3].v.ob[0] += 1;
        dst[0].v.ob[1] += 1;
        dst[1].v.ob[1] += 1;
        dst[2].v.ob[1] -= 1;
        dst[3].v.ob[1] -= 1;
    }

    return dst;
}

static void KaleidoScope_DrawEquippedOutline(GraphicsContext* gfxCtx, Vtx* vtx)
{
    PauseContext* pauseCtx;
    if (!vtx)
        return;
    pauseCtx = &gfxCtx->play->pauseCtx;
    OPEN_DISPS(gfxCtx);
    gDPPipeSync(POLY_OPA_DISP++);
    gDPSetCombineMode(POLY_OPA_DISP++, G_CC_MODULATEIA_PRIM, G_CC_MODULATEIA_PRIM);
    gDPSetPrimColor(POLY_OPA_DISP++, 0, 0, 255, 255, 255, pauseCtx->itemAlpha);
    gSPVertex(POLY_OPA_DISP++, vtx, 4, 0);
    gDPLoadTextureBlock(POLY_OPA_DISP++, MM_EQUIPPED_ITEM_OUTLINE, G_IM_FMT_IA, G_IM_SIZ_8b, 32, 32, 0,
                        G_TX_NOMIRROR | G_TX_WRAP, G_TX_NOMIRROR | G_TX_WRAP, G_TX_NOMASK, G_TX_NOMASK,
                        G_TX_NOLOD, G_TX_NOLOD);
    gSP1Quadrangle(POLY_OPA_DISP++, 0, 2, 3, 1, 0);
    CLOSE_DISPS();
}

static void KaleidoScope_DrawQuestEquipCustom(GraphicsContext* gfxCtx, s32 equipType, u32 originalTexture, u16 width, u16 height, u16 point)
{
    PlayState* play;
    Vtx* questVtx;
    Vtx* smallVtx;
    Vtx* outlineVtx;
    u32 slot;
    u32 selectedTex;
    u32 secondaryTex;
    s32 selected;
    s32 equipped;
    s32 secondary;
    s32 none;

    play = gfxCtx->play;

    if (equipType == MM_QUEST_EQUIP_SWORD)
    {
        MmSword_EnsureState();
        slot = MM_QUEST_SWORD_SLOT;
        selected = MmSword_GetSelected();
        equipped = MmSword_GetEquipped();
        secondary = MmSword_GetNextOwned(selected);
        none = MM_SWORD_EXT_NONE;
        selectedTex = MmSword_GetPauseTexture(selected);
        secondaryTex = MmSword_GetPauseTexture(secondary);
    }
    else
    {
        MmShield_EnsureState();
        slot = MM_QUEST_SHIELD_SLOT;
        selected = MmShield_GetSelected();
        equipped = MmShield_GetEquipped();
        secondary = MmShield_GetNextOwned(selected);
        none = MM_SHIELD_EXT_NONE;
        selectedTex = MmShield_GetPauseTexture(selected);
        secondaryTex = MmShield_GetPauseTexture(secondary);
    }

    if (!selectedTex)
    {
        KaleidoScope_DrawTexQuadRGBA32Raw(gfxCtx, originalTexture, width, height, point);
        return;
    }

    if (selected == equipped)
    {
        outlineVtx = KaleidoScope_GetQuestEquipVtx(play, equipType, slot, MM_QUEST_VTX_PRIMARY_OUTLINE);
        KaleidoScope_DrawEquippedOutline(gfxCtx, outlineVtx);
    }

    questVtx = KaleidoScope_GetQuestVtx(play);
    if (questVtx)
    {
        OPEN_DISPS(gfxCtx);
        gSPVertex(POLY_OPA_DISP++, questVtx + slot * 4, 4, 0);
        CLOSE_DISPS();
    }

    KaleidoScope_DrawTexQuadRGBA32Raw(gfxCtx, selectedTex, 32, 32, 0);

    if (secondary == none ||
        secondary == selected ||
        !secondaryTex)
    {
        return;
    }

    smallVtx = KaleidoScope_GetQuestEquipVtx(play, equipType, slot, MM_QUEST_VTX_SMALL);
    if (!smallVtx)
        return;

    if (secondary == equipped)
    {
        outlineVtx = KaleidoScope_GetQuestEquipVtx(play, equipType, slot, MM_QUEST_VTX_SMALL_OUTLINE);
        KaleidoScope_DrawEquippedOutline(gfxCtx, outlineVtx);
    }

    OPEN_DISPS(gfxCtx);
    gSPVertex(POLY_OPA_DISP++, smallVtx, 4, 0);
    CLOSE_DISPS();

    KaleidoScope_DrawTexQuadRGBA32Raw(gfxCtx, secondaryTex, 32, 32, 0);
}

void KaleidoScope_DrawTexQuadRGBA32Custom(GraphicsContext* gfxCtx, u32 texture, u16 width, u16 height, u16 point)
{
    PlayState* play;
    u32* gItemIcons;
    s32 equipType;
    equipType = -1;
    play = gfxCtx->play;

    if (play && width == 32 && height == 32)
    {
        gItemIcons = (u32*)0x801c1e6c;
        if (texture == gItemIcons[ITEM_MM_SWORD_KOKIRI] || texture == gItemIcons[ITEM_MM_SWORD_RAZOR] || texture == gItemIcons[ITEM_MM_SWORD_GILDED])
        {
            equipType = MM_QUEST_EQUIP_SWORD;
        }
        else if (texture == gItemIcons[ITEM_MM_SHIELD_HERO] || texture == gItemIcons[ITEM_MM_SHIELD_MIRROR])
        {
            equipType = MM_QUEST_EQUIP_SHIELD;
        }
    }
    if (equipType < 0)
    {
        KaleidoScope_DrawTexQuadRGBA32Raw(gfxCtx, texture, width, height, point);
        return;
    }
    KaleidoScope_DrawQuestEquipCustom(gfxCtx, equipType, texture, width, height, point);
}

#define MOON_MASK_BIT(i, f) ((u16)(((i) << 8) | (f)))
#define MOON_MASK_BYTES     ((u8*)0x801f3f3a)
#define MOON_MASK_GIVEN(i)  (MOON_MASK_BYTES[sMasksGivenOnMoonBits_Custom[i] >> 8] & (u8)sMasksGivenOnMoonBits_Custom[i])

static const u16 sMasksGivenOnMoonBits_Custom[MASK_NUM_SLOTS] = {
    MOON_MASK_BIT(1, 0x01), MOON_MASK_BIT(0, 0x04), MOON_MASK_BIT(2, 0x02), MOON_MASK_BIT(1, 0x80),
    MOON_MASK_BIT(1, 0x04), MOON_MASK_BIT(2, 0x10), MOON_MASK_BIT(0, 0x10), MOON_MASK_BIT(2, 0x01),
    MOON_MASK_BIT(0, 0x08), MOON_MASK_BIT(1, 0x10), MOON_MASK_BIT(2, 0x04), MOON_MASK_BIT(2, 0x20),
    MOON_MASK_BIT(0, 0x40), MOON_MASK_BIT(0, 0x80), MOON_MASK_BIT(0, 0x02), MOON_MASK_BIT(1, 0x02),
    MOON_MASK_BIT(0, 0x01), MOON_MASK_BIT(2, 0x40), MOON_MASK_BIT(1, 0x20), MOON_MASK_BIT(1, 0x08),
    MOON_MASK_BIT(0, 0x20), MOON_MASK_BIT(1, 0x40), MOON_MASK_BIT(2, 0x08), MOON_MASK_BIT(2, 0x80),
};

typedef struct {
    u32 flags;
    u32 tableSize;
    u8* itemPtr;
    const u8* table;
    s32 index;
} MaskSlotExtras;

static int GetMaskSlotExtras(u32 slot, MaskSlotExtras* e) {
    e->index = comboGetSlotExtras(slot, &e->itemPtr, &e->flags, &e->table, &e->tableSize);
    return e->index >= 0 && e->tableSize != 0;
}

static int KaleidoScope_IsMoonGivenParam0Mask(u32 slot, u8 item) {
    u32 maskSlot = slot - ITEM_NUM_SLOTS;
    MaskSlotExtras e;
    if (slot < ITEM_NUM_SLOTS || maskSlot >= MASK_NUM_SLOTS || !MOON_MASK_GIVEN(maskSlot))
        return 0;
    return GetMaskSlotExtras(slot, &e) ? item == e.table[0] : item == gSave.info.inventory.items[slot];
}

static s32 GetMaskItemTableIndex(u32 slot, u8 item) {
    MaskSlotExtras e;
    s32 i;
    if (!GetMaskSlotExtras(slot, &e))
        return -1;
    for (i = 0; i < (s32)e.tableSize; i++)
        if (e.table[i] == item)
            return i;
    return -1;
}

static u8 GetNextVisibleMaskTrade(u32 slot, u8 currentItem) {
    MaskSlotExtras e;
    u8 next, probe = currentItem;
    u32 i;
    if (!GetMaskSlotExtras(slot, &e))
        return ITEM_NONE;
    for (i = 0; i < e.tableSize; i++) {
        next = comboGetNextTrade(probe, e.flags, e.table, e.tableSize);
        if (next == ITEM_NONE || next == currentItem)
            return ITEM_NONE;
        if (!KaleidoScope_IsMoonGivenParam0Mask(slot, next))
            return next;
        probe = next;
    }
    return ITEM_NONE;
}

static u8 GetCurrentVisibleMaskItem(u32 slot, s32* outActiveIndex) {
    MaskSlotExtras e;
    u8 next;
    if (!GetMaskSlotExtras(slot, &e)) {
        *outActiveIndex = -1;
        return ITEM_NONE;
    }
    *outActiveIndex = e.index;
    if (!KaleidoScope_IsMoonGivenParam0Mask(slot, *e.itemPtr))
        return *e.itemPtr;
    next = GetNextVisibleMaskTrade(slot, *e.itemPtr);
    if (next == ITEM_NONE)
        return ITEM_NONE;
    *e.itemPtr = next;
    *outActiveIndex = GetMaskItemTableIndex(slot, next);
    return next;
}

static int KaleidoScope_NormalizeMoonMaskSlot(u32 slot) {
    MaskSlotExtras e;
    u8 next;
    if (slot < ITEM_NUM_SLOTS || slot >= ITEM_NUM_SLOTS + MASK_NUM_SLOTS || !GetMaskSlotExtras(slot, &e))
        return 0;
    if (!KaleidoScope_IsMoonGivenParam0Mask(slot, *e.itemPtr))
        return 0;
    next = GetNextVisibleMaskTrade(slot, *e.itemPtr);
    if (next == ITEM_NONE)
        return 0;
    *e.itemPtr = next;
    return 1;
}

static u8 GetNextVisibleMaskOverlayItem(u32 slot, u8 currentItem, s32* outVtxBufferIndex) {
    MaskSlotExtras e;
    u8 next;
    if (!GetMaskSlotExtras(slot, &e)) {
        *outVtxBufferIndex = -1;
        return ITEM_NONE;
    }
    *outVtxBufferIndex = e.index;
    next = GetNextVisibleMaskTrade(slot, currentItem);
    return next != currentItem ? next : ITEM_NONE;
}

static void KaleidoScope_ToggleMaskSlotSkipHidden(u32 slot) {
    MaskSlotExtras e;
    u32 i;
    if (!GetMaskSlotExtras(slot, &e))
        return;
    for (i = 0; i < e.tableSize; i++) {
        comboToggleSlot(slot);
        if (!GetMaskSlotExtras(slot, &e) || !KaleidoScope_IsMoonGivenParam0Mask(slot, *e.itemPtr))
            return;
    }
}

u16 KaleidoScope_ResolveMoonMaskCursorItem(u16 maskSlot, u16 cursorItem) {
    u32 slot = maskSlot + ITEM_NUM_SLOTS;
    s32 activeIndex;
    u8 activeItem;
    if (cursorItem == ITEM_NONE || cursorItem == 999 || !KaleidoScope_IsMoonGivenParam0Mask(slot, cursorItem))
        return cursorItem;
    activeItem = GetCurrentVisibleMaskItem(slot, &activeIndex);
    return activeItem != ITEM_NONE ? activeItem : ITEM_NONE;
}

void KaleidoScope_DrawMaskIconCustom(GraphicsContext* gfxCtx, u8 item, u16 width, u16 height, u32 maskSlot, u16 point, u16 vertIdx)
{
    u32 slot;
    u32 texture;
    s32 tableIndex;
    u8 primary;
    u8 next;

    maskSlot = vertIdx >> 2;
    slot = maskSlot + ITEM_NUM_SLOTS;

    if (!KaleidoScope_IsMoonGivenParam0Mask(slot, item))
    {
        texture = GetItemTexture(item);
        KaleidoScope_DrawTexQuadRGBA32Raw(gfxCtx, texture, width, height, point);

        next = GetNextVisibleMaskOverlayItem(slot, item, &tableIndex);
        if (next != ITEM_NONE && next != item && tableIndex >= 0)
        {
            texture = GetItemTexture(next);
            Vtx* vtx = GetVtxBuffer(gfxCtx->play, vertIdx, tableIndex);
            DrawIcon(gfxCtx, vtx, texture, width, height, point);
        }
        return;
    }
    primary = GetCurrentVisibleMaskItem(slot, &tableIndex);
    if (primary == ITEM_NONE)
        return;
    texture = GetItemTexture(primary);
    KaleidoScope_DrawTexQuadRGBA32Raw(gfxCtx, texture, width, height, point);
    next = GetNextVisibleMaskOverlayItem(slot, primary, &tableIndex);
    if (next != ITEM_NONE && next != primary && tableIndex >= 0)
    {
        texture = GetItemTexture(next);
        Vtx* vtx = GetVtxBuffer(gfxCtx->play, vertIdx, tableIndex);
        DrawIcon(gfxCtx, vtx, texture, width, height, point);
    }
}

void KaleidoScope_SetSaveButton(PlayState* play, s16 bButtonDoAction)
{
    DmaEntry dma;
    if (KaleidoScope_CanSave(play))
    {
        s16 texIndex = 14 + 29; /* DO_ACTION_SAVE + DO_ACTION_MAX */
        comboDmaLookupForeignId(&dma, 17);
        u32 textureFileAddress = dma.pstart;
        u32 textureOffset = DO_ACTION_TEX_SIZE * texIndex;
        DMARomToRam((textureFileAddress + textureOffset) | PI_DOM1_ADDR2, play->interfaceCtx.doActionSegment + 3 * DO_ACTION_TEX_SIZE, DO_ACTION_TEX_SIZE);
        play->interfaceCtx.bButtonInterfaceDoActionActive = 1;
    }
    else
    {
        Interface_SetBButtonInterfaceDoAction(play, bButtonDoAction);
    }
}

PATCH_CALL(0x80828908, KaleidoScope_SetSaveButton);

typedef void (*KaleidoScope_DrawAmmoCount)(PauseContext*, GraphicsContext*, s16, u16);

const static u8* gAmmoDigit0Tex = (u8*)0x02004aa0;

static s16 sAmmoRectLeft[] = {
    95,  // SLOT_BOW
    62,  // SLOT_BOMB
    95,  // SLOT_BOMBCHU
    128, // SLOT_DEKU_STICK
    161, // SLOT_DEKU_NUT
    194, // SLOT_MAGIC_BEANS
    62,  // SLOT_POWDER_KEG
    95,  // SLOT_PICTOGRAPH_BOX
};

static s16 sAmmoRectHeight[] = {
    85,  // SLOT_BOW
    117, // SLOT_BOMB
    117, // SLOT_BOMBCHU
    117, // SLOT_DEKU_STICK
    117, // SLOT_DEKU_NUT
    117, // SLOT_MAGIC_BEANS
    150, // SLOT_POWDER_KEG
    150, // SLOT_PICTOGRAPH_BOX
};

void KaleidoScope_CustomDrawAmmoCount(PauseContext* pauseCtx, GraphicsContext* gfxCtx, s16 item, u16 ammoIndex)
{
    s16 ammo;
    s16 ammoTens;
    s16 maxAmmo;
    s32 canEquip = 0;

    OPEN_DISPS(gfxCtx);

    switch (item)
    {
    case ITEM_MM_BOMBCHU:
        ammo = gSave.info.inventory.ammo[ITS_MM_BOMBCHU];
        maxAmmo = gMaxBombchuMm;
        canEquip = gPlayerFormItemRestrictions[gSaveContext.save.playerForm][item];
        break;
    case ITEM_MM_SLINGSHOT:
        ammo = gMmExtraAmmo.slingshotSeeds;
        maxAmmo = kMaxSeeds[gMmSave.info.inventory.upgrades.bulletBag];
        canEquip = gPlayerFormCustomItemRestrictions[gSaveContext.save.playerForm][item - ITEM_MM_CUSTOM_MIN];
        break;
    default:
        return;
    }

    gDPPipeSync(POLY_OPA_DISP++);

    if (!canEquip) {
        gDPSetPrimColor(POLY_OPA_DISP++, 0, 0, 100, 100, 100, pauseCtx->itemAlpha);
    } else {
        gDPSetPrimColor(POLY_OPA_DISP++, 0, 0, 255, 255, 255, pauseCtx->itemAlpha);

        if (ammo == 0) {
            gDPSetPrimColor(POLY_OPA_DISP++, 0, 0, 130, 130, 130, pauseCtx->itemAlpha);
        } else if (ammo == maxAmmo) {
            gDPSetPrimColor(POLY_OPA_DISP++, 0, 0, 120, 255, 0, pauseCtx->itemAlpha);
        }
    }

    for (ammoTens = 0; ammo >= 10; ammoTens++) {
        ammo -= 10;
    }

    gDPPipeSync(POLY_OPA_DISP++);

    if (ammoTens != 0) {
        POLY_OPA_DISP =
            Gfx_TextureIA8(POLY_OPA_DISP, ((u8*)gAmmoDigit0Tex + (8 * 8 * ammoTens)), 8, 8,
                               sAmmoRectLeft[ammoIndex], sAmmoRectHeight[ammoIndex], 8, 8, 1 << 10, 1 << 10);
    }

    POLY_OPA_DISP =
        Gfx_TextureIA8(POLY_OPA_DISP, ((u8*)gAmmoDigit0Tex + (8 * 8 * ammo)), 8, 8, sAmmoRectLeft[ammoIndex] + 6,
                           sAmmoRectHeight[ammoIndex], 8, 8, 1 << 10, 1 << 10);

    CLOSE_DISPS();
}

void KaleidoScope_DrawAmmoCountWrapper(PauseContext* pauseCtx, GraphicsContext* gfxCtx, s16 item, u16 ammoIndex)
{
    switch (item)
    {
    case ITEM_MM_BOMBCHU:
    case ITEM_MM_SLINGSHOT:
        KaleidoScope_CustomDrawAmmoCount(pauseCtx, gfxCtx, item, ammoIndex);
        break;
    case ITEM_MM_BOOMERANG:
        /* No ammo, draw nothing */
        break;
    default:
        KaleidoScope_DrawAmmoCount KaleidoScope_DrawAmmoCount = OverlayAddr(0x8081b240);
        KaleidoScope_DrawAmmoCount(pauseCtx, gfxCtx, item, ammoIndex);
        break;
    }
}

PATCH_CALL(0x8081bc4c, KaleidoScope_DrawAmmoCountWrapper)
