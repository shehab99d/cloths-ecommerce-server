const express = require("express");
const router = express.Router();
const { v2: cloudinary } = require("cloudinary");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const multer = require("multer");
const { verifyJWT, verifyAdmin } = require("../Auth/Auth");

/* ================= Cloudinary Config ================= */
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

/* ================= Multer + Cloudinary Storage ================= */
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: async (req, file) => ({
        folder: "wazihas_boutique",
        public_id: Date.now() + "-" + file.originalname,
    }),
});

const upload = multer({ storage });

/* =========================================
   CREATE → Add Product (Cloudinary Upload)
========================================= */
router.post(
    "/",
    verifyJWT,
    verifyAdmin,
    upload.fields([
        { name: "image1", maxCount: 1 },
        { name: "image2", maxCount: 1 },
    ]),
    async (req, res) => {
        try {
            const productCollection = req.app.locals.productCollection;
            const { title, price, size, description } = req.body;

            const product = {
                title,
                price: Number(price),
                description,
                size: JSON.parse(size),
                image1: req.files?.image1
                    ? req.files.image1[0].path   // Cloudinary returns the URL in .path
                    : "",
                image2: req.files?.image2
                    ? req.files.image2[0].path
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

module.exports = router;