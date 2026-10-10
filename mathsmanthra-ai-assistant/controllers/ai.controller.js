const { buildPrompt } = require("../services/prompt.service");
const { askAI } = require("../services/openai.service");

const chatController = async (req, res) => {

    try {

        const { message } = req.body;

        const finalPrompt = buildPrompt(message);

        const reply = await askAI(finalPrompt);

        res.json({
            success: true,
            reply
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: "AI request failed"
        });

    }

};

module.exports = {
    chatController
};