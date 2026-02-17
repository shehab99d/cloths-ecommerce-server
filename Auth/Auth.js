const jwt = require("jsonwebtoken");

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
    try {
        const email = req.decoded.email;
        const userCollection = req.app.locals.userCollection;

        const user = await userCollection.findOne({ email });

        if (!user || user.role !== "admin") {
            return res.status(403).send({ message: "Admin only access" });
        }

        next();
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
};

module.exports = { verifyJWT, verifyAdmin };