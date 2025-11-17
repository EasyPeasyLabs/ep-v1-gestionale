
import React, { useState, useRef } from 'react';
import { User } from 'firebase/auth';
import { updateProfilePicture } from '../services/profileService';
import Spinner from '../components/Spinner';

interface ProfileProps {
    user: User;
}

const Profile: React.FC<ProfileProps> = ({ user }) => {
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setImageFile(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    const handleUpload = async () => {
        if (!imageFile) return;

        setLoading(true);
        setError(null);
        try {
            await updateProfilePicture(user, imageFile);
            // The onAuthStateChanged listener in App.tsx will automatically
            // pick up the change and re-render the app with the new photoURL.
            // We can clear the form state here.
            setImageFile(null);
            setPreviewUrl(null);
            alert("Immagine del profilo aggiornata con successo!");
        } catch (err) {
            console.error(err);
            setError("Si è verificato un errore durante il caricamento dell'immagine.");
        } finally {
            setLoading(false);
        }
    };

    const currentPhoto = previewUrl || user.photoURL || `https://i.pravatar.cc/150?u=${user.uid}`;

    return (
        <div>
            <h1 className="text-3xl font-bold text-slate-800">Il mio Profilo</h1>
            <p className="mt-1 text-slate-500">Gestisci le tue informazioni personali.</p>

            <div className="mt-8 max-w-2xl">
                <div className="bg-white p-6 rounded-lg shadow-md">
                    <h2 className="text-lg font-semibold text-slate-700 border-b pb-3">Informazioni Utente</h2>
                    <div className="mt-6 flex items-center space-x-6">
                        <img 
                            src={currentPhoto}
                            alt="User Profile" 
                            className="w-24 h-24 rounded-full object-cover bg-slate-200"
                        />
                        <div className="flex-1">
                            <p className="text-sm text-slate-500">Email</p>
                            <p className="font-medium text-slate-800">{user.email}</p>
                            <p className="text-sm text-slate-500 mt-2">Ruolo</p>
                            <p className="font-medium text-slate-800">Amministratore</p>
                        </div>
                    </div>

                    <div className="mt-6 pt-6 border-t">
                        <h3 className="text-md font-semibold text-slate-700">Modifica Immagine Profilo</h3>
                         <input
                            type="file"
                            accept="image/png, image/jpeg"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            className="hidden"
                        />
                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            className="mt-2 bg-white py-2 px-4 border border-slate-300 rounded-md shadow-sm text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                           {imageFile ? "Cambia Immagine" : "Scegli Immagine"}
                        </button>

                        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
                    </div>

                    {imageFile && (
                        <div className="mt-4 pt-4 border-t flex justify-end">
                            <button
                                onClick={handleUpload}
                                disabled={loading}
                                className="inline-flex items-center justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400"
                            >
                                {loading ? <Spinner /> : 'Salva Immagine'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Profile;