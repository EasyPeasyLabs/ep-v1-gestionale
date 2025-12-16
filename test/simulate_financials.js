// Script Node standalone per simulazione calcolo noli (no Firebase)

const TransactionType = { Expense: 'expense', Income: 'income' };
const TransactionCategory = { Rent: 'Nolo Sedi' };

function calculateRentTransactions(enrollments, suppliers, existingTransactions) {
  const newTransactions = [];
  const locationMap = new Map();
  suppliers.forEach(s => {
    (s.locations || []).forEach(l => locationMap.set(l.id, { cost: l.rentalCost || 0, name: l.name }));
  });

  const aggregates = new Map();

  enrollments.forEach(enr => {
    (enr.appointments || []).forEach(app => {
      if (app.status === 'Present') {
        const date = new Date(app.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
        const locId = app.actualLocationId || enr.locationId;
        const key = `${monthKey}|${locId}`;
        aggregates.set(key, (aggregates.get(key)||0)+1);
      }
    });
  });

  aggregates.forEach((count, key) => {
    const [monthKey, locId] = key.split('|');
    const [year, month] = monthKey.split('-');
    const locData = locationMap.get(locId);
    if (locData || locId !== 'unassigned') {
      const totalCost = (locData?.cost || 0) * count;
      const locName = locData?.name || `Sede [${locId}]`;
      const description = `Nolo Sede: ${locName} - ${month}/${year}`;
      const exists = (existingTransactions || []).some(t => !t.isDeleted && t.type === TransactionType.Expense && t.category === TransactionCategory.Rent && t.description === description);
      if (!exists && totalCost > 0) {
        const lastDayOfMonth = new Date(parseInt(year), parseInt(month), 0);
        newTransactions.push({ date: lastDayOfMonth.toISOString(), description, amount: totalCost, type: TransactionType.Expense, category: TransactionCategory.Rent, relatedDocumentId: `AUTO-RENT-${key}`, allocationId: locId, allocationName: locName });
      }
    }
  });

  return newTransactions;
}

// Scenario di test
const suppliers = [{ id: 'sup-1', companyName: 'Aula A SRL', locations: [{ id: 'loc-a', name: 'Aula A', rentalCost: 100 }] }];

const enrollments = [
  { id: 'enr-1', locationId: 'loc-a', appointments: [
    { lessonId: 'l1', date: '2025-12-01T10:00:00Z', status: 'Present', actualLocationId: 'loc-a' },
    { lessonId: 'l2', date: '2025-12-08T10:00:00Z', status: 'Present', actualLocationId: 'loc-a' }
  ]},
  { id: 'enr-2', locationId: 'loc-a', appointments: [
    { lessonId: 'l3', date: '2025-12-15T10:00:00Z', status: 'Present', actualLocationId: 'loc-a' }
  ]}
];

const existing = [];

console.log('Simulazione calcolo noli...');
const tx = calculateRentTransactions(enrollments, suppliers, existing);
console.log('Transazioni generate:', JSON.stringify(tx, null, 2));

if (tx.length === 1 && tx[0].amount === 300) {
  console.log('OK: Totale noli aggregati correttamente.');
  process.exit(0);
} else {
  console.error('ERRORE: Totale noli non conforme, expected 300');
  process.exit(2);
}
