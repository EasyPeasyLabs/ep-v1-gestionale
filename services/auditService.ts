import { db, auth } from '../firebase/config';
import { collection, addDoc } from 'firebase/firestore';
import { AuditLog } from '../types';

const auditCollectionRef = collection(db, 'audit_logs');

export const logFinancialAction = async (
    action: AuditLog['action'],
    entity: AuditLog['entity'],
    entityId: string,
    details: string
): Promise<void> => {
    try {
        const userEmail = auth.currentUser?.email || 'System';
        
        const logEntry: Omit<AuditLog, 'id'> = {
            timestamp: new Date().toISOString(),
            userEmail,
            action,
            entity,
            entityId,
            details
        };

        await addDoc(auditCollectionRef, logEntry);
    } catch (error) {
        console.error("Failed to write audit log:", error);
        // Fail silent per non bloccare il flusso business
    }
};