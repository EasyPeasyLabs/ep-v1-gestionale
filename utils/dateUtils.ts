
// Helper per ottenere la stringa YYYY-MM-DD rispettando il fuso orario locale
// Risolve il problema delle date che slittano al giorno prima se calcolate in UTC di sera
export const toLocalISOString = (date: Date): string => {
    const offset = date.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(date.getTime() - offset)).toISOString().slice(0, 10);
    return localISOTime;
};

// Algoritmo di Gauss per il calcolo della Pasqua (Western/Cattolica)
const getEasterDate = (year: number): Date => {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    
    // Restituisce oggetto Date (mese è 0-indexed in JS)
    return new Date(year, month - 1, day);
};

// Restituisce mappa { 'YYYY-MM-DD': 'Nome Festività' }
export const getItalianHolidays = (year: number): Record<string, string> => {
    const holidays: Record<string, string> = {
        [`${year}-01-01`]: 'Capodanno',
        [`${year}-01-06`]: 'Epifania',
        [`${year}-04-25`]: 'Liberazione',
        [`${year}-05-01`]: 'Lavoro',
        [`${year}-06-02`]: 'Repubblica',
        [`${year}-08-15`]: 'Ferragosto',
        [`${year}-11-01`]: 'Ognissanti',
        [`${year}-12-08`]: 'Immacolata',
        [`${year}-12-25`]: 'Natale',
        [`${year}-12-26`]: 'S. Stefano',
    };

    const easter = getEasterDate(year);
    const easterMonday = new Date(easter);
    easterMonday.setDate(easter.getDate() + 1);

    holidays[toLocalISOString(easter)] = 'Pasqua';
    holidays[toLocalISOString(easterMonday)] = 'Pasquetta';

    return holidays;
};

// Helper booleano rapido per i servizi
export const isItalianHoliday = (date: Date): boolean => {
    const year = date.getFullYear();
    const dateStr = toLocalISOString(date);
    const holidays = getItalianHolidays(year);
    return !!holidays[dateStr];
};
