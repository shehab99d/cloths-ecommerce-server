const express = require("express");
const cors = require("cors");
// const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 5000;


if (!process.env.DB_USER || !process.env.DB_PASS) {
    console.error("❌ Missing DB credentials");
    process.exit(1);
}

/* ================= Middleware ================= */
app.use(cors({
    origin: [
        "https://e-commerce-client-2.web.app",
        "http://localhost:5173"
    ],
    credentials: true
}));


app.use(express.json());


/* ================= MongoDB ================= */
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.8bthues.mongodb.net/?appName=Cluster0`;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
});

/* ================= Main ================= */
let userCollection;
let productCollection;

async function run() {
    try {
        await client.connect();
        console.log("✅ MongoDB Connected");

        const db = client.db("fashionDB");
        userCollection = db.collection("users");
        productCollection = db.collection("products");

        /* ================= JWT ================= */
        // app.post("/jwt", async (req, res) => {
        //     const { email } = req.body;

        //     if (!email) {
        //         return res.status(400).send({ message: "Email required" });
        //     }

        //     const user = await userCollection.findOne({ email });

        //     if (!user) {
        //         return res.status(401).send({ message: "Unauthorized" });
        //     }

        //     const token = jwt.sign(
        //         { email: user.email },
        //         process.env.JWT_SECRET,
        //         { expiresIn: "7d" }
        //     );

        //     res.send({ token });
        // });

        /* ================= USERS ================= */

        // Register
        app.post("/register", async (req, res) => {
            const { firstName, lastName, email, mobile } = req.body;

            const existingUser = await userCollection.findOne({
                $or: [{ email }, { mobile }],
            });

            if (existingUser) {
                return res.send({
                    success: false,
                    message: "User already registered",
                });
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

            res.send({
                success: true,
                message: "User registered successfully",
            });
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

        // Get all users (Admin)
        app.get("/users", async (req, res) => {
            const users = await userCollection
                .find()
                .sort({ createdAt: -1 })
                .toArray();

            res.send(users);
        });

        // Make admin
        app.patch("/users/admin/:id", async (req, res) => {
            const id = req.params.id;

            const result = await userCollection.updateOne(
                { _id: new ObjectId(id) },
                { $set: { role: "admin" } }
            );

            res.send(result);
        });

        // Remove admin
        app.patch("/users/remove-admin/:id", async (req, res) => {
            const id = req.params.id;

            const result = await userCollection.updateOne(
                { _id: new ObjectId(id) },
                { $set: { role: "user" } }
            );

            res.send(result);
        });

        // Delete user
        app.delete("/users/:id", async (req, res) => {
            const id = req.params.id;

            const result = await userCollection.deleteOne({
                _id: new ObjectId(id),
            });

            res.send(result);
        });

        // Get role
        app.get("/users/role/:email", async (req, res) => {
            const email = req.params.email;
            const user = await userCollection.findOne({ email });

            res.send({ role: user?.role || "user" });
        });

        /* ================= PRODUCTS ================= */

        // Create product (Admin)
        app.post("/products", async (req, res) => {
            try {
                const {
                    title,
                    price,
                    description,
                    category,
                    size,
                    image1,
                    image2,
                } = req.body;

                if (!title || !price || !category || !image1) {
                    return res.status(400).send({
                        success: false,
                        message: "Missing required fields",
                    });
                }

                const product = {
                    title,
                    price: Number(price),
                    description,
                    category, // 🔥 important for sorting
                    size: size || [],
                    image1,
                    image2: image2 || "",
                    createdAt: new Date(),
                };

                const result = await productCollection.insertOne(product);

                res.send({
                    success: true,
                    message: "Product added successfully",
                    result,
                });
            } catch (error) {
                console.error(error);
                res.status(500).send({
                    success: false,
                    message: "Server error",
                });
            }
        });

        // Get all products


        // Get single product
        // GET all products, optional category filter
        // GET all products, optional category filter
        app.get("/products", async (req, res) => {
            try {
                const { category } = req.query;

                const categoryOrder = ["shirts", "pants", "accessories"]; // your preferred order

                let query = {};
                if (category) query.category = category;

                const products = await productCollection
                    .find(query)
                    .sort({ createdAt: -1 })
                    .toArray();

                if (!category) {
                    products.sort((a, b) => {
                        const ai = categoryOrder.indexOf(a.category);
                        const bi = categoryOrder.indexOf(b.category);
                        // unknown categories go to the end
                        const aIdx = ai === -1 ? 999 : ai;
                        const bIdx = bi === -1 ? 999 : bi;
                        return aIdx - bIdx;
                    });
                }

                res.send(products);
            } catch (error) {
                console.error(error);
                res.status(500).send({ message: "Failed to get products" });
            }
        });

        // GET single product by ID
        app.get("/products/:id", async (req, res) => {
            try {
                const id = req.params.id;
                const product = await productCollection.findOne({ _id: new ObjectId(id) });

                if (!product) return res.status(404).send({ success: false, message: "Product not found" });

                res.send(product);
            } catch (error) {
                console.error(error);
                res.status(500).send({ success: false, message: "Failed to get product" });
            }
        });
        // Update product (Admin)
        app.put("/products/:id", async (req, res) => {
            const id = req.params.id;
            const { title, price, size, description, image1, image2 } = req.body;

            const updateDoc = {
                $set: {
                    title,
                    price: Number(price),
                    size,
                    description,
                    image1,
                    image2,
                },
            };

            const result = await productCollection.updateOne(
                { _id: new ObjectId(id) },
                updateDoc
            );

            res.send(result);
        });

        // Delete product (Admin)
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

/* ================= Test ================= */
app.get("/", (req, res) => {
    res.send("🚀 Server is running perfectly");
});

/* ================= Start ================= */
app.listen(port, () => {
    console.log(`🚀 Server running on port ${port}`);
});