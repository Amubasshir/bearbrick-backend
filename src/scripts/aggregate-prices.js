/**
 * Worker: vote_events -> brick_price_state (spec Appendix B - Price Aggregator)
 * Run: node src/scripts/aggregate-prices.js
 */
require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const BATCH = 500;

const SentimentService = require("../services/pricing/SentimentService");
const ConfidenceService = require("../services/pricing/ConfidenceService");
const ReliabilityService = require("../services/pricing/ReliabilityService");
const MovementEligibilityService = require("../services/pricing/MovementEligibilityService");
const IntensityService = require("../services/pricing/IntensityService");
const CapService = require("../services/pricing/CapService");
const MomentumService = require("../services/pricing/MomentumService");
const AnchorService = require("../services/pricing/AnchorService");
const CycleService = require("../services/pricing/CycleService");
const FreezeService = require("../services/pricing/FreezeService");
const OrderAwareService = require("../services/pricing/OrderAwareService");
const RecheckService = require("../services/pricing/RecheckService");

async function getCursor() {
  const c = await prisma.workerCursor.upsert({
    where: { workerName: "price_aggregator" },
    update: {},
    create: { workerName: "price_aggregator", lastProcessedId: 0 },
  });
  return Number(c.lastProcessedId);
}

async function updateCursor(id) {
  await prisma.workerCursor.upsert({
    where: { workerName: "price_aggregator" },
    update: { lastProcessedId: id },
    create: { workerName: "price_aggregator", lastProcessedId: id },
  });
}

async function processEvent(ev) {
  let state = await prisma.brickPriceState.findFirst({
    where: { brickId: ev.brickId },
  });
  if (!state) {
    state = await prisma.brickPriceState.create({
      data: {
        brickId: ev.brickId,
        livePrice: ev.livePriceAtVote,
        currentCycleId: ev.cycleId,
        cycleStartPrice: ev.livePriceAtVote,
        cycleStartedAt: new Date(),
      },
    });
  }

  if (ev.cycleId !== state.currentCycleId) return;
  if (state.freezeMode) return;

  const w = Number(ev.userWeightAtVote);
  let weightedUnder =
    Number(state.weightedUnder) + (ev.voteType === "UNDER" ? w : 0);
  let weightedFair =
    Number(state.weightedFair) + (ev.voteType === "FAIR" ? w : 0);
  let weightedOver =
    Number(state.weightedOver) + (ev.voteType === "OVER" ? w : 0);
  let weightedTotal = weightedUnder + weightedFair + weightedOver;
  let weightedSinceLastMove = Number(state.weightedSinceLastMove) + w;

  const sentiment = SentimentService.calculateSentiment(
    weightedUnder,
    weightedFair,
    weightedOver,
  );
  const pUnder = sentiment.p_under;
  const pFair = sentiment.p_fair;
  const pOver = sentiment.p_over;
  const pricingConfidenceC =
    ConfidenceService.calculatePricingConfidence(weightedTotal);
  const reliabilityScoreR =
    ReliabilityService.calculateReliabilityScore(weightedTotal);

  const eligible = MovementEligibilityService.isEligibleForMovement({
    weightedTotal,
    weightedSinceLastMove,
    freezeMode: state.freezeMode,
  });
  const dominant = SentimentService.getDominantDirection(pUnder, pOver);
  const dominantPct = SentimentService.getDominantPct(pUnder, pOver);
  const direction =
    dominant === "OVER" ? "UP" : dominant === "UNDER" ? "DOWN" : "NONE";

  const stateForEligibility = {
    weightedTotal,
    weightedSinceLastMove,
    freezeMode: state.freezeMode,
  };

  if (!eligible || direction === "NONE") {
    await prisma.brickPriceState.update({
      where: { brickId: ev.brickId },
      data: {
        weightedUnder,
        weightedFair,
        weightedOver,
        weightedTotal,
        weightedSinceLastMove,
        pUnder,
        pFair,
        pOver,
        pricingConfidenceC,
        reliabilityScoreR,
        lastPriceUpdate: new Date(),
      },
    });
    return;
  }

  const fairLower = Number(ev.fairRangeLower);
  const fairUpper = Number(ev.fairRangeUpper);
  const anchorPrice = AnchorService.calculateAnchorPrice(
    dominant,
    fairLower,
    fairUpper,
  );
  const moveSign = AnchorService.getMoveSign(dominant);
  const baseStep = ev.baseStepAtVote;

  const intensityData = IntensityService.calculateIntensityAndStep(
    pUnder,
    pOver,
    pricingConfidenceC,
    baseStep,
  );
  const rawStep = intensityData.raw_step;

  const uniqueVoters = await OrderAwareService.uniqueVotersInCycle(
    prisma,
    ev.brickId,
    state.currentCycleId,
  );
  const catchupEnabled = await OrderAwareService.isCatchupEnabled(
    prisma,
    ev.brickId,
    state.currentCycleId,
    direction,
    weightedTotal,
    uniqueVoters,
    dominantPct,
  );

  const finalStep = CapService.applyCaps(
    rawStep,
    baseStep,
    anchorPrice,
    weightedTotal,
    pricingConfidenceC,
    catchupEnabled,
  );

  const momentumResult = MomentumService.handleMomentum(
    Number(state.momentumScore),
    direction,
  );
  const didMove = momentumResult.did_move;
  const newMomentum = momentumResult.momentum_score;

  let newLivePrice = Number(state.livePrice);
  let newWeightedSinceLastMove = weightedSinceLastMove;

  if (didMove) {
    newLivePrice = Math.max(0, anchorPrice + moveSign * finalStep);
    newWeightedSinceLastMove = 0;
  }

  let updates = {
    weightedUnder,
    weightedFair,
    weightedOver,
    weightedTotal,
    weightedSinceLastMove: newWeightedSinceLastMove,
    pUnder,
    pFair,
    pOver,
    pricingConfidenceC,
    reliabilityScoreR,
    momentumScore: newMomentum,
    lastPriceUpdate: new Date(),
    livePrice: newLivePrice,
  };

  const stateAfterMove = {
    ...state,
    ...updates,
    freezeMode: state.freezeMode,
    needsRecheck: state.needsRecheck,
    freezeUntil: state.freezeUntil,
  };

  if (state.freezeMode && FreezeService.shouldExitFreeze(stateAfterMove)) {
    Object.assign(updates, FreezeService.exitFreeze());
  }

  if (await RecheckService.shouldEnterRecheck(prisma, stateAfterMove)) {
    Object.assign(updates, RecheckService.enterRecheck(stateAfterMove));
  }

  if (
    !state.freezeMode &&
    !updates.needsRecheck &&
    FreezeService.shouldEnterFreeze(stateAfterMove)
  ) {
    Object.assign(updates, FreezeService.enterFreeze(stateAfterMove));
  }

  if (
    !state.freezeMode &&
    !updates.freezeMode &&
    CycleService.shouldResetCycle(
      { ...stateAfterMove, weightedTotal, livePrice: newLivePrice },
      uniqueVoters,
    )
  ) {
    const resetUpdates = CycleService.resetCycle({
      ...stateAfterMove,
      livePrice: newLivePrice,
      weightedTotal,
    });
    Object.assign(updates, resetUpdates);
  }

  await prisma.brickPriceState.update({
    where: { brickId: ev.brickId },
    data: updates,
  });
}

async function main() {
  const cursor = await getCursor();
  const events = await prisma.voteEvent.findMany({
    where: { id: { gt: cursor } },
    orderBy: { id: "asc" },
    take: BATCH,
  });
  if (events.length === 0) {
    console.log("No vote events to process.");
    return;
  }
  let processed = 0;
  for (const ev of events) {
    try {
      await processEvent(ev);
      processed++;
    } catch (e) {
      console.error("Error event", ev.id, e.message);
    }
    await updateCursor(Number(ev.id));
  }
  console.log("Processed", processed, "vote events.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
