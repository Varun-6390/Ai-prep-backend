const { GoogleGenAI } = require("@google/genai")
const { z } = require("zod")
const { zodToJsonSchema } = require("zod-to-json-schema")
const puppeteer = require("puppeteer")

const ai = new GoogleGenAI({
    apiKey: process.env.GOOGLE_API_KEY
})


const interviewReportSchema = z.object({
    matchScore: z.number().describe("A score between 0 and 100 indicating how well the candidate's profile matches the job describe"),
    technicalQuestions: z.array(z.object({
        question: z.string().describe("The technical question can be asked in the interview"),
        intention: z.string().describe("The intention of interviewer behind asking this question"),
        answer: z.string().describe("How to answer this question, what points to cover, what approach to take etc.")
    })).describe("Technical questions that can be asked in the interview along with their intention and how to answer them"),
    behavioralQuestions: z.array(z.object({
        question: z.string().describe("The technical question can be asked in the interview"),
        intention: z.string().describe("The intention of interviewer behind asking this question"),
        answer: z.string().describe("How to answer this question, what points to cover, what approach to take etc.")
    })).describe("Behavioral questions that can be asked in the interview along with their intention and how to answer them"),
    skillGaps: z.array(z.object({
        skill: z.string().describe("The skill which the candidate is lacking"),
        severity: z.enum([ "low", "medium", "high" ]).describe("The severity of this skill gap, i.e. how important is this skill for the job and how much it can impact the candidate's chances")
    })).describe("List of skill gaps in the candidate's profile along with their severity"),
    preparationPlan: z.array(z.object({
        day: z.number().describe("The day number in the preparation plan, starting from 1"),
        focus: z.string().describe("The main focus of this day in the preparation plan, e.g. data structures, system design, mock interviews etc."),
        tasks: z.array(z.string()).describe("List of tasks to be done on this day to follow the preparation plan, e.g. read a specific book or article, solve a set of problems, watch a video etc.")
    })).describe("A day-wise preparation plan for the candidate to follow in order to prepare for the interview effectively"),
    title: z.string().describe("The title of the job for which the interview report is generated"),
})

async function generateInterviewReport({ resume, selfDescription, jobDescription }) {
    const prompt = `Generate an interview report for a candidate with the following details:
                        Resume: ${resume}
                        Self Description: ${selfDescription}
                        Job Description: ${jobDescription}

                        The response MUST be a valid JSON object with the following structure:
                        {
                            "matchScore": number (0-100),
                            "technicalQuestions": [
                                { "question": "string", "intention": "string", "answer": "string" }
                            ],
                            "behavioralQuestions": [
                                { "question": "string", "intention": "string", "answer": "string" }
                            ],
                            "skillGaps": [
                                { "skill": "string", "severity": "low" | "medium" | "high" }
                            ],
                            "preparationPlan": [
                                { "day": number, "focus": "string", "tasks": ["string"] }
                            ],
                            "title": "string (the job title)"
                        }

                        Return ONLY the JSON object. Do not include any markdown formatting or explanations.
`;
    console.log("AI Prompt:", prompt);
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
            responseMimeType: "application/json",
        }
    })

    console.log("AI Response Raw:", response);
    
    let text = "";
    if (response.candidates && response.candidates[0] && response.candidates[0].content && response.candidates[0].content.parts[0]) {
        text = response.candidates[0].content.parts[0].text;
    } else if (typeof response.text === 'function') {
        text = await response.text();
    } else {
        text = response.text || "";
    }
    
    console.log("AI Response Text:", text);

    try {
        // Clean text in case it has markdown blocks
        const cleanedText = text.replace(/```json\n?/, "").replace(/```\n?/, "").trim();
        return JSON.parse(cleanedText)
    } catch (error) {
        console.error("Failed to parse AI response as JSON:", error);
        throw new Error("AI returned an invalid response format. Please try again.");
    }
}



async function generatePdfFromHtml(htmlContent) {
    const browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    })
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: "networkidle0" })   

    const pdfBuffer = await page.pdf({
        format: "A4", margin: {
            top: "20mm",
            bottom: "20mm",
            left: "15mm",
            right: "15mm"
        },
        printBackground: true
    })

    await browser.close()

    return pdfBuffer
}

async function generateResumePdf({ resume, selfDescription, jobDescription }) {

    const resumePdfSchema = z.object({
        html: z.string().describe("The HTML content of the resume which can be converted to PDF using any library like puppeteer")
    })

    const prompt = `Generate a professional, ATS-friendly resume for a candidate with the following details:
                        Resume Content: ${resume}
                        Self Description: ${selfDescription}
                        Job Description: ${jobDescription}

                        The response MUST be a JSON object with a single field "html".
                        The "html" field should contain a FULL HTML document (including <!DOCTYPE html>, <html>, <head> with CSS styles, and <body>).
                        
                        Design requirements:
                        1. Use clean, modern typography (sans-serif fonts).
                        2. Professional color scheme (dark grays, subtle blue accents).
                        3. Clear sections: Contact Information, Summary, Experience, Education, Skills.
                        4. Tailor the content to the Job Description, highlighting relevant achievements.
                        5. Ensure it looks premium and well-formatted when printed to PDF.
                        
                        Return ONLY the JSON object: { "html": "...full html content..." }`

    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
                responseMimeType: "application/json",
            }
        })

        let text = "";
        if (response.candidates && response.candidates[0] && response.candidates[0].content && response.candidates[0].content.parts[0]) {
            text = response.candidates[0].content.parts[0].text;
        } else if (typeof response.text === 'function') {
            text = await response.text();
        } else {
            text = response.text || "";
        }

        const cleanedText = text.replace(/```json\n?/, "").replace(/```\n?/, "").trim();
        const jsonContent = JSON.parse(cleanedText);

        if (!jsonContent.html) {
            throw new Error("AI failed to generate HTML content for the resume.");
        }

        const pdfBuffer = await generatePdfFromHtml(jsonContent.html);
        return pdfBuffer;
    } catch (error) {
        console.error("Error in generateResumePdf service:", error);
        throw error;
    }
}

module.exports = { generateInterviewReport, generateResumePdf }