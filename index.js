const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 5000;

if (!process.env.DB_USER || !process.env.DB_PASS) {
    console.error("❌ Missing DB credentials");
    process.exit(1);
}

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

let isConnected = false;

async function run() {
    try {
        if (!isConnected) {
            await client.connect();
            isConnected = true;
            console.log("✅ MongoDB Connected");
        }

        const db = client.db("fashionDB");
        const userCollection = db.collection("users");
        const productCollection = db.collection("products");

        // Register
        app.post("/register", async (req, res) => {
            const { firstName, lastName, email, mobile } = req.body;
            const existingUser = await userCollection.findOne({
                $or: [{ email }, { mobile }],
            });
            if (existingUser) {
                return res.send({ success: false, message: "User already registered" });
            }
            const newUser = {
                firstName,
                lastName,
                email,
                mobile,
                role: "user",
                createdAt: new Date(),
            };
            await userCollection.insertOne(newUser);
            res.send({ success: true, message: "User registered successfully" });
        });

        // Google Login
        app.post("/google-login", async (req, res) => {
            const { displayName, email, photoURL } = req.body;
            const existingUser = await userCollection.findOne({ email });
            if (existingUser) {
                return res.send({ success: true, user: existingUser });
            }
            const newUser = {
                name: displayName,
                email,
                photo: photoURL || "",
                role: "user",
                createdAt: new Date(),
            };
            await userCollection.insertOne(newUser);
            res.send({ success: true, user: newUser });
        });

        // Get all users
        app.get("/users", async (req, res) => {
            const users = await userCollection.find().sort({ createdAt: -1 }).toArray();
            res.send(users);
        });

        // Make admin
        app.patch("/users/admin/:id", async (req, res) => {
            const result = await userCollection.updateOne(
                { _id: new ObjectId(req.params.id) },
                { $set: { role: "admin" } }
            );
            res.send(result);
        });

        // Remove admin
        app.patch("/users/remove-admin/:id", async (req, res) => {
            const result = await userCollection.updateOne(
                { _id: new ObjectId(req.params.id) },
                { $set: { role: "user" } }
            );
            res.send(result);
        });

        // Delete user
        app.delete("/users/:id", async (req, res) => {
            const result = await userCollection.deleteOne({
                _id: new ObjectId(req.params.id),
            });
            res.send(result);
        });

        // Get user role
        app.get("/users/role/:email", async (req, res) => {
            const user = await userCollection.findOne({ email: req.params.email });
            res.send({ role: user?.role || "user" });
        });

        // Create product
        app.post("/products", async (req, res) => {
            try {
                const { title, price, description, category, size, image1, image2 } = req.body;
                if (!title || !price || !category || !image1) {
                    return res.status(400).send({ success: false, message: "Missing required fields" });
                }
                const product = {
                    title,
                    price: Number(price),
                    description,
                    category,
                    size: size || [],
                    image1,
                    image2: image2 || "",
                    createdAt: new Date(),
                };
                const result = await productCollection.insertOne(product);
                res.send({ success: true, message: "Product added successfully", result });
            } catch (error) {
                console.error(error);
                res.status(500).send({ success: false, message: "Server error" });
            }
        });

        // Get all products
        app.get("/products", async (req, res) => {
            try {
                const { category } = req.query;
                const categoryOrder = ["shirts", "pants", "accessories"];
                let query = {};
                if (category) query.category = category;

                const products = await productCollection
                    .find(query)
                    .sort({ createdAt: -1 })
                    .toArray();

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

        // Get single product
        app.get("/products/:id", async (req, res) => {
            try {
                const product = await productCollection.findOne({
                    _id: new ObjectId(req.params.id),
                });
                if (!product) {
                    return res.status(404).send({ success: false, message: "Product not found" });
                }
                res.send(product);
            } catch (error) {
                console.error(error);
                res.status(500).send({ success: false, message: "Failed to get product" });
            }
        });

        // Update product
        app.put("/products/:id", async (req, res) => {
            const { title, price, size, description, image1, image2 } = req.body;
            const result = await productCollection.updateOne(
                { _id: new ObjectId(req.params.id) },
                { $set: { title, price: Number(price), size, description, image1, image2 } }
            );
            res.send(result);
        });

        // Delete product
        app.delete("/products/:id", async (req, res) => {
            const result = await productCollection.deleteOne({
                _id: new ObjectId(req.params.id),
            });
            res.send(result);
        });
    } catch (error) {
        console.log("❌ Server Error:", error);
    }
}

run();

app.get("/", (req, res) => {
    res.send("🚀 Server is running perfectly");
});

app.listen(port, () => {
    console.log(`🚀 Server running on port ${port}`);
});