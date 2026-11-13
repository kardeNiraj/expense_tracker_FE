import React from 'react';
import { useExpense } from '../../context';
import type { AppTab } from '../../context/ExpenseContextDef';
import { triggerHaptic } from '../../utils/haptics';
import { AppIcon } from '../Icon/AppIcon';

export const BottomNav: React.FC = () => {
    const { activeTab, setActiveTab, isFormerActiveGroup, isRoomArchived, isRoomClosed } =
        useExpense();

    const handleTabClick = (tabId: AppTab) => {
        triggerHaptic('light');
        setActiveTab(tabId);
    };

    const tabs: { id: AppTab; label: string; icon: string; isAdd?: boolean }[] = [
        { id: 'dashboard', label: 'Overview', icon: 'dashboard' },
        { id: 'splits', label: 'Splits', icon: 'pie_chart' },
        ...(!isFormerActiveGroup && !isRoomArchived && !isRoomClosed
            ? [{ id: 'add' as AppTab, label: 'Add', icon: 'add', isAdd: true }]
            : []),
        { id: 'analytics', label: 'Stats', icon: 'analytics' },
        { id: 'people', label: 'People', icon: 'group' },
    ];

    return (
        <nav
            aria-label="Bottom Navigation"
            className="fixed bottom-0 inset-x-0 z-40 pb-safe bg-surface-container-lowest/95 backdrop-blur-xl border-t border-outline-variant/30 shadow-[0_-2px_12px_rgba(0,0,0,0.05)]"
        >
            <div className="max-w-md mx-auto h-16 px-1.5 flex items-center justify-around">
                {tabs.map((tab) => {
                    const isActive = activeTab === tab.id;

                    if (tab.isAdd) {
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => handleTabClick(tab.id)}
                                className="flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 min-h-[44px] group cursor-pointer"
                            >
                                <div
                                    className={`w-9 h-9 rounded-full flex items-center justify-center transition-transform ${
                                        isActive
                                            ? 'bg-primary text-on-primary ring-2 ring-primary/30 scale-105 shadow-md'
                                            : 'bg-primary-container text-on-primary-container group-hover:scale-105'
                                    }`}
                                >
                                    <AppIcon name="add" className="text-[22px]" />
                                </div>
                                <span
                                    className={`text-[10px] font-semibold transition-colors ${
                                        isActive ? 'text-primary' : 'text-on-surface-variant'
                                    }`}
                                >
                                    {tab.label}
                                </span>
                            </button>
                        );
                    }

                    return (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => handleTabClick(tab.id)}
                            className={`flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 min-h-[44px] transition-colors cursor-pointer ${
                                isActive
                                    ? 'text-primary font-bold'
                                    : 'text-on-surface-variant hover:text-on-surface'
                            }`}
                        >
                            <AppIcon
                                name={tab.icon}
                                className={`text-[21px] transition-transform ${
                                    isActive ? 'scale-110' : ''
                                }`}
                            />
                            <span className="text-[10px] font-medium tracking-tight truncate">
                                {tab.label}
                            </span>
                        </button>
                    );
                })}
            </div>
        </nav>
    );
};

export default BottomNav;
