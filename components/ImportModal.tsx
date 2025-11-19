
import React, { useState } from 'react';
import * as XLSX from 'xlsx';
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
    templateHeaders: string[];
    instructions: string[];
    onClose: () => void;
    onImport: (file: File) => Promise<ImportResult>;
}

const ImportModal: React.FC<ImportModalProps> = ({ entityName, templateHeaders, instructions, onClose, onImport }) => {
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
            setError('Per favore, seleziona un file Excel.');
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
        // Crea un worksheet con solo le intestazioni
        const ws = XLSX.utils.json_to_sheet([{}], { header: templateHeaders });
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Template");
        // Scrive il file e avvia il download
        XLSX.writeFile(wb, `${entityName.toLowerCase()}_template.xlsx`);
    };

    return (
        <Modal onClose={onClose}>
             <div className="flex flex-col h-full">
                <div className="text-center flex-shrink-0">
                    <h2 className="text-xl font-bold" id="modal-title">Importa {entityName} da Excel</h2>
                </div>
                
                <div className="flex-1 overflow-y-auto pr-2">
                {!result ? (
                    <div className="mt-4">
                        <div className="p-4 bg-gray-50 border rounded-md" style={{borderColor: 'var(--md-divider)'}}>
                            <h3 className="font-semibold text-sm">Istruzioni</h3>
                            <ul className="list-disc list-inside text-sm mt-2 space-y-1" style={{color: 'var(--md-text-secondary)'}}>
                                {instructions.map((inst, index) => <li key={index}>{inst}</li>)}
                            </ul>
                             <button onClick={handleDownloadTemplate} className="text-sm font-medium mt-3" style={{color: 'var(--md-primary)'}}>
                                Scarica template
                            </button>
                        </div>

                        <div className="mt-4">
                            <label className="block text-sm font-medium mb-1">Seleziona File (.xlsx)</label>
                            <div className="flex items-center justify-center w-full">
                                <label htmlFor="dropzone-file" className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                        <UploadIcon />
                                        <p className="mb-2 text-sm text-gray-500"><span className="font-semibold">Clicca per caricare</span> o trascina il file</p>
                                        <p className="text-xs text-gray-500">Excel (.xlsx)</p>
                                    </div>
                                    <input id="dropzone-file" type="file" className="hidden" accept=".xlsx" onChange={handleFileChange} />
                                </label>
                            </div>
                            {file && <p className="mt-2 text-sm text-green-600 font-medium text-center">File selezionato: {file.name}</p>}
                        </div>
                        
                        {error && <p className="mt-4 text-sm text-red-500 text-center">{error}</p>}
                    </div>
                ) : (
                    <div className="mt-4 space-y-4">
                        <div className={`p-4 rounded-md ${result.errors.length === 0 ? 'bg-green-50 text-green-800' : 'bg-yellow-50 text-yellow-800'}`}>
                            <h3 className="font-bold">Importazione Completata</h3>
                            <p className="text-sm mt-1">Creati: {result.created} | Aggiornati: {result.updated}</p>
                        </div>
                        
                        {result.errors.length > 0 && (
                            <div>
                                <h4 className="font-semibold text-sm text-red-600">Errori ({result.errors.length})</h4>
                                <ul className="mt-2 max-h-40 overflow-y-auto text-xs bg-gray-50 p-2 rounded border border-red-100 space-y-1">
                                    {result.errors.map((err, idx) => (
                                        <li key={idx} className="text-red-600">Riga {err.row}: {err.message}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                )}
                </div>

                <div className="mt-6 pt-4 border-t flex justify-end space-x-3 flex-shrink-0" style={{borderColor: 'var(--md-divider)'}}>
                    <button onClick={onClose} className="md-btn md-btn-flat">Chiudi</button>
                    {!result && (
                        <button 
                            onClick={handleImportClick} 
                            disabled={!file || isImporting} 
                            className="md-btn md-btn-raised md-btn-primary"
                        >
                            {isImporting ? <Spinner /> : 'Importa'}
                        </button>
                    )}
                </div>
            </div>
        </Modal>
    );
};

export default ImportModal;
