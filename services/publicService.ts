import { Supplier, Location, AvailabilitySlot } from '../types';
import { getSuppliers } from './supplierService';

export interface PublicLocation extends Location {
    supplierId: string;
    supplierName: string;
    supplierRating: any;
}

export const getPublicLocations = async (): Promise<PublicLocation[]> => {
    const suppliers = await getSuppliers();
    const publicLocations: PublicLocation[] = [];

    suppliers.forEach(supplier => {
        if (supplier.isDeleted) return;

        supplier.locations.forEach(location => {
            // Filter out closed locations
            if (location.closedAt) return;
            
            // Filter out hidden locations
            if (location.isPubliclyVisible === false) return;

            // Filter slots
            const publicSlots = (location.availability || []).filter(slot => slot.isPubliclyVisible !== false);

            // If no public slots, should we hide the location? 
            // For now, let's keep it visible but with empty slots, or maybe hide it.
            // Let's keep it if it has at least one public slot OR if we want to show it as "Coming Soon" (but usually we want slots).
            // Decision: Show location only if it has at least one public slot? 
            // No, maybe just show it. But let's attach the filtered slots.

            const publicLocation: PublicLocation = {
                ...location,
                availability: publicSlots,
                supplierId: supplier.id,
                supplierName: supplier.companyName,
                supplierRating: supplier.rating
            };

            publicLocations.push(publicLocation);
        });
    });

    return publicLocations;
};
