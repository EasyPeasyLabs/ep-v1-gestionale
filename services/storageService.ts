
import { storage } from '../firebase/config';
import { ref, uploadBytes, getDownloadURL } from '@firebase/storage';

export const uploadCampaignFile = async (file: File): Promise<string> => {
    // Crea un percorso univoco: campaigns/{timestamp}_{nomefile}
    // Sanitizza il nome del file rimuovendo spazi o caratteri speciali se necessario, qui usiamo una versione semplice
    const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
    const storageRef = ref(storage, `campaigns/${fileName}`);
    
    // Carica il file
    const snapshot = await uploadBytes(storageRef, file);
    
    // Ottieni l'URL pubblico
    return await getDownloadURL(snapshot.ref);
};

export const uploadActivityAttachment = async (file: File): Promise<string> => {
    // Crea un percorso univoco: activities/{timestamp}_{nomefile}
    const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
    const storageRef = ref(storage, `activities/${fileName}`);
    
    // Carica il file
    const snapshot = await uploadBytes(storageRef, file);
    
    // Ottieni l'URL pubblico
    return await getDownloadURL(snapshot.ref);
};

export const uploadCommunicationAttachment = async (file: File): Promise<string> => {
    // Crea un percorso univoco: communications/attachments/{timestamp}_{nomefile}
    const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
    const storageRef = ref(storage, `communications/attachments/${fileName}`);
    
    // Carica il file
    const snapshot = await uploadBytes(storageRef, file);
    
    // Ottieni l'URL pubblico
    return await getDownloadURL(snapshot.ref);
};