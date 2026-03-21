
import { db } from '../firebase/config';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, DocumentData, QueryDocumentSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { Supplier, SupplierInput, Location } from '../types';

const getSupplierCollectionRef = () => collection(db, 'suppliers');

const docToSupplier = (doc: QueryDocumentSnapshot<DocumentData>): Supplier => {
    const data = doc.data();
    return {
        id: doc.id,
        companyName: data.companyName || '', // Safety default
        vatNumber: data.vatNumber || '',
        address: data.address || '',
        zipCode: data.zipCode || '',
        city: data.city || '',
        province: data.province || '',
        email: data.email || '',
        phone: data.phone || '',
        locations: (data.locations || []).map((loc: any) => ({
            ...loc,
            name: loc.name || 'Sede senza nome',
            // Ensure new fields have defaults for existing data
            notes: loc.notes || '',
            notesHistory: loc.notesHistory || [],
            tags: loc.tags || [],
            rating: loc.rating || { 
                cost: 0, distance: 0, parking: 0, availability: 0, 
                safety: 0, environment: 0, distractions: 0, modifiability: 0, prestige: 0 
            }
        })),
        isDeleted: data.isDeleted || false,
        // New Fields mapping with safe defaults
        notes: data.notes || '',
        notesHistory: data.notesHistory || [],
        tags: data.tags || [],
        rating: data.rating || { responsiveness: 0, partnership: 0, negotiation: 0 }
    };
};

export const getSuppliers = async (): Promise<Supplier[]> => {
    const querySnapshot = await getDocs(getSupplierCollectionRef());
    return querySnapshot.docs.map(docToSupplier);
};

export const addSupplier = async (supplier: SupplierInput): Promise<string> => {
    const docRef = await addDoc(getSupplierCollectionRef(), { ...supplier, isDeleted: false });
    
    // Sync locations to top-level collection
    if (supplier.locations && supplier.locations.length > 0) {
        for (const loc of supplier.locations) {
            const locId = loc.id || doc(collection(db, 'locations')).id;
            await setDoc(doc(db, 'locations', locId), {
                ...loc,
                id: locId,
                supplierId: docRef.id,
                status: loc.closedAt ? 'closed' : 'active',
                updatedAt: serverTimestamp()
            });
        }
    }
    
    return docRef.id;
};

export const updateSupplier = async (id: string, supplier: Partial<SupplierInput>): Promise<void> => {
    const supplierDoc = doc(db, 'suppliers', id);
    // Sync locations to top-level collection
    if (supplier.locations) {
        for (const loc of supplier.locations) {
            const locId = loc.id && !String(loc.id).startsWith('temp-') ? loc.id : doc(collection(db, 'locations')).id;
            // Update the ID in the supplier document too if it was temporary
            if (loc.id !== locId) loc.id = locId; 

            await setDoc(doc(db, 'locations', locId), {
                ...loc,
                id: locId,
                supplierId: id,
                status: loc.closedAt ? 'closed' : 'active',
                updatedAt: serverTimestamp()
            });
        }
    }

    await updateDoc(supplierDoc, { ...supplier });
};

// Soft Delete: sposta nel cestino
export const deleteSupplier = async (id: string): Promise<void> => {
    const supplierDoc = doc(db, 'suppliers', id);
    await updateDoc(supplierDoc, { isDeleted: true });
};

// Ripristina dal cestino
export const restoreSupplier = async (id: string): Promise<void> => {
    const supplierDoc = doc(db, 'suppliers', id);
    await updateDoc(supplierDoc, { isDeleted: false });
};

// Hard Delete: elimina fisicamente
export const permanentDeleteSupplier = async (id: string): Promise<void> => {
    const supplierDoc = doc(db, 'suppliers', id);
    await deleteDoc(supplierDoc);
};
