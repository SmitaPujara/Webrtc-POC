const db = require("../database/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Register User
 */
exports.register = async (req, res) => {

    try {

        const { username, email, password } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({
                success: false,
                message: "All fields are required."
            });
        }

        const normalizedEmail = email.trim().toLowerCase(); // 👈 add this

        db.get(
            "SELECT * FROM users WHERE email = ?",
            [normalizedEmail], // 👈 use normalized value
            async (err, user) => {

                if (err) {
                    return res.status(500).json({
                        success: false,
                        message: err.message
                    });
                }

                if (user) {
                    return res.status(400).json({
                        success: false,
                        message: "Email already exists."
                    });
                }

                const hashedPassword = await bcrypt.hash(password, 10);

                db.run(
                    `INSERT INTO users(username,email,password)
                     VALUES(?,?,?)`,
                    [
                        username,
                        normalizedEmail, // 👈 store normalized value
                        hashedPassword
                    ],
                    function (err) {

                        if (err) {
                            return res.status(500).json({
                                success: false,
                                message: err.message
                            });
                        }

                        return res.status(201).json({
                            success: true,
                            message: "User registered successfully."
                        });

                    }
                );

            }
        );

    }
    catch (error) {

        return res.status(500).json({
            success: false,
            message: error.message
        });

    }

};


/**
 * Login User
 */
exports.login = (req, res) => {

    const { email, password } = req.body;

    if (!email || !password) {

        return res.status(400).json({
            success: false,
            message: "Email and Password are required."
        });

    }
    const normalizedEmail = email.trim().toLowerCase();
    
    db.get(
        "SELECT * FROM users WHERE email=?",
        [email],
        async (err, user) => {

            if (err) {
                return res.status(500).json({
                    success: false,
                    message: err.message
                });
            }

            if (!user) {

                return res.status(401).json({
                    success: false,
                    message: "Invalid email or password."
                });

            }

            const isMatch = await bcrypt.compare(
                password,
                user.password
            );

            if (!isMatch) {

                return res.status(401).json({
                    success: false,
                    message: "Invalid email or password."
                });

            }

            const token = jwt.sign(
                {
                    id: user.id,
                    email: user.email
                },
                JWT_SECRET,
                {
                    expiresIn: "1h"
                }
            );

            return res.status(200).json({

                success: true,

                message: "Login successful.",

                token,

                user: {

                    id: user.id,
                    username: user.username,
                    email: user.email

                }

            });

        }

    );

};


/**
 * Get Logged-in User
 */
exports.profile = (req, res) => {

    db.get(
        `SELECT id,
                username,
                email,
                created_at
         FROM users
         WHERE id=?`,
        [req.user.id],
        (err, user) => {

            if (err) {

                return res.status(500).json({
                    success: false,
                    message: err.message
                });

            }

            if (!user) {

                return res.status(404).json({
                    success: false,
                    message: "User not found."
                });

            }

            return res.status(200).json({

                success: true,
                data: user

            });

        }

    );

};