const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();

const app = express();

app.use(
    cors({
        origin: [
            "https://e-commerce-client-2.web.app",
            "http://localhost:5173",
        ],
        credentials: true,
    })
);
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.8bthues.mongodb.net/?appName=Cluster0`;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
});

// ✅ Single promise — reused across all requests in the same warm instance
let connectionPromise = null;

function getDB() {
    if (!connectionPromise) {
        connectionPromise = client.connect().then(() => {
            console.log("✅ MongoDB Connected");
            return client.db("fashionDB");
        }).catch((err) => {
            // Reset so the next request can retry
            connectionPromise = null;
            throw err;
        });
    }
    return connectionPromise;
}

// ✅ Middleware: ensures DB is connected before any route handler runs
app.use(async (req, res, next) => {
    try {
        await getDB();
        next();
    } catch (err) {
        console.error("❌ DB connection failed:", err);
        res.status(503).send({ success: false, message: "Database unavailable, please retry" });
    }
});

// ─── USERS ────────────────────────────────────────────────────────────────────

app.post("/register", async (req, res) => {
    const db = await getDB();
    const userCollection = db.collection("users");
    const { firstName, lastName, email, mobile } = req.body;
    const existingUser = await userCollection.findOne({ $or: [{ email }, { mobile }] });
    if (existingUser) {
        return res.send({ success: false, message: "User already registered" });
    }
    const newUser = { firstName, lastName, email, mobile, role: "user", createdAt: new Date() };
    await userCollection.insertOne(newUser);
    res.send({ success: true, message: "User registered successfully" });
});

app.post("/google-login", async (req, res) => {
    const db = await getDB();
    const userCollection = db.collection("users");
    const { displayName, email, photoURL } = req.body;
    const existingUser = await userCollection.findOne({ email });
    if (existingUser) return res.send({ success: true, user: existingUser });
    const newUser = { name: displayName, email, photo: photoURL || "", role: "user", createdAt: new Date() };
    await userCollection.insertOne(newUser);
    res.send({ success: true, user: newUser });
});

app.get("/users", async (req, res) => {
    const db = await getDB();
    const users = await db.collection("users").find().sort({ createdAt: -1 }).toArray();
    res.send(users);
});

app.get("/users/role/:email", async (req, res) => {
    const db = await getDB();
    const user = await db.collection("users").findOne({ email: req.params.email });
    res.send({ role: user?.role || "user" });
});

app.patch("/users/admin/:id", async (req, res) => {
    const db = await getDB();
    const result = await db.collection("users").updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: { role: "admin" } }
    );
    res.send(result);
});

app.patch("/users/remove-admin/:id", async (req, res) => {
    const db = await getDB();
    const result = await db.collection("users").updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: { role: "user" } }
    );
    res.send(result);
});

app.delete("/users/:id", async (req, res) => {
    const db = await getDB();
    const result = await db.collection("users").deleteOne({ _id: new ObjectId(req.params.id) });
    res.send(result);
});

// ─── PRODUCTS ─────────────────────────────────────────────────────────────────

app.post("/products", async (req, res) => {
    try {
        const db = await getDB();
        const { title, price, description, category, size, image1, image2 } = req.body;
        if (!title || !price || !category || !image1) {
            return res.status(400).send({ success: false, message: "Missing required fields" });
        }
        const product = {
            title, price: Number(price), description, category,
            size: size || [], image1, image2: image2 || "", createdAt: new Date(),
        };
        const result = await db.collection("products").insertOne(product);
        res.send({ success: true, message: "Product added successfully", result });
    } catch (error) {
        console.error(error);
        res.status(500).send({ success: false, message: "Server error" });
    }
});

app.get("/products", async (req, res) => {
    try {
        const db = await getDB();
        const { category } = req.query;
        const categoryOrder = ["shirts", "pants", "accessories"];
        let query = {};
        if (category) query.category = category;

        const products = await db.collection("products").find(query).sort({ createdAt: -1 }).toArray();

        if (!category) {
            products.sort((a, b) => {
                const aIdx = categoryOrder.indexOf(a.category);
                const bIdx = categoryOrder.indexOf(b.category);
                return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
            });
        }
        res.send(products);
    } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Failed to get products" });
    }
});

app.get("/products/:id", async (req, res) => {
    try {
        const db = await getDB();
        const product = await db.collection("products").findOne({ _id: new ObjectId(req.params.id) });
        if (!product) return res.status(404).send({ success: false, message: "Product not found" });
        res.send(product);
    } catch (error) {
        console.error(error);
        res.status(500).send({ success: false, message: "Failed to get product" });
    }
});

app.put("/products/:id", async (req, res) => {
    const db = await getDB();
    const { title, price, size, description, image1, image2 } = req.body;
    const result = await db.collection("products").updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: { title, price: Number(price), size, description, image1, image2 } }
    );
    res.send(result);
});

app.delete("/products/:id", async (req, res) => {
    const db = await getDB();
    const result = await db.collection("products").deleteOne({ _id: new ObjectId(req.params.id) });
    res.send(result);
});

// ─── ROOT ─────────────────────────────────────────────────────────────────────

app.get("/", (req, res) => {
    res.send("🚀 Server is running perfectly");
});

module.exports = app;