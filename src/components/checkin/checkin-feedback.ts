import type { CheckInOutcome } from "@/lib/checkin";

let audioContext: AudioContext | null = null;

function beep(frequency: number, startAt: number, duration: number) {
  if (!audioContext) return;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0.2, startAt);
  gain.gain.exponentialRampToValueAtTime(0.001, startAt + duration);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration);
}

export function unlockAudio() {
  if (typeof window === "undefined" || !("AudioContext" in window)) return;
  audioContext ??= new AudioContext();
  void audioContext.resume();
}

export function playFeedback(outcome: CheckInOutcome) {
  const valid = outcome === "VALID";
  navigator.vibrate?.(valid ? 120 : [90, 60, 90]);
  if (!audioContext) return;
  const now = audioContext.currentTime;
  if (valid) {
    beep(1320, now, 0.15);
    return;
  }
  beep(330, now, 0.18);
  beep(330, now + 0.24, 0.18);
}
