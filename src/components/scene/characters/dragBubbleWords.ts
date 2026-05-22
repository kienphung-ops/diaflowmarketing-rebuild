/**
 * Words / phrases that pop into the speech bubble above a minifigure
 * while the user drags them around the office.
 *
 * Edit this list freely — add, remove, or reorder. The drag-bubble
 * picker (see `pickDragBubbleWord` below + the consumer in
 * `Character.tsx`) just grabs a uniformly random entry every ~1.2s
 * during sustained drag.
 *
 * Keep entries short (≲ 14 chars) so the bubble stays on one line.
 * Emojis are fine and recommended for flavour.
 */
export const DRAG_BUBBLE_WORDS: readonly string[] = [
  'Wheee!',
  'Where to?',
  '🛸',
  'Hold on!',
  'Look ma!',
  '😵‍💫',
  'Easy now',
  'Yeet!',
  'Whoa',
  '✨',
  'Flying!',
  'Wait what',
  '😀',
  '😳',
  '😊',
  '🤔',
  'ლ(◕ω◕ლ)',
  'ヾ(☆▽☆)',
  '✧･ﾟ:*( ͡ꈍ ͜ʖ̫ ͡ꈍ )*:･ﾟ✧',
  '(˵ ͡~ ͜ʖ ͡°˵)ﾉ⌒♡*:・。.',
]

/**
 * Pick a random entry. Falls back to a safe placeholder if the list
 * was emptied by accident — so the caller never has to null-check.
 */
export function pickDragBubbleWord(): string {
  if (DRAG_BUBBLE_WORDS.length === 0) return '…'
  const i = Math.floor(Math.random() * DRAG_BUBBLE_WORDS.length)
  return DRAG_BUBBLE_WORDS[i]
}
