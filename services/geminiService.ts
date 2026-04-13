import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface BookSuggestion {
    targetTags: string[];
    categoryTags: string[];
    themeTags: string[];
}

export const suggestBookMetadata = async (title: string, authors: string, publisher: string): Promise<BookSuggestion> => {
    const prompt = `
        Analizza il seguente libro effettuando una ricerca web per ottenere metadati precisi.
        
        Informazioni Libro:
        Titolo: ${title}
        Autori: ${authors}
        Casa Editrice: ${publisher}

        Suggerisci i tag basandoti sui risultati della ricerca:
        1. targetTags (Fascia d'età): Mappa l'età consigliata trovata online in questi tag esatti:
           - "piccolissimi" (se l'età è 0-2+ anni)
           - "piccoli" (se l'età è 3-4+ anni)
           - "grandi" (se l'età è 5-7+ anni)
        2. categoryTags (Categoria): Scegli tra ["solo testo", "solo immagini", "testo & immagini", "tattile"].
        3. themeTags (Temi): Suggerisci temi pertinenti (es. ["animali", "stagioni", "amicizia", "avventura", "natura", "società"]).

        Rispondi ESCLUSIVAMENTE con un oggetto JSON nel seguente formato:
        {
            "targetTags": ["tag1"],
            "categoryTags": ["tag2"],
            "themeTags": ["tag3", "tag4"]
        }
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }]
            }
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
        return { targetTags: [], categoryTags: [], themeTags: [] };
    }
};
