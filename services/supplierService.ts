
import { db } from '../firebase/config';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import { Supplier, SupplierInput } from '../types';

const supplierCollectionRef = collection(db, 'suppliers');

const docToSupplier = (doc: QueryDocumentSnapshot<DocumentData>): Supplier => {
    const data = doc.data();
    return {
        id: doc.id,
        name: data.name,
        contactPerson: data.contactPerson,
        email: data.email,
        phone: data.phone,
        locations: data.locations || [],
    };
};

export const getSuppliers = async (): Promise<Supplier[]> => {
    const querySnapshot = await getDocs(supplierCollectionRef);
    return querySnapshot.docs.map(docToSupplier);
};

export const addSupplier = async (supplier: SupplierInput): Promise<string> => {
    const docRef = await addDoc(supplierCollectionRef, supplier);
    return docRef.id;
};

export const updateSupplier = async (id: string, supplier: Partial<SupplierInput>): Promise<void> => {
    const supplierDoc = doc(db, 'suppliers', id);
    await updateDoc(supplierDoc, supplier);
};

export const deleteSupplier = async (id: string): Promise<void> => {
    const supplierDoc = doc(db, 'suppliers', id);
    await deleteDoc(supplierDoc);
};
