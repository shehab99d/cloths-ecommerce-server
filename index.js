const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const cors = require("cors");
require("dotenv").config();
const jwt = require("jsonwebtoken");

const app = express();
const port = process.env.PORT || 5000;

/* ================= Middleware ================= */
app.use(cors());
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

/* ================= Main Run ================= */
async function run() {
    try {
        await client.connect();
        console.log("✅ MongoDB Connected");

        const db = client.db("fashionDB");
        const userCollection = db.collection("users");

        /* =========================================
           Attach collections to app locals so
           routers and middlewares can access them
        ========================================= */
        app.locals.productCollection = db.collection("products");
        app.locals.userCollection = userCollection;

        /* =========================================
           Mount product routes AFTER DB is ready
        ========================================= */
        const productRoutes = require("./products/Products");
        app.use("/products", productRoutes);

        /* =========================================
           JSON Web Token
        ========================================= */
        app.post("/jwt", async (req, res) => {
            const { email } = req.body;

            if (!email) {
                return res.status(400).send({ message: "Email required" });
            }

            const user = await userCollection.findOne({ email });

            if (!user) {
                return res.status(401).send({ message: "Unauthorized" });
            }

            const token = jwt.sign(
                { email: user.email },
                process.env.JWT_SECRET,
                { expiresIn: "7d" }
            );

            res.send({ token });
        });

        /* =========================================
           READ → All Products
        ========================================= */
        app.get("/products", async (req, res) => {
            const productCollection = req.app.locals.productCollection;
            const result = await productCollection
                .find()
                .sort({ createdAt: -1 })
                .toArray();
            res.send(result);
        });

        /* =========================================
           READ → Single Product
        ========================================= */
        app.get("/products/:id", async (req, res) => {
            try {
                const productCollection = req.app.locals.productCollection;
                const result = await productCollection.findOne({
                    _id: new ObjectId(req.params.id),
                });
                res.send(result);
            } catch {
                res.status(400).send({ error: "Invalid ID" });
            }
        });

        /* =========================================
           UPDATE → Product
        ========================================= */
        app.put("/products/:id", async (req, res) => {
            const productCollection = req.app.locals.productCollection;
            const id = req.params.id;
            const { title, price, description, size } = req.body;

            const updateDoc = {
                $set: {
                    title,
                    price: Number(price),
                    description,
                    size,
                },
            };

            const result = await productCollection.updateOne(
                { _id: new ObjectId(id) },
                updateDoc
            );

            res.send(result);
        });

        /* =========================================
           DELETE → Product
        ========================================= */
        app.delete("/products/:id", async (req, res) => {
            try {
                const productCollection = req.app.locals.productCollection;
                const result = await productCollection.deleteOne({
                    _id: new ObjectId(req.params.id),
                });
                res.send(result);
            } catch {
                res.status(400).send({ error: "Invalid ID" });
            }
        });

        /* =========================================
           USER REGISTRATION
        ========================================= */
        app.post("/register", async (req, res) => {
            const { firstName, lastName, email, mobile } = req.body;

            try {
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
                    user: newUser,
                });
            } catch (error) {
                res.status(500).send({ success: false, error: error.message });
            }
        });

        /* =========================================
           GET → All Users
        ========================================= */
        app.get("/users", async (req, res) => {
            try {
                const users = await userCollection
                    .find()
                    .sort({ createdAt: -1 })
                    .toArray();

                res.send({ success: true, users });
            } catch (error) {
                res.status(500).send({ success: false, message: error.message });
            }
        });

        /* =========================================
           PATCH → Make Admin
        ========================================= */
        app.patch("/users/admin/:id", async (req, res) => {
            const id = req.params.id;

            const result = await userCollection.updateOne(
                { _id: new ObjectId(id) },
                { $set: { role: "admin" } }
            );

            res.send(result);
        });

        /* =========================================
           PATCH → Remove Admin
        ========================================= */
        app.patch("/users/remove-admin/:id", async (req, res) => {
            const id = req.params.id;

            const result = await userCollection.updateOne(
                { _id: new ObjectId(id) },
                { $set: { role: "user" } }
            );

            res.send(result);
        });

        /* =========================================
           DELETE → User
        ========================================= */
        app.delete("/users/:id", async (req, res) => {
            const id = req.params.id;

            const result = await userCollection.deleteOne({
                _id: new ObjectId(id),
            });

            res.send(result);
        });

        /* =========================================
           Google Login / Register
        ========================================= */
        app.post("/google-login", async (req, res) => {
            const { displayName, email, photoURL } = req.body;

            try {
                const existingUser = await userCollection.findOne({ email });
                if (existingUser) {
                    return res.send({
                        success: true,
                        message: "User already exists",
                        user: existingUser,
                    });
                }

                const newUser = {
                    name: displayName,
                    email,
                    photo: photoURL || "",
                    role: "user",
                    createdAt: new Date(),
                };

                await userCollection.insertOne(newUser);
                res.send({
                    success: true,
                    message: "User registered via Google",
                    user: newUser,
                });
            } catch (error) {
                res.status(500).send({ success: false, error: error.message });
            }
        });

        /* =========================================
           GET → User Role by Email
        ========================================= */
        app.get("/users/role/:email", async (req, res) => {
            const email = req.params.email;

            try {
                const user = await userCollection.findOne({ email });

                if (!user) {
                    return res.send({ role: "user" });
                }

                res.send({ role: user.role });
            } catch (error) {
                res.status(500).send({ error: error.message });
            }
        });
    } catch (error) {
        console.log("❌ Mongo Error:", error);
    }
}

run();

/* ================= Test ================= */
app.get("/", (req, res) => {
    res.send("🚀 Server is running perfectly");
});

/* ================= Start ================= */
app.listen(port, () => {
    console.log(`🔥 Server running on port ${port}`);
});