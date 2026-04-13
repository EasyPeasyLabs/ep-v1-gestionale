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
        const query = encodeURIComponent(`${title} ${authors}`);
        const response = await fetch(`https://europe-west1-ep-gestionale-v1.cloudfunctions.net/proxyGoogleBooks?q=${query}`);
        const data = await response.json();

        if (!data.items || data.items.length === 0) return null;

        const volumeInfo = data.items[0].volumeInfo;
        const description = (volumeInfo.description || '').toLowerCase();
        const categories = (volumeInfo.categories || []).map((c: string) => c.toLowerCase());

        // Mappatura Tag (Logica Locale)
        const targetTags: string[] = [];
        if (description.includes('0-2') || description.includes('0-3') || description.includes('primi anni')) targetTags.push('piccolissimi');
        if (description.includes('3-4') || description.includes('prescolare')) targetTags.push('piccoli');
        if (description.includes('5-7') || description.includes('scuola primaria')) targetTags.push('grandi');

        const categoryTags: string[] = [];
        if (description.includes('tattile')) categoryTags.push('tattile');
        else if (description.includes('solo immagini') || description.includes('silent book')) categoryTags.push('solo immagini');
        else if (description.includes('testo') && description.includes('immagini')) categoryTags.push('testo & immagini');
        else categoryTags.push('solo testo');

        const themeTags: string[] = [];
        const potentialThemes = ['animali', 'stagioni', 'amicizia', 'avventura', 'natura', 'società'];
        potentialThemes.forEach(theme => {
            if (description.includes(theme) || categories.some((c: string) => c.includes(theme))) {
                themeTags.push(theme);
            }
        });

        return {
            title: volumeInfo.title,
            authors: volumeInfo.authors || [],
            publisher: volumeInfo.publisher || '',
            targetTags,
            categoryTags,
            themeTags
        };
    } catch (error) {
        console.error("Error fetching book metadata:", error);
        return null;
    }
};
