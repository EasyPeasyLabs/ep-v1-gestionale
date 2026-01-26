
import React, { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase/config';
import Spinner from '../components/Spinner';

const LoginPage: React.FC = () => {
    const [email, setEmail] = useState('labeasypeasy@gmail.com');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [isSignUp, setIsSignUp] = useState(false);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            if (isSignUp) {
                await createUserWithEmailAndPassword(auth, email, password);
            } else {
                await signInWithEmailAndPassword(auth, email, password);
            }
        } catch (err: any) {
            console.error(err);
            if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
                setError('Credenziali non valide. Controlla email e password.');
            } else if (err.code === 'auth/email-already-in-use') {
                setError('Email già registrata. Prova ad accedere.');
            } else if (err.code === 'auth/weak-password') {
                setError('La password deve essere di almeno 6 caratteri.');
            } else {
                setError('Errore durante l\'autenticazione. Riprova.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-100" style={{ backgroundColor: 'var(--md-bg-light, #F1F5F9)' }}>
            <div className="w-full max-w-md p-8 space-y-8 md-card border-t-4 bg-white shadow-xl rounded-xl" style={{ borderColor: 'var(--md-primary, #3C3C52)' }}>
                <div className="text-center">
                    <div className="flex justify-center items-center gap-3 mb-4">
                        <h1 className="text-3xl font-bold tracking-wider text-slate-800" style={{ color: 'var(--md-text-primary, #1A1A1A)' }}>EP v1</h1>
                    </div>
                    <p className="mt-2 text-slate-500" style={{ color: 'var(--md-text-secondary, #6B7280)' }}>
                        {isSignUp ? 'Crea un nuovo account' : 'Accedi al tuo gestionale'}
                    </p>
                </div>
                <form className="mt-8 space-y-6" onSubmit={handleAuth}>
                    <div className="space-y-4">
                        <div className="md-input-group">
                            <input
                                id="email-address"
                                name="email"
                                type="email"
                                autoComplete="email"
                                required
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                className="md-input"
                                placeholder=" "
                            />
                            <label htmlFor="email-address" className="md-input-label">Indirizzo email</label>
                        </div>
                        <div className="md-input-group">
                            <input
                                id="password"
                                name="password"
                                type="password"
                                autoComplete={isSignUp ? "new-password" : "current-password"}
                                required
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                className="md-input"
                                placeholder=" "
                            />
                             <label htmlFor="password" className="md-input-label">Password</label>
                        </div>
                    </div>

                    {error && <p className="text-sm text-red-600 text-center bg-red-50 p-2 rounded border border-red-100">{error}</p>}

                    <div className="pt-4 space-y-4">
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full md-btn md-btn-raised md-btn-primary"
                            style={{ backgroundColor: 'var(--md-primary, #3C3C52)', color: 'white' }}
                        >
                            {loading ? <Spinner /> : (isSignUp ? 'Registrati' : 'Accedi')}
                        </button>
                        
                        <div className="text-center">
                            <button
                                type="button"
                                onClick={() => { setIsSignUp(!isSignUp); setError(null); }}
                                className="text-sm font-medium text-indigo-600 hover:text-indigo-500 hover:underline"
                            >
                                {isSignUp ? 'Hai già un account? Accedi' : 'Non hai un account? Registrati'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default LoginPage;
