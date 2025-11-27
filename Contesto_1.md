# Contesto del Progetto "EP Public Iscrizioni"

Questo documento definisce il perimetro del nuovo sottoprogetto per la raccolta iscrizioni online.

## Obiettivo
Creare una **Landing Page Pubblica** per la Lead Generation della scuola di inglese "EasyPeasy".
L'applicazione deve essere distinta e separata dal gestionale principale (EP v.1) per motivi di sicurezza e architettura.

## Requisiti Tecnici
1.  **Sicurezza (Buffer Database)**:
    - L'app deve collegarsi a un progetto Firebase dedicato (**Project B**), diverso da quello del gestionale principale (Project A).
    - La pagina deve avere **permessi di SOLA SCRITTURA** (Write-Only). Un utente anonimo può inviare dati ma non può leggere nulla dal database.
2.  **Performance e Semplicità**:
    - Deve essere una Single Page Application (SPA) leggerissima.
    - Stack consigliato: **React + Vite** (invece di Create React App per maggiore velocità).
    - Hosting: **Vercel** (Piano Hobby gratuito).
3.  **Design**:
    - Deve rispecchiare il brand "EasyPeasy" (Colori, Logo, Font).
    - Deve essere "Mobile First": la maggior parte dei genitori compilerà il form da smartphone.

## Flusso Utente
1.  Il genitore apre il link (es. `iscrizioni.easypeasy.it` o dominio Vercel).
2.  Vede una presentazione accattivante della scuola (Hero section, Vantaggi).
3.  Compila un form suddiviso in step (Dati Genitore, Dati Figlio, Sede, Consensi).
4.  Clicca "Invia Iscrizione".
5.  I dati vengono salvati su Firestore (Project B).
6.  Vede una pagina di ringraziamento ("Grazie! Ti contatteremo presto").

## Integrazione futura
Questi dati "grezzi" verranno successivamente pescati dal gestionale EP v.1 tramite una funzione di importazione protetta, svuotando il "buffer" del Project B.