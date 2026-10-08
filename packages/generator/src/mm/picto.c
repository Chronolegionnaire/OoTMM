#include <combo.h>

#define PICTOBOX_SWAMP          (1 <<  1)
#define PICTOBOX_MONKEY         (1 <<  2)
#define PICTOBOX_BIG_OCTO       (1 <<  3)
#define PICTOBOX_LULU1          (1 <<  4)
#define PICTOBOX_LULU2          (1 <<  5)
#define PICTOBOX_LULU3          (1 <<  6)
#define PICTOBOX_SCARECROW      (1 <<  7)
#define PICTOBOX_TINGLE         (1 <<  8)
#define PICTOBOX_PIRATE_GOOD    (1 <<  9)
#define PICTOBOX_DEKU_KING      (1 << 10)
#define PICTOBOX_PIRATE_BAD     (1 << 11)


#include "picto_names.inc"

#define PICTO_SUBJECT_NONE 0xffff
#define PICTO_SAVED_SUBJECT_MASK 0x0000ffff

static u16 sPictoPendingSubject = PICTO_SUBJECT_NONE;
static u16 sPictoPreviousSubject = PICTO_SUBJECT_NONE;
static u8 sPictoSubjectPending = 0;

static const char* Picto_GetSubjectName(u16 subjectId)
{
    if (subjectId == PICTO_SUBJECT_NONE || subjectId >= ARRAY_COUNT(sPictoActorNames))
        return "Unknown";

    if (sPictoActorNames[subjectId] == NULL)
        return "Unknown";

    return sPictoActorNames[subjectId];
}

u16 Picto_GetSavedSubject(void)
{
    u16 value = gSave.info.pictoFlags1 & PICTO_SAVED_SUBJECT_MASK;
    return value ? value - 1 : PICTO_SUBJECT_NONE;
}

static void Picto_SetSavedSubject(u16 subjectId)
{
    u32 value = subjectId == PICTO_SUBJECT_NONE ? 0 : subjectId + 1;
    gSave.info.pictoFlags1 = (gSave.info.pictoFlags1 & ~PICTO_SAVED_SUBJECT_MASK) | value;
}

static int PictoValidateActor(PlayState* play, Actor* actor)
{
    u32 flags0 = gSave.info.pictoFlags0;
    u32 flags1 = gSave.info.pictoFlags1;
    s32 result;

    result = Snap_ValidatePictograph(play, actor, 0, &actor->focus.pos, &actor->shape.rot, 10.0f, 1200.0f, -1);

    gSave.info.pictoFlags0 = flags0;
    gSave.info.pictoFlags1 = flags1;

    return result == 0;
}

static u16 Picto_GetSubjectId(const Actor* actor)
{
    switch (actor->id)
    {
    case ACTOR_EN_RD:
        if (actor->params == -2 || actor->params == -3)
            return 0x300;
        break;
    case ACTOR_EN_WF:
        if ((actor->params & 0x3f) == 0)
            return 0x301;
        break;
    case ACTOR_EN_PO_COMPOSER:
        return (actor->params & 0x8000) ? 0x302 : 0x303;
    case ACTOR_EN_TSN:
        if (actor->params & 0x100)
            return (actor->params & 0xf) == 0 ? 0x304 : 0xffff;
        break;
    case ACTOR_EN_IN:
        switch (actor->params & 0x1ff)
        {
    case 1: case 3: return 0x306;
    case 2: case 4: return 0x305;
        }
        break;
    case ACTOR_EN_RZ:
        return (actor->params & 0x8000) ? 0x308 : 0x307;
    case ACTOR_DM_CHAR00:
        return actor->params == 0 ? 0x309 : actor->params == 1 ? 0x30a : 0xffff;
    }
    return actor->id;
}


static u16 Picto_CanonicalSubjectId(u16 subjectId)
{
    switch (subjectId)
    {
    case 0x2a3: return 0x176; /* Tingle */

    case 0x187:
    case 0x214: return 0x168; /* Koume */

    case 0x1b7: return 0x188; /* Kotake */
    case 0x21f: return 0x1a4; /* Romani */

    case 0x299:
    case 0x29e: return 0x202; /* Anju */

    case 0x29d: return 0x262; /* Madame Aroma */
    case 0x29f: return 0x253; /* Anju's Mother */
    case 0x2a0: return 0x243; /* Anju's Grandmother */
    case 0x2a2: return 0x26f; /* Mayor Dotour */
    case 0x2a8: return 0x26c; /* Viscen */
    case 0x2a9: return 0x26b; /* Mutoh */
    case 0x1d5: return 0x17d; /* Postman */
    case 0x1fa: return 0x1f7; /* Darmani */
    case 0x1ba: return 0x144; /* Snapper */
    case 0x304: return 0x205; /* Seahorse */

    case 0x09f: return 0x21e; /* Gerudo Pirate */
    case 0x292: return 0x1c2; /* Fisherman */

    case 0x26a:
    case 0x2ab: return 0x09c; /* Carpenter */

    case 0x2aa: return 0x26d; /* Soldier */
    case 0x2a5: return 0x0ed; /* Stalchild */

    case 0x17a:
    case 0x1a0: return 0x08a; /* Deku Guard */

    case 0x24c:
    case 0x274: return 0x1bd; /* Business Scrub */

    case 0x242:
    case 0x276: return 0x138; /* Goron */

    case 0x260: return 0x228; /* Zora */

    case 0x280:
    case 0x281: return 0x27f; /* Bomber */
    }

    return subjectId;
}

static u16 Picto_RecordSubject(PlayState* play)
{
    Actor* actor;
    u16 bestId = PICTO_SUBJECT_NONE;
    f32 bestDistance = 1000000.0f;
    s32 category;

    for (category = 0; category < ACTORCAT_MAX; category++)
    {
        for (actor = play->actorCtx.actors[category].first; actor != NULL; actor = actor->next)
        {
            if (actor->id == ACTOR_PLAYER || actor->draw == NULL)
                continue;

            if (actor->id >= ARRAY_COUNT(sPictoActorNames))
                continue;

            if (sPictoActorNames[actor->id] == NULL)
            {
                u16 subjectId = Picto_GetSubjectId(actor);

                if (subjectId == 0xffff || subjectId >= ARRAY_COUNT(sPictoActorNames))
                    continue;

                if (sPictoActorNames[subjectId] == NULL)
                    continue;
            }

            if (!PictoValidateActor(play, actor))
                continue;

            if (actor->xzDistToPlayer < bestDistance)
            {
                bestDistance = actor->xzDistToPlayer;
                bestId = Picto_CanonicalSubjectId(Picto_GetSubjectId(actor));
            }
        }
    }

    return bestId;
}

void Picto_UpdateSavedSubject(void)
{
    if (!sPictoSubjectPending)
        return;

    if (gPictoboxState == 0)
    {
        Picto_SetSavedSubject(sPictoPendingSubject);
        sPictoSubjectPending = 0;
    }
    else if (gPictoboxState == 1)
    {
        Picto_SetSavedSubject(sPictoPreviousSubject);
        sPictoSubjectPending = 0;
    }
}


static const char* pictoText(void)
{
    static const u32 luluMask = PICTOBOX_LULU1 | PICTOBOX_LULU2 | PICTOBOX_LULU3;
    u32 f;

    f = gSave.info.pictoFlags0;

    if (f & PICTOBOX_MONKEY)
        return "picture of a monkey";
    if (f & PICTOBOX_BIG_OCTO)
        return "picture of a big octo";
    if (f & PICTOBOX_DEKU_KING)
        return "picture of the Deku King";
    if ((f & luluMask) == luluMask)
        return "good picture of Lulu";
    if (f & PICTOBOX_LULU1)
        return "bad picture of Lulu";
    if (f & PICTOBOX_SCARECROW)
        return "picture of a scarecrow";
    if (f & PICTOBOX_TINGLE)
        return "picture of Tingle";
    if (f & PICTOBOX_PIRATE_GOOD)
        return "good picture of a pirate";
    if (f & PICTOBOX_PIRATE_BAD)
        return "bad picture of a pirate";
    if (f & PICTOBOX_SWAMP)
        return "picture of the swamp";
    return "picture";
}

static int PictoStartsWith(const char* str, const char* prefix)
{
    while (*prefix)
    {
        if (*str++ != *prefix++)
            return 0;
    }

    return 1;
}

static void PictoHijackText(PlayState* play)
{
    char* b;
    const char* subject;
    const char* name;

    subject = NULL;

    if (sPictoPendingSubject < ARRAY_COUNT(sPictoActorNames))
        subject = sPictoActorNames[sPictoPendingSubject];

    b = play->msgCtx.font.textBuffer.schar;
    comboTextAppendHeader(&b);
    comboTextAppendStr(&b, "Keep this picture");

    if (subject != NULL)
    {
        name = subject;

        name = subject;

        if (PictoStartsWith(name, "of "))
        {
            comboTextAppendStr(&b, " of ");
            name += 3;
        }

        if (PictoStartsWith(name, "an "))
        {
            comboTextAppendStr(&b, "an ");
            name += 3;
        }
        else if (PictoStartsWith(name, "a "))
        {
            comboTextAppendStr(&b, "a ");
            name += 2;
        }
        else if (PictoStartsWith(name, "the "))
        {
            comboTextAppendStr(&b, "the ");
            name += 4;
        }

        comboTextAppendStr(&b, TEXT_COLOR_RED);
        comboTextAppendStr(&b, name);
        comboTextAppendClearColor(&b);
    }

    comboTextAppendStr(&b, "?" TEXT_NL TEXT_NL TEXT_CHOICE2 TEXT_COLOR_GREEN "Yes" TEXT_NL "No" TEXT_END);
}

static void PictoDisplayTextBox(PlayState* play, s16 messageId, Actor* actor)
{
    if (gPictoboxPhotoTaken == 1)
    {
        sPictoPreviousSubject = Picto_GetSavedSubject();
        PictoUpdateFlags(play);
        sPictoPendingSubject = Picto_RecordSubject(play);
        sPictoSubjectPending = 1;
    }

    PlayerDisplayTextBox(play, messageId, actor);
    PictoHijackText(play);
}

PATCH_CALL(0x80120c34, PictoDisplayTextBox);


#define PICTO_SUBJECT_MAX 0x400
#define PICTO_SUBJECT_BYTES (PICTO_SUBJECT_MAX / 8)

static u8 sPictoSubjects[PICTO_SUBJECT_BYTES];

void Picto_RecordSubjects(PlayState* play)
{
    Actor* actor;
    s32 category;
    s32 i;

    for (i = 0; i < PICTO_SUBJECT_BYTES; i++)
        sPictoSubjects[i] = 0;

    for (category = 0; category < ACTORCAT_MAX; category++)
    {
        for (actor = play->actorCtx.actors[category].first; actor != NULL; actor = actor->next)
        {
            u16 id = actor->id;

            if (id >= PICTO_SUBJECT_MAX || actor->draw == NULL)
                continue;

            if (!PictoValidateActor(play, actor))
                continue;

            sPictoSubjects[id >> 3] |= 1 << (id & 7);
        }
    }
}

int Picto_HasSubject(u16 subjectId)
{
    if (subjectId >= PICTO_SUBJECT_MAX)
        return 0;

    return (sPictoSubjects[subjectId >> 3] & (1 << (subjectId & 7))) != 0;
}

//pictograph box fix

typedef struct
{
    u16 width;
    u16 height;
    u8 pad[0x0c];
    u16* fbuf;
    u16* fbufSave;
} PictoPreRender;

static void PictoConvert(u8* dst, const u16* src, s32 stride, s32 left, s32 top, s32 right, s32 bottom)
{
    s32 x;
    s32 y;
    s32 index = 0;

    for (y = top; y <= bottom; y++)
    {
        for (x = left; x <= right; x++)
        {
            u16 pixel = src[y * stride + x];
            u32 r = (pixel >> 11) & 0x1f;
            u32 g = (pixel >> 6) & 0x1f;
            u32 b = (pixel >> 1) & 0x1f;
            u32 intensity = ((r * 2 + g * 4 + b) * 255) / (31 * 7);
            dst[index++] = (u8)intensity;
        }
    }
}

static void PictoTakePhotoDirect(PictoPreRender* prerender)
{
    const u16* src;
    s32 width;
    s32 height;

    src = prerender->fbuf;
    width = prerender->width;
    height = prerender->height;

    if (src == NULL)
        return;

    if (width != 320 || height != 240)
        return;

    osInvalDCache((void*)src, width * height * sizeof(u16));
    PictoConvert(((u8*)0x80780000), src, width, 80, 64, 239, 175);
}

PATCH_FUNC(0x80165e1c, PictoTakePhotoDirect);

static u8 sPictoCaptureActive = 0;
static u8 sPictoCaptureStarted = 0;
static u8 sPictoCleanFrames = 0;

int Picto_IsCapturing(void)
{
    return sPictoCaptureActive;
}

void Picto_PrepareDraw(void)
{
    if (!sPictoCaptureActive)
    {
        if (R_PICTO_PHOTO_STATE == 1)
        {
            Picto_RecordSubjects(gPlay);
            sPictoCaptureActive = 1;
            sPictoCaptureStarted = 0;
            sPictoCleanFrames = 3;
            R_PICTO_PHOTO_STATE = 0;
        }
        return;
    }
    if (sPictoCaptureStarted)
    {
        if (R_PICTO_PHOTO_STATE == 0)
        {
            sPictoCaptureActive = 0;
            sPictoCaptureStarted = 0;
        }
        return;
    }
    if (sPictoCleanFrames > 0)
    {
        sPictoCleanFrames--;
        return;
    }
    sPictoCaptureStarted = 1;
    R_PICTO_PHOTO_STATE = 1;
}

// Needed in order to not break photos on hardware with the above rework

typedef struct
{
    u8 pad[0x10];
    u16* fbuf;
    u16* fbufSave;
    u8* cvgSave;
} PictoCoveragePreRender;

extern void PreRender_FetchFbufCoverage(PictoCoveragePreRender* prerender, Gfx** gfx);
extern void PreRender_CoverageRgba16ToI8(PictoCoveragePreRender* prerender, Gfx** gfx, void* src, void* dst);


static void PictoDrawCoverage(PictoCoveragePreRender* prerender, Gfx** gfx)
{
    if (R_PICTO_PHOTO_STATE == 2)
        return;

    PreRender_FetchFbufCoverage(prerender, gfx);

    if (prerender->cvgSave != NULL)
        PreRender_CoverageRgba16ToI8(prerender, gfx, prerender->fbuf, prerender->cvgSave);
}

PATCH_FUNC(0x80170730, PictoDrawCoverage);

typedef struct
{
    u16 subjectId;
    u16 actorId;
    s16 paramsMask;
    s16 paramsValue;
    f32 minDistance;
    f32 maxDistance;
    s16 angleRange;
} PictoSubjectDef;

static int PictoSubjectMatches(const PictoSubjectDef* subject, Actor* actor)
{
    return actor->id == subject->actorId &&
           (actor->params & subject->paramsMask) == subject->paramsValue;
}

#define PICTO_CHECK_TOURIST_CENTER 0
#define PICTO_CHECK_SEAHORSE      1
#define PICTO_CHECK_COUNT         2

#define PICTO_SUBJECT_DISABLED    0xffff


u16 Picto_GetRequiredSubject(int check)
{
    if (check < 0 || check >= PICTO_CHECK_COUNT)
        return PICTO_SUBJECT_DISABLED;

    return gComboConfig.pictoSubjects[check];
}

int Picto_CheckPhoto(int check)
{
    u16 subject = Picto_GetRequiredSubject(check);

    if (subject == PICTO_SUBJECT_DISABLED)
        return 0;

    return Picto_HasSubject(subject);
}


