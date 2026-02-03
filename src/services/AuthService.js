const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function login(email, password) {
    const user = await prisma.user.findUnique({
        where: { email },
    });
    if (!user || !(await bcrypt.compare(password, user.password))) {
        return { success: false, message: "Invalid credentials" };
    }
    const token = jwt.sign({ sub: String(user.id) }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    });
    return {
        success: true,
        message: "Login successful",
        data: {
            user: {
                id: String(user.id),
                name: user.name,
                email: user.email,
                email_verified_at: user.email_verified_at,
            },
            token,
            token_type: "Bearer",
        },
    };
}

module.exports = { login };
