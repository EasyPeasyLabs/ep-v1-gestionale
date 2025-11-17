import React, { useState, useRef } from 'react';
import { User } from 'firebase/auth';
import { updateProfilePicture } from '../services/profileService';
import PencilIcon from '../components/icons/PencilIcon';
import Spinner from '../components/Spinner';

interface ProfileProps {
    user: User;
}

const Profile: React.FC<ProfileProps> = ({ user }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handlePictureChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setLoading(true);
        setError(null);
        try {
            await updateProfilePicture(user, file);
            // The onAuthStateChanged listener in App.tsx should pick up the change and re-render.
        } catch (err) {
            console.error(err);
            setError("Impossibile aggiornare l'immagine del profilo.");
        } finally {
            setLoading(false);
        }
    };
    
    const triggerFileSelect = () => fileInputRef.current?.click();

    return (
        <div>
            <h1 className="text-3xl font-bold text-slate-800">Il mio Profilo</h1>
            <p className="mt-1 text-slate-500">Gestisci le tue informazioni personali.</p>

            <div className="mt-8 max-w-2xl">
                <div className="bg-white p-6 rounded-lg shadow-md">
                    <h2 className="text-lg font-semibold text-slate-700 border-b pb-3">Informazioni Utente</h2>
                    <div className="mt-6 flex items-center space-x-6">
                        <div className="relative group flex-shrink-0">
                            <img 
                                src={user.photoURL || './lemon_logo_150px.png'}
                                alt="Avatar" 
                                className="w-24 h-24 rounded-full object-cover border-2 border-slate-200"
                            />
                            <button
                                onClick={triggerFileSelect}
                                className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 flex items-center justify-center rounded-full transition-opacity text-white"
                                disabled={loading}
                                aria-label="Cambia immagine del profilo"
                            >
                                {loading ? <Spinner /> : <PencilIcon />}
                            </button>
                             <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handlePictureChange}
                                className="hidden"
                                accept="image/png, image/jpeg"
                            />
                        </div>
                        <div className="flex-1">
                            <p className="text-sm text-slate-500">Email</p>
                            <p className="font-medium text-slate-800 break-all">{user.email}</p>
                            <p className="text-sm text-slate-500 mt-2">Ruolo</p>
                            <p className="font-medium text-slate-800">Amministratore</p>
                        </div>
                    </div>
                     {error && <p className="text-sm text-red-600 text-center mt-4">{error}</p>}
                </div>
            </div>
        </div>
    );
};

export default Profile;