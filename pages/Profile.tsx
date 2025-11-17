import React from 'react';
import { User } from 'firebase/auth';

interface ProfileProps {
    user: User;
}

const Profile: React.FC<ProfileProps> = ({ user }) => {

    return (
        <div>
            <h1 className="text-3xl font-bold">Il mio Profilo</h1>
            <p className="mt-1" style={{ color: 'var(--md-text-secondary)'}}>Gestisci le tue informazioni personali.</p>

            <div className="mt-8 max-w-2xl">
                <div className="md-card p-6">
                    <h2 className="text-lg font-semibold border-b pb-3" style={{borderColor: 'var(--md-divider)'}}>Informazioni Utente</h2>
                    <div className="mt-6">
                        <div className="flex-1">
                            <p className="text-sm" style={{ color: 'var(--md-text-secondary)'}}>Email</p>
                            <p className="font-medium break-all">{user.email}</p>
                            <p className="text-sm mt-4" style={{ color: 'var(--md-text-secondary)'}}>Ruolo</p>
                            <p className="font-medium">Amministratore</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Profile;