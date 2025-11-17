
import { User, updateProfile } from 'firebase/auth';
import { storage } from '../firebase/config';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

export const updateProfilePicture = async (user: User, file: File): Promise<string> => {
    if (!user) throw new Error("Utente non autenticato.");
    
    // Crea un riferimento al percorso di archiviazione
    const storageRef = ref(storage, `profile-pictures/${user.uid}`);

    // Carica il file
    const snapshot = await uploadBytes(storageRef, file);

    // Ottieni l'URL di download
    const photoURL = await getDownloadURL(snapshot.ref);

    // Aggiorna il profilo dell'utente con il nuovo URL della foto
    await updateProfile(user, { photoURL });

    return photoURL;
};
