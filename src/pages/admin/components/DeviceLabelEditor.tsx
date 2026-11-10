import React, { useId, useState } from 'react';

interface DeviceLabelEditorProps {
    initialLabel: string;
    isBusy: boolean;
    onSave: (label: string) => void;
}

export const DeviceLabelEditor: React.FC<DeviceLabelEditorProps> = ({
    initialLabel,
    isBusy,
    onSave,
}) => {
    const [labelDraft, setLabelDraft] = useState(initialLabel);
    const inputId = useId();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(labelDraft.trim());
    };

    return (
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
            <label htmlFor={inputId} className="sr-only">
                Device friendly label
            </label>
            <input
                id={inputId}
                type="text"
                value={labelDraft}
                onChange={(e) => setLabelDraft(e.target.value)}
                placeholder="e.g. Niraj's Pixel 8 or Incognito PC"
                className="flex-1 h-9 px-3 rounded-xl bg-surface-card border border-border-strong text-xs text-on-surface focus:border-primary focus:outline-none"
            />
            <button
                type="submit"
                disabled={isBusy}
                className="h-9 px-3 rounded-xl bg-primary text-on-primary text-xs font-bold cursor-pointer disabled:opacity-50"
            >
                Save
            </button>
        </form>
    );
};

export default DeviceLabelEditor;

