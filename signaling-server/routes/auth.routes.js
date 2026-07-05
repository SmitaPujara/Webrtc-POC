const express = require("express");

const router = express.Router();

const authController = require("../controllers/auth.controller");
const authMiddleware = require("../middleware/auth.middleware");

console.log("Auth Controller:", authController);
console.log("Auth Middleware:", authMiddleware);

// Register User
router.post("/register", authController.register);

// Login User
router.post("/login", authController.login);

// Profile
router.get(
    "/profile",
    authMiddleware.verifyToken,
    authController.profile
);

module.exports = router;