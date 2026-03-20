import { Supplier, Location, AvailabilitySlot, Course } from '../types';
import { getSuppliers } from './supplierService';
import { getOpenCourses } from './courseService';

export interface PublicLocation extends Location {
    supplierId: string;
    supplierName: string;
    supplierRating: any;
}

export const getPublicLocations = async (): Promise<PublicLocation[]> => {
    const [suppliers, courses] = await Promise.all([
        getSuppliers(),
        getOpenCourses()
    ]);
    const publicLocations: PublicLocation[] = [];

    suppliers.forEach(supplier => {
        if (supplier.isDeleted) return;

        supplier.locations.forEach(location => {
            // Filter out closed locations
            if (location.closedAt || location.status === 'closed') return;
            
            // Filter out hidden locations
            if (location.isPubliclyVisible === false) return;

            // Derived slots from courses
            const publicSlots: AvailabilitySlot[] = courses
                .filter(c => c.locationId === location.id && c.status === 'open')
                .map(c => ({
                    dayOfWeek: c.dayOfWeek,
                    startTime: c.startTime,
                    endTime: c.endTime,
                    isPubliclyVisible: true, // by definition if it's open/returned
                    minAge: c.minAge,
                    maxAge: c.maxAge,
                    type: c.slotType
                }));

            if (publicSlots.length === 0) return;

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
