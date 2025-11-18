
import React, { useState } from 'react';
// FIX: Corrected Firebase import path.
import { signInWithEmailAndPassword } from '@firebase/auth';
import { auth } from '../firebase/config';
import Spinner from '../components/Spinner';

const LoginPage: React.FC = () => {
    const [email, setEmail] = useState('labeasypeasy@gmail.com');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (err) {
            setError('Credenziali non valide. Riprova.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--md-bg-light)' }}>
            <div className="w-full max-w-md p-8 space-y-8 md-card">
                <div className="text-center">
                    <h1 className="text-3xl font-bold tracking-wider" style={{ color: 'var(--md-text-primary)' }}>EP <span style={{ color: 'var(--md-primary)' }}>v.1</span></h1>
                    <p className="mt-2" style={{ color: 'var(--md-text-secondary)' }}>Accedi al tuo gestionale</p>
                </div>
                <form className="mt-8 space-y-6" onSubmit={handleLogin}>
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
                                autoComplete="current-password"
                                required
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                className="md-input"
                                placeholder=" "
                            />
                             <label htmlFor="password" className="md-input-label">Password</label>
                        </div>
                    </div>

                    {error && <p className="text-sm text-red-600 text-center">{error}</p>}

                    <div className="pt-4">
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full md-btn md-btn-raised md-btn-primary"
                        >
                            {loading ? <Spinner /> : 'Accedi'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default LoginPage;