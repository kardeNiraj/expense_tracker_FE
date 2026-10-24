import React from 'react';
import { useExpense } from '../../context';

export const Toast: React.FC = () => {
    const { toast } = useExpense();

    if (!toast.visible) return null;

    return (
        <div
            role="status"
            aria-live="polite"
            className="fixed top-20 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 max-w-[90vw] animate-in fade-in slide-in-from-top-4"
        >
            <div className="bg-inverse-surface text-inverse-on-surface px-4 py-2.5 rounded-full shadow-2xl flex items-center gap-2 text-xs font-semibold tracking-wide border border-outline/30 backdrop-blur-md">
                <span className="material-symbols-outlined text-primary-fixed text-[18px]">
                    {toast.icon || 'check_circle'}
                </span>
                <span>{toast.message}</span>
            </div>
        </div>
    );
};

export default Toast;
