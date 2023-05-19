// user.js
const express = require("express");
const authJWT = require("../middlewares/authJWT/authJWT");
const router = express.Router();
const multer = require("multer");
const upload = multer({ dest: "uploads/" });

router.get("/test", authJWT, (req, res) => {
	console.log(req);
	res.send({ status_code: 200 });
});

router.post(
    "/testImg",
    authJWT,
    (req, res) => {
        res.send({ status_code: 200 });
        next();
    },
    upload.single("img"),
    (req, res) => {
        console.log(req.file);
        next();
    }
);

module.exports = router;
