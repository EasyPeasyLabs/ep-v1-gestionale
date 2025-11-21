
export interface ThemeColors {
    primary: string;
    bgLight: string;
}

export const defaultTheme: ThemeColors = {
    primary: '#757575', // Grigio richiesto (equivale a shade 600)
    bgLight: '#f5f5f5'
};

// Helper per convertire HEX in RGB
const hexToRgb = (hex: string) => {
    let c = hex.replace('#', '');
    if (c.length === 3) {
        c = c.split('').map(x => x + x).join('');
    }
    const num = parseInt(c, 16);
    return {
        r: (num >> 16) & 255,
        g: (num >> 8) & 255,
        b: num & 255
    };
}

// Helper per mixare due colori
// weight è la percentuale di color2 nel mix (0-100)
const mix = (color1: {r:number, g:number, b:number}, color2: {r:number, g:number, b:number}, weight: number) => {
    const w = weight / 100;
    const r = Math.round(color1.r * (1 - w) + color2.r * w);
    const g = Math.round(color1.g * (1 - w) + color2.g * w);
    const b = Math.round(color1.b * (1 - w) + color2.b * w);
    return `rgb(${r}, ${g}, ${b})`;
}

export const applyTheme = (primaryHex: string, bgHex?: string) => {
    const root = document.documentElement;
    
    // Validazione
    if (!primaryHex || !/^#[0-9A-F]{6}$/i.test(primaryHex)) {
        primaryHex = defaultTheme.primary;
    }
    const bg = bgHex || defaultTheme.bgLight;

    // Persistenza
    localStorage.setItem('ep_theme_primary', primaryHex);
    localStorage.setItem('ep_theme_bg', bg);

    // Calcolo Palette
    const base = hexToRgb(primaryHex);
    const white = { r: 255, g: 255, b: 255 };
    const black = { r: 0, g: 0, b: 0 };

    // Helper per settare variabile
    const set = (name: string, val: string) => root.style.setProperty(name, val);

    // Generazione Sfumature (Assumiamo che il colore scelto sia il "600" o "Primary")
    // Creiamo una scala tonale miscelando con bianco e nero
    
    set('--theme-50',  mix(base, white, 95));
    set('--theme-100', mix(base, white, 90));
    set('--theme-200', mix(base, white, 75));
    set('--theme-300', mix(base, white, 60));
    set('--theme-400', mix(base, white, 30));
    set('--theme-500', mix(base, white, 10)); // Leggermente più chiaro del base
    set('--theme-600', `rgb(${base.r}, ${base.g}, ${base.b})`); // Colore Base
    set('--theme-700', mix(base, black, 15));
    set('--theme-800', mix(base, black, 30));
    set('--theme-900', mix(base, black, 50));
    set('--theme-950', mix(base, black, 70));

    // Variabili Legacy (per compatibilità con CSS statico in index.html)
    set('--md-primary', primaryHex);
    set('--md-primary-dark', mix(base, black, 20));
    set('--md-bg-light', bg);
};

export const getSavedTheme = (): { primary: string, bg: string } => {
    const primary = localStorage.getItem('ep_theme_primary') || defaultTheme.primary;
    const bg = localStorage.getItem('ep_theme_bg') || defaultTheme.bgLight;
    return { primary, bg };
};
