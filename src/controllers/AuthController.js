const AuthService = require("../services/AuthService");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function login(req, res) {
  const { email, password } = req.body;
  const errors = {};
  if (!email) errors.email = ["Required"];
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    errors.email = ["Must be a valid email"];
  if (!password) errors.password = ["Required"];
  else if (String(password).length < 6) errors.password = ["Min 6 characters"];
  if (Object.keys(errors).length) {
    return res.status(422).json({
      success: false,
      message: "Validation error",
      errors,
    });
  }
  const result = await AuthService.login(email, password);
  if (!result.success) {
    return res.status(401).json({ success: false, message: result.message });
  }
  return res.status(200).json({
    success: true,
    message: "Login successful",
    data: result.data,
  });
}

async function logout(req, res) {
  res.json({ success: true, message: "Logout successful" });
}

async function me(req, res) {
  const user = req.user;
  return res.status(200).json({
    success: true,
    data: {
      id: String(user.id),
      name: user.name,
      email: user.email,
      email_verified_at: user.email_verified_at,
    },
  });
}

module.exports = { login, logout, me };
