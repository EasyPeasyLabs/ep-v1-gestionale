import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'danger';
    // FIX: Added an optional `size` prop to support different button dimensions. This resolves errors where the prop was used without being defined.
    size?: 'sm' | 'md';
    children: React.ReactNode;
    icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({ variant = 'primary', size = 'md', children, icon, ...props }) => {
    // FIX: Removed size-specific styling from base classes to allow for dynamic sizing.
    const baseClasses = 'rounded-md font-semibold inline-flex items-center justify-center transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';

    const variantClasses = {
        primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
        secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 focus:ring-gray-500',
        danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
    };

    // FIX: Added a map of classes for different button sizes.
    const sizeClasses = {
        sm: 'px-2 py-1 text-xs',
        md: 'px-4 py-2 text-sm',
    };

    return (
        // FIX: Applied the dynamic size class along with variant and base classes.
        <button className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]}`} {...props}>
            {icon && <span className="mr-2 -ml-1">{icon}</span>}
            {children}
        </button>
    );
};
