
import { db } from '../../firebase/config';
import { 
    writeBatch,
    doc,
    query,
    where,
    getDocs
} from 'firebase/firestore';
import { 
    Enrollment, 
    RentAnalysisResult, 
    TransactionCategory, 
    TransactionType, 
    PaymentMethod, 
    TransactionStatus,
    TransactionInput
} from '../../types';
import { getSuppliers } from '../supplierService';
import { getLessons } from '../calendarService';
import { 
    getTransactions, 
    getTransactionsCollectionRef 
} from './core';
import { getNextTransactionNumber } from './numbering';

export const analyzeRentExpenses = async (month: number, year: number, enrollments: Enrollment[]): Promise<RentAnalysisResult[]> => {
    const suppliers = await getSuppliers();
    const lessons = await getLessons();
    const transactions = await getTransactions();

    const uniqueSessions = new Map<string, Set<string>>();

    enrollments.forEach(enr => {
        if (enr.appointments) {
            enr.appointments.forEach(app => {
                const d = new Date(app.date);
                const isValidStatus = app.status === 'Present' || app.status === 'Scheduled' || app.status === 'Absent';
                
                if (d.getMonth() === month && d.getFullYear() === year && isValidStatus) {
                    const locId = app.locationId || enr.locationId;
                    if (locId && locId !== 'unassigned') {
                        if (!uniqueSessions.has(locId)) {
                            uniqueSessions.set(locId, new Set());
                        }
                        const sessionKey = `${d.toISOString().split('T')[0]}_${app.startTime}_${app.endTime}`;
                        uniqueSessions.get(locId)!.add(sessionKey);
                    }
                }
            });
        }
    });

    lessons.forEach(l => {
        const d = new Date(l.date);
        if (d.getMonth() === month && d.getFullYear() === year) {
            let locId = l.locationId;
            if (!locId) {
                for (const s of suppliers) {
                    const found = s.locations.find(loc => loc.name === l.locationName);
                    if (found) { locId = found.id; break; }
                }
            }
            if (locId) {
                if (!uniqueSessions.has(locId)) {
                    uniqueSessions.set(locId, new Set());
                }
                const sessionKey = `${d.toISOString().split('T')[0]}_${l.startTime}_${l.endTime}`;
                uniqueSessions.get(locId)!.add(sessionKey);
            }
        }
    });

    const results: RentAnalysisResult[] = [];
    const monthLabel = `${year}-${String(month+1).padStart(2,'0')}`;

    for (const s of suppliers) {
        for (const loc of s.locations) {
            const usage = uniqueSessions.get(loc.id)?.size || 0;
            if (usage > 0) {
                const totalCost = usage * (loc.rentalCost || 0);
                
                const isPaid = transactions.some(t => 
                    t.category === TransactionCategory.Nolo &&
                    t.allocationId === loc.id &&
                    t.relatedDocumentId === `AUTO-RENT-${monthLabel}-${loc.id}` &&
                    !t.isDeleted
                );

                results.push({
                    locationId: loc.id,
                    locationName: loc.name,
                    supplierName: s.companyName,
                    usageCount: usage,
                    unitCost: loc.rentalCost || 0,
                    totalCost: totalCost,
                    isPaid
                });
            }
        }
    }

    return results;
};

export const createRentTransactionsBatch = async (results: RentAnalysisResult[], date: string, monthLabel: string): Promise<void> => {
    const batch = writeBatch(db);
    const dateObj = new Date(date);
    const monthKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth()+1).padStart(2,'0')}`;

    const existingQuery = query(
        getTransactionsCollectionRef(),
        where('category', '==', TransactionCategory.Nolo),
        where('date', '>=', `${monthKey}-01`),
        where('date', '<=', `${monthKey}-31`)
    );
    const existingSnap = await getDocs(existingQuery);
    const existingDocIds = new Set(
        existingSnap.docs
            .filter(d => !d.data().isDeleted)
            .map(d => d.data().relatedDocumentId as string)
            .filter(Boolean)
    );

    let nextNum = await getNextTransactionNumber(date);
    let added = 0;

    results.forEach(res => {
        const idempotencyKey = `AUTO-RENT-${monthKey}-${res.locationId}`;
        if (existingDocIds.has(idempotencyKey)) {
            console.log(`[RentSync] Skip sede ${res.locationName}: già registrata per ${monthKey}.`);
            return;
        }

        const ref = doc(getTransactionsCollectionRef());
        const t: TransactionInput = {
            transactionNumber: nextNum++,
            date: date,
            description: `Nolo ${res.locationName} - ${monthLabel} (${res.usageCount} lezioni)`,
            amount: res.totalCost,
            type: TransactionType.Expense,
            category: TransactionCategory.Nolo,
            paymentMethod: PaymentMethod.BankTransfer,
            status: TransactionStatus.Pending,
            allocationType: 'location',
            allocationId: res.locationId,
            allocationName: res.locationName,
            isDeleted: false,
            relatedDocumentId: idempotencyKey
        };
        batch.set(ref, t);
        added++;
    });

    if (added > 0) {
        await batch.commit();
        console.log(`[RentSync] Create ${added} nuove transazioni affitto per ${monthKey}.`);
    }
};

export const deleteAutoRentTransactions = async (locationId: string): Promise<void> => {
    const q = query(getTransactionsCollectionRef(), where('allocationId', '==', locationId), where('category', '==', 'Nolo'));
    const snapshot = await getDocs(q);
    const batch = writeBatch(db);
    snapshot.docs.forEach(d => {
        if (d.data().relatedDocumentId?.startsWith('AUTO-RENT')) {
            batch.delete(d.ref);
        }
    });
    await batch.commit();
};
