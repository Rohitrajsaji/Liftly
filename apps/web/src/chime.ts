// A soft two-note chime when rest is over. iPhone only plays sound from an audio context that a tap unlocked, so
// `unlockChime` runs on the set's tap and `chime` plays later. Vibrates too where the phone supports it.

let ctx: AudioContext | null = null;

export function unlockChime(): void {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AC === undefined) return;
    ctx ??= new AC();
    if (ctx.state === "suspended") void ctx.resume();
  } catch {
    // No sound on this device; the timer still shows Ready.
  }
}

export function chime(): void {
  try {
    navigator.vibrate?.([60, 80, 60]);
    if (ctx === null || ctx.state !== "running" || document.visibilityState !== "visible") return;
    const t = ctx.currentTime;
    for (const [i, freq] of [660, 880].entries()) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, t + i * 0.18);
      gain.gain.linearRampToValueAtTime(0.12, t + i * 0.18 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.18 + 0.5);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t + i * 0.18);
      osc.stop(t + i * 0.18 + 0.55);
    }
  } catch {
    // Ignore: sound is a nicety.
  }
}
