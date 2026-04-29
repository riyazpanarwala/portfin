// ── goal-state.js — Slider wiring, debounce, and shared state ──────

// Debounce timer for slider input
let _goalDebounceTimer = null;

// Token used to cancel an in-flight async MC run when params change
let _mcRunToken = null;

// Wire sliders once; debounce the heavy work
let _goalSlidersWired = false;
function _initGoalSliders() {
  if (_goalSlidersWired) return;
  ['goal-corpus', 'goal-year', 'goal-rate'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', _debouncedUpdateGoal);
  });
  _goalSlidersWired = true;
}

function _debouncedUpdateGoal() {
  clearTimeout(_goalDebounceTimer);
  _goalDebounceTimer = setTimeout(updateGoal, 180);
}
