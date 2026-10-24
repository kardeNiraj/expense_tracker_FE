export type GradientHeroCardProps = {
    children: React.ReactNode;
    className?: string;
}

function GradientHeroCard({ children, className = '' }: GradientHeroCardProps) {
    return (
        <div
            className={`relative overflow-hidden w-full p-6 flex text-center rounded-3xl bg-neutral-200 border border-neutral-300 shadow-lg shadow-neutral-900/5 ${className}`}
        >
            {/* Top Right Glowing Element */}
            <div
                className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-primary-200/40 blur-2xl pointer-events-none"
                aria-hidden="true"
            />

            {/* Bottom Left Glowing Element */}
            <div
                className="absolute -bottom-10 -left-10 w-32 h-32 rounded-full bg-secondary-200/40 blur-2xl pointer-events-none"
                aria-hidden="true"
            />

            {/* Card Content */}
            <div className="relative z-10">
                {children}
            </div>
        </div>
    )
}

export default GradientHeroCard