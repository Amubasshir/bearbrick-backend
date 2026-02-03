const FreezeService = require("./FreezeService");

/**
 * Enter recheck: stale confidence >21d, freeze timeout, weak participation, conflicting signals. Clarifications §3.
 */
async function shouldEnterRecheck(prisma, state) {
  if (state.lastConfidenceTimestamp) {
    const days =
      (Date.now() - new Date(state.lastConfidenceTimestamp)) /
      (24 * 60 * 60 * 1000);
    if (days > 21) return true;
  }
  if (
    state.freezeMode &&
    state.freezeUntil &&
    new Date() > new Date(state.freezeUntil)
  ) {
    return true;
  }
  const lastVote = await prisma.voteEvent.findFirst({
    where: { brickId: state.brickId },
    orderBy: { createdAt: "desc" },
  });
  if (lastVote) {
    const daysSince =
      (Date.now() - new Date(lastVote.createdAt)) / (24 * 60 * 60 * 1000);
    if (daysSince > 7 && Number(state.weightedTotal) < 10) return true;
  }
  const pFair = Number(state.pFair);
  const pUnder = Number(state.pUnder);
  const pOver = Number(state.pOver);
  if (pFair < 0.4 && pUnder > 0.3 && pOver > 0.3) return true;
  return false;
}

function enterRecheck(state) {
  const updates = { needsRecheck: true };
  if (state.freezeMode) {
    Object.assign(updates, FreezeService.exitFreeze());
  }
  return updates;
}

module.exports = { shouldEnterRecheck, enterRecheck };
