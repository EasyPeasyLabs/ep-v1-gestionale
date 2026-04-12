import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface BookSuggestion {
    targetTags: string[];
    themeTags: string[];
}

export const suggestBookMetadata = async (title: string, authors: string, category: string): Promise<BookSuggestion> => {
    const prompt = `
        Analizza il seguente libro e suggerisci:
        1. La fascia d'età dei destinatari tra queste opzioni: PICCOLISSIMI, PICCOLI, GRANDI.
        2. Un tema principale (es. animali, amicizia, avventura, natura, etc.).

        Libro:
        Titolo: ${title}
        Autori: ${authors}
        Categoria: ${category}

        Rispondi ESCLUSIVAMENTE con un oggetto JSON nel seguente formato:
        {
            "targetTags": ["FASCIA_ETA"],
            "themeTags": ["TEMA"]
        }
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: prompt
        });
        
        const text = response.text || "";
        
        // Extract JSON from response
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
        throw new Error("Invalid AI response format");
    } catch (error) {
        console.error("Gemini Suggestion Error:", error);
        return { targetTags: [], themeTags: [] };
    }
};
