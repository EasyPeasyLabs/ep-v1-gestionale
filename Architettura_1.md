# Architettura "EP Public"

## Stack Tecnologico
- **Frontend Framework**: React 19 + Vite.
- **Linguaggio**: TypeScript.
- **Styling**: TailwindCSS (per coerenza visiva con EP v.1).
- **Backend (BaaS)**: Firebase Firestore (**Project B** - Nuovo progetto dedicato).
- **Hosting**: Vercel.

## Struttura Dati (Firestore Project B)
Il database funge solo da "casella postale" (Buffer).
Esiste una sola collezione: `new_leads`.

### Documento `new_leads/{leadId}`
```json
{
  "parentFirstName": "Mario",
  "parentLastName": "Rossi",
  "parentEmail": "mario.rossi@email.com",
  "parentPhone": "3331234567",
  "parentTaxCode": "RSSMRA...", // Opzionale in fase di lead, obbligatorio poi
  "childName": "Luca",
  "childAge": "5 anni", // O data di nascita
  "selectedLocation": "Bari - Poggiofranco", // Stringa semplice
  "notes": "Ha già fatto un anno di inglese",
  "submittedAt": "TIMESTAMP",
  "status": "new", // new | imported
  "privacyConsent": true
}
```

## Sicurezza (Firestore Rules - Project B)
Le regole di sicurezza sono il cuore di questa architettura.
Devono permettere la creazione (`create`) a chiunque, ma negare lettura (`read`), aggiornamento (`update`) ed eliminazione (`delete`) a tutti (tranne l'Admin SDK che useremo in EP v.1, che bypassa le regole).

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /new_leads/{document} {
      allow create: if true; // Chiunque può scrivere
      allow read, update, delete: if false; // Nessuno può leggere o modificare via client
    }
  }
}
```

## UI/UX
- **Single Page**: Tutto in una pagina con scroll o wizard a step.
- **Feedback Immediato**: Validazione dei campi in tempo reale.
- **Success State**: Pagina di conferma chiara dopo l'invio.