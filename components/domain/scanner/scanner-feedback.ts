/**
 * Web Audio and Haptic feedback engine for shop floor devices
 */

export type FeedbackTone = 'scan' | 'success' | 'warning' | 'error'

export function playAudioFeedback(type: FeedbackTone) {
  if (typeof window === 'undefined') return
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext
    if (!AudioContextClass) return

    const ctx = new AudioContextClass()
    if (ctx.state === 'suspended') {
      void ctx.resume()
    }

    if (type === 'scan') {
      // Crisp 880Hz sine chime (positive scan acknowledgement)
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(880, ctx.currentTime)
      gain.gain.setValueAtTime(0.15, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.1)
    } else if (type === 'success') {
      // Ascending two-tone harmonic confirmation
      const osc1 = ctx.createOscillator()
      const osc2 = ctx.createOscillator()
      const gain = ctx.createGain()
      osc1.type = 'sine'
      osc2.type = 'sine'
      osc1.frequency.setValueAtTime(523.25, ctx.currentTime) // C5
      osc1.frequency.setValueAtTime(659.25, ctx.currentTime + 0.08) // E5
      osc2.frequency.setValueAtTime(659.25, ctx.currentTime) // E5
      osc2.frequency.setValueAtTime(783.99, ctx.currentTime + 0.08) // G5
      gain.gain.setValueAtTime(0.18, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22)
      osc1.connect(gain)
      osc2.connect(gain)
      gain.connect(ctx.destination)
      osc1.start()
      osc2.start()
      osc1.stop(ctx.currentTime + 0.22)
      osc2.stop(ctx.currentTime + 0.22)
    } else if (type === 'warning') {
      // Urgent alternating dual-pitch alert for blocking obsolete revision
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'square'
      osc.frequency.setValueAtTime(880, ctx.currentTime)
      osc.frequency.setValueAtTime(440, ctx.currentTime + 0.1)
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.2)
      gain.gain.setValueAtTime(0.2, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.35)
    } else if (type === 'error') {
      // Low sawtooth buzz for rejection
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(180, ctx.currentTime)
      gain.gain.setValueAtTime(0.2, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.2)
    }
  } catch {
    // Autoplay restrictions or unavailable audio hardware
  }
}

export function triggerHaptic(type: FeedbackTone) {
  if (typeof navigator === 'undefined' || !navigator.vibrate) return
  try {
    if (type === 'scan') {
      navigator.vibrate(50)
    } else if (type === 'success') {
      navigator.vibrate([60, 40, 60])
    } else if (type === 'warning') {
      navigator.vibrate([200, 100, 200, 100, 200])
    } else if (type === 'error') {
      navigator.vibrate([150, 80, 150])
    }
  } catch {
    // Unsupported vibration API
  }
}
