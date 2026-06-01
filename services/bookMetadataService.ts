import { getFunctions, httpsCallable } from 'firebase/functions';

export interface BookMetadata {
    title: string;
    authors: string[];
    publisher: string;
    targetTags: string[];
    categoryTags: string[];
    themeTags: string[];
}

export const fetchBookMetadata = async (title: string, authors: string): Promise<BookMetadata | null> => {
    try {
        const functions = getFunctions();
        const suggestBookTags = httpsCallable(functions, 'suggestBookTags');
        
        const response = await suggestBookTags({ title, authors });
        const data = response.data as any;

        return {
            title: data.title || title,
            authors: data.authors || (authors ? [authors] : []),
            publisher: data.publisher || '',
            targetTags: data.targetTags || [],
            categoryTags: data.categoryTags || [],
            themeTags: data.themeTags || []
        };
    } catch (error) {
        console.error("Error fetching book metadata with AI:", error);
        // Fallback a proxyGoogleBooks in caso di errore AI
        try {
            const query = encodeURIComponent(`${title} ${authors}`);
            const fbResponse = await fetch(`https://europe-west1-ep-gestionale-v1.cloudfunctions.net/proxyGoogleBooks?q=${query}`);
            const data = await fbResponse.json();

            if (!data.items || data.items.length === 0) return null;

            const volumeInfo = data.items[0].volumeInfo;
            return {
                title: volumeInfo.title,
                authors: volumeInfo.authors || [],
                publisher: volumeInfo.publisher || '',
                targetTags: [],
                categoryTags: [],
                themeTags: []
            };
        } catch (innerError) {
            console.error("Fallback Google Books Error:", innerError);
            return null;
        }
    }
};
