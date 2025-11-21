
import { db } from '../firebase/config';
// FIX: Corrected Firebase import path.
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, DocumentData, QueryDocumentSnapshot } from '@firebase/firestore';
import { Supplier, SupplierInput } from '../types';

const supplierCollectionRef = collection(db, 'suppliers');

const docToSupplier = (doc: QueryDocumentSnapshot<DocumentData>): Supplier => {
    const data = doc.data();
    return {
        id: doc.id,
        companyName: data.companyName,
        vatNumber: data.vatNumber,
        address: data.address,
        zipCode: data.zipCode,
        city: data.city,
        province: data.province,
        email: data.email,
        phone: data.phone,
        locations: data.locations || [],
        isDeleted: data.isDeleted || false
    };
};

export const getSuppliers = async (): Promise<Supplier[]> => {
    const querySnapshot = await getDocs(supplierCollectionRef);
    return querySnapshot.docs.map(docToSupplier);
};

export const addSupplier = async (supplier: SupplierInput): Promise<string> => {
    const docRef = await addDoc(supplierCollectionRef, { ...supplier, isDeleted: false });
    return docRef.id;
};

export const updateSupplier = async (id: string, supplier: Partial<SupplierInput>): Promise<void> => {
    const supplierDoc = doc(db, 'suppliers', id);
    // Assicurati che i dati inviati siano un oggetto "pulito"
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