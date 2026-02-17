const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const cors = require("cors");
const multer = require("multer");
// const bcrypt = require("bcryptjs");
require("dotenv").config();
const jwt = require("jsonwebtoken");


const app = express();
const port = process.env.PORT || 5000;

/* ================= Middleware ================= */
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads"));

const verifyJWT = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).send({ message: "Unauthorized access" });
    }

    const token = authHeader.split(" ")[1];

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).send({ message: "Forbidden access" });
        }

        req.decoded = decoded;
        next();
    });
};

const verifyAdmin = async (req, res, next) => {
    const email = req.decoded.email;

    const user = await userCollection.findOne({ email });

    if (!user || user.role !== "admin") {
        return res.status(403).send({ message: "Admin only access" });
    }

    next();
};



/* ================= MongoDB ================= */
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.8bthues.mongodb.net/?appName=Cluster0`;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
});

/* ================= Multer ================= */
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, "uploads/"),
    filename: (req, file, cb) =>
        cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });

/* ================= Main Run ================= */
async function run() {
    try {
        await client.connect();
        console.log("✅ MongoDB Connected");

        const db = client.db("fashionDB");
        const productCollection = db.collection("products");
        const userCollection = client.db("fashionDB").collection("users");



        /* =========================================
           JSON web token
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
           CREATE → Add Product
        ========================================= */
        app.post(
            "/products",
            verifyJWT,
            verifyAdmin,
            upload.fields([
                { name: "image1", maxCount: 1 },
                { name: "image2", maxCount: 1 },
            ]),
            async (req, res) => {
                try {
                    const { title, price, size, description } = req.body;

                    const product = {
                        title,
                        price: Number(price),
                        description,
                        size: JSON.parse(size),
                        image1: req.files?.image1
                            ? `${req.protocol}://${req.get("host")}/uploads/${req.files.image1[0].filename}`
                            : "",
                        image2: req.files?.image2
                            ? `${req.protocol}://${req.get("host")}/uploads/${req.files.image2[0].filename}`
                            : "",
                        createdAt: new Date(),
                    };

                    const result = await productCollection.insertOne(product);
                    res.send({ success: true, result });
                } catch (error) {
                    res.status(500).send({ success: false, error: error.message });
                }
            }
        );



        /* =========================================
           READ → All Products
        ========================================= */
        app.get("/products", async (req, res) => {
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
            const id = req.params.id;
            const { title, price, description, size } = req.body;

            const updateDoc = {
                $set: {
                    title,
                    price: Number(price),
                    description, // ✅ NEW
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
                const result = await productCollection.deleteOne({
                    _id: new ObjectId(req.params.id),
                });
                res.send(result);
            } catch {
                res.status(400).send({ error: "Invalid ID" });
            }
        });


        // USER DATA 
        app.post("/register", async (req, res) => {
            const { firstName, lastName, email, mobile } = req.body;

            try {
                const existingUser = await userCollection.findOne({
                    $or: [{ email }, { mobile }]
                });

                if (existingUser) {
                    return res.send({
                        success: false,
                        message: "User already registered"
                    });
                }

                const newUser = {
                    firstName,
                    lastName,
                    email,
                    mobile,
                    role: "user",          // ✅ Initial role
                    createdAt: new Date()
                };

                const result = await userCollection.insertOne(newUser);

                res.send({
                    success: true,
                    message: "User registered successfully",
                    user: newUser
                });
            } catch (error) {
                res.status(500).send({ success: false, error: error.message });
            }
        });




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

        app.patch("/users/admin/:id", async (req, res) => {
            const id = req.params.id;

            const result = await userCollection.updateOne(
                { _id: new ObjectId(id) },
                { $set: { role: "admin" } }
            );

            res.send(result);
        });

        app.patch("/users/remove-admin/:id", async (req, res) => {
            const id = req.params.id;

            const result = await userCollection.updateOne(
                { _id: new ObjectId(id) },
                { $set: { role: "user" } }
            );

            res.send(result);
        });

        app.delete("/users/:id", async (req, res) => {
            const id = req.params.id;

            const result = await userCollection.deleteOne({
                _id: new ObjectId(id),
            });

            res.send(result);
        });


        app.post("/google-login", async (req, res) => {
            const { displayName, email, photoURL } = req.body;

            try {
                const existingUser = await userCollection.findOne({ email });
                if (existingUser) {
                    return res.send({
                        success: true,
                        message: "User already exists",
                        user: existingUser
                    });
                }

                const newUser = {
                    name: displayName,
                    email,
                    photo: photoURL || "",
                    role: "user",          // ✅ Initial role
                    createdAt: new Date()
                };

                const result = await userCollection.insertOne(newUser);
                res.send({
                    success: true,
                    message: "User registered via Google",
                    user: newUser
                });
            } catch (error) {
                res.status(500).send({ success: false, error: error.message });
            }
        });

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
// app.listen(port, () => {
//     console.log(`🔥 Server running on port ${port}`);
// });
