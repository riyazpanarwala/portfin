// ── monte-carlo-engine.js — PRNG, Gaussian random, MC constants ──────

const MC_SIMS  = 500;
const MC_CHUNK = 50;   // sims per RAF frame — tune if needed
const MC_SIGMA = 0.18;

function _mcPRNG(seed) {
  let s = seed | 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function _randn(rand) {
  let u, v;
  do { u = rand(); v = rand(); } while (u === 0);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
