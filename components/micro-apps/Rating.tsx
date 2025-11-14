
import React from 'react';
import { useMockData } from '../../hooks/useMockData';
import { Tabs } from '../ui/Tabs';
import { StarIcon } from '../icons/Icons';
import { Cliente, Fornitore, Attivita, ClienteTipo, ClienteFamiglia, ClienteEnteAzienda } from '../../types';

const StarRatingInput: React.FC<{
    count: number;
    value: number;
    onChange: (value: number) => void;
}> = ({ count, value, onChange }) => {
    return (
        <div className="flex items-center">
            {[...Array(count)].map((_, i) => {
                const ratingValue = i + 1;
                return (
                    <button
                        type="button"
                        key={ratingValue}
                        onClick={() => onChange(ratingValue)}
                        className="focus:outline-none"
                        aria-label={`Rate ${ratingValue} out of ${count}`}
                    >
                        <StarIcon
                            className="h-5 w-5 cursor-pointer"
                            filled={ratingValue <= value}
                        />
                    </button>
                );
            })}
        </div>
    );
};


const RatingsTab: React.FC<{
    items: (Cliente | Fornitore | Attivita)[];
    onRatingChange: (item: Cliente | Fornitore | Attivita, newRating: number) => void;
}> = ({ items, onRatingChange }) => {
    
    // FIX: Implemented robust type guards to correctly identify the item type.
    // The check for 'titolo' safely identifies an 'Attivita'. For others, it checks
    // for properties unique to each client type or defaults to 'ragioneSociale'
    // which is common to both Fornitore and ClienteEnteAzienda.
    const getItemName = (item: Cliente | Fornitore | Attivita): string => {
        if ('titolo' in item) { // is Attivita
            return item.titolo;
        }
        // Now item is Cliente or Fornitore
        if (item.tipo === ClienteTipo.FAMIGLIA) { // is ClienteFamiglia
            return `Fam. ${(item as ClienteFamiglia).dati.genitore1.cognome}`;
        }
        // is ClienteEnteAzienda or Fornitore
        return (item as ClienteEnteAzienda | Fornitore).dati.ragioneSociale;
    }

    return (
        <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden">
            <ul role="list" className="divide-y divide-gray-200 dark:divide-gray-700">
                {items.sort((a,b) => b.rating - a.rating).map((item) => (
                    <li key={item.id} className="px-6 py-4 flex items-center justify-between">
                        <span className="font-medium text-gray-900 dark:text-white">{getItemName(item)}</span>
                        <StarRatingInput
                            count={5}
                            value={item.rating}
                            onChange={(newRating) => onRatingChange(item, newRating)}
                        />
                    </li>
                ))}
            </ul>
        </div>
    );
}


export const Rating: React.FC = () => {
    const { clienti, updateCliente, fornitori, updateFornitore, attivita, updateAttivita } = useMockData();
    
    // FIX: Replaced flawed type-checking logic with robust type guards.
    // The previous check used a non-existent `sedi` property, causing errors.
    // The new logic correctly discriminates between types using the unique 'titolo'
    // property for Attivita and then distinguishes between Fornitore and Cliente
    // based on their distinct type structures.
    const handleRatingChange = (item: Cliente | Fornitore | Attivita, newRating: number) => {
        const updatedItem = { ...item, rating: newRating };
        
        if ('titolo' in item) { // Type guard for Attivita
            updateAttivita(updatedItem as Attivita);
        } else if (item.tipo === ClienteTipo.FAMIGLIA || 'bambini' in item) { // Type guard for Cliente (either Famiglia or Ente/Azienda which might have 'bambini')
             updateCliente(updatedItem as Cliente);
        } else { // By elimination, it must be a Fornitore
            updateFornitore(updatedItem as Fornitore);
        }
    };

    const tabs = [
        {
            label: `Clienti (${clienti.length})`,
            content: <RatingsTab items={clienti} onRatingChange={handleRatingChange} />
        },
        {
            label: `Fornitori (${fornitori.length})`,
            content: <RatingsTab items={fornitori} onRatingChange={handleRatingChange} />
        },
        {
            label: `Attività (${attivita.length})`,
            content: <RatingsTab items={attivita} onRatingChange={handleRatingChange} />
        }
    ];

    return (
        <div className="p-4 md:p-8">
             <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">Gestione Rating</h1>
            </div>
            <Tabs tabs={tabs} />
        </div>
    );
};
