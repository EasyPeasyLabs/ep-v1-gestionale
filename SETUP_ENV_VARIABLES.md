# 🔐 SETUP ENVIRONMENT VARIABLES - VERCEL

Questo file documenta come configurare le environment variables su Vercel.

## Opzione 1: Setup Automatico (CONSIGLIATO) ⚡

### Prerequisiti
```bash
npm install -g vercel    # Installa Vercel CLI globalmente
vercel login             # Effettua il login
```

### Esegui lo script
```powershell
.\setup-env.ps1
```

Lo script farà tutto automaticamente:
1. ✅ Verifica Vercel CLI
2. ✅ Aggiunge tutte le 6 variabili
3. ✅ Ti dice quando è finito
4. ✅ Ti mostra i prossimi step

---

## Opzione 2: Setup Manuale

Se il file `.gitignore` è correttamente configurato ed esclude i file con le variabili, puoi aggiungerle manualmente:

1. Vai a: https://vercel.com/easypeasylabs/ep-v1-gestionale/settings/environment-variables
2. Click "Add New" per ogni variabile:

| Nome | Valore |
|------|--------|
| `VITE_FIREBASE_API_KEY` | `AIzaSyDON9vmJzNvYH7Eqw3c2KlpgOjr3ToIJhM` |
| `VITE_FIREBASE_AUTH_DOMAIN` | `ep-gestionale-v1.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | `ep-gestionale-v1` |
| `VITE_FIREBASE_STORAGE_BUCKET` | `ep-gestionale-v1.firebasestorage.app` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `332612800443` |
| `VITE_FIREBASE_APP_ID` | `1:332612800443:web:d5d434d38a78020dd57e9e` |

3. Per ogni variabile, seleziona gli scope: **Production**, **Preview**, **Development**
4. Click "Save"

---

## Dopo aver aggiunto le variabili

1. Vai a: https://vercel.com/easypeasylabs/ep-v1-gestionale/deployments
2. Clicca sul deployment fallito (rosso)
3. Clicca il bottone **"Redeploy"**
4. Aspetta 30-60 secondi
5. L'app sarà live su: https://ep-v1-gestionale.vercel.app

---

## 🔒 Sicurezza

⚠️ **IMPORTANTE:**
- **NON** committare `.env.local` nel repository (è in .gitignore)
- Le variabili rimangono solo in Vercel Dashboard
- Il codice legge da `import.meta.env.VITE_*` in produzione

---

## Verifica

Per verificare che le variabili siano state aggiunte correttamente:

```bash
vercel env ls
```

Dovrai vedere tutte e 6 le variabili elencate con i loro scope.

---

## Troubleshooting

### "Vercel CLI non trovato"
```bash
npm install -g vercel
```

### "Non sei loggato"
```bash
vercel login
```

### "Deployment ancora fallisce"
1. Controlla i Build Logs in Vercel Dashboard
2. Verifica che tutte e 6 le variabili siano salvate
3. Prova il Redeploy manualmente

---

**Created:** December 16, 2025  
**Project:** ep-v1-gestionale  
**Environment:** Vercel Production
