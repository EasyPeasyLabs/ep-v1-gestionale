import React from 'react';
import { User } from 'firebase/auth';

interface ProfileProps {
    user: User;
}

const Profile: React.FC<ProfileProps> = ({ user }) => {

    return (
        <div>
            <h1 className="text-3xl font-bold text-slate-800">Il mio Profilo</h1>
            <p className="mt-1 text-slate-500">Gestisci le tue informazioni personali.</p>

            <div className="mt-8 max-w-2xl">
                <div className="bg-white p-6 rounded-lg shadow-md">
                    <h2 className="text-lg font-semibold text-slate-700 border-b pb-3">Informazioni Utente</h2>
                    <div className="mt-6">
                        <div className="flex-1">
                            <p className="text-sm text-slate-500">Email</p>
                            <p className="font-medium text-slate-800 break-all">{user.email}</p>
                            <p className="text-sm text-slate-500 mt-4">Ruolo</p>
                            <p className="font-medium text-slate-800">Amministratore</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Profile;