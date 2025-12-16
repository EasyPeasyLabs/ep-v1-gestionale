# Criticità Residue e Roadmap di Miglioramento

**Data:** 15 Dicembre 2025  
**Stato Attuale:** 10 bug critici corretti, build stabile  
**Prossimi Passi:** Criticità residue da affrontare

---

## ⚠️ Criticità Residue (Non Urgenti)

### 1. **Ricalcolo Costi Noli Granulare**
**Gravità:** 🟡 MEDIA  
**Status:** ❌ NON RISOLTO (da affrontare in futuro)

**Problema Attuale:**
```
Quando cancelli un'iscrizione:
- Scenario: Sede A, Gennaio: 10 lezioni (€1000 nolo)
- Cancelli 3 iscrizioni con 5 lezioni
- EFFETTO: Transazione nolo ELIMINATA completamente
- RISULTATO: Rimangono 5 lezioni senza costo addebitato!
```

**Soluzione Ideale:**
```typescript
// In financeService.ts - nuova funzione
export const recalculateLocationRents = async (
    locationId: string,
    monthKey: string, // "2025-01"
    enrollments: Enrollment[]
): Promise<void> => {
    // 1. Cancella vecchia transazione AUTO-RENT per questo mese/sede
    // 2. Ricalcola conteggio lezioni presenti (filtered by actualLocation)
    // 3. Se count > 0: crea nuova transazione
    // 4. Se count = 0: niente (nolo zero per il mese)
}
```

**Dove Usarla:**
```typescript
// In cleanupEnrollmentFinancials(), linea 343
if (enrollment.locationId && enrollment.locationId !== 'unassigned') {
    const appointmentDate = enrollment.appointments[0]?.date;
    const monthKey = appointmentDate ? 
        extractMonthKey(appointmentDate) : 
        getCurrentMonthKey();
    await recalculateLocationRents(enrollment.locationId, monthKey, allEnrollments);
}
```

---

### 2. **Transazioni Atomiche Firestore**
**Gravità:** 🔴 CRITICA (Consistenza Dati)  
**Status:** ❌ NON IMPLEMENTATO

**Problema Attuale:**
```
Flusso Pagamento (executePayment):
  1. Crea Fattura ✅
  2. Crea Transazione ✅
  3. Aggiorna Status Iscrizione ✅

Se fallisce tra step 1 e 2:
  → Fattura creata SU LUI
  → Transazione non creata ❌
  → INCONSISTENZA: Ricavo registrato senza controparte

Se fallisce tra step 2 e 3:
  → Fattura creata
  → Transazione creata
  → Status rimane Pending ❌
  → INCONSISTENZA: Cliente pagato ma iscrizione non attivata
```

**Soluzione:**
```typescript
// PRIMA (attuale, non atomica)
await addInvoice(invoiceInput);
await addTransaction({ ... });
await updateEnrollment(enr.id, { status: EnrollmentStatus.Active });

// DOPO (atomica)
const batch = writeBatch(db);
batch.set(invoiceDocRef, invoiceData);
batch.set(transactionDocRef, transactionData);
batch.update(enrollmentDocRef, { status: EnrollmentStatus.Active });
await batch.commit(); // ✅ Tutto-o-niente
```

**Dove Applicare:**
- `pages/Enrollments.tsx:300-370` — executePayment() → creare funzione separata `atomicPayment()`
- `services/enrollmentService.ts:280-310` — activateEnrollmentWithLocation()
- `components/EnrollmentForm.tsx:180` — onSave()

---

### 3. **Soft Delete Tracking per Costi Sedi**
**Gravità:** 🟡 MEDIA  
**Status:** ❌ NON IMPLEMENTATO

**Problema:**
```
Query: "Calcola costi noli per Gennaio"
→ Conta lezioni di iscrizioni ATTIVE (status = Active)
→ NON conta lezioni di iscrizioni ELIMINATE (isDeleted = true)

Scenario:
- Iscrizione A: 3 lezioni, eliminata (soft-delete)
- Iscrizione B: 7 lezioni, attiva
- Costo nolo calcolato: 7 × €100 = €700
- Costo REALE dovrebbe essere: 10 × €100 = €1000 ❌
```

**Soluzione:**
```typescript
// In calculateRentTransactions(), distinguere:
const activeEnrollments = enrollments.filter(e => e.status === EnrollmentStatus.Active);
const deletedEnrollments = enrollments.filter(e => e.isDeleted);

// Costi Attivi (transazioni Pending)
const activeCost = calculateForEnrollments(activeEnrollments);

// Costi Storici (transazioni Completed? o marking separate?)
const historicalCost = calculateForEnrollments(deletedEnrollments);
```

---

### 4. **Audit Trail Completo Finanziario**
**Gravità:** 🟡 ALTA  
**Status:** ❌ NON IMPLEMENTATO

**Problema:** Nessuna tabella di audit per:
- Chi ha cancellato una fattura
- Quando è stato modificato uno status di transazione
- Modifica di importi dopo creazione

**Soluzione:**
```typescript
// Nuova collection: 'audit_log'
interface AuditLog {
    id: string;
    timestamp: Timestamp;
    userId: string;
    action: 'INVOICE_CREATE' | 'INVOICE_UPDATE' | 'TRANSACTION_DELETE' | ...;
    targetId: string; // invoiceId, transactionId, etc.
    targetType: 'invoice' | 'transaction' | 'enrollment';
    changesSummary: {
        field: string;
        oldValue: any;
        newValue: any;
    }[];
    metadata: {
        enrollmentId?: string;
        clientId?: string;
        reason?: string;
    };
}
```

---

### 5. **Sincronizzazione Clienti Prima Fatturazione**
**Gravità:** 🟠 MEDIA  
**Status:** ❌ NON IMPLEMENTATO

**Problema Attuale:**
```typescript
// In executePayment(), linea 238
const client = clients.find(c => c.id === enr.clientId);
if (!client) throw new Error("Cliente non trovato");
```

Se la lista di clienti in memoria è **stale** (vecchia), errore!

**Soluzione:**
```typescript
// PRIMA di fatturare
const executePayment = async (...) => {
    try {
        // 1. Refresh clienti da Firestore (anti-cache)
        const freshClients = await getClients(); // forceRefresh = true
        
        // 2. Verifica cliente
        const client = freshClients.find(c => c.id === enr.clientId);
        if (!client) throw new Error("Cliente non trovato post-refresh");
        
        // 3. Procedi a fatturare
        ...
    }
}
```

---

### 6. **Unit Tests Flusso di Pagamento**
**Gravità:** 🟠 MEDIA  
**Status:** ❌ NON IMPLEMENTATO

**Test Mancanti:**
```typescript
describe('executePayment', () => {
    test('dovrebbe creare fattura e transazione atomicamente', () => {});
    test('dovrebbe validare depositAmount ≤ fullPrice', () => {});
    test('dovrebbe aggiornare status a Active se Pending', () => {});
    test('dovrebbe generare Fattura Fantasma se acconto', () => {});
    test('dovrebbe fallire se cliente non trovato', () => {});
    test('dovrebbe tracciare actualLocation in transazione', () => {});
});

describe('calculateRentTransactions', () => {
    test('dovrebbe usare actualLocation se disponibile', () => {});
    test('dovrebbe creare fallback per sede non trovata', () => {});
    test('dovrebbe aggregare per mese correttamente', () => {});
});
```

---

### 7. **Logica Saldi Multipli**
**Gravità:** 🟠 MEDIA  
**Status:** ⚠️ PARZIALE

**Problema:**
```
Scenario: Iscrizione €1000
- Acconto 1: €300 → Fattura 1 (€300)
- Acconto 2: €200 → Fattura 2 (€200)
- Saldo: €500 → Fattura Fantasma (€500)

DOMANDA: E se cliente paga più acconti?
- Attualmente crea una sola Fattura Fantasma
- Dovrebbe aggiornare la Fattura Fantasma precedente?
- O creare una nuova?
```

**Decisione Richiesta:**
- Policy saldi multipli vs singolo saldo finale
- Impatto su cleanupEnrollmentFinancials()

---

## 🔄 Miglioramenti Strutturali

### A. **Refactor Architettura Finanziaria**
```
ATTUALE: ogni operazione genera Fattura + Transazione + AgiornamentoStatus
       → Logica sparse in Enrollments.tsx

IDEALE: Service layer dedicato
       ├─ paymentService.ts
       │  ├── atomicPayment()
       │  ├── generateInvoiceWithTransaction()
       │  ├── handlePartialPayment()
       │  └── syncEnrollmentAfterPayment()
       └─ Enrollments.tsx → chiama paymentService
```

### B. **Event-Driven Architecture**
```
ATTUALE: EP_DataUpdated event generico

IDEALE:
├── ENROLLMENT_CREATED
├── ENROLLMENT_ACTIVATED
├── ENROLLMENT_PAYMENT_REGISTERED
├── ENROLLMENT_DELETED
├── APPOINTMENT_REGISTERED
├── INVOICE_CREATED
├── RENT_CALCULATED
└── ...

Subscriber:
├── Dashboard → ENROLLMENT_ACTIVATED, APPOINTMENT_REGISTERED
├── Finance → RENT_CALCULATED, INVOICE_CREATED
├── Notifications → ENROLLMENT_PAYMENT_REGISTERED, ENROLLMENT_DELETED
└── AuditLog → Tutti gli eventi (per tracciamento completo)
```

### C. **Validazione Schema Firestore**
```
Attualmente nessuna validation a livello database.
Aggiungere Firestore Security Rules:

match /enrollments/{enrollmentId} {
    allow create: if request.auth != null 
                 && request.resource.data.price > 0
                 && request.resource.data.clientId in get(/databases/$(database)/documents/clients/$(request.resource.data.clientId));
    allow update: if request.auth != null 
                 && isValidStatusTransition(resource.data.status, request.resource.data.status);
}
```

---

## 📊 Tabella Roadmap Priorità

| ID | Criticità | Sforzo | Impatto | Priority | Sprint |
|----|-----------|--------|--------|----------|--------|
| 1 | Ricalcolo noli granulare | 🔴 Alto | 🔴 Alto | P0 | Q1-2025 |
| 2 | Transazioni atomiche | 🔴 Alto | 🔴 Critico | P0 | Q1-2025 |
| 3 | Soft delete tracking | 🟡 Medio | 🟡 Medio | P1 | Q1-2025 |
| 4 | Audit trail | 🟡 Medio | 🟡 Alto | P1 | Q2-2025 |
| 5 | Sincronizzazione clienti | 🟢 Basso | 🟡 Medio | P2 | Q2-2025 |
| 6 | Unit tests | 🔴 Alto | 🟡 Medio | P2 | Q2-2025 |
| 7 | Logica saldi multipli | 🟢 Basso | 🟠 Basso | P3 | Q2-2025 |
| 8 | Refactor finanza | 🔴 Molto Alto | 🔴 Alto | P1 | Q2-2025 |
| 9 | Event-driven | 🔴 Molto Alto | 🟡 Medio | P1 | Q3-2025 |
| 10 | Firestore validation | 🟡 Medio | 🟡 Alto | P1 | Q1-2025 |

---

## 🎯 Checklist per Sviluppatore

Per risolvere le criticità, seguire questo ordine:

```
FASE 1 (Immediato - Q1 2025):
- [ ] Implementare transazioni atomiche in executePayment()
- [ ] Aggiungere Firestore Security Rules
- [ ] Creare recalculateLocationRents() function
- [ ] Aggiornare cleanupEnrollmentFinancials()

FASE 2 (Breve termine - Q1/Q2 2025):
- [ ] Refactor paymentService.ts (separare logica da Enrollments.tsx)
- [ ] Implementare Audit Trail collection + logging
- [ ] Soft delete tracking in rent calculation
- [ ] Sincronizzazione clienti pre-fatturazione

FASE 3 (Medio termine - Q2 2025):
- [ ] Aggiungere unit tests per payment flow
- [ ] Implementare event-driven architecture
- [ ] Testing e documentazione saldi multipli

FASE 4 (Lungo termine - Q3 2025):
- [ ] Analytics dashboard (costi per sede, margini, ecc.)
- [ ] Reconciliazione automatica Firestore ↔ Ragioneria
- [ ] Export dati per software ragioneria
```

---

## 📞 Contatti per Chiarimenti

Per domande su:
- **Bug critici corretti:** Vedi `DATAFLOW_AUDIT_REPORT.md`
- **Correzioni applicate:** Vedi `CORREZIONI_AUDIT_DATAFLOW.md`
- **Architecture decisions:** Chiedere al team lead

---

**Fine Report.**  
*Generato: 15 Dicembre 2025*

