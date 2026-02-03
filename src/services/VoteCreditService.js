const pricing = require("../../config/pricing");

/**
 * Vote credit service - check/consume/regain credits per user×brick.
 * Matches Laravel VoteCreditService.
 */
async function getCredits(tx, userId, brickId) {
  let credits = await tx.userBrickVoteCredit.findUnique({
    where: { userId_brickId: { userId, brickId } },
  });
  if (!credits) {
    credits = await tx.userBrickVoteCredit.create({
      data: {
        userId,
        brickId,
        creditsRemaining: pricing.vote_credits_max,
      },
    });
  }
  return credits;
}

function hasCredits(credits) {
  return credits.creditsRemaining > 0;
}

/**
 * Check and handle credit regain (price moved ≥7% or brick needs_recheck).
 */
async function checkCreditRegain(tx, userId, brickId, state) {
  const credits = await getCredits(tx, userId, brickId);
  if (credits.creditsRemaining > 0) return;

  const livePrice = Number(state.livePrice);
  const regainPct = pricing.credit_regain_move_pct;

  if (credits.lastVotePrice != null && Number(credits.lastVotePrice) > 0) {
    const lastPrice = Number(credits.lastVotePrice);
    const movePct = Math.abs(livePrice - lastPrice) / lastPrice;
    if (movePct >= regainPct) {
      const lastRegain = credits.lastCreditRegainPrice
        ? Number(credits.lastCreditRegainPrice)
        : null;
      if (
        lastRegain == null ||
        lastRegain === 0 ||
        Math.abs(livePrice - lastRegain) / lastRegain >= regainPct
      ) {
        await regainCredit(tx, userId, brickId, livePrice);
        return;
      }
    }
  }

  if (state.needsRecheck) {
    await regainCredit(tx, userId, brickId, livePrice);
  }
}

async function regainCredit(tx, userId, brickId, currentPrice) {
  await tx.userBrickVoteCredit.update({
    where: { userId_brickId: { userId, brickId } },
    data: {
      creditsRemaining: 1,
      lastCreditRegainPrice: currentPrice,
      lastCreditRegainAt: new Date(),
    },
  });
}

async function consumeCredit(tx, userId, brickId, livePriceAtVote, cycleId) {
  const credits = await getCredits(tx, userId, brickId);
  if (credits.creditsRemaining <= 0) throw new Error("No credits available");
  await tx.userBrickVoteCredit.update({
    where: { userId_brickId: { userId, brickId } },
    data: {
      creditsRemaining: credits.creditsRemaining - 1,
      lastVotePrice: livePriceAtVote,
      lastVoteCycleId: cycleId,
      lastVoteAt: new Date(),
    },
  });
}

module.exports = {
  getCredits,
  hasCredits,
  checkCreditRegain,
  consumeCredit,
};
