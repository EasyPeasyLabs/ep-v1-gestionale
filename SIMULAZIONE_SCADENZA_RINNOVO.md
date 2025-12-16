# 🧪 SIMULAZIONE: Scadenza Abbonamento → Rinnovo → Consumo Slot

**Data Test:** 15 Dicembre 2025  
**Scenario:** Marco Rossi (Cliente) → Andrea (figlio) 4 lezioni/mese → Scadenza → Rinnovo  

---

## FASE 1️⃣: Scenario Iniziale

```
📅 DATA OGGI: 15 Dicembre 2025

👨‍👩‍👦 FAMIGLIA: Marco Rossi (Cliente)
  └─ 🧒 FIGLIO: Andrea, 7 anni

📦 ISCRIZIONE 1 (PRIMA SCADENZA):
  ├─ ID: enr-001
  ├─ Subscription: "4 Lezioni Mensili"
  ├─ Prezzo: €120/mese
  ├─ Lezioni Totali: 4
  ├─ Lezioni Rimanenti: 3 ✅ (1 già consumata il 10 Dic)
  ├─ Start Date: 15 Novembre 2025
  ├─ End Date: 15 Dicembre 2025 (📍 SCADE OGGI!)
  ├─ Status: Active ✅
  ├─ Sede: Aula A (Fornitori SRL)
  └─ Appointments:
      ├─ 25-Nov-2025 → Present (lezione consumata) ✅
      ├─ 02-Dec-2025 → Scheduled (non ancora fatta)
      └─ 09-Dec-2025 → Scheduled (non ancora fatta)
```

---

## FASE 2️⃣: SCADENZA ABBONAMENTO - Notifiche Automatiche

### ✅ TEST: Notifiche di Scadenza Attivate?

**File:** `services/notificationService.ts` linea 62-72

```typescript
// Scadenza temporale
if (endDate >= today && endDate <= sevenDaysFromNow) {
    const diffTime = endDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    notifications.push({
        id: `enr-exp-${enr.id}`,
        type: 'expiry',
        message: `L'iscrizione di ${enr.childName} (${parentName}) scade tra ${diffDays} giorni.`,
        clientId: enr.clientId,
        date: new Date().toISOString(),
        linkPage: 'Enrollments',
        filterContext: { status: 'active', searchTerm: enr.childName }
    });
}
```

### 📋 SIMULAZIONE STEP-BY-STEP

```javascript
// STEP 1: getNotifications() viene chiamato (es. da Dashboard.tsx, Header.tsx)
const notifications = await getNotifications(userId);

// STEP 2: Calcolo della scadenza
const enr = {
    id: 'enr-001',
    childName: 'Andrea',
    endDate: '2025-12-15T00:00:00Z',  // ISO String
    status: 'Active'
};

const today = new Date('2025-12-15T00:00:00Z');
const endDate = new Date('2025-12-15T00:00:00Z');
const diffTime = endDate.getTime() - today.getTime();  // = 0 ms
const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));  // = 0 giorni

// STEP 3: Condizione controllata
if (endDate >= today && endDate <= sevenDaysFromNow) {  // ✅ TRUE (0 giorni ≤ 7)
    // Notifica creata!
    const notification = {
        id: 'enr-exp-enr-001',
        type: 'expiry',
        message: 'L\'iscrizione di Andrea (Marco Rossi) scade tra 0 giorni.',
        clientId: 'client-001',
        linkPage: 'Enrollments'
    };
}

// RISULTATO: ✅ Notifica inviata al Dashboard
```

### 🎯 ASPETTATIVE vs REALTÀ

| Aspettativa | Realtà | Status |
|-------------|--------|--------|
| Notifica visibile in Dashboard | ✅ Sì (getNotifications ritorna array) | ✅ PASS |
| Tipo notifica = 'expiry' | ✅ Sì | ✅ PASS |
| Message contiene "Andrea" | ✅ Sì | ✅ PASS |
| linkPage = 'Enrollments' | ✅ Sì | ✅ PASS |
| Giorni rimanenti calcolati correttamente | ⚠️ 0 giorni (leggibile ma neutro) | ⚠️ EDGE CASE |
| **Iscrizione rimane Scheduled fino a rinnovo** | ❌ NO - Non è impedito creare nuova iscrizione | ❌ **BUG #1** |

---

## FASE 3️⃣: SCADENZA ABBONAMENTO - Test Invio WhatsApp

### ✅ TEST: WhatsApp Message Integration

**File:** `pages/CRM.tsx` linea 90-120

```typescript
// CommunicationModal handleSend() function
if (channel === 'whatsapp') {
    // targetPhones = ['+393331234567'] (numero Marco Rossi)
    
    targetPhones.forEach(rawPhone => {
        // 1. Pulisce il numero: rimuove tutto tranne le cifre
        let cleanPhone = rawPhone.replace(/[^0-9]/g, '');
        
        // 2. Rimuove '00' iniziale se presente
        if (cleanPhone.startsWith('00')) {
            cleanPhone = cleanPhone.substring(2);
        }
        
        // 3. Logica Prefisso Italia
        if (cleanPhone.length === 10) {
            cleanPhone = '39' + cleanPhone;
        }
        
        // 4. Apre WhatsApp Web
        if (cleanPhone) {
            window.open(`https://wa.me/${cleanPhone}?text=${encodedMsg}`, '_blank');
        }
    });
    
    // 5. Logga in CommunicationLogs
    await logCommunication({
        date: new Date().toISOString(),
        channel: 'whatsapp',
        subject: subject,
        message: message,
        recipients: ['Marco Rossi'],
        recipientCount: 1,
        type: 'manual'
    });
}
```

### 📋 SIMULAZIONE MESSAGGIO WHATSAPP

```
👤 ADMIN INVIA MESSAGGIO A MARCO ROSSI

📌 INPUT:
├─ Destinatario: "Marco Rossi" (cliente)
├─ Numero: "333 1234567"
├─ Canale: WhatsApp
├─ Subject: "Rinnovo Iscrizione Andrea"
└─ Message: "Gentile Marco,\n\nLa iscrizione di Andrea scade oggi (15 Dicembre).\nPer continuare, è necessario rinnovare il pacchetto.\n\nVisite le iscrizioni per effettuare il rinnovo."

🔄 ELABORAZIONE:
├─ Clean number: "333 1234567" → "3331234567" (10 cifre)
├─ Add country code: "3331234567" → "393331234567"
├─ Encode message: "Rinnovo%20Iscrizione%20Andrea%0A%0A..."
└─ Build URL: "https://wa.me/393331234567?text=..."

📱 OUTPUT:
├─ WhatsApp Web apre automaticamente
├─ Chat pre-compilata con messaggio
├─ Marco Rossi vede: "*Rinnovo Iscrizione Andrea*\n\nGentile Marco,..."
└─ Log salvato in 'communicationLogs' collection

✅ RISULTATO: CommunicationLog creato
   ├─ id: auto-generated
   ├─ date: "2025-12-15T14:30:00Z"
   ├─ channel: "whatsapp"
   ├─ subject: "Rinnovo Iscrizione Andrea"
   ├─ recipients: ["Marco Rossi"]
   ├─ recipientCount: 1
   └─ type: "manual"
```

### 🎯 ASPETTATIVE vs REALTÀ

| Aspettativa | Realtà | Status |
|-------------|--------|--------|
| WhatsApp Web si apre | ✅ Sì (window.open()) | ✅ PASS |
| Numero pulito correttamente | ✅ Sì (regex + logica Italia) | ✅ PASS |
| Messaggio pre-compilato | ✅ Sì (URL encoding) | ✅ PASS |
| Log salvato in Firestore | ✅ Sì (logCommunication) | ✅ PASS |
| **Numero telefono obbligatorio?** | ⚠️ NO - Client/Supplier può non averlo | ⚠️ **BUG #2** |
| **Validazione numero telefono?** | ❌ NO - Accetta qualsiasi stringa | ❌ **BUG #3** |

---

## FASE 4️⃣: RINNOVO ABBONAMENTO - Reiscrizione

### ✅ TEST: Creazione Nuova Iscrizione (Rinnovo)

**File:** `components/EnrollmentForm.tsx` linea 100-200

```typescript
// STEP 1: Marco Rossi seleziona "Rinnova Andrea"
// STEP 2: EnrollmentForm apre in "NEW MODE"
// STEP 3: Form pre-compilato:
const newEnrollment: EnrollmentInput = {
    clientId: 'client-001',        // ✅ Stesso cliente
    childId: 'child-001',           // ✅ Stesso figlio
    childName: 'Andrea',
    isAdult: false,
    subscriptionTypeId: 'sub-003',  // STESSO abbonamento (4 lezioni)
    subscriptionName: '4 Lezioni Mensili',
    price: 120,
    
    supplierId: 'unassigned',       // ⚠️ Reset a "da assegnare"
    supplierName: '',
    locationId: 'unassigned',       // ⚠️ Reset a "da assegnare"
    locationName: 'Sede Non Definita',
    locationColor: '#e5e7eb',
    
    appointments: [],               // ✅ Vuoto (verrà ripopolato)
    lessonsTotal: 4,                // ✅ 4 lezioni
    lessonsRemaining: 4,            // ✅ Tutte nuove
    startDate: '2025-12-15T00:00:00Z',
    endDate: '2026-01-15T00:00:00Z',  // 1 mese di durata
    status: 'Pending'               // ⚠️ Ritorna a Pending fino a pagamento
};

// STEP 4: Salvataggio in Firestore
await addDoc(collection(db, 'enrollments'), newEnrollment);

// RISULTATO:
// ✅ Nuova iscrizione creata (enr-002)
// ✅ lessonsRemaining = 4 (carnet completo)
// ✅ Status = Pending (in attesa di pagamento)
// ⚠️ Sede reset a "unassigned" (dovrà essere riassegnata)
// ⚠️ Vecchia iscrizione (enr-001) rimane Active ma scaduta
```

### 📋 STATO DOPO RINNOVO (PRIMA PAGAMENTO)

```
📅 DATA: 15 Dicembre 2025

📦 ISCRIZIONE 1 (VECCHIA - SCADUTA):
  ├─ ID: enr-001
  ├─ Status: Active ❌ (dovrebbe essere Expired o Completed)
  ├─ End Date: 15-12-2025 (SCADUTO)
  ├─ Lezioni Rimanenti: 3 ❌ (non consumate prima della scadenza!)
  └─ ❌ CRITICO: Lezioni "orfane" - non potranno mai essere consumate!

📦 ISCRIZIONE 2 (NUOVA - RINNOVO):
  ├─ ID: enr-002
  ├─ Status: Pending ✅
  ├─ Start Date: 15-12-2025
  ├─ End Date: 15-01-2026
  ├─ Lezioni Totali: 4
  ├─ Lezioni Rimanenti: 4 ✅
  ├─ Sede: Unassigned ⚠️ (dovrà essere riassegnata)
  └─ Appointments: [] (vuoto)
```

### 🎯 ASPETTATIVE vs REALTÀ (RINNOVO SENZA PAGAMENTO)

| Aspettativa | Realtà | Status | Criticità |
|-------------|--------|--------|-----------|
| Nuova iscrizione creata | ✅ Sì | ✅ PASS | - |
| lessonsTotal = 4 | ✅ Sì | ✅ PASS | - |
| lessonsRemaining = 4 | ✅ Sì | ✅ PASS | - |
| Status = Pending | ✅ Sì | ✅ PASS | - |
| Sede reset a unassigned | ✅ Sì (da form) | ✅ PASS | ✅ OK |
| **Vecchia iscrizione mark Expired** | ❌ NO - rimane Active | ❌ FAIL | **BUG #4** 🔴 |
| **Lezioni scadute autom. cancellate** | ❌ NO - rimangono orfane | ❌ FAIL | **BUG #5** 🔴 |
| **Impedire creazione doppia iscrizione** | ❌ NO - nessun check | ❌ FAIL | **BUG #6** 🟡 |

---

## FASE 5️⃣: RINNOVO - Riassegnazione Sede

### ✅ TEST: Assegnazione a STESSA SEDE

```
📌 SCENARIO A: Riassegna Andrea a STESSA sede (Aula A)

STEP 1: Drag&Drop enr-002 su slot Aula A
└─ activateEnrollmentWithLocation(enr-002, 'sup-aula-a', 'Aula A', '#3b82f6')

STEP 2: Crea 4 nuove lezioni (successivamente al rinnovo)
├─ Lezione 1: 22-12-2025 15:00-16:00 @ Aula A → Scheduled
├─ Lezione 2: 29-12-2025 15:00-16:00 @ Aula A → Scheduled
├─ Lezione 3: 05-01-2026 15:00-16:00 @ Aula A → Scheduled
└─ Lezione 4: 12-01-2026 15:00-16:00 @ Aula A → Scheduled

STEP 3: Aggiorna enrollment
├─ supplierId: 'sup-aula-a'
├─ locationId: 'sup-aula-a/loc-aula-a'
├─ locationName: 'Aula A'
├─ appointments: [...]
├─ status: Active ✅
└─ lessonsRemaining: 4

RISULTATO: ✅ Nuove lezioni create, tutte a Aula A
```

### ✅ TEST: Assegnazione a SEDE DIVERSA

```
📌 SCENARIO B: Riassegna Andrea a SEDE DIVERSA (Aula B)

STEP 1: Drag&Drop enr-002 su slot Aula B
└─ activateEnrollmentWithLocation(enr-002, 'sup-aula-b', 'Aula B', '#ec4899')

STEP 2: Crea 4 nuove lezioni a Aula B
├─ Lezione 1: 20-12-2025 17:00-18:00 @ Aula B → Scheduled
├─ Lezione 2: 27-12-2025 17:00-18:00 @ Aula B → Scheduled
├─ Lezione 3: 03-01-2026 17:00-18:00 @ Aula B → Scheduled
└─ Lezione 4: 10-01-2026 17:00-18:00 @ Aula B → Scheduled

STEP 3: Aggiorna enrollment
├─ supplierId: 'sup-aula-b'
├─ locationId: 'sup-aula-b/loc-aula-b'
├─ locationName: 'Aula B'
├─ appointments: [...]
├─ status: Active ✅
└─ lessonsRemaining: 4

RISULTATO: ✅ Nuove lezioni create, tutte a Aula B
```

### 🎯 ASPETTATIVE vs REALTÀ

| Aspettativa | Realtà | Status |
|-------------|--------|--------|
| Drag&Drop funziona | ✅ Sì | ✅ PASS |
| 4 lezioni create | ✅ Sì (generateRecurringLessons) | ✅ PASS |
| Location aggiornata | ✅ Sì (activateEnrollmentWithLocation) | ✅ PASS |
| Status = Active | ✅ Sì (BUG #2 precedente era in questo) | ✅ PASS |
| **Lezioni ereditate da vecchia sede** | ❌ NO - nuove lezioni sempre | ✅ OK |

---

## FASE 6️⃣: CONSUMO SLOT - Simulazione Lezioni

### ✅ TEST: Registrazione Presenze e Consumo Slot

```
📅 TIMELINE CONSUMO:

22-12-2025 15:00-16:00 @ Aula A
├─ Andrea PRESENTE
├─ registerPresence(enr-002, app-001)
├─ lessonsRemaining: 4 → 3 ✅
├─ Notification: (nessuna, ancora > 2)
└─ ✅ Cost Rent: +€100 (1 lezione × €100/lezione Aula A)

29-12-2025 15:00-16:00 @ Aula A
├─ Andrea PRESENTE
├─ registerPresence(enr-002, app-002)
├─ lessonsRemaining: 3 → 2 ✅
├─ Notification: (nessuna, esattamente 2)
└─ ✅ Cost Rent: +€100 (Aula A)

05-01-2026 15:00-16:00 @ Aula A
├─ Andrea PRESENTE
├─ registerPresence(enr-002, app-003)
├─ lessonsRemaining: 2 → 1 ⚠️
├─ Notification: ✅ "AVVISO: Restano solo 1 lezione per Andrea!"
└─ ✅ Cost Rent: +€100 (Aula A)

12-01-2026 15:00-16:00 @ Aula A
├─ Andrea PRESENTE
├─ registerPresence(enr-002, app-004)
├─ lessonsRemaining: 1 → 0 ⚠️ ESAURITO
├─ Notification: ❌ (lessonsRemaining ≤ 2 include 0, ma già notificato prima)
└─ ✅ Cost Rent: +€100 (Aula A)

💰 RIEPILOGO COSTI:
   ├─ Gennaio 2026: 4 lezioni × €100 = €400 (Aula A)
   └─ Auto-RENT Transaction creato automaticamente
```

### 🎯 ASPETTATIVE vs REALTÀ (CONSUMO SLOT)

| Aspettativa | Realtà | Status |
|-------------|--------|--------|
| lessonsRemaining decrementa | ✅ Sì (registerPresence) | ✅ PASS |
| Notifica dopo 2 lezioni | ✅ Sì (< 2) | ✅ PASS |
| Costi noli calcolati | ✅ Sì (calculateRentTransactions) | ✅ PASS |
| **Iscrizione ESAURITA→Expired** | ⚠️ NO - rimane Active | ⚠️ **BUG #7** 🟡 |
| **Ulteriori iscrizioni bloccate** | ❌ NO - puoi farne altre | ⚠️ **BUG #8** 🟡 |

---

## FASE 7️⃣: RINNOVO - Notifiche Cliente e Messaggi

### ✅ TEST: Notifiche Automatiche ad ESAURIMENTO SLOT

```
📌 SCENARI DI NOTIFICA:

1️⃣ LEZIONI IN ESAURIMENTO:
   ├─ Trigger: lessonsRemaining ≤ 2 (linea 75-81, notificationService.ts)
   ├─ Message: "Restano solo 1 lezioni per Andrea (Marco Rossi)."
   ├─ Type: 'low_lessons'
   ├─ UI: Dashboard notifications bell
   └─ Log: console, localStorage ignored IDs

2️⃣ SCADENZA TEMPORALE:
   ├─ Trigger: endDate >= today && endDate <= today+7giorni
   ├─ Message: "L'iscrizione di Andrea scade tra 2 giorni."
   ├─ Type: 'expiry'
   ├─ UI: Dashboard notifications bell
   └─ Log: console, localStorage ignored IDs

3️⃣ RINNOVO NECESSARIO:
   ├─ Trigger: Auto nella pagina CRM
   ├─ UI: "Rinnovi Iscrizioni" card
   ├─ Action: Button "Contatta" → apre CommunicationModal
   └─ Messaggio pre-compilato: "L'iscrizione di Andrea scade il 15-01-2026..."
```

### 📧 TEST: Preparazione Messaggi Email e WhatsApp

```
📧 EMAIL TEMPLATE (settingsService.ts linea 135-139):

Subject: "Rinnovo Iscrizione in scadenza - Andrea"

Body:
"Gentile Marco Rossi,

Ti ricordiamo che l'iscrizione di Andrea scadrà il 15 gennaio 2026.
Per confermare il posto per il prossimo periodo, ti preghiamo di effettuare il rinnovo.

A presto,
Easy Peasy"

---

📱 WHATSAPP MESSAGE:

"*Rinnovo Iscrizione di Andrea*

Gentile Marco,

L'iscrizione per Andrea scadrà il 15 gennaio 2026.

Per continuare senza interruzioni, ti chiediamo di rinnovare il pacchetto.

Accedi al sistema e seleziona 'Rinnova Iscrizione'.

Grazie,
Easy Peasy"

---

✅ FLOW:
   ├─ Admin apre CRM → tab Panoramica
   ├─ Vede card "Andrea - Scade il 15-01-2026"
   ├─ Clicca "Contatta"
   ├─ CommunicationModal apre
   ├─ Seleziona canale (email/whatsapp)
   ├─ Personalizza messaggio (opzionale)
   ├─ Clicca "Invia"
   └─ Log salvato + Marco notificato
```

### 🎯 ASPETTATIVE vs REALTÀ (NOTIFICHE RINNOVO)

| Aspettativa | Realtà | Status |
|-------------|--------|--------|
| Notifica nel Dashboard | ✅ Sì (getNotifications) | ✅ PASS |
| Card visibile in CRM | ✅ Sì (CRM.tsx fetchData) | ✅ PASS |
| Email template disponibile | ✅ Sì (settingsService) | ✅ PASS |
| WhatsApp number pulito | ✅ Sì (regex+Italia fix) | ✅ PASS |
| Log salvato in Firestore | ✅ Sì (logCommunication) | ✅ PASS |
| **Numero telefonico obbligatorio** | ❌ NO | ❌ **BUG #2** 🔴 |
| **Validazione numero** | ❌ NO - accetta qualsiasi | ❌ **BUG #3** 🟡 |
| **Email confermata ricevuta** | ❌ NO - solo log locale | ❌ **BUG #9** 🟡 |

---

## 📊 RIEPILOGO BUG IDENTIFICATI

| # | Descrizione | Gravità | File | Status |
|---|-------------|---------|------|--------|
| 1 | Iscrizione non auto-marked Expired | 🔴 CRITICA | enrollmentService.ts | ❌ TO-FIX |
| 2 | Phone number non obbligatorio | 🔴 CRITICA | CRM.tsx, parentService.ts | ❌ TO-FIX |
| 3 | Validazione number phone assente | 🟡 ALTA | CRM.tsx | ❌ TO-FIX |
| 4 | Old enrollment non update Status | 🔴 CRITICA | enrollmentService.ts | ❌ TO-FIX |
| 5 | Lezioni orfane non pulite | 🔴 CRITICA | enrollmentService.ts | ❌ TO-FIX |
| 6 | Nessun controllo doppia iscrizione | 🟡 ALTA | EnrollmentForm.tsx | ❌ TO-FIX |
| 7 | Enrollment esaurito non Expired | 🟡 ALTA | enrollmentService.ts | ❌ TO-FIX |
| 8 | Nessun limite nuove iscrizioni | 🟡 MEDIA | EnrollmentForm.tsx | ⚠️ REVIEW |
| 9 | Email receipt non confermato | 🟡 MEDIA | CRM.tsx | ⚠️ TODO |
| 10 | Vecchia iscrizione slot still visible | 🟡 MEDIA | Enrollments.tsx | ⚠️ REVIEW |

---

## 🔧 PROSSIMO STEP

Analizzare il codice e correggere i BUG critici (#1, #2, #4, #5).

