import React from 'react';
import { useMockData } from '../../hooks/useMockData';
import { Tabs } from '../ui/Tabs';
import { StarIcon } from '../icons/Icons';
import { Cliente, Fornitore, Attivita, ClienteTipo } from '../../types';

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
    
    // FIX: Re-ordered checks and improved type safety to correctly identify item type.
    // This avoids misidentifying a Fornitore as a Cliente due to overlapping 'tipo' enum values.
    const getItemName = (item: Cliente | Fornitore | Attivita): string => {
        if ('sedi' in item) { // Is Fornitore
            return item.dati.ragioneSociale;
        }
        if ('titolo' in item) { // is Attivita
            return item.titolo;
        }
        // By elimination, item is Cliente
        if (item.tipo === ClienteTipo.FAMIGLIA) {
            return `Fam. ${item.dati.genitore1.cognome}`;
        }
        return item.dati.ragioneSociale;
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
    // The previous check caused a TypeScript error and a runtime logic bug
    // where Fornitori could be misidentified as Clienti.
    // Using the `in` operator on unique properties (`sedi`, `titolo`) correctly
    // discriminates between the types in the union.
    const handleRatingChange = (item: Cliente | Fornitore | Attivita, newRating: number) => {
        const updatedItem = { ...item, rating: newRating };
        
        if ('sedi' in item) {
            updateFornitore(updatedItem as Fornitore);
        } else if ('titolo' in item) {
            updateAttivita(updatedItem as Attivita);
        } else {
            updateCliente(updatedItem as Cliente);
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
