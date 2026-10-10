const OpenAI = require("openai");

const client = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: "https://api.groq.com/openai/v1"
});

async function askAI(prompt) {

    const completion = await client.chat.completions.create({
        model: "openai/gpt-oss-20b",
        messages: [
            {
                role: "user",
                content: prompt
            }
        ],
        temperature: 0.7
    });

    return completion.choices[0].message.content;
}

module.exports = {
    askAI
};