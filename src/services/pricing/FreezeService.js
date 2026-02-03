const pricing = require("../../../config/pricing");

/**
 * Enter freeze: p_fair >= 0.55 AND weighted_total >= 20. Spec §23.
 */
function shouldEnterFreeze(state) {
  const pFair = Number(state.pFair);
  const wt = Number(state.weightedTotal);
  return (
    pFair >= pricing.freeze_fair_pct && wt >= pricing.freeze_min_weighted_total
  );
}

function enterFreeze(state) {
  const minDays = pricing.freeze_duration_days_min;
  const maxDays = pricing.freeze_duration_days_max;
  const freezeDays =
    minDays + Math.floor(Math.random() * (maxDays - minDays + 1));
  const until = new Date();
  until.setDate(until.getDate() + freezeDays);
  return {
    freezeMode: true,
    freezeUntil: until,
  };
}

function shouldExitFreeze(state) {
  if (!state.freezeMode) return false;
  if (state.needsRecheck) return true;
  if (state.freezeUntil && new Date() > new Date(state.freezeUntil)) {
    return true;
  }
  return false;
}

function exitFreeze() {
  return { freezeMode: false, freezeUntil: null };
}

module.exports = {
  shouldEnterFreeze,
  enterFreeze,
  shouldExitFreeze,
  exitFreeze,
};
