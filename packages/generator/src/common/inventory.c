#include <combo.h>
#include <combo/config.h>
#include <combo/inventory.h>

s32 MmSword_IsOwned(MmSwordExt sword)
{
    if (sword <= MM_SWORD_EXT_NONE || sword >= MM_SWORD_EXT_MAX)
        return 0;
    return !!(gSharedCustomSave.mmSwordsOwned &
              MM_SWORD_OWNED_BIT(sword));
}

void MmSword_EnsureState(void)
{
    MmSwordExt first = MM_SWORD_EXT_NONE;

    for (MmSwordExt sword = MM_SWORD_EXT_KOKIRI;
         sword < MM_SWORD_EXT_MAX;
         sword++)
    {
        if (MmSword_IsOwned(sword))
        {
            first = sword;
            break;
        }
    }

    if (first == MM_SWORD_EXT_NONE)
    {
        gSharedCustomSave.mmSwordSelected =
            MM_SWORD_EXT_NONE;
        gSharedCustomSave.mmSwordEquipped =
            MM_SWORD_EXT_NONE;
        return;
    }
    if (!MmSword_IsOwned(
            (MmSwordExt)gSharedCustomSave.mmSwordSelected))
    {
        gSharedCustomSave.mmSwordSelected = first;
    }

    if (!MmSword_IsOwned(
            (MmSwordExt)gSharedCustomSave.mmSwordEquipped))
    {
        gSharedCustomSave.mmSwordEquipped =
            MM_SWORD_EXT_NONE;
    }
}

MmSwordExt MmSword_GetSelected(void)
{
    MmSword_EnsureState();
    return (MmSwordExt)gSharedCustomSave.mmSwordSelected;
}

MmSwordExt MmSword_GetEquipped(void)
{
    MmSword_EnsureState();
    return (MmSwordExt)gSharedCustomSave.mmSwordEquipped;
}

void MmSword_SetSelected(MmSwordExt sword)
{
    if (MmSword_IsOwned(sword))
        gSharedCustomSave.mmSwordSelected = sword;
}

MmSwordExt MmSword_GetNextOwned(MmSwordExt current)
{
    MmSwordExt sword = current;
    for (s32 i = 0; i < MM_SWORD_EXT_MAX; i++)
    {
        sword++;
        if (sword >= MM_SWORD_EXT_MAX)
            sword = MM_SWORD_EXT_KOKIRI;
        if (MmSword_IsOwned(sword))
            return sword;
    }
    return current;
}

u16 MmSword_GetGiantsKnifeHealth(void)
{
    if (Config_Flag(CFG_SHARED_BIGGORON_SWORD))
        return gOotSave.info.playerData.swordHealth;

    return gSharedCustomSave.mmGiantsKnifeHealth;
}

void MmSword_SetGiantsKnifeHealth(u16 health)
{
    if (Config_Flag(CFG_SHARED_BIGGORON_SWORD))
        gOotSave.info.playerData.swordHealth = health;
    else
        gSharedCustomSave.mmGiantsKnifeHealth = health;
}

void MmSword_Equip(PlayState* play, MmSwordExt sword)
{
    if (!MmSword_IsOwned(sword))
        return;
    gSharedCustomSave.mmSwordEquipped = sword;
    gSharedCustomSave.mmSwordSelected = sword;
    gSharedCustomSave.mm.humanAgeLoadouts[gMmSave.linkAge].sword =
        (u8)sword;

    MmSword_RefreshNativeEquip(play);
}

static MmShieldExt MmShield_FirstOwned(void)
{
    for (MmShieldExt shield = MM_SHIELD_EXT_DEKU;
         shield < MM_SHIELD_EXT_MAX;
         shield++)
    {
        if (MmShield_IsOwned(shield))
            return shield;
    }
    return MM_SHIELD_EXT_NONE;
}

s32 MmShield_IsOwned(MmShieldExt shield)
{
    if (shield <= MM_SHIELD_EXT_NONE || shield >= MM_SHIELD_EXT_MAX)
        return 0;
    return !!(gSharedCustomSave.mmShieldsOwned & MM_SHIELD_OWNED_BIT(shield));
}

void MmShield_EnsureState(void)
{
    MmShieldExt first;

    first = MmShield_FirstOwned();

    if (first == MM_SHIELD_EXT_NONE)
    {
        gSharedCustomSave.mmShieldSelected =
            MM_SHIELD_EXT_NONE;
        gSharedCustomSave.mmShieldEquipped =
            MM_SHIELD_EXT_NONE;
        return;
    }
    if (!MmShield_IsOwned(
            (MmShieldExt)gSharedCustomSave.mmShieldSelected))
    {
        gSharedCustomSave.mmShieldSelected = first;
    }

    if (!MmShield_IsOwned(
            (MmShieldExt)gSharedCustomSave.mmShieldEquipped))
    {
        gSharedCustomSave.mmShieldEquipped =
            MM_SHIELD_EXT_NONE;
    }
}

MmShieldExt MmShield_GetSelected(void)
{
    MmShield_EnsureState();
    return
        (MmShieldExt)gSharedCustomSave.mmShieldSelected;
}

MmShieldExt MmShield_GetEquipped(void)
{
    MmShield_EnsureState();
    return
        (MmShieldExt)gSharedCustomSave.mmShieldEquipped;
}

MmShieldExt MmShield_GetLost(void)
{
    MmShieldExt shield;
    shield = (MmShieldExt)gSharedCustomSave.mmShieldLost;
    if (shield <= MM_SHIELD_EXT_NONE || shield >= MM_SHIELD_EXT_MAX)
        return MM_SHIELD_EXT_NONE;
    return shield;
}

void MmShield_SetSelected(MmShieldExt shield)
{
    if (MmShield_IsOwned(shield))
    {
        gSharedCustomSave.mmShieldSelected = shield;
    }
}

MmShieldExt MmShield_GetNextOwned(MmShieldExt current)
{
    MmShieldExt shield;
    shield = current;
    for (s32 i = 0; i < MM_SHIELD_EXT_MAX; i++)
    {
        shield++;
        if (shield >= MM_SHIELD_EXT_MAX)
            shield = MM_SHIELD_EXT_DEKU;
        if (MmShield_IsOwned(shield))
            return shield;
    }
    return current;
}

static u8 MmShield_GetNativeEquipValue(
    MmShieldExt shield)
{
    switch (shield)
    {
    case MM_SHIELD_EXT_DEKU:
    case MM_SHIELD_EXT_HERO:
    case MM_SHIELD_EXT_HYLIAN:
        return 1;
    case MM_SHIELD_EXT_MIRROR:
        return 2;
    default:
        return 0;
    }
}

void MmShield_RefreshNativeEquip(PlayState* play)
{
    MmShieldExt shield;
    MmShield_EnsureState();
    shield = (MmShieldExt)gSharedCustomSave.mmShieldEquipped;
    gMmSave.info.itemEquips.shield = MmShield_GetNativeEquipValue(shield);
#if defined(GAME_MM)
    if (play)
        UpdateEquipment(play, GET_PLAYER(play));
#endif
}

static u8 MmSword_GetItemId(MmSwordExt sword)
{
    switch (sword)
    {
        case MM_SWORD_EXT_KOKIRI:
            return ITEM_MM_SWORD_KOKIRI;

        case MM_SWORD_EXT_RAZOR:
            return ITEM_MM_SWORD_RAZOR;

        case MM_SWORD_EXT_GILDED:
            return ITEM_MM_SWORD_GILDED;

        case MM_SWORD_EXT_MASTER:
            return ITEM_MM_SWORD_MASTER;

        case MM_SWORD_EXT_GIANTS_KNIFE:
            return ITEM_MM_SWORD_GIANTS_KNIFE;

        case MM_SWORD_EXT_BIGGORON:
            return ITEM_MM_SWORD_BIGGORON;

        default:
            return ITEM_NONE;
    }
}

static u8 MmSword_GetNativeEquipValue(MmSwordExt sword)
{
    switch (sword)
    {
        case MM_SWORD_EXT_KOKIRI:
            return 1;

        case MM_SWORD_EXT_RAZOR:
            return 2;

        case MM_SWORD_EXT_GILDED:
            return 3;
        case MM_SWORD_EXT_MASTER:
        case MM_SWORD_EXT_GIANTS_KNIFE:
        case MM_SWORD_EXT_BIGGORON:
        default:
            return 0;
    }
}

void MmSword_RefreshNativeEquip(PlayState* play)
{
    MmSwordExt sword;

    MmSword_EnsureState();

    sword = MmSword_GetEquipped();

    gMmSave.info.itemEquips.sword =
        MmSword_GetNativeEquipValue(sword);

    gMmSave.info.itemEquips
        .buttonItems[0][EQUIP_SLOT_B] =
        MmSword_GetItemId(sword);

#if defined(GAME_MM)
    if (play)
    {
        UpdateEquipment(
            play,
            GET_PLAYER(play)
        );

        Interface_LoadItemIconImpl(
            play,
            EQUIP_SLOT_B
        );
    }
#endif
}

void MmShield_Equip(
    PlayState* play,
    MmShieldExt shield)
{
    if (!MmShield_IsOwned(shield))
        return;

    gSharedCustomSave.mmShieldEquipped = shield;
    gSharedCustomSave.mmShieldSelected = shield;

    gSharedCustomSave.mm.humanAgeLoadouts[gMmSave.linkAge].shield =
        (u8)shield;

    MmShield_RefreshNativeEquip(play);
}

void MmShield_Lose(
    PlayState* play,
    MmShieldExt shield)
{
    s32 age;

    if (!MmShield_IsOwned(shield))
        return;

    gSharedCustomSave.mmShieldsOwned &=
        ~MM_SHIELD_OWNED_BIT(shield);

    gSharedCustomSave.mmShieldLost = shield;

    for (age = 0; age < 2; age++)
    {
        if (gSharedCustomSave.mm.humanAgeLoadouts[age].shield ==
            (u8)shield)
        {
            gSharedCustomSave.mm.humanAgeLoadouts[age].shield =
                MM_SHIELD_EXT_NONE;
        }
    }

    if (gSharedCustomSave.mmShieldSelected == shield)
    {
        gSharedCustomSave.mmShieldSelected =
            MM_SHIELD_EXT_NONE;
    }

    if (gSharedCustomSave.mmShieldEquipped == shield)
    {
        gSharedCustomSave.mmShieldEquipped =
            MM_SHIELD_EXT_NONE;
    }

    MmShield_EnsureState();
    MmShield_RefreshNativeEquip(play);
}


void Inventory_ReobtainProgressiveShields(void)
{
    if (gOotExtraItems.shield & EQ_OOT_SHIELD_DEKU)
        gOotSave.info.inventory.equipment.shields |= EQ_OOT_SHIELD_DEKU;

    if (gOotExtraItems.shield & EQ_OOT_SHIELD_HYLIAN)
        gOotSave.info.inventory.equipment.shields |= EQ_OOT_SHIELD_HYLIAN;

    if (gSharedCustomSave.mmProgressiveShields & 1)
    {
        gSharedCustomSave.mmShieldsOwned |= MM_SHIELD_OWNED_BIT(MM_SHIELD_EXT_DEKU);
        if (gSharedCustomSave.mmShieldLost == MM_SHIELD_EXT_DEKU)
            gSharedCustomSave.mmShieldLost = MM_SHIELD_EXT_NONE;
    }

    if (gSharedCustomSave.mmProgressiveShields & 2)
    {
        gSharedCustomSave.mmShieldsOwned |= MM_SHIELD_OWNED_BIT( MM_SHIELD_EXT_HERO);
        if (gSharedCustomSave.mmShieldLost == MM_SHIELD_EXT_HERO)
            gSharedCustomSave.mmShieldLost = MM_SHIELD_EXT_NONE;
    }
    MmShield_EnsureState();
    MmShield_RefreshNativeEquip(NULL);
}

int comboHasFreeBottleOot(void)
{
    for (int i = 0; i < 4; ++i)
    {
        if (gOotSave.info.inventory.items[ITS_OOT_BOTTLE + i] == ITEM_OOT_BOTTLE_EMPTY)
            return 1;
    }
    if ((gOotExtraTrade.adult & (1 << XITEM_OOT_ADULT_BOTTLE)) && gOotExtraItems.bottleAdultSlot == ITEM_OOT_BOTTLE_EMPTY)
    {
        return 1;
    }
    if ((gOotExtraTrade.child & (1 << XITEM_OOT_CHILD_BOTTLE)) && gOotExtraItems.bottleChildSlot == ITEM_OOT_BOTTLE_EMPTY)
    {
        return 1;
    }
    return 0;
}

#if defined(GAME_OOT)
PATCH_FUNC(0x80071A94, comboHasFreeBottleOot);
#endif

int comboHasFreeBottleMm(void)
{
    for (int i = 0; i < 6; ++i)
    {
        if (gMmSave.info.inventory.items[ITS_MM_BOTTLE + i] == ITEM_MM_BOTTLE_EMPTY)
            return 1;
    }
    return 0;
}
