const swaggerAutogen = require("swagger-autogen")();

const doc = {
  info: {
    title: "BE@RBRICK Crowd-Sourced Pricing Engine API",
    version: "1.0.0",
    description:
      "Backend API for BE@RBRICK Crowd-Sourced Pricing Engine. Event-sourced, deterministic workers.",
  },
  host: "localhost:3000",
  schemes: ["http"],
  basePath: "/",
  consumes: ["application/json"],
  produces: ["application/json"],
  securityDefinitions: {
    bearerAuth: {
      type: "apiKey",
      name: "Authorization",
      scheme: "bearer",
      in: "header",
      bearerFormat: "JWT",
    },
  },
  definitions: {
    Error: {
      success: false,
      message: "Error message",
      errors: {
        field: ["Error detail"],
      },
    },
    LoginRequest: {
      email: "admin@example.com",
      password: "password123",
    },
    LoginResponse: {
      success: true,
      message: "Login successful",
      data: {
        token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        user: {
          id: "1",
          name: "Admin User",
          email: "admin@example.com",
          email_verified_at: "2024-01-01T00:00:00.000Z",
        },
      },
    },
    User: {
      id: "1",
      name: "Admin User",
      email: "admin@example.com",
      email_verified_at: "2024-01-01T00:00:00.000Z",
    },
    VoteIntentRequest: {
      brick_id: "11111111-1111-4111-8111-111111111101",
      vote_type: "OVER",
    },
    VoteIntentResponse: {
      success: true,
      message: "Vote intent accepted",
      data: {
        status: "ACCEPTED",
        intent_id: 12345,
      },
    },
    BrickState: {
      brick_id: "11111111-1111-4111-8111-111111111101",
      live_price: 100.0,
      fair_lower: 95.0,
      fair_upper: 105.0,
      freeze_mode: false,
      current_cycle_id: "uuid-here",
      last_price_update: "2024-01-01T00:00:00.000Z",
      last_vote_event_id_processed: 123,
      p_under: 0.2,
      p_fair: 0.3,
      p_over: 0.5,
      pricing_confidence_c: 0.6,
    },
    BricksListResponse: {
      success: true,
      data: [
        {
          brick_id: "11111111-1111-4111-8111-111111111101",
          live_price: 100.0,
          fair_lower: 95.0,
          fair_upper: 105.0,
          freeze_mode: false,
          current_cycle_id: "uuid-here",
          last_price_update: "2024-01-01T00:00:00.000Z",
          last_vote_event_id_processed: 123,
        },
      ],
    },
  },
  tags: [
    {
      name: "Auth",
      description: "Authentication endpoints",
    },
    {
      name: "Bricks",
      description: "Brick price state endpoints",
    },
    {
      name: "Votes",
      description: "Vote intent endpoints",
    },
  ],
};

const outputFile = "./src/config/swagger-output.json";
const endpointsFiles = ["./src/app.js"];

swaggerAutogen(outputFile, endpointsFiles, doc).then(() => {
  console.log("Swagger documentation generated successfully!");
});
