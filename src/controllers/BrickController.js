const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function getState(req, res) {
    const { brick_id } = req.params;
    const user = req.user || null;

    const state = await prisma.brickPriceState.findUnique({
        where: { brickId: brick_id },
    });
    if (!state) {
        return res
            .status(404)
            .json({ success: false, message: "Brick not found" });
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

module.exports = { getState };
