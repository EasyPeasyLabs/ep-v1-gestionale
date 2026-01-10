
import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
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
        // Added 'bg-slate-100' as fallback for background
        <div className="min-h-screen flex items-center justify-center bg-slate-100" style={{ backgroundColor: 'var(--md-bg-light, #F1F5F9)' }}>
            {/* Added 'bg-white' and explicit border colors as fallback */}
            <div className="w-full max-w-md p-8 space-y-8 md-card border-t-4 bg-white shadow-xl rounded-xl" style={{ borderColor: 'var(--md-primary, #3C3C52)' }}>
                <div className="text-center">
                    <div className="flex justify-center items-center gap-3 mb-4">
                        <h1 className="text-3xl font-bold tracking-wider text-slate-800" style={{ color: 'var(--md-text-primary, #1A1A1A)' }}>EP v1</h1>
                    </div>
                    <p className="mt-2 text-slate-500" style={{ color: 'var(--md-text-secondary, #6B7280)' }}>Accedi al tuo gestionale</p>
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

                    {error && <p className="text-sm text-red-600 text-center bg-red-50 p-2 rounded border border-red-100">{error}</p>}

                    <div className="pt-4">
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full md-btn md-btn-raised md-btn-primary"
                            style={{ backgroundColor: 'var(--md-primary, #3C3C52)', color: 'white' }}
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
