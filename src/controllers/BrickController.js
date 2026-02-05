const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function getAllBricks(req, res) {
  const user = req.user || null;

  const allStates = await prisma.brickPriceState.findMany({
    orderBy: { createdAt: "asc" },
  });

  // Get all vote events for this user (if authenticated) to check which bricks they've voted on
  let userVotedBricks = new Set();
  if (user) {
    const userVotes = await prisma.voteEvent.findMany({
      where: { userId: user.id },
      select: { brickId: true },
      distinct: ["brickId"],
    });
    userVotedBricks = new Set(userVotes.map((v) => v.brickId));
  }

  // Get last event ID for each brick
  const brickIds = allStates.map((s) => s.brickId);
  const lastEvents = await prisma.voteEvent.groupBy({
    by: ["brickId"],
    where: { brickId: { in: brickIds } },
    _max: { id: true },
  });
  const lastEventMap = new Map(lastEvents.map((e) => [e.brickId, e._max.id]));

  const bricks = allStates.map((state) => {
    const livePrice = Number(state.livePrice);
    const hasVoted = user ? userVotedBricks.has(state.brickId) : false;

    const brickData = {
      brick_id: state.brickId,
      live_price: livePrice,
      fair_lower: livePrice * 0.95,
      fair_upper: livePrice * 1.05,
      freeze_mode: state.freezeMode,
      current_cycle_id: state.currentCycleId,
      last_price_update: state.lastPriceUpdate,
      last_vote_event_id_processed: lastEventMap.get(state.brickId)
        ? Number(lastEventMap.get(state.brickId))
        : 0,
    };

    // Include sentiment only if user has voted
    if (hasVoted) {
      brickData.p_under = state.pUnder;
      brickData.p_fair = state.pFair;
      brickData.p_over = state.pOver;
      brickData.pricing_confidence_c = state.pricingConfidenceC;
    }

    return brickData;
  });

  res.json({ success: true, data: bricks });
}

async function getState(req, res) {
  const { brick_id } = req.params;
  const user = req.user || null;

  const state = await prisma.brickPriceState.findUnique({
    where: { brickId: brick_id },
  });
  if (!state) {
    return res.status(404).json({ success: false, message: "Brick not found" });
  }

  let hasVoted = false;
  if (user) {
    const voted = await prisma.voteEvent.findFirst({
      where: { brickId: brick_id, userId: user.id },
    });
    hasVoted = !!voted;
  }

  const lastEvent = await prisma.voteEvent.findFirst({
    where: { brickId: brick_id },
    orderBy: { id: "desc" },
  });

  const livePrice = Number(state.livePrice);
  const response = {
    brick_id: state.brickId,
    live_price: livePrice,
    fair_lower: livePrice * 0.95,
    fair_upper: livePrice * 1.05,
    freeze_mode: state.freezeMode,
    current_cycle_id: state.currentCycleId,
    last_price_update: state.lastPriceUpdate,
    last_vote_event_id_processed: lastEvent ? Number(lastEvent.id) : 0,
  };
  if (hasVoted) {
    response.p_under = state.pUnder;
    response.p_fair = state.pFair;
    response.p_over = state.pOver;
    response.pricing_confidence_c = state.pricingConfidenceC;
  }

  res.json({ success: true, data: response });
}

module.exports = { getAllBricks, getState };
