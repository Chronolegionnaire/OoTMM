import {
  classifyPlayerModel,
  isPlayerModelPak,
  isProcessedPlayerModel,
  readPakPlayerModels,
} from './model-pak';
import type { PakPlayerModel, PlayerModelAge, PlayerModelGame } from './model-pak';

export type ResolvedPlayerModel = {
  data: Uint8Array;
  sourceGame: PlayerModelGame | null;
};

export type PlayerModelPair = {
  adult: ResolvedPlayerModel | null;
  child: ResolvedPlayerModel | null;
};

function emptyPair(): PlayerModelPair {
  return {
    adult: null,
    child: null,
  };
}

function resolvedModel(model: PakPlayerModel): ResolvedPlayerModel {
  return {
    data: model.data,
    sourceGame: model.game,
  };
}

export async function resolvePlayerModelInput(
  data: Uint8Array | null,
  game: PlayerModelGame,
  slotAge: PlayerModelAge,
): Promise<PlayerModelPair> {
  const out = emptyPair();

  if (data === null) {
    return out;
  }

  if (!isPlayerModelPak(data)) {
    const classified = classifyPlayerModel(data);

    out[slotAge] = {
      data,
      sourceGame: classified.game,
    };

    return out;
  }

  const models = await readPakPlayerModels(data);
  let relevant = models.filter((model) => model.game === game);
  if (relevant.length === 0) {
    relevant = models.filter((model) => model.game === null);
  }

  if (relevant.length === 0) {
    const crossGame = models.filter(
      (model) => model.game !== null && model.game !== game,
    );

    const rawCrossGame = crossGame.filter(
      (model) => !isProcessedPlayerModel(model.data),
    );

    relevant = rawCrossGame.length > 0 ? rawCrossGame : crossGame;
  }

  if (relevant.length === 0) {
    throw new Error(`Model pak contains no player models usable by ${game.toUpperCase()}`);
  }

  const adult = relevant.find((model) => model.age === 'adult');
  const child = relevant.find((model) => model.age === 'child');
  const unknown = relevant.filter((model) => model.age === null);

  if (adult) {
    out.adult = resolvedModel(adult);
  }

  if (child) {
    out.child = resolvedModel(child);
  }

  if (unknown.length === 1) {
    const model = resolvedModel(unknown[0]);

    if (out.adult !== null && out.child === null) {
      out.child = model;
    } else if (out.child !== null && out.adult === null) {
      out.adult = model;
    } else if (out[slotAge] === null) {
      out[slotAge] = model;
    }
  } else if (unknown.length > 1) {
    throw new Error(`Model pak contains multiple unclassified ${game.toUpperCase()} player models`);
  }

  if (out.adult === null && out.child === null) {
    throw new Error(`Unable to determine player model age from ${game.toUpperCase()} pak`);
  }

  return out;
}

export function mergePlayerModelInputs(
  childSlot: PlayerModelPair,
  adultSlot: PlayerModelPair,
): PlayerModelPair {
  return {
    child: childSlot.child ?? adultSlot.child,
    adult: adultSlot.adult ?? childSlot.adult,
  };
}
