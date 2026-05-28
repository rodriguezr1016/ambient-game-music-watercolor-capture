import { instrument, type Player } from 'soundfont-player'
import type { MelodyEvent, StyleId } from '../music/types'

type SoundscapeNodes = {
  master: GainNode
  pianoBus: GainNode
  bellBus: GainNode
  padBus: GainNode
  textureBus: GainNode
  delay: DelayNode
  feedback: GainNode
  delayReturn: GainNode
  lowpass: BiquadFilterNode
}

type PlayerWithBuffers = Player & {
  buffers?: Record<string, AudioBuffer>
  name?: string
}

export type SoundscapeLoadReport = {
  ready: boolean
  instruments: Array<{
    role: string
    name: string
    sampleCount: number
    missingProbes: string[]
  }>
}

const NOTE_TO_PC: Record<string, number> = {
  C: 0,
  'C#': 1,
  Db: 1,
  D: 2,
  'D#': 3,
  Eb: 3,
  E: 4,
  F: 5,
  'F#': 6,
  Gb: 6,
  G: 7,
  'G#': 8,
  Ab: 8,
  A: 9,
  'A#': 10,
  Bb: 10,
  B: 11,
}

export class AmbientSoundscape {
  private context?: AudioContext
  private nodes?: SoundscapeNodes
  private piano?: PlayerWithBuffers
  private bell?: PlayerWithBuffers
  private harp?: PlayerWithBuffers
  private strings?: PlayerWithBuffers
  private activeNodes: AudioNode[] = []
  private textureSource?: AudioBufferSourceNode
  private fadeToken = 0
  private style: StyleId = 'peaceful'

  async start(style: StyleId): Promise<SoundscapeLoadReport> {
    this.dispose()
    this.style = style
    this.context = new AudioContext()
    await this.context.resume()
    this.nodes = this.createNodes(this.context, style)

    const common = {
      soundfont: 'MusyngKite',
      format: 'mp3',
      attack: 0.035,
      decay: 0.22,
      sustain: 0.66,
      release: 2.3,
    }

    const [piano, bell, harp, strings] = await Promise.all([
      instrument(this.context, 'acoustic_grand_piano', {
        ...common,
        destination: this.nodes.pianoBus,
        gain: style === 'peaceful' ? 0.34 : 0.3,
      }),
      instrument(this.context, style === 'peaceful' ? 'celesta' : 'music_box', {
        ...common,
        destination: this.nodes.bellBus,
        gain: style === 'peaceful' ? 0.32 : 0.3,
        attack: 0.006,
        release: 3.2,
      }),
      instrument(this.context, 'orchestral_harp', {
        ...common,
        destination: this.nodes.pianoBus,
        gain: 0.22,
        release: 2.6,
      }),
      instrument(this.context, style === 'peaceful' ? 'string_ensemble_1' : 'choir_aahs', {
        ...common,
        destination: this.nodes.padBus,
        gain: style === 'peaceful' ? 0.2 : 0.18,
        attack: 0.28,
        release: 4.2,
      }),
    ])

    this.piano = piano as PlayerWithBuffers
    this.bell = bell as PlayerWithBuffers
    this.harp = harp as PlayerWithBuffers
    this.strings = strings as PlayerWithBuffers
    this.startTexture()

    return this.createLoadReport()
  }

  play(event: MelodyEvent, seconds: number) {
    if (!this.context || !this.nodes || !this.piano || !this.bell || !this.harp || !this.strings) return

    const now = this.context.currentTime + (Math.random() - 0.5) * 0.025
    this.applyEventMix(event, now)

    if (event.role === 'rest') {
      this.activeNodes = this.activeNodes.slice(-80)
      return
    }

    if (event.role === 'pad' || event.role === 'chord') {
      this.playPad(event, now, seconds)
      this.playChordColor(event, now, seconds)
      return
    }

    if (event.role === 'bell') {
      this.safePlay(this.bell, event.note, now, {
        duration: Math.min(seconds * 2.1, 3.8),
        gain: event.velocity * 0.9,
        attack: 0.008,
        release: 3.4,
      })
      this.playHarmony(event, now + 0.035, seconds, 0.24)
      return
    }

    if (event.role === 'arp') {
      this.safePlay(this.harp, event.note, now, {
        duration: Math.min(seconds * 1.8, 3.4),
        gain: event.velocity * 0.7,
        attack: 0.018,
        release: 2.7,
      })
      return
    }

    this.safePlay(this.piano, event.note, now, {
      duration: Math.min(seconds * 1.9, 5.2),
      gain: event.velocity * 0.76,
      attack: 0.04,
      release: 3.2,
    })
    this.playHarmony(event, now + 0.045, seconds, 0.18)
    this.activeNodes = this.activeNodes.slice(-80)
  }

  dispose() {
    this.fadeToken += 1
    this.piano?.stop()
    this.bell?.stop()
    this.harp?.stop()
    this.strings?.stop()
    this.textureSource?.stop()
    this.activeNodes = []
    this.context?.close()
    this.context = undefined
    this.nodes = undefined
    this.piano = undefined
    this.bell = undefined
    this.harp = undefined
    this.strings = undefined
    this.textureSource = undefined
  }

  async fadeOut(seconds = 2.4) {
    const token = (this.fadeToken += 1)
    const context = this.context
    const nodes = this.nodes
    if (!context || !nodes) return

    const now = context.currentTime
    nodes.master.gain.cancelScheduledValues(now)
    nodes.master.gain.setValueAtTime(nodes.master.gain.value, now)
    nodes.master.gain.linearRampToValueAtTime(0.0001, now + seconds)

    await new Promise((resolve) => window.setTimeout(resolve, seconds * 1000 + 120))
    if (token === this.fadeToken) {
      this.dispose()
    }
  }

  private createNodes(context: AudioContext, style: StyleId): SoundscapeNodes {
    const master = context.createGain()
    const pianoBus = context.createGain()
    const bellBus = context.createGain()
    const padBus = context.createGain()
    const textureBus = context.createGain()
    const delay = context.createDelay(6)
    const feedback = context.createGain()
    const delayReturn = context.createGain()
    const lowpass = context.createBiquadFilter()

    master.gain.value = 0.66
    pianoBus.gain.value = 0.48
    bellBus.gain.value = 0.34
    padBus.gain.value = 0.42
    textureBus.gain.value = 0
    delay.delayTime.value = style === 'peaceful' ? 0.88 : 1.12
    feedback.gain.value = style === 'peaceful' ? 0.4 : 0.48
    delayReturn.gain.value = style === 'peaceful' ? 0.34 : 0.42
    lowpass.type = 'lowpass'
    lowpass.frequency.value = style === 'peaceful' ? 4200 : 2900

    pianoBus.connect(master)
    pianoBus.connect(delay)
    bellBus.connect(master)
    bellBus.connect(delay)
    padBus.connect(master)
    padBus.connect(delay)
    textureBus.connect(master)
    delay.connect(delayReturn)
    delay.connect(feedback)
    feedback.connect(delay)
    delayReturn.connect(master)
    master.connect(lowpass)
    lowpass.connect(context.destination)

    return { master, pianoBus, bellBus, padBus, textureBus, delay, feedback, delayReturn, lowpass }
  }

  private playPad(event: MelodyEvent, time: number, seconds: number) {
    if (!this.context || !this.nodes) return

    const notes = [event.midi, ...(event.harmony ?? []).map((note) => this.noteNameToMidi(note))]
      .filter((note): note is number => typeof note === 'number' && note > 0)
      .slice(0, event.wide ? 4 : 3)
    const duration = Math.max(seconds * 1.2, 2.4)

    notes.forEach((midi, index) => {
      const oscillator = this.context!.createOscillator()
      const gain = this.context!.createGain()
      oscillator.type = index % 2 === 0 ? 'sine' : 'triangle'
      oscillator.frequency.value = 440 * 2 ** ((midi - 69) / 12)
      gain.gain.setValueAtTime(0.0001, time)
      gain.gain.linearRampToValueAtTime((0.016 + event.texture * 0.064) / Math.max(1, notes.length), time + 0.52)
      gain.gain.exponentialRampToValueAtTime(0.0001, time + duration)
      oscillator.connect(gain)
      gain.connect(this.nodes!.padBus)
      oscillator.start(time)
      oscillator.stop(time + duration + 0.1)
      this.activeNodes.push(oscillator)
    })
  }

  private playChordColor(event: MelodyEvent, time: number, seconds: number) {
    const colorNotes = [event.note, ...(event.harmony ?? [])].filter(Boolean).slice(0, event.wide ? 4 : 2) as string[]
    colorNotes.forEach((note, index) => {
      this.safePlay(this.strings, note, time + index * 0.08, {
        duration: Math.min(seconds * 1.85, 6.2),
        gain: event.velocity * (index === 0 ? 0.38 : 0.22),
        attack: 0.32,
        release: 4.4,
      })
    })
  }

  private playHarmony(event: MelodyEvent, time: number, seconds: number, gain: number) {
    ;(event.harmony ?? []).slice(0, event.wide ? 2 : 1).forEach((note, index) => {
      this.safePlay(this.piano, note, time + index * 0.05, {
        duration: Math.min(seconds * 1.55, 4.6),
        gain: event.velocity * gain * 0.82,
        attack: 0.04,
        release: 3.1,
      })
    })
  }

  private applyEventMix(event: MelodyEvent, time: number) {
    if (!this.nodes) return
    this.nodes.padBus.gain.setTargetAtTime(0.12 + event.texture * 0.5, time, 0.26)
    this.nodes.pianoBus.gain.setTargetAtTime(event.role === 'melody' ? 0.58 : event.role === 'arp' ? 0.5 : 0.28, time, 0.18)
    this.nodes.bellBus.gain.setTargetAtTime(event.role === 'bell' ? 0.58 : 0.2, time, 0.16)
    this.nodes.textureBus.gain.setTargetAtTime((this.style === 'peaceful' ? 0.01 : 0.018) + event.texture * 0.032, time, 0.8)
    this.nodes.delayReturn.gain.setTargetAtTime((this.style === 'peaceful' ? 0.22 : 0.3) + event.texture * 0.2, time, 0.48)
  }

  private startTexture() {
    if (!this.context || !this.nodes) return
    const length = this.context.sampleRate * 4
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate)
    const data = buffer.getChannelData(0)
    for (let index = 0; index < length; index += 1) {
      data[index] = (Math.random() * 2 - 1) * 0.22
    }

    const source = this.context.createBufferSource()
    const filter = this.context.createBiquadFilter()
    source.buffer = buffer
    source.loop = true
    filter.type = 'bandpass'
    filter.frequency.value = this.style === 'peaceful' ? 900 : 620
    filter.Q.value = 0.55
    source.connect(filter)
    filter.connect(this.nodes.textureBus)
    source.start()
    this.textureSource = source
  }

  private safePlay(player: PlayerWithBuffers | undefined, note: string | undefined, time: number, options: Record<string, number>) {
    if (!player || !note) return
    const node = player.play(note, time, options) as unknown as AudioNode | undefined
    if (node) {
      this.activeNodes.push(node)
    }
  }

  private createLoadReport(): SoundscapeLoadReport {
    const instruments = [
      this.inspectInstrument('piano', this.piano, ['C4', 'E4', 'A4']),
      this.inspectInstrument('bell', this.bell, ['C5', 'E5', 'A5']),
      this.inspectInstrument('harp', this.harp, ['C4', 'G4', 'A4']),
      this.inspectInstrument('pad', this.strings, ['C3', 'E3', 'A3']),
    ]

    return {
      ready: instruments.every((item) => item.sampleCount > 0),
      instruments,
    }
  }

  private inspectInstrument(role: string, player?: PlayerWithBuffers, probes: string[] = []) {
    const buffers = player?.buffers ?? {}
    const sampleKeys = Object.keys(buffers)
    const missingProbes = probes.filter((probe) => !buffers[String(this.noteNameToMidi(probe))])

    return {
      role,
      name: player?.name ?? 'not loaded',
      sampleCount: sampleKeys.length,
      missingProbes,
    }
  }

  private noteNameToMidi(noteName: string) {
    const match = /^([A-G](?:#|b)?)(-?\d+)$/.exec(noteName)
    if (!match) return -1
    return 12 * (Number(match[2]) + 1) + NOTE_TO_PC[match[1]]
  }
}
