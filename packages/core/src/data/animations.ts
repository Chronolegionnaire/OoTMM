import type { Game } from '../defines';

import { default as DATA } from '../../dist/data-link-animations.json';

export type CustomAnimation = {
  name: string;
  home_game: Game;
  header_offset: number;
  frame_data_offset: number;
};

export const DATA_ANIMATIONS = DATA.animations as CustomAnimation[];
