
// SlotType removed

// Mock Lead con dati "sporchi"
export const mockLead = {
  id: "test-lead-123",
  nome: "MARIO",
  cognome: "ROSSI",
  email: "mario@example.com",
  telefono: "3331122333",
  childName: "LUCA",
  childAge: "4 anni + 6 mesi",
  selectedLocation: "MEGAMAMMA",
  selectedSlot: {
    bundleId: "wrong-id", // ID sbagliato
    bundleName: "LAB 10", // Nome simile
    dayOfWeek: 3,
    startTime: "17:45",
    endTime: "18:45"
  },
  status: "pending"
};

// Funzione estratta da EnrollmentPortal.tsx per test unitario
export const formatSlotToString = (slot: unknown): string => {
  if (!slot) return '';
  if (typeof slot === 'string') return slot;
  const s = slot as Record<string, unknown>;
  const daysMap = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
  const day = daysMap[(s.dayOfWeek as number) || 0] || '';
  const time = (s.startTime && s.endTime) ? `${s.startTime} - ${s.endTime}` : '';
  if (day && time) return `${day}, ${time}`;
  if (s.bundleName) return s.bundleName as string;
  return JSON.stringify(slot);
};

console.log("TEST 1 (Format Slot):", formatSlotToString(mockLead.selectedSlot));
// Risultato atteso: "Mercoledì, 17:45 - 18:45"
