
export interface ThemeColors {
    primary: string;
    primaryDark: string;
    bgLight: string;
}

export const defaultTheme: ThemeColors = {
    primary: '#757575', // Grigio richiesto
    primaryDark: '#616161', // Variante più scura calcolata
    bgLight: '#f5f5f5'
};

// Funzione helper per scurire un colore HEX (per gli stati hover/active)
const darkenColor = (hex: string, percent: number): string => {
    let cleanHex = hex.replace('#', '');
    if (cleanHex.length === 3) {
        cleanHex = cleanHex.split('').map(c => c + c).join('');
    }

    let num = parseInt(cleanHex, 16);
    let amt = Math.round(2.55 * percent);
    let R = (num >> 16) - amt;
    let B = ((num >> 8) & 0x00FF) - amt;
    let G = (num & 0x0000FF) - amt;

    return "#" + (0x1000000 + (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 + (B < 255 ? (B < 1 ? 0 : B) : 255) * 0x100 + (G < 255 ? (G < 1 ? 0 : G) : 255)).toString(16).slice(1);
};

export const applyTheme = (primary: string, bg?: string) => {
    const root = document.documentElement;
    
    // Validazione e fallback
    if (!primary || !/^#[0-9A-F]{6}$/i.test(primary)) {
        primary = defaultTheme.primary;
    }

    // Calcola variante scura per hover
    const primaryDark = darkenColor(primary, 20);
    const background = bg || defaultTheme.bgLight;

    // Applica variabili CSS globali
    root.style.setProperty('--md-primary', primary);
    root.style.setProperty('--md-primary-dark', primaryDark);
    root.style.setProperty('--md-bg-light', background);
    
    // Persistenza
    localStorage.setItem('ep_theme_primary', primary);
    localStorage.setItem('ep_theme_bg', background);
};

export const getSavedTheme = (): { primary: string, bg: string } => {
    const primary = localStorage.getItem('ep_theme_primary') || defaultTheme.primary;
    const bg = localStorage.getItem('ep_theme_bg') || defaultTheme.bgLight;
    return { primary, bg };
};
