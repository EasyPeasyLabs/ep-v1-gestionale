
import { Supplier, CompanyInfo, Location } from '../types';

export const PLACEHOLDERS_LEGEND = [
    { code: '[Nome Fornitore]', desc: 'Ragione Sociale del fornitore' },
    { code: '[Indirizzo Fornitore]', desc: 'Indirizzo completo fornitore' },
    { code: '[C.F./P.IVA Fornitore]', desc: 'Partita IVA o Codice Fiscale fornitore' },
    { code: '[Ragione Sociale Admin]', desc: 'Il tuo nome aziendale' },
    { code: '[Indirizzo Admin]', desc: 'Il tuo indirizzo' },
    { code: '[C.F./P.IVA Admin]', desc: 'La tua P.IVA' },
    { code: '[Nome Sede]', desc: 'Nome della location specifica' },
    { code: '[Indirizzo Sede]', desc: 'Indirizzo della location' },
    { code: '[Importo Nolo]', desc: 'Costo nolo della location' },
    { code: '[Data]', desc: 'Data odierna' },
    { code: '[Luogo]', desc: 'Città dell\'Admin (per la firma)' },
    { code: '[Data inizio]', desc: 'Data inizio validità (default oggi)' }
];

export const compileContractTemplate = (
    templateHtml: string,
    supplier: Supplier,
    companyInfo: CompanyInfo,
    location?: Location,
    options?: { startDate?: string }
): string => {
    let compiled = templateHtml;

    // Helper per escape (opzionale se i dati sono sicuri, ma buona norma)
    const safe = (str: string | undefined | number) => str ? String(str) : '_________________';

    // 1. Dati Fornitore
    compiled = compiled.replace(/\[Nome Fornitore\]/gi, safe(supplier.companyName));
    compiled = compiled.replace(/\[Indirizzo Fornitore\]/gi, `${safe(supplier.address)}, ${safe(supplier.city)} (${safe(supplier.province)})`);
    compiled = compiled.replace(/\[C\.F\.\/P\.IVA Fornitore\]/gi, safe(supplier.vatNumber));

    // 2. Dati Admin (Azienda)
    compiled = compiled.replace(/\[Ragione Sociale Admin\]/gi, safe(companyInfo.denomination || companyInfo.name));
    compiled = compiled.replace(/\[Indirizzo Admin\]/gi, safe(companyInfo.address));
    compiled = compiled.replace(/\[C\.F\.\/P\.IVA Admin\]/gi, safe(companyInfo.vatNumber));
    // Prioritizza il campo city esplicito, altrimenti fallback sullo split dell'indirizzo
    compiled = compiled.replace(/\[Luogo\]/gi, safe(companyInfo.city) !== '_________________' ? safe(companyInfo.city) : (companyInfo.address.split(',')[1]?.trim() || 'Bari'));

    // 3. Dati Sede (Location)
    if (location) {
        compiled = compiled.replace(/\[Nome Sede\]/gi, safe(location.name));
        compiled = compiled.replace(/\[Indirizzo Sede\]/gi, `${safe(location.address)}, ${safe(location.city)}`);
        compiled = compiled.replace(/\[Importo Nolo\]/gi, location.rentalCost ? location.rentalCost.toFixed(2) : '____');
    } else {
        // Pulisce i placeholder se non c'è sede, o lascia spazio vuoto
        compiled = compiled.replace(/\[Nome Sede\]/gi, '_________________');
        compiled = compiled.replace(/\[Indirizzo Sede\]/gi, '_________________');
        compiled = compiled.replace(/\[Importo Nolo\]/gi, '____');
    }

    // 4. Date
    const today = new Date().toLocaleDateString('it-IT');
    const start = options?.startDate ? new Date(options.startDate).toLocaleDateString('it-IT') : today;
    
    compiled = compiled.replace(/\[Data\]/gi, today);
    compiled = compiled.replace(/\[Data inizio\]/gi, start);

    return compiled;
};
