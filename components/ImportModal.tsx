import React, { useState, useCallback } from 'react';
import Modal from './Modal';
import Spinner from './Spinner';
import UploadIcon from './icons/UploadIcon';

export interface ImportResult {
    created: number;
    updated: number;
    errors: { row: number; message: string }[];
}

interface ImportModalProps {
    entityName: string;
    templateCsvContent: string;
    instructions: string[];
    onClose: () => void;
    onImport: (file: File) => Promise<ImportResult>;
}

const ImportModal: React.FC<ImportModalProps> = ({ entityName, templateCsvContent, instructions, onClose, onImport }) => {
    const [file, setFile] = useState<File | null>(null);
    const [isImporting, setIsImporting] = useState(false);
    const [result, setResult] = useState<ImportResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setError(null);
            setResult(null);
        }
    };

    const handleImportClick = async () => {
        if (!file) {
            setError('Per favore, seleziona un file CSV.');
            return;
        }

        setIsImporting(true);
        setError(null);
        setResult(null);

        try {
            const importResult = await onImport(file);
            setResult(importResult);
        } catch (err) {
            console.error(err);
            setError(`Si è verificato un errore imprevisto durante l'importazione. Controlla la console per i dettagli.`);
        } finally {
            setIsImporting(false);
        }
    };

    const handleDownloadTemplate = () => {
        const blob = new Blob([templateCsvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `${entityName.toLowerCase()}_template.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <Modal onClose={onClose}>
            <div className="text-center">
                <h2 className="text-xl font-bold text-slate-800" id="modal-title">Importa {entityName} da CSV</h2>
            </div>
            {!result ? (
                <div className="mt-4">
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-md">
                        <h3 className="font-semibold text-sm text-slate-700">Istruzioni</h3>
                        <ul className="list-disc list-inside text-sm text-slate-600 mt-2 space-y-1">
                            {instructions.map((inst, index) => <li key={index}>{inst}</li>)}
                        </ul>
                         <button onClick={handleDownloadTemplate} className="text-sm font-medium text-indigo-600 hover:text-indigo-800 mt-3">
                            Scarica template
                        </button>
                    </div>

                    <div className="mt-4">
                        <label htmlFor="file-upload" className="block text-sm font-medium text-slate-700">Seleziona file CSV</label>
                        <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-300 border-dashed rounded-md">
                            <div className="space-y-1 text-center">
                                <UploadIcon />
                                <div className="flex text-sm text-slate-600">
                                    <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500">
                                        <span>Carica un file</span>
                                        <input id="file-upload" name="file-upload" type="file" className="sr-only" accept=".csv" onChange={handleFileChange} />
                                    </label>
                                    <p className="pl-1">o trascinalo qui</p>
                                </div>
                                {file && <p className="text-xs text-slate-500">{file.name}</p>}
                            </div>
                        </div>
                    </div>

                    {error && <p className="text-sm text-red-600 text-center mt-3">{error}</p>}
                    
                    <div className="mt-6 flex justify-end space-x-3">
                        <button type="button" onClick={onClose} className="bg-white py-2 px-4 border border-slate-300 rounded-md shadow-sm text-sm font-medium text-slate-700 hover:bg-slate-50">Annulla</button>
                        <button type="button" onClick={handleImportClick} disabled={isImporting || !file} className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400">
                            {isImporting ? <Spinner /> : 'Importa'}
                        </button>
                    </div>
                </div>
            ) : (
                <div className="mt-4">
                    <h3 className="font-semibold text-lg text-slate-800 text-center">Riepilogo Importazione</h3>
                    <div className="mt-4 grid grid-cols-2 gap-4 text-center">
                        <div className="bg-green-50 p-3 rounded-md">
                            <p className="text-2xl font-bold text-green-700">{result.created}</p>
                            <p className="text-sm font-medium text-green-600">Creati</p>
                        </div>
                         <div className="bg-sky-50 p-3 rounded-md">
                            <p className="text-2xl font-bold text-sky-700">{result.updated}</p>
                            <p className="text-sm font-medium text-sky-600">Aggiornati</p>
                        </div>
                    </div>
                     {result.errors.length > 0 && (
                        <div className="mt-4">
                            <h4 className="font-semibold text-red-700">Errori ({result.errors.length})</h4>
                            <div className="mt-2 bg-red-50 p-3 rounded-md max-h-40 overflow-y-auto text-sm">
                                {result.errors.map((err, index) => (
                                    <p key={index} className="text-red-800"><b>Riga {err.row}:</b> {err.message}</p>
                                ))}
                            </div>
                        </div>
                    )}
                    <div className="mt-6 text-center">
                        <button type="button" onClick={onClose} className="bg-indigo-600 text-white py-2 px-6 rounded-md shadow-sm text-sm font-medium hover:bg-indigo-700">Chiudi</button>
                    </div>
                </div>
            )}
        </Modal>
    );
};

export default ImportModal;
