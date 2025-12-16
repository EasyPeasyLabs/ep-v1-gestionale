import { describe, it, expect } from 'vitest';
import { calculateRentTransactions } from '../services/financeService';

// Nota: Questo test richiede che venga eseguito in ambiente con TypeScript e Vitest installati.

describe('financeService - calculateRentTransactions', () => {
  it('aggregates present lessons into rent transactions by location/month', () => {
    const suppliers: any[] = [{ id: 's1', companyName: 'Sup', locations: [{ id: 'loc-a', name: 'A', rentalCost: 100 }] }];
    const enrollments: any[] = [{ id: 'e1', locationId: 'loc-a', appointments: [{ lessonId: 'l1', date: '2025-12-01T10:00:00Z', status: 'Present', actualLocationId: 'loc-a' }, { lessonId: 'l2', date: '2025-12-08T10:00:00Z', status: 'Present', actualLocationId: 'loc-a' }] }];
    const existing: any[] = [];

    const res = calculateRentTransactions(enrollments as any, suppliers as any, existing as any);
    expect(res.length).toBe(1);
    expect(res[0].amount).toBe(200);
  });
});
