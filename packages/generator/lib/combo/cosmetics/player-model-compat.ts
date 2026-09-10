const CROSS_GAME_PLAYER_PIECES = new Set<string>([
  'Limb 1','Limb 3','Limb 4','Limb 5','Limb 6','Limb 7','Limb 8',
  'Limb 10','Limb 11','Limb 12','Limb 13','Limb 14','Limb 15',
  'Limb 16','Limb 17','Limb 18','Limb 19','Limb 20',
  'Waist','Thigh.R','Shin.R','Foot.R','Thigh.L','Shin.L','Foot.L',
  'Head','Hat','Collar','Shoulder.L','Forearm.L','Hand.L',
  'Shoulder.R','Forearm.R','Hand.R','Torso',
  'Fist.L','Fist.R',
]);

export function isCrossGamePlayerPiece(name: string) {
  return CROSS_GAME_PLAYER_PIECES.has(name);
}

export function crossGamePieceDefaultLimb(name: string): number | null {
  switch (name) {
    case 'Fist.L': return 15;
    case 'Fist.R': return 18;
    default: return null;
  }
}
