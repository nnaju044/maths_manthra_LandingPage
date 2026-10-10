const SYSTEM_PROMPT = require("../prompts/systemPrompt");
const courseData = require("../prompts/courseData");

function buildPrompt(userMessage) {

    return `
${SYSTEM_PROMPT}

Course Information:

${JSON.stringify(courseData, null, 2)}

User Question:
${userMessage}
`;
}

module.exports = {
    buildPrompt
};