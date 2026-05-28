import { describe, expect, it } from 'vitest'
import { MelodyEngine } from './melodyEngine'
import { noteNameFromMidi } from './notes'
import { DEFAULT_GESTURE, STYLE_PRESETS } from './presets'
import type { GestureFeatures, StylePreset } from './types'

function gesture(overrides: Partial<GestureFeatures> = {}): GestureFeatures {
  return { ...DEFAULT_GESTURE, handCount: 1, ...overrides }
}

function allowedNotesFor(preset: StylePreset) {
  return new Set([...preset.scale, ...preset.chords.flatMap((chord) => chord.notes)])
}

describe('MelodyEngine', () => {
  it('keeps generated notes inside the active ambient grammar', () => {
    Object.values(STYLE_PRESETS).forEach((preset) => {
      const engine = new MelodyEngine(preset, () => 0.74)
      const allowed = allowedNotesFor(preset)

      for (let index = 0; index < 16; index += 1) {
        const event = engine.next(gesture({ speed: 0.5 }))
        if (event.midi !== undefined) {
          expect(allowed.has(noteNameFromMidi(event.midi))).toBe(true)
        }
      }
    })
  })

  it('intentionally returns rests with deterministic sparse input', () => {
    const engine = new MelodyEngine(STYLE_PRESETS.peaceful, () => 0.1)
    const event = engine.next(gesture({ speed: 0.26, sharpness: 0.05 }))

    expect(event.role).toBe('rest')
    expect(event.note).toBeUndefined()
    expect(event.velocity).toBe(0)
  })

  it('uses stillness for long pad or drone events', () => {
    const engine = new MelodyEngine(STYLE_PRESETS.peaceful, () => 0.9)
    const event = engine.next(gesture({ speed: 0.02, sharpness: 0.02, articulation: 'legato' }))

    expect(event.role).toBe('pad')
    expect(event.duration).toBe('1n')
    expect(event.articulation).toBe('legato')
  })

  it('uses sharp motion for bell accents', () => {
    const engine = new MelodyEngine(STYLE_PRESETS.mysterious, () => 0.42)
    const event = engine.next(gesture({ speed: 0.84, sharpness: 0.88, articulation: 'staccato' }), 'swipe')

    expect(event.role).toBe('bell')
    expect(event.duration).toBe('2n')
    expect(event.velocity).toBeGreaterThan(0.5)
  })

  it('keeps watercolor motion sparse even with moderate movement', () => {
    const engine = new MelodyEngine(STYLE_PRESETS.peaceful, () => 0.5)
    const event = engine.next(gesture({ speed: 0.34, sharpness: 0.12 }))

    expect(event.role).toBe('rest')
    expect(event.duration).toBe('2n')
  })

  it('uses two hands for wider chord voicings', () => {
    const engine = new MelodyEngine(STYLE_PRESETS.peaceful, () => 0.8)
    const event = engine.next(gesture({ handCount: 2, size: 0.78, speed: 0.18 }))

    expect(event.role).toBe('chord')
    expect(event.wide).toBe(true)
    expect(event.harmony?.length).toBeGreaterThan(1)
  })

  it('turns circular gestures into slow arpeggio events', () => {
    const engine = new MelodyEngine(STYLE_PRESETS.mysterious, () => 0.5)
    const event = engine.next(gesture({ direction: 'up', speed: 0.32 }), 'circle')

    expect(event.role).toBe('arp')
    expect(event.motif.length).toBeGreaterThan(2)
    expect(event.note).toBeDefined()
  })
})
