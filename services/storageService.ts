
import { storage } from '../firebase/config';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

export const uploadCampaignFile = async (file: File): Promise<string> => {
    console.log(`[Storage] Starting upload for campaign: ${file.name} (${file.size} bytes)`);
    try {
        const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
        const storageRef = ref(storage, `campaigns/${fileName}`);
        
        console.log(`[Storage] Ref created: ${storageRef.fullPath}, Bucket: ${storageRef.bucket}`);
        
        const snapshot = await uploadBytes(storageRef, file);
        console.log('[Storage] Upload completed, fetching URL...');
        
        const url = await getDownloadURL(snapshot.ref);
        console.log('[Storage] URL retrieved:', url);
        return url;
    } catch (error) {
        console.error('[Storage] Upload Failed:', error);
        throw error;
    }
};

export const uploadActivityAttachment = async (file: File): Promise<string> => {
    console.log(`[Storage] Starting upload for activity: ${file.name}`);
    try {
        const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
        const storageRef = ref(storage, `activities/${fileName}`);
        const snapshot = await uploadBytes(storageRef, file);
        return await getDownloadURL(snapshot.ref);
    } catch (error) {
        console.error('[Storage] Activity Upload Failed:', error);
        throw error;
    }
};

export const uploadCommunicationAttachment = async (file: File): Promise<string> => {
    console.log(`[Storage] Starting upload for communication: ${file.name} (${file.size} bytes)`);
    try {
        const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
        const storageRef = ref(storage, `communications/attachments/${fileName}`);
        
        console.log(`[Storage] Ref created: ${storageRef.fullPath}, Bucket: ${storageRef.bucket}`);

        // Add metadata
        const metadata = {
            contentType: file.type,
        };

        const snapshot = await uploadBytes(storageRef, file, metadata);
        console.log('[Storage] Upload completed successfully.');
        
        const url = await getDownloadURL(snapshot.ref);
        console.log('[Storage] Download URL generated.');
        return url;
    } catch (error: any) {
        console.error('[Storage] Communication Upload Failed:', error);
        if (error.code === 'storage/unauthorized') {
            console.error('PERMISSION DENIED: Check Firebase Storage Rules.');
        } else if (error.code === 'storage/canceled') {
            console.error('UPLOAD CANCELED');
        } else if (error.code === 'storage/unknown') {
            console.error('UNKNOWN ERROR: Check CORS configuration.');
        }
        throw error;
    }
};
