import type { GestureFeatures, StylePreset } from './types'

export const STYLE_PRESETS: Record<string, StylePreset> = {
  peaceful: {
    id: 'peaceful',
    name: 'Blue Wash Meadow',
    key: 'C',
    scale: ['C', 'D', 'E', 'G', 'A'],
    progressionName: 'Cmaj7 - Am7 - Fmaj7 - Gsus4',
    chords: [
      { label: 'Cmaj7', notes: ['C', 'E', 'G', 'B'] },
      { label: 'Am7', notes: ['A', 'C', 'E', 'G'] },
      { label: 'Fmaj7', notes: ['F', 'A', 'C', 'E'] },
      { label: 'Gsus4', notes: ['G', 'C', 'D'] },
    ],
    rhythmBias: ['1n', '2n', '2n', '4n'],
    rhythmTemplates: [
      ['1n', '2n', '2n', '1n'],
      ['2n', '2n', '4n', '2n'],
      ['1n', '4n', '2n', '2n'],
    ],
    instruments: ['paper piano', 'blue wash', 'celesta droplets', 'harp ripples', 'wet grain'],
    mood: 'pale blue washes, soft pentatonic blooms, gentle ripples on paper',
  },
  mysterious: {
    id: 'mysterious',
    name: 'Indigo Hollow',
    key: 'A minor',
    scale: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
    progressionName: 'Am(add9) - Fmaj7 - Dm(add9) - Em',
    chords: [
      { label: 'Am(add9)', notes: ['A', 'C', 'E', 'B'] },
      { label: 'Fmaj7', notes: ['F', 'A', 'C', 'E'] },
      { label: 'Dm(add9)', notes: ['D', 'F', 'A', 'E'] },
      { label: 'Em', notes: ['E', 'G', 'B'] },
    ],
    rhythmBias: ['1n', '2n', '2n', '4n'],
    rhythmTemplates: [
      ['1n', '1n', '2n', '2n'],
      ['2n', '1n', '4n', '2n'],
      ['1n', '2n', '2n', '4n'],
    ],
    instruments: ['felt ink piano', 'indigo strings', 'violet choir wash', 'music-box droplets', 'paper shadow'],
    mood: 'indigo pigment, suspended minor color, distant droplets fading into shadow',
  },
}

export const DEFAULT_GESTURE: GestureFeatures = {
  handCount: 0,
  height: 0.48,
  speed: 0.18,
  horizontal: 0.5,
  vertical: 0.5,
  size: 0.38,
  sharpness: 0.08,
  direction: 'level',
  articulation: 'normal',
}
