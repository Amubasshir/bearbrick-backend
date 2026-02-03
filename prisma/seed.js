const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");
const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash("password123", 10);
  const users = [
    {
      name: "Admin User",
      email: "admin@example.com",
      password,
      email_verified_at: new Date(),
    },
    {
      name: "User 1",
      email: "user1@example.com",
      password,
      email_verified_at: new Date(),
    },
    {
      name: "User 2",
      email: "user2@example.com",
      password,
      email_verified_at: new Date(),
    },
  ];
  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: u,
    });
  }
  console.log("Seeded users.");

  // RFC 4122 UUIDs (version 4, variant 8) for API validation
  const bricks = [
    { brickId: "11111111-1111-4111-8111-111111111101", baseline_price: 150 },
    { brickId: "11111111-1111-4111-8111-111111111102", baseline_price: 500 },
    { brickId: "11111111-1111-4111-8111-111111111103", baseline_price: 300 },
    { brickId: "11111111-1111-4111-8111-111111111104", baseline_price: 250 },
    { brickId: "11111111-1111-4111-8111-111111111105", baseline_price: 800 },
  ];
  for (const b of bricks) {
    await prisma.brickPriceState.upsert({
      where: { brickId: b.brickId },
      update: {},
      create: {
        brickId: b.brickId,
        baselinePrice: b.baseline_price,
        livePrice: b.baseline_price,
        currentCycleId: uuidv4(),
        cycleStartPrice: b.baseline_price,
        cycleStartedAt: new Date(),
      },
    });
  }
  console.log("Seeded 5 bricks.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
