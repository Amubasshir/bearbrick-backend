const pricing = require("../../../config/pricing");

/**
 * final_weight = clamp(age_weight × trust_multiplier × behavior_multiplier, 0, 1.25). Spec §9, CLARIFICATIONS.
 */
async function computeWeight(prisma, user, identity) {
  const ageWeight = baseAccountAgeWeight(user, identity);
  const trustMultiplier = trustTierMultiplier(identity);
  const behaviorMultiplier = behaviorMultiplierFromState(identity);
  let finalWeight = ageWeight * trustMultiplier * behaviorMultiplier;
  const minW = pricing.user_weight.min_weight;
  const maxW = pricing.user_weight.max_weight;
  return Math.max(minW, Math.min(maxW, finalWeight));
}

function baseAccountAgeWeight(user, identity) {
  const accountAgeDays =
    (Date.now() - new Date(user.createdAt)) / (24 * 60 * 60 * 1000);
  const maxAgeDays = pricing.user_weight.age_weight?.max_age_days ?? 365;
  const ageWeight = Math.min(1, accountAgeDays / maxAgeDays);
  return Math.max(0.1, ageWeight);
}

function trustTierMultiplier(identity) {
  const tierMap = {
    0: "UNTRUSTED",
    1: "PROBATION",
    2: "NEUTRAL",
    3: "RELIABLE",
    4: "PROVEN",
  };
  const name = tierMap[identity.trustTier] ?? "NEUTRAL";
  return pricing.trust_tier_multipliers[name] ?? 1;
}

function behaviorMultiplierFromState(identity) {
  const map = { NORMAL: 1, SUSPECT: 0.75, RESTRICTED: 0.5 };
  return map[identity.behaviorState] ?? 1;
}

module.exports = { computeWeight };
