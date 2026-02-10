import React, { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase/config';
import Spinner from '../components/Spinner';

const LoginPage: React.FC = () => {
    const [email, setEmail] = useState('');
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
            const errorCode = err.code;
            if (errorCode === 'auth/invalid-credential' || errorCode === 'auth/user-not-found' || errorCode === 'auth/wrong-password' || errorCode === 'auth/invalid-login-credentials') {
                setError('Credenziali non valide.');
            } else if (errorCode === 'auth/email-already-in-use') {
                setError('Email già registrata.');
            } else if (errorCode === 'auth/weak-password') {
                setError('Password troppo debole.');
            } else if (errorCode === 'auth/too-many-requests') {
                setError('Troppi tentativi. Riprova più tardi.');
            } else {
                setError('Errore di autenticazione. Riprova.');
                console.error(err);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-slate-100 py-12 px-4 sm:px-6 lg:px-8 font-sans">
            {/* CARD CONTAINER: Stile 'Login 0' Hard-coded per bypassare problemi CSS */}
            <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl border-t-8 border-indigo-600 p-10 overflow-hidden relative">
                
                {/* Decorative Background Elements */}
                <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-indigo-50 rounded-full blur-xl opacity-50 pointer-events-none"></div>

                {/* HEADER */}
                <div className="text-center mb-10 relative z-10">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-white border-2 border-indigo-50 text-indigo-600 mb-6 shadow-lg shadow-indigo-100">
                        <span className="text-4xl font-black tracking-tighter">EP</span>
                    </div>
                    <h2 className="text-3xl font-black text-slate-800 tracking-tight">Gestionale v.1</h2>
                    <p className="mt-3 text-sm font-bold text-slate-400 uppercase tracking-wide">
                        {isSignUp ? 'Nuovo Account Admin' : 'Accesso Area Riservata'}
                    </p>
                </div>
                
                <form className="space-y-8 relative z-10" onSubmit={handleAuth}>
                    <div className="space-y-6">
                        {/* INPUT EMAIL: Floating Label System nativo */}
                        <div className="relative group">
                            <input
                                id="email-address"
                                name="email"
                                type="email"
                                autoComplete="email"
                                required
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                className="peer block w-full px-4 py-4 bg-slate-50 border-2 border-slate-200 rounded-xl text-slate-900 placeholder-transparent focus:outline-none focus:border-indigo-600 focus:ring-0 focus:bg-white transition-all font-bold text-base shadow-sm"
                                placeholder="Email"
                            />
                            <label 
                                htmlFor="email-address" 
                                className="absolute left-4 top-3.5 text-slate-400 font-bold text-sm transition-all 
                                           peer-placeholder-shown:text-base peer-placeholder-shown:text-slate-400 peer-placeholder-shown:top-4 
                                           peer-focus:-top-3 peer-focus:text-xs peer-focus:text-indigo-600 peer-focus:bg-white peer-focus:px-1 pointer-events-none"
                            >
                                Indirizzo Email
                            </label>
                        </div>
                        
                        {/* INPUT PASSWORD */}
                        <div className="relative group">
                            <input
                                id="password"
                                name="password"
                                type="password"
                                autoComplete={isSignUp ? "new-password" : "current-password"}
                                required
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                className="peer block w-full px-4 py-4 bg-slate-50 border-2 border-slate-200 rounded-xl text-slate-900 placeholder-transparent focus:outline-none focus:border-indigo-600 focus:ring-0 focus:bg-white transition-all font-bold text-base shadow-sm"
                                placeholder="Password"
                            />
                            <label 
                                htmlFor="password" 
                                className="absolute left-4 top-3.5 text-slate-400 font-bold text-sm transition-all 
                                           peer-placeholder-shown:text-base peer-placeholder-shown:text-slate-400 peer-placeholder-shown:top-4 
                                           peer-focus:-top-3 peer-focus:text-xs peer-focus:text-indigo-600 peer-focus:bg-white peer-focus:px-1 pointer-events-none"
                            >
                                Password
                            </label>
                        </div>
                    </div>

                    {error && (
                        <div className="rounded-xl bg-red-50 p-4 border-l-4 border-red-500 flex items-start gap-3 animate-fade-in shadow-sm">
                            <div className="text-red-500 mt-0.5 font-bold">⚠️</div>
                            <div>
                                <h3 className="text-xs font-black text-red-800 uppercase tracking-wide">Attenzione</h3>
                                <p className="text-sm text-red-700 mt-1 font-medium leading-tight">{error}</p>
                            </div>
                        </div>
                    )}

                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-4 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-black uppercase tracking-[0.2em] shadow-xl shadow-indigo-200 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed transform hover:-translate-y-0.5"
                        >
                            {loading ? <Spinner /> : (isSignUp ? 'CREA ACCOUNT' : 'ACCEDI ORA')}
                        </button>
                    </div>

                    <div className="text-center pt-2">
                        <button
                            type="button"
                            onClick={() => { setIsSignUp(!isSignUp); setError(null); }}
                            className="text-xs font-bold text-slate-400 hover:text-indigo-600 hover:underline transition-colors uppercase tracking-wide"
                        >
                            {isSignUp ? 'Hai già un account? Accedi' : 'Non hai un account? Registrati'}
                        </button>
                    </div>
                </form>
            </div>
            
            <div className="fixed bottom-6 text-center w-full">
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] opacity-50">
                    EasyPeasy Enterprise System • 2026
                </p>
            </div>
        </div>
    );
};

export default LoginPage;