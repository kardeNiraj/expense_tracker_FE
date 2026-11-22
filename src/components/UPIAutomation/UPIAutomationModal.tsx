import React, { useMemo, useState } from 'react';
import { AppIcon } from '../Icon/AppIcon';
import { Avatar } from '../Avatar';
import { triggerHaptic } from '../../utils/haptics';
import { useExpense } from '../../context';
import {
    useCategories,
    useQuickExpenseIntegration,
    useGenerateQuickExpenseTokenMutation,
    useRotateQuickExpenseTokenMutation,
    useRevokeQuickExpenseTokenMutation,
    useTestQuickExpenseMutation,
    useUndoQuickExpenseMutation,
} from '../../api';

interface UPIAutomationModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const UPIAutomationModal: React.FC<UPIAutomationModalProps> = ({
    isOpen,
    onClose,
}) => {
    const { activeGroup, claimedPerson, activePerson, showToast } = useExpense();
    const currentMemberName = claimedPerson || activePerson || 'User';

    const [activeOsTab, setActiveOsTab] = useState<'ios' | 'android'>('ios');
    const [showSecret, setShowSecret] = useState(false);
    const [copiedField, setCopiedField] = useState<'url' | 'token' | 'curl' | 'payload' | 'shortcut' | null>(null);
    const [selectedCategoryOverride, setSelectedCategoryOverride] = useState<string | null>(null);
    const [lastTestExpenseId, setLastTestExpenseId] = useState<string | null>(null);
    const [showSafeguards, setShowSafeguards] = useState(false);
    const [showJsonSchema, setShowJsonSchema] = useState(false);

    const { data: serverCategories } = useCategories();
    const {
        data: integrationConfig,
        isLoading,
        refetch,
    } = useQuickExpenseIntegration(activeGroup?.groupId, isOpen);

    const generateMutation = useGenerateQuickExpenseTokenMutation();
    const rotateMutation = useRotateQuickExpenseTokenMutation();
    const revokeMutation = useRevokeQuickExpenseTokenMutation();
    const testMutation = useTestQuickExpenseMutation();
    const undoMutation = useUndoQuickExpenseMutation();

    const iosShortcutUrl =
        (import.meta.env.VITE_IOS_SHORTCUT_URL || '').trim() ||
        'https://www.icloud.com/shortcuts/5313d107fb104900b4e06a23dfc917a4';

    const tokenDoc = integrationConfig?.integration;
    const isConfigured = Boolean(tokenDoc?.token);

    const availableCategories = useMemo(() => {
        if (Array.isArray(serverCategories) && serverCategories.length > 0) {
            const list = serverCategories
                .map((c) => (typeof c === 'string' ? c : (c as { name?: string })?.name || ''))
                .filter(Boolean);
            if (list.length > 0) return list;
        }
        const intCats = integrationConfig?.categories;
        if (Array.isArray(intCats) && intCats.length > 0) {
            const list = intCats
                .map((c) => (typeof c === 'string' ? c : (c as { name?: string })?.name || ''))
                .filter(Boolean);
            if (list.length > 0) return list;
        }
        return [
            'Food & Dining',
            'Beverages & Snacks',
            'Fuel',
            'Groceries & Supplies',
            'Transportation',
            'Accommodation',
            'Entertainment',
            'Activities & Adventure',
            'Shopping',
            'Personal',
            'Miscellaneous',
        ];
    }, [serverCategories, integrationConfig?.categories]);

    const activeDefaultCategory = useMemo(() => {
        if (selectedCategoryOverride && availableCategories.includes(selectedCategoryOverride)) {
            return selectedCategoryOverride;
        }
        return availableCategories[0] || 'Food & Dining';
    }, [selectedCategoryOverride, availableCategories]);

    if (!isOpen) return null;

    const getBaseApiUrl = (): string => {
        const raw = (import.meta.env.VITE_API_BASE_URL || '').trim();
        if (raw && /^https?:\/\//i.test(raw) && !raw.includes('localhost')) {
            return `${raw.replace(/\/+$/, '')}/quick-expense`;
        }
        return `${window.location.origin}/quick-expense`;
    };

    const webhookUrl = getBaseApiUrl();
    const webhookToken = tokenDoc?.token || '';

    const handleCopy = async (text: string, field: 'url' | 'token' | 'curl' | 'payload' | 'shortcut') => {
        try {
            await navigator.clipboard.writeText(text);
            triggerHaptic('success');
            setCopiedField(field);
            showToast(
                field === 'token'
                    ? 'Secret token copied!'
                    : field === 'url'
                    ? 'Webhook URL copied!'
                    : field === 'shortcut'
                    ? 'Shortcut link copied!'
                    : field === 'curl'
                    ? 'cURL command copied!'
                    : 'Payload copied!',
                'content_copy'
            );
            setTimeout(() => setCopiedField(null), 2500);
        } catch {
            triggerHaptic('warning');
            showToast('Failed to copy', 'error');
        }
    };

    const handleGenerate = async () => {
        triggerHaptic('medium');
        try {
            await generateMutation.mutateAsync({
                groupId: activeGroup?.groupId,
                memberName: currentMemberName,
                defaultCategory: activeDefaultCategory,
            });
            showToast('Webhook integration key generated!', 'check_circle');
            refetch();
        } catch (err: unknown) {
            triggerHaptic('warning');
            const msg = err instanceof Error ? err.message : 'Failed to generate webhook key';
            showToast(msg, 'error');
        }
    };

    const handleRotate = async () => {
        if (!window.confirm('Rotating this key will immediately invalidate your previous Shortcut configuration. Continue?')) {
            return;
        }
        triggerHaptic('warning');
        try {
            await rotateMutation.mutateAsync({
                groupId: activeGroup?.groupId,
                memberName: currentMemberName,
                defaultCategory: activeDefaultCategory,
            });
            showToast('New webhook key generated!', 'autorenew');
            refetch();
        } catch (err: unknown) {
            triggerHaptic('warning');
            const msg = err instanceof Error ? err.message : 'Failed to rotate key';
            showToast(msg, 'error');
        }
    };

    const handleRevoke = async () => {
        if (!window.confirm('Are you sure you want to revoke this automation webhook? External automations will no longer be able to log expenses.')) {
            return;
        }
        triggerHaptic('warning');
        try {
            await revokeMutation.mutateAsync({
                groupId: activeGroup?.groupId,
            });
            showToast('Webhook key revoked.', 'delete');
            refetch();
        } catch (err: unknown) {
            triggerHaptic('warning');
            const msg = err instanceof Error ? err.message : 'Failed to revoke key';
            showToast(msg, 'error');
        }
    };

    const handleSendTest = async () => {
        if (!webhookToken) return;
        triggerHaptic('medium');
        const testExpenseId = `test_upi_${Date.now()}`;
        try {
            const testPayload = {
                amount: 10,
                description: 'Chai Point (UPI Test)',
                category: 'Food & Dining',
                payee: currentMemberName,
                expenseId: testExpenseId,
                source: 'test_button',
            };
            const res = await testMutation.mutateAsync({
                token: webhookToken,
                payload: testPayload,
            });
            triggerHaptic('success');
            setLastTestExpenseId(testExpenseId);
            showToast(res.message || 'Test expense of ₹10 recorded!', 'verified');
        } catch (err: unknown) {
            triggerHaptic('warning');
            const msg = err instanceof Error ? err.message : 'Failed to send test expense';
            showToast(msg, 'error');
        }
    };

    const handleUndoTest = async () => {
        if (!lastTestExpenseId || !webhookToken) return;
        triggerHaptic('light');
        try {
            await undoMutation.mutateAsync({
                token: webhookToken,
                expenseId: lastTestExpenseId,
            });
            setLastTestExpenseId(null);
            showToast('Test expense of ₹10 removed.', 'delete');
        } catch (err: unknown) {
            triggerHaptic('warning');
            const msg = err instanceof Error ? err.message : 'Failed to remove test expense';
            showToast(msg, 'error');
        }
    };

    const samplePayload = {
        amount: 250,
        description: 'Chai Point',
        category: 'Beverages & Snacks',
        payee: currentMemberName,
        expenseId: 'upi_432587123456',
        source: activeOsTab === 'ios' ? 'ios_shortcut' : 'macrodroid',
    };

    const curlCommand = `curl -X POST "${webhookUrl}" \\
  -H "Content-Type: application/json" \\
  -H "x-webhook-token: ${webhookToken || 'YOUR_TOKEN'}" \\
  -d '${JSON.stringify(samplePayload)}'`;

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
            {/* Backdrop click dismiss */}
            <div
                className="fixed inset-0"
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Modal Card / Bottom Sheet */}
            <div className="relative z-10 bg-surface-card rounded-t-3xl sm:rounded-3xl w-full max-w-lg border-t sm:border border-border-subtle shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-on-surface animate-in slide-in-from-bottom duration-250">
                {/* Mobile Handle Indicator */}
                <div className="w-10 h-1 bg-outline-variant/40 rounded-full mx-auto mt-2.5 mb-1 sm:hidden shrink-0" />

                {/* Modal Header */}
                <div className="px-5 py-3.5 border-b border-border-subtle flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8.5 h-8.5 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                            <AppIcon name="bolt" className="text-[20px]" />
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-base font-bold font-headline text-on-surface leading-tight truncate">
                                UPI & Shortcuts Automation
                            </h2>
                            <p className="text-[11px] text-on-surface-variant leading-tight truncate">
                                Auto-log payments from GPay, PhonePe, or Paytm
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-card-subtle transition-colors cursor-pointer"
                        aria-label="Close"
                    >
                        <AppIcon name="close" className="text-[18px]" />
                    </button>
                </div>

                {/* Scrollable Content */}
                <div className="overflow-y-auto p-4 sm:p-5 space-y-4">
                    {/* Active Context Attribution Ribbon */}
                    <div className="px-3 py-2 rounded-xl bg-surface-card-subtle border border-border-subtle flex items-center justify-between gap-2.5 text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                            <Avatar name={currentMemberName} size="sm" />
                            <div className="min-w-0 leading-tight">
                                <span className="font-bold text-on-surface block truncate">
                                    {activeGroup?.name || 'Current Room'}
                                </span>
                                <span className="text-[10px] text-on-surface-variant block truncate">
                                    Auto-logs as <strong className="text-primary font-medium">{currentMemberName}</strong>
                                </span>
                            </div>
                        </div>

                        {isConfigured ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold font-mono bg-status-settled-bg text-status-settled-text shrink-0">
                                <span className="w-1.5 h-1.5 rounded-full bg-status-settled-text animate-pulse" />
                                Active
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-surface-card text-on-surface-variant border border-border-subtle shrink-0">
                                Not Configured
                            </span>
                        )}
                    </div>

                    {/* Webhook Configuration Section */}
                    {isLoading ? (
                        <div className="py-8 text-center text-xs text-on-surface-variant animate-pulse">
                            Loading integration keys...
                        </div>
                    ) : !isConfigured ? (
                        /* Empty State: Clean Onboarding Card */
                        <div className="p-4 sm:p-5 rounded-2xl bg-primary/5 border border-primary/15 text-center space-y-3.5">
                            <div className="w-11 h-11 rounded-2xl bg-primary/10 text-primary mx-auto flex items-center justify-center shadow-2xs">
                                <AppIcon name="vpn_key" className="text-[22px]" />
                            </div>

                            <div>
                                <h3 className="text-sm font-bold font-headline text-on-surface">
                                    Capture Expenses with Zero Taps
                                </h3>
                                <p className="text-xs text-on-surface-variant mt-1 max-w-sm mx-auto leading-relaxed">
                                    Connect Apple Shortcuts or Android MacroDroid to log your group expenses automatically whenever you pay via UPI.
                                </p>
                            </div>

                            {/* 3 Key Value Props */}
                            <div className="grid grid-cols-3 gap-2 py-1 text-left max-w-sm mx-auto">
                                <div className="p-2 rounded-xl bg-surface-card border border-border-subtle">
                                    <span className="text-[10px] font-bold text-primary block">⚡ 0.5s Log</span>
                                    <span className="text-[9px] text-on-surface-variant block mt-0.5">Captures receipt on payment</span>
                                </div>
                                <div className="p-2 rounded-xl bg-surface-card border border-border-subtle">
                                    <span className="text-[10px] font-bold text-primary block">🔒 On-Device</span>
                                    <span className="text-[9px] text-on-surface-variant block mt-0.5">Bank digits stay private</span>
                                </div>
                                <div className="p-2 rounded-xl bg-surface-card border border-border-subtle">
                                    <span className="text-[10px] font-bold text-primary block">🎯 1-Tap Check</span>
                                    <span className="text-[9px] text-on-surface-variant block mt-0.5">Category prompt on lockscreen</span>
                                </div>
                            </div>

                            {/* Default Category Picker */}
                            <div className="max-w-xs mx-auto text-left pt-1">
                                <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1">
                                    Default Category for Unknown Spends
                                </label>
                                <select
                                    value={activeDefaultCategory}
                                    onChange={(e) => setSelectedCategoryOverride(e.target.value)}
                                    className="w-full h-8.5 px-3 rounded-xl bg-surface-card border border-border-strong text-xs text-on-surface focus:outline-hidden focus:ring-1 focus:ring-primary font-medium"
                                >
                                    {availableCategories.map((cat) => (
                                        <option key={cat} value={cat}>
                                            {cat}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <button
                                type="button"
                                onClick={handleGenerate}
                                disabled={generateMutation.isPending}
                                className="h-9 px-5 rounded-xl bg-primary hover:bg-primary-dark text-on-primary text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
                            >
                                <AppIcon name={generateMutation.isPending ? 'sync' : 'bolt'} className={`text-[15px] ${generateMutation.isPending ? 'animate-spin' : ''}`} />
                                <span>{generateMutation.isPending ? 'Generating Key...' : 'Enable UPI Automation'}</span>
                            </button>
                        </div>
                    ) : (
                        /* Configured State: Sleek Credentials & Controls Card */
                        <div className="p-3.5 rounded-2xl bg-surface-card border border-border-subtle space-y-3">
                            {/* Endpoint URL Row */}
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-[10px] font-bold font-mono text-on-surface-variant uppercase tracking-wider">
                                        Webhook Ingest Endpoint
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => handleCopy(webhookUrl, 'url')}
                                        className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                                    >
                                        <AppIcon name={copiedField === 'url' ? 'check' : 'content_copy'} className="text-[12px]" />
                                        <span>{copiedField === 'url' ? 'Copied' : 'Copy URL'}</span>
                                    </button>
                                </div>
                                <div className="h-8 px-2.5 rounded-xl bg-surface-card-subtle border border-border-subtle flex items-center text-xs font-mono text-on-surface select-all truncate">
                                    {webhookUrl}
                                </div>
                            </div>

                            {/* Ingest Token Row */}
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-[10px] font-bold font-mono text-on-surface-variant uppercase tracking-wider">
                                        Personal Secret Token
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setShowSecret(!showSecret)}
                                            className="text-[11px] font-medium text-on-surface-variant hover:text-on-surface flex items-center gap-0.5 cursor-pointer"
                                        >
                                            <AppIcon name={showSecret ? 'visibility_off' : 'visibility'} className="text-[13px]" />
                                            <span>{showSecret ? 'Hide' : 'Reveal'}</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleCopy(webhookToken, 'token')}
                                            className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                                        >
                                            <AppIcon name={copiedField === 'token' ? 'check' : 'content_copy'} className="text-[12px]" />
                                            <span>{copiedField === 'token' ? 'Copied' : 'Copy'}</span>
                                        </button>
                                    </div>
                                </div>
                                <div className="h-8 px-2.5 rounded-xl bg-surface-card-subtle border border-border-subtle flex items-center text-xs font-mono text-on-surface select-all truncate">
                                    {showSecret ? webhookToken : `sn_wh_${'•'.repeat(24)}`}
                                </div>
                            </div>

                            {/* Control Bar: Test Button + Rotate + Revoke */}
                            <div className="flex items-center justify-between gap-2 pt-2 border-t border-border-subtle">
                                <button
                                    type="button"
                                    onClick={handleSendTest}
                                    disabled={testMutation.isPending}
                                    className="h-7.5 px-3 rounded-lg bg-status-settled-bg hover:opacity-90 text-status-settled-text text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors active:scale-95 disabled:opacity-50 shadow-2xs"
                                    title="Dispatches a test expense of ₹10 to verify your webhook"
                                >
                                    <AppIcon name={testMutation.isPending ? 'sync' : 'send'} className={`text-[13px] ${testMutation.isPending ? 'animate-spin' : ''}`} />
                                    <span>{testMutation.isPending ? 'Testing...' : 'Test Webhook (₹10)'}</span>
                                </button>

                                <div className="flex items-center gap-1.5">
                                    <button
                                        type="button"
                                        onClick={handleRotate}
                                        disabled={rotateMutation.isPending}
                                        className="h-7.5 px-2 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-card-subtle text-xs font-medium flex items-center gap-1 cursor-pointer transition-colors"
                                        title="Generates a fresh key and invalidates the previous one"
                                    >
                                        <AppIcon name="autorenew" className="text-[14px]" />
                                        <span className="hidden sm:inline">Rotate</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleRevoke}
                                        disabled={revokeMutation.isPending}
                                        className="h-7.5 px-2 rounded-lg text-negative hover:bg-negative/10 text-xs font-medium flex items-center gap-1 cursor-pointer transition-colors"
                                        title="Revokes this webhook key completely"
                                    >
                                        <AppIcon name="delete" className="text-[14px]" />
                                        <span className="hidden sm:inline">Revoke</span>
                                    </button>
                                </div>
                            </div>

                            {/* Test Undo Banner */}
                            {lastTestExpenseId && (
                                <div className="p-2.5 rounded-xl bg-status-settled-bg/40 border border-status-settled-text/20 flex items-center justify-between gap-2 text-xs text-status-settled-text animate-in fade-in duration-150">
                                    <span className="flex items-center gap-1 font-medium truncate">
                                        <AppIcon name="verified" className="text-[14px] shrink-0" />
                                        <span>Test expense logged to ledger!</span>
                                    </span>
                                    <button
                                        type="button"
                                        onClick={handleUndoTest}
                                        disabled={undoMutation.isPending}
                                        className="text-xs font-bold text-negative hover:underline shrink-0 cursor-pointer"
                                    >
                                        {undoMutation.isPending ? 'Removing...' : 'Undo (Remove ₹10)'}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Platform Setup Guides */}
                    <div className="space-y-3">
                        {/* Segmented Pill Selector */}
                        <div className="flex rounded-xl bg-surface-card-subtle p-0.5 border border-border-subtle">
                            <button
                                type="button"
                                onClick={() => setActiveOsTab('ios')}
                                className={`flex-1 h-7.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                                    activeOsTab === 'ios'
                                        ? 'bg-surface-card text-primary shadow-2xs'
                                        : 'text-on-surface-variant hover:text-on-surface'
                                }`}
                            >
                                <AppIcon name="phone_iphone" className="text-[14px]" />
                                <span>Apple Shortcuts (iOS)</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveOsTab('android')}
                                className={`flex-1 h-7.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                                    activeOsTab === 'android'
                                        ? 'bg-surface-card text-primary shadow-2xs'
                                        : 'text-on-surface-variant hover:text-on-surface'
                                }`}
                            >
                                <AppIcon name="phone_android" className="text-[14px]" />
                                <span>MacroDroid (Android)</span>
                            </button>
                        </div>

                        {/* iOS Guide Body */}
                        {activeOsTab === 'ios' && (
                            <div className="p-3.5 rounded-2xl bg-surface-card border border-border-subtle space-y-3.5 text-xs">
                                {/* 1-Tap iCloud Shortcut Install Banner */}
                                <div className="p-3 rounded-xl bg-primary/10 border border-primary/25 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
                                            <AppIcon name="bolt" className="text-[16px]" />
                                            <span>Pre-Built Apple Shortcut</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleCopy(iosShortcutUrl, 'shortcut')}
                                            className="text-[11px] font-bold text-primary hover:underline flex items-center gap-0.5 cursor-pointer"
                                        >
                                            <AppIcon name={copiedField === 'shortcut' ? 'check' : 'content_copy'} className="text-[12px]" />
                                            <span>{copiedField === 'shortcut' ? 'Copied' : 'Copy Link'}</span>
                                        </button>
                                    </div>
                                    <p className="text-[11px] text-on-surface-variant leading-relaxed">
                                        Includes live room category sync, 1-tap lockscreen prompt, and automatic bank SMS extraction.
                                    </p>
                                    <a
                                        href={iosShortcutUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="w-full h-8.5 px-3 rounded-xl bg-primary hover:bg-primary-dark text-on-primary font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-xs active:scale-98 cursor-pointer"
                                    >
                                        <AppIcon name="phone_iphone" className="text-[16px]" />
                                        <span>Install Shortcut (iCloud Link)</span>
                                        <AppIcon name="open_in_new" className="text-[14px]" />
                                    </a>
                                </div>

                                {/* Step 1 */}
                                <div className="flex items-start gap-2.5">
                                    <span className="w-5 h-5 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                                        1
                                    </span>
                                    <div className="space-y-1.5 min-w-0">
                                        <span className="font-bold text-on-surface block">
                                            Create SMS Automation in Shortcuts
                                        </span>
                                        <div className="flex items-center flex-wrap gap-1 text-[11px] text-on-surface py-0.5">
                                            <span className="px-1.5 py-0.5 rounded-md bg-surface-card-subtle font-semibold border border-border-subtle">Shortcuts</span>
                                            <AppIcon name="arrow_forward" className="text-[11px] text-primary shrink-0" />
                                            <span className="px-1.5 py-0.5 rounded-md bg-surface-card-subtle font-semibold border border-border-subtle">Automation</span>
                                            <AppIcon name="arrow_forward" className="text-[11px] text-primary shrink-0" />
                                            <span className="px-1.5 py-0.5 rounded-md bg-surface-card-subtle font-semibold border border-border-subtle">New Automation</span>
                                            <AppIcon name="arrow_forward" className="text-[11px] text-primary shrink-0" />
                                            <span className="px-1.5 py-0.5 rounded-md bg-surface-card-subtle font-semibold border border-border-subtle">Message</span>
                                        </div>
                                        <p className="text-[11px] text-on-surface-variant leading-relaxed">
                                            Set <i>Message Contains</i> to <code className="px-1 py-0.5 rounded bg-surface-card-subtle text-primary font-mono text-[10px]">debited</code> or <code className="px-1 py-0.5 rounded bg-surface-card-subtle text-primary font-mono text-[10px]">UPI</code>. Toggle <strong>Run Immediately</strong> to ON.
                                        </p>
                                    </div>
                                </div>

                                {/* Step 2 */}
                                <div className="flex items-start gap-2.5">
                                    <span className="w-5 h-5 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                                        2
                                    </span>
                                    <div className="space-y-1.5 min-w-0 w-full">
                                        <span className="font-bold text-on-surface block">
                                            On-Device 1-Tap Category Prompt
                                        </span>
                                        <p className="text-[11px] text-on-surface-variant leading-relaxed">
                                            Shortcut parses the amount & payee locally, syncs live room categories, then presents a quick action sheet on your lockscreen:
                                        </p>

                                        {/* Mini Lockscreen Action Sheet Preview */}
                                        <div className="p-2.5 rounded-xl bg-surface-card-subtle border border-border-subtle space-y-1 font-sans">
                                            <div className="flex items-center justify-between text-[10px] font-bold text-primary mb-1">
                                                <span className="flex items-center gap-1">
                                                    <AppIcon name="bolt" className="text-[12px]" />
                                                    iPhone Lockscreen Action Sheet
                                                </span>
                                                <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-primary/10 text-primary">Live Synced</span>
                                            </div>
                                            <div className="p-1.5 rounded-lg bg-surface-card border border-primary/25 font-semibold text-primary flex items-center justify-between text-[11px]">
                                                <span>✓ Confirm: ₹250 (Food & Dining)</span>
                                                <span className="text-[9px] bg-primary/10 px-1 py-0.5 rounded font-bold">1 Tap</span>
                                            </div>
                                            <div className="p-1.5 rounded-lg bg-surface-card border border-border-subtle text-on-surface-variant flex items-center justify-between text-[11px]">
                                                <span>🔄 Change Category...</span>
                                                <span className="text-[9px] text-on-surface-variant">Live List</span>
                                            </div>
                                            <div className="p-1.5 rounded-lg bg-surface-card border border-border-subtle text-on-surface-variant flex items-center justify-between text-[11px]">
                                                <span>✕ Dismiss (Personal / Ignore)</span>
                                                <span className="text-[9px] text-on-surface-variant">Exit</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Step 3 */}
                                <div className="flex items-start gap-2.5">
                                    <span className="w-5 h-5 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                                        3
                                    </span>
                                    <div className="space-y-1 min-w-0">
                                        <span className="font-bold text-on-surface block">
                                            One-Time Ingest Setup Questions
                                        </span>
                                        <p className="text-[11px] text-on-surface-variant leading-relaxed">
                                            When importing the shortcut, iOS will prompt you for your <strong>Webhook URL</strong> and <strong>Secret Token</strong>. Copy them using the 1-tap copy buttons above.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Android Guide Body */}
                        {activeOsTab === 'android' && (
                            <div className="p-3.5 rounded-2xl bg-surface-card border border-border-subtle space-y-3 text-xs">
                                {/* Step 1 */}
                                <div className="flex items-start gap-2.5">
                                    <span className="w-5 h-5 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                                        1
                                    </span>
                                    <div className="space-y-1 min-w-0">
                                        <span className="font-bold text-on-surface block">
                                            Notification Listener (MacroDroid / Tasker)
                                        </span>
                                        <p className="text-[11px] text-on-surface-variant leading-relaxed">
                                            Trigger: <strong>Notification Received</strong> from Google Pay (<code className="text-[10px] font-mono text-primary">com.google.android.apps.nbu.paisa.user</code>), PhonePe, or Paytm.
                                        </p>
                                    </div>
                                </div>

                                {/* Step 2 */}
                                <div className="flex items-start gap-2.5">
                                    <span className="w-5 h-5 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                                        2
                                    </span>
                                    <div className="space-y-1 min-w-0">
                                        <span className="font-bold text-on-surface block">
                                            Interactive Heads-Up Notification
                                        </span>
                                        <p className="text-[11px] text-on-surface-variant leading-relaxed">
                                            MacroDroid shows a notification drawer with action buttons:
                                            <strong className="text-on-surface"> [✓ Log to {activeGroup?.name || 'Room'}]</strong> and <strong className="text-on-surface">[Change Category]</strong>.
                                        </p>
                                    </div>
                                </div>

                                {/* Step 3 */}
                                <div className="flex items-start gap-2.5">
                                    <span className="w-5 h-5 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                                        3
                                    </span>
                                    <div className="space-y-1 min-w-0">
                                        <span className="font-bold text-on-surface block">
                                            HTTP Request Action
                                        </span>
                                        <p className="text-[11px] text-on-surface-variant leading-relaxed">
                                            Configure an HTTP Request action sending the extracted JSON payload to your webhook URL.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Developer cURL & Schema Quick Access */}
                        <div className="rounded-xl border border-border-subtle overflow-hidden">
                            <button
                                type="button"
                                onClick={() => setShowJsonSchema(!showJsonSchema)}
                                className="w-full px-3 py-2 bg-surface-card-subtle hover:bg-surface-card text-xs font-semibold text-on-surface flex items-center justify-between cursor-pointer transition-colors"
                            >
                                <span className="flex items-center gap-1.5">
                                    <AppIcon name="code" className="text-[14px] text-primary" />
                                    <span>Developer cURL & JSON Schema</span>
                                </span>
                                <AppIcon name={showJsonSchema ? 'expand_less' : 'expand_more'} className="text-[16px] text-on-surface-variant" />
                            </button>

                            {showJsonSchema && (
                                <div className="p-3 bg-surface-card border-t border-border-subtle space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-mono text-on-surface-variant uppercase font-bold">
                                            Terminal cURL Command
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => handleCopy(curlCommand, 'curl')}
                                            className="text-[11px] font-bold text-primary hover:underline flex items-center gap-0.5 cursor-pointer"
                                        >
                                            <AppIcon name={copiedField === 'curl' ? 'check' : 'content_copy'} className="text-[12px]" />
                                            <span>{copiedField === 'curl' ? 'Copied' : 'Copy cURL'}</span>
                                        </button>
                                    </div>
                                    <pre className="p-2.5 rounded-xl bg-surface-card-subtle border border-border-subtle font-mono text-[10px] text-on-surface overflow-x-auto leading-relaxed select-all">
                                        {curlCommand}
                                    </pre>
                                </div>
                            )}
                        </div>

                        {/* Privacy & Zero-Knowledge Architecture Accordion */}
                        <div className="rounded-xl border border-border-subtle overflow-hidden">
                            <button
                                type="button"
                                onClick={() => setShowSafeguards(!showSafeguards)}
                                className="w-full px-3 py-2 bg-surface-card-subtle hover:bg-surface-card text-xs font-semibold text-on-surface flex items-center justify-between cursor-pointer transition-colors"
                            >
                                <span className="flex items-center gap-1.5">
                                    <AppIcon name="verified_user" className="text-[14px] text-primary" />
                                    <span>Privacy & Safeguards (Zero-Knowledge)</span>
                                </span>
                                <AppIcon name={showSafeguards ? 'expand_less' : 'expand_more'} className="text-[16px] text-on-surface-variant" />
                            </button>

                            {showSafeguards && (
                                <div className="p-3 bg-surface-card border-t border-border-subtle space-y-2.5 text-[11px] text-on-surface-variant leading-relaxed">
                                    <div className="flex items-start gap-2">
                                        <AppIcon name="lock" className="text-primary text-[15px] shrink-0 mt-0.5" />
                                        <div>
                                            <strong className="text-on-surface block">100% On-Device Extraction</strong>
                                            Your phone parses the SMS or notification locally. Bank balances and account numbers are completely discarded before sending.
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <AppIcon name="replay" className="text-primary text-[15px] shrink-0 mt-0.5" />
                                        <div>
                                            <strong className="text-on-surface block">Automatic UTR Deduplication</strong>
                                            Bank reference numbers are used as idempotency keys. If an SMS and app push arrive for the same payment, it will only ever be logged once.
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <AppIcon name="shield" className="text-secondary text-[15px] shrink-0 mt-0.5" />
                                        <div>
                                            <strong className="text-on-surface block">Strict Negative Filters</strong>
                                            OTP messages, bank deposits, ATM withdrawals, and refunds are ignored to avoid false captures.
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Modal Footer */}
                <div className="px-5 py-3 border-t border-border-subtle bg-surface-card shrink-0 flex items-center justify-between">
                    <span className="text-[10px] text-on-surface-variant font-mono">
                        Instant Capture · {activeGroup?.name || 'SplitNest'}
                    </span>
                    <button
                        type="button"
                        onClick={onClose}
                        className="h-8 px-4 rounded-xl bg-primary text-on-primary hover:bg-primary-dark text-xs font-bold transition-colors cursor-pointer shadow-2xs"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
};
