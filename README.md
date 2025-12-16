<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/image/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# 📚 EP v1 Gestionale - Easy Peasy Labs

Applicazione web per la gestione finanziaria e amministrativa di Easy Peasy Labs.

**Status:** 🟢 Live in Produzione  
**URL:** https://ep-v1-gestionale.vercel.app  
**Repository:** github.com/EasyPeasyLabs/ep-v1-gestionale

## Features Principali

- 💰 Gestione finanziaria con sistema di fatture (real + ghost invoices)
- 📊 Dashboard con analytics e P&L
- 👥 Gestione clienti e iscrizioni
- 📅 Calendario e pianificazione
- 📱 Responsive design
- 🔐 Autenticazione Firebase

## Tech Stack

- **Frontend:** React 19 + TypeScript + Vite
- **Backend:** Firebase (Firestore, Auth, Storage, Messaging)
- **Deploy:** Vercel
- **Build:** npm + Vite (642KB gzipped)

## Run Locally

**Prerequisites:**  Node.js 18+

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set the environment variables in [.env.local](.env.local):
   ```
   VITE_FIREBASE_API_KEY=your_key
   VITE_FIREBASE_AUTH_DOMAIN=your_domain
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_bucket
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   VITE_FIREBASE_APP_ID=your_app_id
   GEMINI_API_KEY=your_gemini_key
   ```

3. Run the app:
   ```bash
   npm run dev
   ```

4. Build for production:
   ```bash
   npm run build
   ```

## Setup Variabili Ambiente (Vercel)

Usa lo script automatico per aggiungere le variabili a Vercel:

```powershell
.\setup-env.ps1
```

O seguire la [guida manuale](SETUP_ENV_VARIABLES.md)

## Deployment

L'app è automaticamente deployata su Vercel quando fai push su `main`:

```bash
git push origin main
```

Vercel triggerizzerà automaticamente il build e il deploy.

---

**Last Updated:** December 16, 2025  
**Version:** 1.0.0
