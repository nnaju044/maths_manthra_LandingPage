const express = require("express");

const router = express.Router();

const {
    chatController
} = require("../controllers/ai.controller");

router.post("/chat", chatController);

module.exports = router;