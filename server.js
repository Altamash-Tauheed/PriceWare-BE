const express = require("express");
const stripe = require("stripe")(
  "sk_test_51PXLFBJIO84MAnBIZ7rcZgaFEEKu8q31aYQm0hyvynVSpd5VZF5gaCqXOmEwPkMzpiqLUkx2uOQxHrNVc5WlD902002j181LRm"
);
const bodyParser = require("body-parser");
const cors = require("cors");
const knex = require("knex");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const app = express();
const port = 3000;

// Database connection setup using knex
const db = knex({
  client: "pg",
  connection: {
    host: "127.0.0.1",
    user: "postgres",
    password: "postgres",
    database: "dealfinder",
  },
});

app.use(cors());
app.use(bodyParser.json());

const generateToken = (user) => {
  return jwt.sign(
    { id: user.user_id, email: user.email },
    process.env.JWT_SECRET,
    {
      expiresIn: "1h",
    }
  );
};

// Handle POST request to /join route (User Registration)
app.post("/join", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json("Please provide all required fields");
    }
    // Insert the user into the database
    await db("users").insert({
      name: name,
      email: email,
      password: password,
    });
    res.json("User registered successfully");
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json("Internal server error");
  }
});

// Handle payment
app.post("/payment", async (req, res) => {
  try {
    const { cartItems } = req.body;

    const lineItems = cartItems.map((item) => ({
      price_data: {
        currency: "inr",
        product_data: {
          name: item.name,
          description: item.description,
        },
        unit_amount: item.price * 100, // Stripe expects amount in cents
      },
      quantity: 1,
    }));

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: lineItems,
      mode: "payment",
      success_url: "http://localhost:5173/items",
      cancel_url: "https://www.youtube.com",
      // customer_email: "demo@gmail.com", // Replace with dynamic email if available
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error("Error creating payment session:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Handle POST request to /signin route (User Sign-In)
app.post("/signin", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json("Please provide all required fields");
    }
    // Check if the user exists and the password matches
    const user = await db("users").where({ email }).first();
    if (user && user.password === password) {
      const token = generateToken(user);
      res.json({ message: "Sign-in successful", token });
    } else {
      res.status(400).json("Invalid email or password");
    }
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json("Internal server error");
  }
});

// Middleware to verify the token
const verifyToken = (req, res, next) => {
  const token = req.headers["authorization"];
  if (!token) {
    return res.status(403).json("A token is required for authentication");
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json("Invalid Token");
  }
};

// Example of a protected route
app.get("/profile", verifyToken, async (req, res) => {
  try {
    const user = await db("users").where({ user_id: req.user.id }).first();
    res.json(user);
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json("Internal server error");
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
