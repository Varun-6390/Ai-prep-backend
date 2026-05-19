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

    const prompt = `You are an expert resume writer and ATS optimization specialist.

Your task: Generate a single-page, ATS-optimized resume in pure HTML that will be rendered to PDF via Puppeteer (A4 size).

=== CANDIDATE DATA ===
Resume (source of truth – use ONLY this information, do NOT invent any details):
${resume}

Self Description (use to enrich the professional summary section only):
${selfDescription || "Not provided"}

Target Job Description (use to extract and highlight keywords):
${jobDescription}

=== STRICT RULES ===
1. NEVER invent, fabricate, or assume any information not present in the provided resume content.
2. If a section (e.g. LinkedIn, GitHub, phone) is not in the provided resume, omit it entirely.
3. Extract relevant keywords/skills/tools from the Job Description. Wherever these keywords appear in the resume content, wrap them in <span class="keyword">...</span>.
4. Use the exact job titles, company names, dates, and accomplishments from the provided resume.
5. The entire resume MUST fit on a single A4 page (no scrolling, no page overflow). Use tight but readable spacing.
6. The output must be PURE HTML only — no markdown, no code fences, no explanations.

=== HTML/CSS REQUIREMENTS ===
- Full HTML document: <!DOCTYPE html>, <html>, <head> (with all CSS inside <style>), <body>.
- Page size: A4 (210mm × 297mm). Set: html, body { width: 210mm; max-height: 297mm; margin: 0; padding: 0; overflow: hidden; }
- Margins: 12mm on all sides via padding on a wrapper div.
- Font: 'Segoe UI', Arial, sans-serif. Base font-size: 10pt.
- Color palette:
    • Headings / name: #1a1a2e (very dark navy)
    • Accent / keyword highlight: #2563eb (blue-600)
    • Body text: #374151 (gray-700)
    • Section rule lines: #e5e7eb (gray-200)
    • Background: #ffffff
- Keyword spans: .keyword { color: #2563eb; font-weight: 600; }
- Layout: single column OR two-column (left narrow sidebar for contact/skills, right main content) — whichever fits better on one page.
- Section headers: uppercase, letter-spacing: 0.08em, font-size: 7.5pt, color: #2563eb, border-bottom: 1px solid #e5e7eb, margin-bottom: 4pt.
- Name: font-size: 18pt, font-weight: 700, color: #1a1a2e.
- Job title / tagline: font-size: 10pt, color: #4b5563.
- Bullet points: use "▸" character, margin-left: 10pt, tight line-height (1.3).
- Dates: float right, font-size: 8.5pt, color: #6b7280.
- ATS compatibility: use semantic tags (<h1> for name, <h2> for sections, <ul><li> for bullets). No tables for layout, no images, no icons.
- Do NOT use external fonts or external URLs. All CSS inline in <style>.

Return ONLY the complete HTML document. Nothing else.`;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
                responseMimeType: "text/plain",
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

        // Strip any accidental markdown code fences
        const htmlContent = text
            .replace(/^```html\s*/i, "")
            .replace(/^```\s*/i, "")
            .replace(/\s*```$/i, "")
            .trim();

        if (!htmlContent || !htmlContent.includes("<html")) {
            throw new Error("AI failed to generate valid HTML content for the resume.");
        }

        const pdfBuffer = await generatePdfFromHtml(htmlContent);
        return pdfBuffer;
    } catch (error) {
        console.error("Error in generateResumePdf service:", error);
        throw error;
    }
}

module.exports = { generateInterviewReport, generateResumePdf }