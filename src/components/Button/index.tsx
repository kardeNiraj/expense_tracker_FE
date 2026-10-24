import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    title?: string;
    isLoading?: boolean;
    loadingText?: string;
    isError?: boolean;
    error?: boolean | string;
    errorText?: string;
}

function Button({
    title,
    children,
    isLoading = false,
    loadingText,
    isError = false,
    error,
    errorText,
    disabled = false,
    className = '',
    type = 'button',
    ...rest
}: ButtonProps) {
    const isCurrentlyLoading = isLoading;
    const hasError = isError || Boolean(error);
    const isEffectivelyDisabled = disabled || isCurrentlyLoading;

    const resolvedErrorMessage =
        errorText ||
        (typeof error === 'string' && error.length > 0 ? error : undefined);

    const getVariantClasses = () => {
        if (hasError) {
            return 'bg-gradient-to-r from-tertiary-500 to-tertiary-600 hover:from-tertiary-600 hover:to-tertiary-700 text-white shadow-lg shadow-tertiary-500/25 ring-2 ring-tertiary-400/40 active:scale-[0.99]';
        }

        if (isCurrentlyLoading) {
            return 'bg-gradient-to-r from-primary-600 to-secondary-700 text-white/90 shadow-md shadow-primary-500/15 cursor-wait';
        }

        if (disabled) {
            return 'bg-neutral-200 text-neutral-400 border border-neutral-300/80 cursor-not-allowed opacity-75 shadow-none';
        }

        return 'bg-gradient-to-r from-primary-500 to-secondary-600 hover:from-primary-600 hover:to-secondary-700 active:scale-[0.99] text-white shadow-lg shadow-primary-500/25';
    };

    return (
        <button
            type={type}
            disabled={isEffectivelyDisabled}
            aria-busy={isCurrentlyLoading}
            aria-disabled={isEffectivelyDisabled}
            className={`w-full py-3.5 px-4 rounded-xl font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 select-none cursor-pointer ${getVariantClasses()} ${className}`}
            {...rest}
        >
            {/* Loading Spinner */}
            {isCurrentlyLoading && (
                <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-white shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                >
                    <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                    />
                    <path
                        className="opacity-90"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                </svg>
            )}

            {/* Error Alert Icon */}
            {hasError && !isCurrentlyLoading && (
                <svg
                    className="h-4 w-4 text-white -ml-0.5 mr-1.5 shrink-0 animate-pulse"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    aria-hidden="true"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 7.5h.008v.008H12v-.008z"
                    />
                </svg>
            )}

            {/* Button Label */}
            <span>
                {isCurrentlyLoading
                    ? loadingText || title || children || 'Loading...'
                    : hasError
                        ? resolvedErrorMessage || title || children || 'Failed. Try again'
                        : title || children}
            </span>
        </button>
    );
}

export default Button;