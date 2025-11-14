import React from 'react';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    label: string;
    id: string;
    options?: readonly string[];
}

export const Select: React.FC<SelectProps> = ({ label, id, options, children, ...props }) => {
    return (
        <div>
            <label htmlFor={id} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {label}
            </label>
            <select
                id={id}
                className="block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                {...props}
            >
                {options ? (
                    <>
                        <option value="">Seleziona...</option>
                        {options.map((option) => (
                            <option key={option} value={option}>{option}</option>
                        ))}
                    </>
                ) : (
                    children
                )}
            </select>
        </div>
    );
};
