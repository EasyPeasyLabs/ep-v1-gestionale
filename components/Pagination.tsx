
import React from 'react';

interface PaginationProps {
    currentPage: number;
    totalItems: number;
    itemsPerPage: number;
    onPageChange: (page: number) => void;
}

const Pagination: React.FC<PaginationProps> = ({ currentPage, totalItems, itemsPerPage, onPageChange }) => {
    const totalPages = Math.ceil(totalItems / itemsPerPage);

    if (totalPages <= 1) return null;

    const startItem = (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, totalItems);

    const getPageNumbers = () => {
        const pages = [];
        const maxVisiblePages = 5;
        
        let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

        if (endPage - startPage + 1 < maxVisiblePages) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }

        for (let i = startPage; i <= endPage; i++) {
            pages.push(i);
        }
        return pages;
    };

    return (
        <div className="flex flex-col sm:flex-row justify-between items-center py-4 px-2 border-t border-gray-100 mt-4 gap-4">
            <div className="text-xs text-gray-500">
                Mostrando <span className="font-bold">{startItem}</span> - <span className="font-bold">{endItem}</span> di <span className="font-bold">{totalItems}</span> risultati
            </div>
            
            <div className="flex items-center space-x-1">
                <button
                    onClick={() => onPageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="md-btn md-btn-flat px-2 py-1 text-xs disabled:opacity-30"
                >
                    &lt; Prec
                </button>

                {getPageNumbers().map(number => (
                    <button
                        key={number}
                        onClick={() => onPageChange(number)}
                        className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-bold transition-all ${
                            currentPage === number
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'text-gray-600 hover:bg-gray-100'
                        }`}
                    >
                        {number}
                    </button>
                ))}

                <button
                    onClick={() => onPageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="md-btn md-btn-flat px-2 py-1 text-xs disabled:opacity-30"
                >
                    Succ &gt;
                </button>
            </div>
        </div>
    );
};

export default Pagination;
