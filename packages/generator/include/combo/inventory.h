#ifndef COMBO_INVENTORY_H
#define COMBO_INVENTORY_H

#include <combo/types.h>

s32 comboGetSlotExtras(u32 slot, u8** outItemPtr, u32* outFlags, const u8** outTable, u32* outTableSize);
u8 comboGetNextTrade(u8 currentItem, u32 flags, const u8* table, u32 tableSize);
void comboToggleSlot(u32 slot);
void comboToggleTrade(u8* slot, u32 flags, const u8* table, u32 tableSize);
s32 comboIsTradeBottleOot(u8 itemId);

int comboHasFreeBottleOot(void);
int comboHasFreeBottleMm(void);

#if defined(GAME_OOT)
void comboRemoveTradeItemAdult(u16 xitemId);
void comboRemoveTradeItemChild(u16 xitemId);
#endif

#if defined(GAME_MM)
void comboRemoveTradeItem1(u16 xitemId);
void comboRemoveTradeItem2(u16 xitemId);
void comboRemoveTradeItem3(u16 xitemId);
void Inventory_SaveLotteryCodeGuess(PlayState* play);
#endif

    void Inventory_ReobtainProgressiveShields(void);

typedef enum
{
    MM_SWORD_EXT_NONE = 0,
    MM_SWORD_EXT_KOKIRI,
    MM_SWORD_EXT_RAZOR,
    MM_SWORD_EXT_GILDED,
    MM_SWORD_EXT_MASTER,
    MM_SWORD_EXT_GIANTS_KNIFE,
    MM_SWORD_EXT_BIGGORON,
    MM_SWORD_EXT_MAX,
}
MmSwordExt;

#define MM_SWORD_OWNED_BIT(sword) (1u << ((sword) - 1))

s32 MmSword_IsOwned(MmSwordExt sword);
void MmSword_EnsureState(void);

MmSwordExt MmSword_GetSelected(void);
MmSwordExt MmSword_GetEquipped(void);
MmSwordExt MmSword_GetNextOwned(MmSwordExt sword);

void MmSword_SetSelected(MmSwordExt sword);
void MmSword_Equip(PlayState* play, MmSwordExt sword);

u16 MmSword_GetGiantsKnifeHealth(void);
void MmSword_SetGiantsKnifeHealth(u16 health);

#if defined(GAME_MM)
void MmSword_LoadHudIcon(PlayState* play);
#endif

typedef enum
{
    MM_SHIELD_EXT_NONE = 0,
    MM_SHIELD_EXT_DEKU,
    MM_SHIELD_EXT_HERO,
    MM_SHIELD_EXT_MIRROR,
    MM_SHIELD_EXT_MAX,
}
MmShieldExt;

#define MM_SHIELD_OWNED_BIT(shield) \
(1u << ((shield) - 1))

s32 MmShield_IsOwned(MmShieldExt shield);
void MmShield_EnsureState(void);

MmShieldExt MmShield_GetSelected(void);
MmShieldExt MmShield_GetEquipped(void);
MmShieldExt MmShield_GetLost(void);
MmShieldExt MmShield_GetNextOwned(MmShieldExt shield);

void MmShield_SetSelected(MmShieldExt shield);
void MmShield_Equip(PlayState* play, MmShieldExt shield);
void MmShield_Lose(PlayState* play, MmShieldExt shield);
void MmShield_RefreshNativeEquip(PlayState* play);
void MmSword_RefreshNativeEquip(PlayState* play);
void MmSword_RefreshHudIcon(PlayState* play);
#endif
