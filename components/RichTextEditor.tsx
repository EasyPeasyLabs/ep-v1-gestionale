
import React, { useEffect, useRef, useState } from 'react';

interface RichTextEditorProps {
    value: string;
    onChange: (html: string) => void;
    placeholder?: string;
    label?: string;
    className?: string;
}

const RichTextEditor: React.FC<RichTextEditorProps> = ({ value, onChange, placeholder, label, className }) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const [isFocused, setIsFocused] = useState(false);

    // Sync external value to internal HTML only if different to avoid cursor jumping
    useEffect(() => {
        if (editorRef.current && editorRef.current.innerHTML !== value) {
            // Only update if focused is false or content is empty to prevent loops
            if (!isFocused || !editorRef.current.innerText.trim()) {
                editorRef.current.innerHTML = value;
            }
        }
    }, [value, isFocused]);

    const handleInput = () => {
        if (editorRef.current) {
            onChange(editorRef.current.innerHTML);
        }
    };

    const execCmd = (command: string, value: string | undefined = undefined) => {
        document.execCommand(command, false, value);
        if (editorRef.current) {
            editorRef.current.focus();
            onChange(editorRef.current.innerHTML);
        }
    };

    const handleTextTransform = (type: 'upper' | 'lower') => {
        const selection = window.getSelection();
        if (selection && !selection.isCollapsed) {
            const text = selection.toString();
            const transformed = type === 'upper' ? text.toUpperCase() : text.toLowerCase();
            document.execCommand('insertText', false, transformed);
        }
    };

    const Button: React.FC<{ cmd?: string; arg?: string; icon: React.ReactNode; active?: boolean; onClick?: () => void; title: string }> = ({ cmd, arg, icon, active, onClick, title }) => (
        <button
            type="button"
            onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (onClick) onClick();
                else if (cmd) execCmd(cmd, arg);
            }}
            className={`p-1.5 rounded hover:bg-gray-200 transition-colors text-gray-700 ${active ? 'bg-gray-300' : ''}`}
            title={title}
        >
            {icon}
        </button>
    );

    return (
        <div className={`flex flex-col border border-gray-300 rounded-lg overflow-hidden bg-white focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500 transition-all ${className}`}>
            {label && <label className="text-xs font-bold text-gray-500 uppercase px-3 pt-2">{label}</label>}
            
            {/* Toolbar */}
            <div className="flex flex-wrap gap-1 p-2 bg-gray-50 border-b border-gray-200 items-center">
                {/* Style */}
                <div className="flex gap-0.5 border-r border-gray-300 pr-2 mr-1">
                    <Button cmd="bold" icon={<span className="font-bold">B</span>} title="Grassetto" />
                    <Button cmd="italic" icon={<span className="italic font-serif">I</span>} title="Corsivo" />
                </div>

                {/* Lists */}
                <div className="flex gap-0.5 border-r border-gray-300 pr-2 mr-1">
                    <Button cmd="insertUnorderedList" icon={<span>• List</span>} title="Elenco Puntato" />
                    <Button cmd="insertOrderedList" icon={<span>1. List</span>} title="Elenco Numerato" />
                </div>

                {/* Alignment */}
                <div className="flex gap-0.5 border-r border-gray-300 pr-2 mr-1">
                    <Button cmd="justifyLeft" icon={<AlignLeftIcon />} title="Allinea Sinistra" />
                    <Button cmd="justifyCenter" icon={<AlignCenterIcon />} title="Centra" />
                    <Button cmd="justifyRight" icon={<AlignRightIcon />} title="Allinea Destra" />
                    <Button cmd="justifyFull" icon={<AlignJustifyIcon />} title="Giustifica" />
                </div>

                {/* Transform */}
                <div className="flex gap-0.5 border-r border-gray-300 pr-2 mr-1">
                    <Button onClick={() => handleTextTransform('upper')} icon={<span className="text-xs font-bold">AA</span>} title="TUTTO MAIUSCOLO" />
                    <Button onClick={() => handleTextTransform('lower')} icon={<span className="text-xs">aa</span>} title="tutto minuscolo" />
                </div>

                {/* Colors */}
                <div className="flex gap-1 items-center">
                    <button type="button" onClick={() => execCmd('foreColor', '#000000')} className="w-4 h-4 rounded-full bg-black border border-gray-300 hover:scale-110 transition-transform" title="Nero (Default)"></button>
                    <button type="button" onClick={() => execCmd('foreColor', '#2563eb')} className="w-4 h-4 rounded-full bg-blue-600 border border-gray-300 hover:scale-110 transition-transform" title="Blu"></button>
                    <button type="button" onClick={() => execCmd('foreColor', '#dc2626')} className="w-4 h-4 rounded-full bg-red-600 border border-gray-300 hover:scale-110 transition-transform" title="Rosso"></button>
                </div>
            </div>

            {/* Editable Area */}
            <div
                ref={editorRef}
                contentEditable
                className="p-3 min-h-[150px] outline-none text-sm text-gray-800 overflow-y-auto"
                onInput={handleInput}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                style={{ maxHeight: '300px' }}
                data-placeholder={placeholder}
            />
            {/* CSS Placeholder Trick */}
            <style>{`
                [contenteditable]:empty:before {
                    content: attr(data-placeholder);
                    color: #9ca3af;
                    pointer-events: none;
                    display: block; /* For Firefox */
                }
            `}</style>
        </div>
    );
};

// Simple Icons for RTE
const AlignLeftIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h10M4 18h14"/></svg>;
const AlignCenterIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M7 12h10M5 18h14"/></svg>;
const AlignRightIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M10 12h10M6 18h14"/></svg>;
const AlignJustifyIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h16"/></svg>;

export default RichTextEditor;
