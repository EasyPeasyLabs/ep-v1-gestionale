import React, { useState } from 'react';
import { GoogleGenAI } from "@google/genai";
import { useMockData } from '../../hooks/useMockData';
import { Button } from '../ui/Button';
import { BrainIcon } from '../icons/Icons';

type Message = {
    role: 'user' | 'model';
    content: string;
};

export const Brain: React.FC = () => {
    const allData = useMockData();
    const [messages, setMessages] = useState<Message[]>([]);
    const [prompt, setPrompt] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!prompt.trim() || isLoading) return;

        const userMessage: Message = { role: 'user', content: prompt };
        setMessages(prev => [...prev, userMessage]);
        setPrompt('');
        setIsLoading(true);
        setError(null);

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

            const dataContext = JSON.stringify({
                clienti: allData.clienti,
                fornitori: allData.fornitori,
                laboratori: allData.laboratori,
                movimenti: allData.movimenti,
            });

            const fullPrompt = `System: Sei 'Brain', un assistente AI per l'app gestionale EasyPeasy Labs. Il tuo compito è rispondere alle domande dell'utente basandoti sui dati forniti in formato JSON. Sii conciso, utile e rispondi sempre in italiano. Non inventare informazioni non presenti nei dati. I dati attuali sono: ${dataContext}\n\nUser: ${prompt}`;

            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: fullPrompt,
            });

            const modelMessage: Message = { role: 'model', content: response.text };
            setMessages(prev => [...prev, modelMessage]);

        } catch (err) {
            console.error(err);
            const errorMessage = err instanceof Error ? err.message : 'Si è verificato un errore sconosciuto.';
            setError(`Errore durante la comunicazione con l'IA: ${errorMessage}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="p-4 md:p-8 h-full flex flex-col">
            <div className="flex items-center mb-6">
                 <BrainIcon className="h-8 w-8 text-blue-500 mr-3"/>
                <h1 className="text-3xl font-bold">Brain Assistant</h1>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 mb-4">
                 <p className="text-sm text-gray-600 dark:text-gray-300">
                    Fai una domanda sui tuoi dati. Esempi: <br/>
                    <em className="text-gray-500 dark:text-gray-400">"Chi è il cliente con il rating più alto?"</em>, 
                    <em className="text-gray-500 dark:text-gray-400">"Qual è il totale delle uscite per il personale?"</em>,
                    <em className="text-gray-500 dark:text-gray-400">"Quali laboratori ci sono nella Sala Arcobaleno?"</em>
                </p>
            </div>
            
            <div className="flex-grow bg-white dark:bg-gray-800 shadow-md rounded-lg p-4 overflow-y-auto mb-4">
                {messages.length === 0 && !isLoading && (
                     <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
                        Inizia una conversazione...
                    </div>
                )}
                <div className="space-y-4">
                    {messages.map((msg, index) => (
                        <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-xl p-3 rounded-lg ${msg.role === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200'}`}>
                                <p className="whitespace-pre-wrap">{msg.content}</p>
                            </div>
                        </div>
                    ))}
                     {isLoading && (
                        <div className="flex justify-start">
                            <div className="max-w-lg p-3 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                                <div className="flex items-center space-x-2">
                                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-pulse"></div>
                                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-pulse delay-75"></div>
                                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-pulse delay-150"></div>
                                </div>
                            </div>
                        </div>
                     )}
                     {error && (
                         <div className="p-3 rounded-lg bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300">
                            <p>{error}</p>
                         </div>
                     )}
                </div>
            </div>

            <form onSubmit={handleSendMessage} className="flex gap-4">
                <input
                    type="text"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Scrivi la tua domanda..."
                    disabled={isLoading}
                    className="flex-grow block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white disabled:opacity-50"
                />
                <Button type="submit" disabled={isLoading || !prompt.trim()}>
                    {isLoading ? 'Invio...' : 'Invia'}
                </Button>
            </form>
        </div>
    );
};
