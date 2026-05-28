import { closestMidiForNote, clampMidiToRange, midiToNote, noteNameFromMidi } from './notes'
import type { AmbientRole, Chord, GestureFeatures, MelodyEvent, RhythmValue, StylePreset } from './types'

type Random = () => number
type AmbientIntent = 'none' | 'swipe' | 'circle'

const rhythmSeconds: Record<RhythmValue, number> = {
  '8n': 0.5,
  '4n': 1,
  '2n': 2,
  '1n': 4,
}

const weightedPick = <T,>(items: Array<[T, number]>, random: Random): T => {
  const total = items.reduce((sum, [, weight]) => sum + weight, 0)
  let cursor = random() * total
  for (const [item, weight] of items) {
    cursor -= weight
    if (cursor <= 0) return item
  }
  return items[items.length - 1][0]
}

export function secondsForRhythm(duration: RhythmValue, tempo: number) {
  return rhythmSeconds[duration] * (60 / tempo)
}

export class MelodyEngine {
  private chordIndex = 0
  private lastMidi = 60
  private motif: number[] = []
  private phraseStep = 0
  private arpStepsLeft = 0

  constructor(
    private preset: StylePreset,
    private random: Random = Math.random,
  ) {}

  setPreset(preset: StylePreset) {
    this.preset = preset
    this.chordIndex = 0
    this.lastMidi = preset.id === 'mysterious' ? 57 : 60
    this.motif = []
    this.phraseStep = 0
    this.arpStepsLeft = 0
  }

  next(gesture: GestureFeatures, intent: AmbientIntent = 'none'): MelodyEvent {
    const chord = this.preset.chords[this.chordIndex]
    const role = this.roleFor(gesture, intent)
    const duration = this.rhythmFor(gesture, role)
    const velocity = this.velocityFor(gesture, role)
    const texture = Math.min(1, 0.18 + gesture.size * 0.58 + gesture.speed * 0.18 + gesture.sharpness * 0.12)
    const wide = gesture.handCount > 1 || gesture.size > 0.62

    if (intent === 'circle') {
      this.arpStepsLeft = 8
      this.motif = this.createArp(chord, gesture)
    }

    if (role === 'rest') {
      this.advance(role)
      return {
        duration,
        velocity: 0,
        articulation: 'legato',
        chord,
        motif: this.motif.map((note) => midiToNote(note)),
        role,
        texture,
        wide,
      }
    }

    const midi = this.midiFor(role, chord, gesture)
    const harmony = this.harmonyFor(midi, chord, wide)
    this.lastMidi = midi
    this.advance(role)

    return {
      note: midiToNote(midi),
      midi,
      duration,
      velocity,
      articulation: role === 'bell' ? 'staccato' : role === 'pad' || role === 'chord' ? 'legato' : gesture.articulation,
      chord,
      motif: this.motif.map((note) => midiToNote(note)),
      harmony,
      role,
      texture,
      wide,
    }
  }

  private roleFor(gesture: GestureFeatures, intent: AmbientIntent): AmbientRole {
    if (intent === 'circle' || this.arpStepsLeft > 0) return 'arp'
    if (intent === 'swipe' || gesture.sharpness > 0.78 || gesture.speed > 0.86) return 'bell'
    if (gesture.handCount < 1 || (gesture.speed < 0.16 && gesture.sharpness < 0.28)) return 'pad'
    if (gesture.handCount > 1 && gesture.size > 0.42 && this.random() > 0.12) return 'chord'
    if (this.random() < this.restChance(gesture)) return 'rest'
    return gesture.speed < 0.34 ? 'pad' : 'melody'
  }

  private restChance(gesture: GestureFeatures) {
    const density = Math.min(0.42, gesture.speed * 0.3 + gesture.sharpness * 0.14 + gesture.handCount * 0.025)
    return Math.max(0.38, 0.72 - density)
  }

  private rhythmFor(gesture: GestureFeatures, role: AmbientRole): RhythmValue {
    if (role === 'pad' || role === 'chord') return '1n'
    if (role === 'arp') return gesture.speed > 0.74 ? '4n' : '2n'
    if (role === 'bell') return '2n'
    if (gesture.speed < 0.42) return '2n'
    if (gesture.speed > 0.78) return '4n'
    return weightedPick(
      this.preset.rhythmBias.map((duration, index) => [duration, index === 0 ? 2 : 1]),
      this.random,
    )
  }

  private velocityFor(gesture: GestureFeatures, role: AmbientRole) {
    const base = role === 'pad' ? 0.16 : role === 'chord' ? 0.2 : role === 'bell' ? 0.26 : 0.22
    return Math.min(0.72, base + gesture.size * 0.28 + gesture.speed * 0.1 + gesture.sharpness * 0.14)
  }

  private midiFor(role: AmbientRole, chord: Chord, gesture: GestureFeatures) {
    const rangeMin = 46 + Math.round(gesture.height * 18)
    const rangeMax = rangeMin + (role === 'bell' ? 19 : role === 'arp' ? 17 : 14)

    if (role === 'arp' && this.motif.length) {
      const arpMidi = this.motif[this.phraseStep % this.motif.length]
      return this.snapToAllowedPool(clampMidiToRange(arpMidi, rangeMin, rangeMax), chord)
    }

    if (role === 'pad' || role === 'chord') {
      const colorTone = chord.notes[(this.phraseStep + (gesture.direction === 'up' ? 1 : 0)) % chord.notes.length]
      const padLift = Math.round(gesture.size * 4) + (gesture.direction === 'up' ? 2 : gesture.direction === 'down' ? -2 : 0)
      return this.snapToAllowedPool(closestMidiForNote(colorTone, rangeMin + 5 + padLift), chord)
    }

    const pool = [
      ...chord.notes.map((note) => [note, 6] as [string, number]),
      ...this.preset.scale.map((note) => [note, role === 'bell' ? 3 : 2] as [string, number]),
    ]
    const targetNote = weightedPick(pool, this.random)
    const target = closestMidiForNote(targetNote, this.lastMidi)
    const drift = gesture.direction === 'up' ? 3 : gesture.direction === 'down' ? -3 : Math.round((gesture.horizontal - 0.5) * 3)
    const stepLimit = role === 'bell' ? 7 : 3
    const gentleStep = this.constrainStep(this.lastMidi, target + drift, stepLimit)
    const heightTint = role === 'bell' ? Math.round(gesture.height * 5) : Math.round((gesture.height - 0.5) * 3)

    return this.snapToAllowedPool(clampMidiToRange(gentleStep + heightTint, rangeMin, rangeMax), chord)
  }

  private createArp(chord: Chord, gesture: GestureFeatures) {
    const base = 48 + Math.round(gesture.height * 14)
    const notes = chord.notes.flatMap((note, index) => [
      closestMidiForNote(note, base + index * 2),
      closestMidiForNote(note, base + 7 + index * 2),
    ])
    return notes
      .map((note) => this.snapToAllowedPool(note, chord))
      .sort((a, b) => (gesture.direction === 'down' ? b - a : a - b))
      .slice(0, 6)
  }

  private harmonyFor(midi: number, chord: Chord, wide: boolean) {
    const intervals = wide ? [-12, -7, 5, 12] : [-5]
    return intervals.map((interval) => midiToNote(this.snapToAllowedPool(midi + interval, chord)))
  }

  private constrainStep(from: number, target: number, maxStep: number) {
    const distance = target - from
    if (Math.abs(distance) <= maxStep) return target
    return from + Math.sign(distance) * maxStep
  }

  private snapToAllowedPool(midi: number, chord: Chord) {
    const allowedNames = new Set([...chord.notes, ...this.preset.scale])
    const candidates = Array.from({ length: 25 }, (_, index) => midi - 12 + index)
      .filter((candidate) => allowedNames.has(noteNameFromMidi(candidate)))
      .sort((a, b) => Math.abs(a - midi) - Math.abs(b - midi))

    return candidates[0] ?? midi
  }

  private advance(role: AmbientRole) {
    this.phraseStep += 1
    if (role === 'arp') this.arpStepsLeft = Math.max(0, this.arpStepsLeft - 1)
    if (this.phraseStep % 4 === 0) {
      this.chordIndex = (this.chordIndex + 1) % this.preset.chords.length
    }
  }
}
