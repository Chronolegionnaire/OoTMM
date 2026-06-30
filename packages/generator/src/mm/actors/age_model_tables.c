#include <combo.h>
#include <combo/player.h>
#include <combo/config.h>
#include <combo/custom.h>
#include <combo/global.h>

#define AGE_MODEL_CMD_END     0x00000000
#define AGE_MODEL_CMD_WRITE16 0x00000001
#define AGE_MODEL_CMD_WRITE32 0x00000002
#define AGE_MODEL_CMD_COPY32  0x00000003

typedef struct
{
    u32 op;
    u32 addr;
    u32 value;
}
AgeModelCommand;

static void ComboPlayer_ApplyAgeModelCommand(const AgeModelCommand* cmd)
{
    switch (cmd->op)
    {
        case AGE_MODEL_CMD_WRITE16:
            *(u16*)cmd->addr = (u16)cmd->value;
            break;

        case AGE_MODEL_CMD_WRITE32:
            *(u32*)cmd->addr = cmd->value;
            break;

        case AGE_MODEL_CMD_COPY32:
            *(u32*)cmd->addr = *(u32*)cmd->value;
            break;
    }
}

static void ComboPlayer_RestoreChildModelTables(void)
{
    AgeModelCommand cmds[CUSTOM_MM_AGE_MODEL_CHILD_TABLES_SIZE / sizeof(AgeModelCommand)];
    AgeModelCommand* cmd;

    LoadFile(cmds, CUSTOM_MM_AGE_MODEL_CHILD_TABLES_VROM, CUSTOM_MM_AGE_MODEL_CHILD_TABLES_SIZE);

    for (cmd = cmds; cmd->op != AGE_MODEL_CMD_END; ++cmd)
    {
        ComboPlayer_ApplyAgeModelCommand(cmd);
    }
}

static void ComboPlayer_ApplyAdultModelTables(void)
{
    AgeModelCommand cmds[CUSTOM_MM_AGE_MODEL_TABLES_SIZE / sizeof(AgeModelCommand)];
    AgeModelCommand* cmd;

    LoadFile(cmds, CUSTOM_MM_AGE_MODEL_TABLES_VROM, CUSTOM_MM_AGE_MODEL_TABLES_SIZE);

    for (cmd = cmds; cmd->op != AGE_MODEL_CMD_END; ++cmd)
    {
        ComboPlayer_ApplyAgeModelCommand(cmd);
    }
}

void ComboPlayer_ApplyAgeModelTables(void)
{
    ComboPlayer_RestoreChildModelTables();

    if (!comboIsLinkAdult())
        return;

    ComboPlayer_ApplyAdultModelTables();
}