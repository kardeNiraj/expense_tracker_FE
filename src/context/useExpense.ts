import { useContext } from 'react';
import { ExpenseContext } from './ExpenseContextDef';

export const useExpense = () => {
    const context = useContext(ExpenseContext);
    if (!context) {
        throw new Error('useExpense must be used within an ExpenseProvider');
    }
    return context;
};
