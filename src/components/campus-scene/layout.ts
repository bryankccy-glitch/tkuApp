/** Scene geometry in art pixels, derived from the logical canvas size. */
export interface Layout {
  W: number;
  H: number;
  /** water surface */
  horizon: number;
  /** bridge deck top */
  deckY: number;
  /** pylon centre x and top y */
  pylonX: number;
  pylonTop: number;
  /** foreground hill baseline at left / right edge */
  hillLeft: number;
  hillRight: number;
}

export function layoutFor(W: number, H: number): Layout {
  const horizon = Math.round(H * 0.7);
  const deckY = horizon - Math.round(H * 0.075);
  const pylonTop = Math.round(H * 0.33);
  return {
    W,
    H,
    horizon,
    deckY,
    pylonX: Math.round(W * 0.7),
    pylonTop,
    hillLeft: Math.round(H * 0.9),
    hillRight: Math.round(H * 0.8),
  };
}
