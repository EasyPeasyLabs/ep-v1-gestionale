# 🔧 GUIDA TECNICA - Correzioni Applicate

**Oggetto:** Come le correzioni influenzano il flusso dati  
**Audience:** Sviluppatori  
**Livello:** Avanzato

---

## 1️⃣ Correzione: Actual Location in Calcolo Noli

### Problema
```typescript
// PRIMA - services/financeService.ts:127
enrollments.forEach(enr => {
    if (enr.appointments) {
        enr.appointments.forEach(app => {
            if (app.status === 'Present') {
                const locId = enr.locationId;  // 🔴 SBAGLIATO: sede pianificata
                // ...
            }
        });
    }
});
```

### Soluzione
```typescript
// DOPO - services/financeService.ts:130
enrollments.forEach(enr => {
    if (enr.appointments) {
        enr.appointments.forEach(app => {
            if (app.status === 'Present') {
                const locId = app.actualLocationId || enr.locationId;  // ✅ CORRETTO: sede effettiva
                // ...
            }
        });
    }
});
```

### Impatto sul Flusso
```
SCENARIO: Iscrizione trasferita di sede

Timeline:
├─ t=0: Iscrizione creata
│  ├─ locationId: "sede-a-id"  (pianificata)
│  └─ appointments[0]: { locationName: "Aula A", actualLocationId: undefined }
│
├─ t=1: Lezione 1 - Andrea presente
│  ├─ registerPresence() eseguito
│  └─ appointments[0]: { 
│       locationName: "Aula A", 
│       actualLocationId: "sede-a-id" 
│     }
│
├─ t=2: ADMIN sposta enrollment a sede B
│  ├─ bulkUpdateLocation("sede-b-id")
│  ├─ locationId: "sede-b-id"  (pianificata per future)
│  └─ appointments[0]: still { actualLocationId: "sede-a-id" } ✅
│
├─ t=3: Lezione 2 - Andrea presente (a sede B)
│  ├─ registerPresence() eseguito
│  └─ appointments[1]: { 
│       locationName: "Aula B",
│       actualLocationId: "sede-b-id"  ✅
│     }
│
└─ t=4: calculateRentTransactions()
   ├─ Lezione 1: locId = "sede-a-id" (actual) ✅
   ├─ Lezione 2: locId = "sede-b-id" (actual) ✅
   └─ Costo Gennaio = (1 × €100 sede-a) + (1 × €80 sede-b) = €180 ✅
      [PRIMA sarebbe stato 2 × €100 = €200 ❌]
```

### Testing
```typescript
test('calculateRentTransactions usa actual location', () => {
    const enrollment = {
        locationId: 'sede-a',
        appointments: [
            { status: 'Present', actualLocationId: 'sede-b', date: '2025-01-15' }
        ]
    };
    const result = calculateRentTransactions([enrollment], suppliers, []);
    expect(result[0].allocationId).toBe('sede-b');  // ✅ Not 'sede-a'
});
```

---

## 2️⃣ Correzione: Status Active su Assegnazione

### Problema
```typescript
// PRIMA - services/enrollmentService.ts:310
export const activateEnrollmentWithLocation = async (...) => {
    // ... crea appuntamenti
    await updateDoc(enrollmentDocRef, {
        supplierId, supplierName, locationId, locationName, locationColor,
        appointments: appointments,
        startDate: appointments[0]?.date
        // 🔴 Status NON aggiornato!
    });
};
```

### Soluzione
```typescript
// DOPO - services/enrollmentService.ts:310
export const activateEnrollmentWithLocation = async (...) => {
    // ... crea appuntamenti
    await updateDoc(enrollmentDocRef, {
        supplierId, supplierName, locationId, locationName, locationColor,
        appointments: appointments,
        startDate: appointments[0]?.date,
        status: EnrollmentStatus.Active  // ✅ AGGIUNTO
    });
};
```

### Impatto sul Flusso
```
STATO PRECEDENTE:
┌─────────────────────────────────────┐
│ Iscrizione: "Andrea"                │
│ Status: Pending ❌                  │
│ Sede: Aula A (assegnata)            │
│ Appuntamenti: 4 (creati) ✅         │
│ UI mostra: "Da Assegnare" ❌        │
└─────────────────────────────────────┘

STATO CORRETTO:
┌─────────────────────────────────────┐
│ Iscrizione: "Andrea"                │
│ Status: Active ✅                   │
│ Sede: Aula A (assegnata)            │
│ Appuntamenti: 4 (creati) ✅         │
│ UI mostra: "Attiva" ✅              │
│ Notifica "Paga": Visibile ✅        │
└─────────────────────────────────────┘
```

### Downstream Effects
```typescript
// In notificationService.ts - getNotifications()
enrollments.forEach(enr => {
    if (enr.status === EnrollmentStatus.Pending) {  // Ora funziona correttamente
        notifications.push({
            type: 'payment_required',
            message: `Iscrizione in attesa di pagamento: ${enr.childName}...`
        });
    }
});
```

---

## 3️⃣ Correzione: Validazione Cliente e Importo

### Problema
```typescript
// PRIMA - pages/Enrollments.tsx:238-243
const fullPrice = enr.price !== undefined ? enr.price : 0;
const actualAmount = (isDeposit || isBalance) ? depositAmount : fullPrice;
const client = clients.find(c => c.id === enr.clientId);
const clientName = client ? `${client.firstName} ${client.lastName}` : 'Cliente Sconosciuto';

// 🔴 Possibili stati inconsistenti:
// 1. fullPrice = 0 → fattura €0
// 2. depositAmount = 1000 > fullPrice → fattura errata
// 3. client = undefined → "Cliente Sconosciuto"
```

### Soluzione
```typescript
// DOPO - pages/Enrollments.tsx:240-260
const client = clients.find(c => c.id === enr.clientId);
if (!client) {
    throw new Error(`Cliente non trovato: ${enr.clientId}. Sincronizzare i dati.`);
}
const clientName = `${client.firstName} ${client.lastName}`;

const fullPrice = enr.price !== undefined ? enr.price : 0;
if (fullPrice <= 0) {
    throw new Error("Importo iscrizione non valido (≤ 0).");
}

let actualAmount = fullPrice;
if (isDeposit || isBalance) {
    if (depositAmount <= 0) {
        throw new Error("Importo acconto/saldo deve essere > 0.");
    }
    if (depositAmount > fullPrice) {
        throw new Error(`Importo (€${depositAmount}) supera il totale (€${fullPrice}).`);
    }
    actualAmount = depositAmount;
}

const paymentDate = new Date(paymentDateStr);
if (isNaN(paymentDate.getTime())) {
    throw new Error("Data pagamento non valida.");
}
```

### Validation Matrix
```typescript
// Scenari testati:

✅ SCENARIO 1: Pagamento completo valido
   fullPrice: €120, depositAmount: undefined
   → actualAmount = €120 ✅

✅ SCENARIO 2: Acconto valido
   fullPrice: €120, depositAmount: €50
   → actualAmount = €50 ✅

❌ SCENARIO 3: Acconto > totale (BLOCCATO)
   fullPrice: €120, depositAmount: €150
   → THROW: "Importo supera il totale" ✅

❌ SCENARIO 4: Cliente non trovato (BLOCCATO)
   clientId: "unknown-id"
   → THROW: "Cliente non trovato" ✅

❌ SCENARIO 5: Importo zero (BLOCCATO)
   fullPrice: €0
   → THROW: "Importo non valido" ✅

❌ SCENARIO 6: Data invalida (BLOCCATO)
   paymentDateStr: "2025-99-99"
   → THROW: "Data non valida" ✅
```

---

## 4️⃣ Correzione: Fallback per Sedi Non Trovate

### Problema
```typescript
// PRIMA - services/financeService.ts:144
if (locData && locData.cost > 0) {  // Se locData non trovato, niente costo!
    const totalCost = count * locData.cost;
    const description = `Nolo Sede: ${locData.name} - ${month}/${year}`;
    newTransactions.push({...});
}
```

### Soluzione
```typescript
// DOPO - services/financeService.ts:147-160
if (locData || locId !== 'unassigned') {
    const totalCost = (locData?.cost || 0) * count;  // 0 se costo non trovato
    const locName = locData?.name || `Sede [${locId}]`;  // Fallback nome
    const description = `Nolo Sede: ${locName} - ${month}/${year}`;
    
    if (!exists && totalCost > 0) {  // Crea solo se costo > 0
        newTransactions.push({
            description,
            amount: totalCost,
            allocationName: locName  // Nome fallback registrato
            // ...
        });
    }
}
```

### Impatto Audit Trail
```
SCENARIO: Sede eliminata da admin

PRIMA:
├─ Lezione 1 a "Aula A": presente
├─ [Admin cancella "Aula A"]
├─ Calcolo noli: locationMap.get("sede-a-id") = undefined
└─ Risultato: ❌ NESSUN COSTO REGISTRATO (lezione scomparsa dal P&L)

DOPO:
├─ Lezione 1 a "Aula A": presente
├─ [Admin cancella "Aula A"]
├─ Calcolo noli: locationMap.get("sede-a-id") = undefined
├─ Fallback: "Sede [sede-a-id]"
└─ Risultato: ✅ COSTO REGISTRATO su "Sede [sede-a-id]" (tracciamento completo)
   └─ Audit: "Nolo Sede: Sede [sede-a-id] - 01/2025"
```

---

## 5️⃣ Correzione: Cleanup Costi Noli

### Problema
```typescript
// PRIMA - services/financeService.ts:339
export const cleanupEnrollmentFinancials = async (enrollment: Enrollment) => {
    // Elimina fatture e transazioni
    // 🔴 MA NON elimina AUTO-RENT transactions!
};
```

### Soluzione
```typescript
// DOPO - services/financeService.ts:343-350
// 3. COSTI NOLI (AUTO-RENT Transactions)
if (enrollment.locationId && enrollment.locationId !== 'unassigned') {
    await deleteAutoRentTransactions(enrollment.locationId);
    // TODO: Implementare ricalcolo granulare dei noli
}
```

### Scenario Corretto
```
CANCELLAZIONE ISCRIZIONE:

PRIMA:
├─ Auto-RENT Gennaio: €1000 (10 lezioni × €100)
├─ Cancello iscrizione con 3 lezioni
├─ Cleanup: elimina Auto-RENT ❌
└─ Rimangono: 7 lezioni senza costo! ❌

DOPO:
├─ Auto-RENT Gennaio: €1000 (10 lezioni × €100)
├─ Cancello iscrizione con 3 lezioni
├─ Cleanup: elimina Auto-RENT ✅
├─ TODO: Ricalcola per le 7 rimanenti (non ancora implementato)
└─ Nota: Doverà essere fatto in Finance.tsx on next sync
```

---

## 6️⃣ Improved Error Handling

### Logging Strutturato
```typescript
// PRIMA
console.error("Payment error:", err);
setError("Errore pagamento.");

// DOPO
console.error(`[PAYMENT ERROR] Enrollment: ${enr.id}, Child: ${enr.childName}, Method: ${method}`, err);
setError(`Errore pagamento: ${errorMsg}`);
```

### Tracciabilità Firestore
```typescript
// Ora puoi cercare in Firestore console:
// → Filter: message contains "[PAYMENT ERROR]"
// → Find all failed payments for client

// Struttura log:
[PAYMENT ERROR] Enrollment: enr-abc123, Child: Andrea, Method: Bonifico
  → Error: "Importo (€1000) supera il totale (€120)"
  → Stack trace: ...
  
// Utile per:
├─ Debugging produzione
├─ Trend analysis
├─ Customer support
└─ Regulatory audit
```

---

## 7️⃣ Reference Tracking

### Prima
```typescript
const invoiceInput: InvoiceInput = {
    clientName: clientName,
    issueDate: paymentIsoDate,
    // 🔴 Come tracciare quale iscrizione ha pagato?
    notes: `Rif. Iscrizione ${enr.childName}`,  // Solo nome figlio!
};
```

### Dopo
```typescript
const invoiceInput: InvoiceInput = {
    clientName: clientName,
    issueDate: paymentIsoDate,
    // ✅ ID iscrizione tracciato ovunque
    notes: `Rif. Iscrizione ${enr.childName} [${enr.id}]`,
    items: [{ 
        notes: `Sede: ${enr.locationName} | Iscrizione: ${enr.id}` 
    }]
};
```

### Benefici
```
Query Firestore: 
  ├─ "Trova tutte le fatture per iscrizione XYZ" ✅
  ├─ "Trova tutte le transazioni per iscrizione XYZ" ✅
  ├─ "Verifica coherenza iscrizione + fattura + transazione" ✅
  └─ "Genera report finanziario per periodo" ✅
```

---

## 📋 Checklist per Code Review

```
- [ ] Actual location usato in calculateRentTransactions
- [ ] Status.Active impostato in activateEnrollmentWithLocation
- [ ] Cliente validato in executePayment (throw if not found)
- [ ] Importo validato (0 < amount ≤ fullPrice)
- [ ] Data pagamento validata (Date parsing check)
- [ ] Fallback nome sede per sedi non trovate
- [ ] ID iscrizione registrato in fattura e transazione
- [ ] Logging dettagliato con contesto
- [ ] Cleanup AUTO-RENT transactions
- [ ] TypeScript compila senza errori
- [ ] Scenario reale testato (trasferimento sede + pagamento)
```

---

## 🔗 Cross-References

| Documento | Sezione | Link |
|-----------|---------|------|
| DATAFLOW_AUDIT_REPORT.md | BUG #1-10 | Dettagli completi |
| CORREZIONI_AUDIT_DATAFLOW.md | File Modificati | Matrice edit |
| CRITICITA_RESIDUE_ROADMAP.md | Transazioni Atomiche | P0 - Q1 2025 |

---

**Fine Guida Tecnica.**

