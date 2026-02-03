
import React from 'react';
import { Notification } from '../types';
import ClockIcon from './icons/ClockIcon';
import ExclamationIcon from './icons/ExclamationIcon';
import ChecklistIcon from './icons/ChecklistIcon';

interface FocusModePopupProps {
    notifications: Notification[];
    onDismiss: () => void;
    onNavigate: (page: any, params?: any) => void;
}

const FocusModePopup: React.FC<FocusModePopupProps> = ({ notifications, onDismiss, onNavigate }) => {
    const today = new Date();
    const dateStr = today.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });

    const getNotificationIcon = (type: Notification['type']) => {
        switch (type) {
            case 'expiry': return <span className="text-amber-500"><ClockIcon /></span>;
            case 'low_lessons': return <span className="text-indigo-500"><ExclamationIcon /></span>;
            case 'payment_required': return <span className="text-red-500"><ExclamationIcon /></span>;
            case 'action_required': return <span className="text-blue-500"><ChecklistIcon /></span>;
            default: return <span className="text-gray-500"><ClockIcon /></span>;
        }
    };

    return (
        <div className="fixed inset-0 z-[200] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-slide-up">
                
                {/* Header */}
                <div className="p-8 pb-4 border-b border-gray-100 text-center">
                    <p className="text-xs font-black text-indigo-500 uppercase tracking-[0.2em] mb-2">Routine di Controllo</p>
                    <h2 className="text-3xl font-black text-slate-800 mb-1">Briefing del Giorno</h2>
                    <p className="text-lg text-slate-400 font-medium capitalize">{dateStr}</p>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-slate-50/50">
                    {notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center py-10">
                            <div className="w-24 h-24 bg-green-100 text-green-500 rounded-full flex items-center justify-center text-5xl mb-4 shadow-lg animate-pulse">
                                ✨
                            </div>
                            <h3 className="text-xl font-bold text-slate-800">Tutto sotto controllo!</h3>
                            <p className="text-slate-500 mt-2">Non ci sono avvisi critici per oggi. Buon lavoro!</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-xs font-bold text-slate-400 uppercase">Priorità ({notifications.length})</span>
                            </div>
                            {notifications.map((notif, idx) => (
                                <div 
                                    key={idx} 
                                    onClick={() => { onNavigate(notif.linkPage as any, notif.filterContext); onDismiss(); }}
                                    className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all cursor-pointer flex items-start gap-4 group"
                                >
                                    <div className="p-3 bg-gray-50 rounded-xl group-hover:scale-110 transition-transform shadow-inner">
                                        {getNotificationIcon(notif.type)}
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-bold text-slate-800 text-sm md:text-base leading-snug">{notif.message}</p>
                                        <div className="flex items-center gap-2 mt-2">
                                            <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded uppercase">Vai al dettaglio →</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-100 bg-white flex justify-center">
                    <button 
                        onClick={onDismiss}
                        className="md-btn md-btn-raised md-btn-primary w-full md:w-auto px-12 py-4 rounded-xl text-sm font-black uppercase tracking-widest shadow-xl hover:scale-105 transition-transform"
                    >
                        {notifications.length === 0 ? 'Vai alla Dashboard' : 'Ho letto tutto, vai alla Dashboard'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default FocusModePopup;
