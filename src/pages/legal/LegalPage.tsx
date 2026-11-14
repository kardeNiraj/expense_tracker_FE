import React from 'react';
import { useExpense } from '../../context';
import { AppIcon } from '../../components';
import { pushTabPath } from '../../context/expenseStorage';

interface LegalPageProps {
    initialMode?: 'privacy' | 'terms';
}

export const LegalPage: React.FC<LegalPageProps> = ({ initialMode }) => {
    const { activeTab, setActiveTab, isAuthenticated } = useExpense();

    // Derived directly from activeTab or initialMode without redundant state
    const mode: 'privacy' | 'terms' =
        activeTab === 'terms' || activeTab === 'privacy'
            ? activeTab
            : initialMode || 'privacy';

    const handleSwitchMode = (newMode: 'privacy' | 'terms') => {
        setActiveTab(newMode);
        pushTabPath(newMode);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleBack = () => {
        if (window.history.length > 1) {
            window.history.back();
        } else {
            setActiveTab(isAuthenticated ? 'dashboard' : 'dashboard');
            pushTabPath('dashboard');
        }
    };

    return (
        <div className="w-full max-w-2xl mx-auto px-4 pt-4 pb-20 text-on-surface">
            {/* Top Navigation Bar */}
            <div className="flex items-center justify-between gap-3 mb-6">
                <button
                    type="button"
                    onClick={handleBack}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-xs font-semibold text-on-surface transition-colors cursor-pointer border border-outline-variant/30 active:scale-95"
                    aria-label="Go Back"
                >
                    <AppIcon name="arrow_back" className="text-[16px]" />
                    <span>Back</span>
                </button>

                <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-bold tracking-wide uppercase">
                        <AppIcon name="verified_user" className="text-[13px]" />
                        <span>SplitNest Legal</span>
                    </span>
                    <span className="text-[11px] text-on-surface-variant hidden sm:inline">
                        Updated Nov 2026
                    </span>
                </div>
            </div>

            {/* Mode Segmented Control */}
            <div className="p-1 rounded-2xl bg-surface-container border border-outline-variant/30 flex items-center gap-1 mb-8 shadow-2xs">
                <button
                    type="button"
                    onClick={() => handleSwitchMode('privacy')}
                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        mode === 'privacy'
                            ? 'bg-surface-container-lowest text-primary shadow-xs'
                            : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                >
                    <AppIcon name="shield" className="text-[15px]" />
                    <span>Privacy Policy</span>
                </button>
                <button
                    type="button"
                    onClick={() => handleSwitchMode('terms')}
                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        mode === 'terms'
                            ? 'bg-surface-container-lowest text-primary shadow-xs'
                            : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                >
                    <AppIcon name="gavel" className="text-[15px]" />
                    <span>Terms of Service</span>
                </button>
            </div>

            {/* Content Body */}
            {mode === 'privacy' ? (
                <article className="space-y-6 animate-in fade-in duration-200">
                    <header className="space-y-2 border-b border-outline-variant/20 pb-5">
                        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight font-headline text-on-surface">
                            Privacy Policy
                        </h1>
                        <p className="text-xs text-on-surface-variant leading-relaxed">
                            Effective Date: November 14, 2026 • SplitNest by Niraj Karde
                        </p>
                    </header>

                    {/* Section 1: Overview */}
                    <section className="space-y-3 p-4 rounded-2xl bg-surface-container-low border border-outline-variant/30">
                        <div className="flex items-center gap-2 text-primary font-bold text-sm">
                            <AppIcon name="info" className="text-[18px]" />
                            <h2>1. Overview & Commitment</h2>
                        </div>
                        <p className="text-xs text-on-surface-variant leading-relaxed">
                            SplitNest (&quot;we&quot;, &quot;our&quot;, or &quot;the app&quot;) is a group expense tracking,
                            bill splitting, and pairwise settlement platform. We believe personal financial
                            collaboration should be private, transparent, and secure. We do not sell your personal
                            data or share it with data brokers.
                        </p>
                    </section>

                    {/* Section 2: Information We Collect */}
                    <section className="space-y-3">
                        <h2 className="text-sm font-bold text-on-surface flex items-center gap-2">
                            <AppIcon name="badge" className="text-primary text-[18px]" />
                            <span>2. Information We Collect</span>
                        </h2>
                        <div className="grid gap-2.5 text-xs text-on-surface-variant">
                            <div className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/25 space-y-1">
                                <span className="font-bold text-on-surface block">Account & Profile Information</span>
                                <p className="leading-relaxed">
                                    When you create an account, we collect your display name, email address, and an
                                    optional Unified Payments Interface (UPI) ID for settlement routing. Passwords are
                                    strictly salted and hashed using cryptographic one-way functions; plain-text
                                    passwords are never stored or accessible by anyone.
                                </p>
                            </div>
                            <div className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/25 space-y-1">
                                <span className="font-bold text-on-surface block">Google Sign-In (OAuth 2.0)</span>
                                <p className="leading-relaxed">
                                    If you choose to sign in using Google, we access only your basic profile information
                                    (Google User ID, email address, display name, and avatar URL) to authenticate you.
                                    We do not request or access your Google Drive, Gmail, Google Contacts, search history,
                                    or any other personal Google account data.
                                </p>
                            </div>
                            <div className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/25 space-y-1">
                                <span className="font-bold text-on-surface block">Expense & Room Data</span>
                                <p className="leading-relaxed">
                                    We store room names, expense amounts, descriptions, categories, timestamps, participant
                                    shares, and settlement records created within your rooms to calculate balances and
                                    pairwise debt reductions.
                                </p>
                            </div>
                            <div className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/25 space-y-1">
                                <span className="font-bold text-on-surface block">Device & Security Telemetry</span>
                                <p className="leading-relaxed">
                                    To protect rooms against unauthorized claims and session hijacking, we store a
                                    resilient, cryptographically random device identifier, platform info (Web/Android/iOS),
                                    and standard IP addresses strictly for rate limiting and fraud prevention.
                                </p>
                            </div>
                            <div className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/25 space-y-1">
                                <span className="font-bold text-on-surface block">Web Push Notifications (Optional)</span>
                                <p className="leading-relaxed">
                                    If you explicitly enable push alerts, we store your browser&apos;s push subscription endpoint
                                    to deliver instant alerts when expenses or settlements are created. You can revoke this
                                    permission at any time from your Profile settings.
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* Section 3: Financial Safety & No Banking Data */}
                    <section className="space-y-3 p-4 rounded-2xl bg-primary/8 border border-primary/20">
                        <div className="flex items-center gap-2 text-primary font-bold text-sm">
                            <AppIcon name="lock" className="text-[18px]" />
                            <h2>3. Financial Safety: What We Never Collect</h2>
                        </div>
                        <p className="text-xs text-on-surface-variant leading-relaxed">
                            SplitNest is a calculation ledger, <strong>not a payment gateway, wallet, or bank</strong>.
                            We never ask for, collect, process, or store:
                        </p>
                        <ul className="list-disc list-inside text-xs text-on-surface-variant space-y-1 pl-1">
                            <li>Bank account numbers or IFSC codes</li>
                            <li>Credit, debit, or ATM card numbers, CVVs, or expiry dates</li>
                            <li>Net banking passwords, UPI PINs, or SMS OTPs</li>
                        </ul>
                        <p className="text-xs text-on-surface-variant leading-relaxed">
                            All settlements are completed by launching standard UPI deep links (<code className="font-mono text-[11px] bg-surface-container px-1 py-0.5 rounded">upi://pay</code>)
                            into verified external payment applications (Google Pay, PhonePe, Paytm, BHIM). Payments execute
                            strictly between your bank and the recipient&apos;s bank.
                        </p>
                    </section>

                    {/* Section 4: How We Use Data */}
                    <section className="space-y-3">
                        <h2 className="text-sm font-bold text-on-surface flex items-center gap-2">
                            <AppIcon name="sync_alt" className="text-primary text-[18px]" />
                            <span>4. How We Use Your Information</span>
                        </h2>
                        <ul className="text-xs text-on-surface-variant space-y-2 list-disc list-inside pl-1 leading-relaxed">
                            <li>To calculate group spend, monthly trends, and penny-perfect pairwise settlements.</li>
                            <li>To sync room expenses across all devices in real-time.</li>
                            <li>To authenticate your identity and restrict room access to invited members.</li>
                            <li>To send transactional push notifications (new splits, settlement updates, reminders).</li>
                            <li>To safeguard our platform against DDoS, brute-force logins, and automated abuse.</li>
                        </ul>
                    </section>

                    {/* Section 5: Data Storage & Security */}
                    <section className="space-y-3">
                        <h2 className="text-sm font-bold text-on-surface flex items-center gap-2">
                            <AppIcon name="security" className="text-primary text-[18px]" />
                            <span>5. Data Storage, Security & Retention</span>
                        </h2>
                        <p className="text-xs text-on-surface-variant leading-relaxed">
                            Your data is stored in secured, access-restricted MongoDB Atlas databases located in secure cloud
                            regions. All data in transit is encrypted using modern TLS (HTTPS), and database storage is encrypted
                            at rest (AES-256). User session tokens are cryptographically signed using HMAC keys.
                        </p>
                        <p className="text-xs text-on-surface-variant leading-relaxed">
                            We retain data for as long as your account and rooms remain active. You may remove yourself from rooms,
                            archive rooms, or request complete account and data erasure at any time.
                        </p>
                    </section>

                    {/* Section 6: User Rights & Contact */}
                    <section className="space-y-3 p-4 rounded-2xl bg-surface-container-low border border-outline-variant/30">
                        <h2 className="text-sm font-bold text-on-surface flex items-center gap-2">
                            <AppIcon name="mail" className="text-primary text-[18px]" />
                            <span>6. Your Rights & Contact Information</span>
                        </h2>
                        <p className="text-xs text-on-surface-variant leading-relaxed">
                            You have the right to access, edit, or delete your personal information. You can update your display name
                            and UPI ID directly in the Profile modal. For account deletion or privacy inquiries, contact our developer:
                        </p>
                        <div className="pt-1">
                            <a
                                href="mailto:nirajkarde01@gmail.com"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-on-primary text-xs font-bold hover:bg-primary/90 transition-colors shadow-xs"
                            >
                                <AppIcon name="mail" className="text-[14px]" />
                                <span>nirajkarde01@gmail.com</span>
                            </a>
                        </div>
                    </section>
                </article>
            ) : (
                <article className="space-y-6 animate-in fade-in duration-200">
                    <header className="space-y-2 border-b border-outline-variant/20 pb-5">
                        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight font-headline text-on-surface">
                            Terms of Service
                        </h1>
                        <p className="text-xs text-on-surface-variant leading-relaxed">
                            Effective Date: November 14, 2026 • SplitNest by Niraj Karde
                        </p>
                    </header>

                    {/* Section 1: Agreement */}
                    <section className="space-y-3 p-4 rounded-2xl bg-surface-container-low border border-outline-variant/30">
                        <div className="flex items-center gap-2 text-primary font-bold text-sm">
                            <AppIcon name="handshake" className="text-[18px]" />
                            <h2>1. Acceptance of Terms</h2>
                        </div>
                        <p className="text-xs text-on-surface-variant leading-relaxed">
                            By downloading, accessing, or using SplitNest (&quot;the App&quot;), you agree to be bound by these Terms of Service.
                            If you do not agree to these terms, please do not use the application.
                        </p>
                    </section>

                    {/* Section 2: Nature of Service & Financial Disclaimer */}
                    <section className="space-y-3 p-4 rounded-2xl bg-tertiary/10 border border-tertiary/25">
                        <div className="flex items-center gap-2 text-tertiary font-bold text-sm">
                            <AppIcon name="warning" className="text-[18px]" />
                            <h2>2. Financial Disclaimer: Calculation Ledger Only</h2>
                        </div>
                        <div className="text-xs text-on-surface-variant space-y-2 leading-relaxed">
                            <p>
                                <strong>SplitNest is not a bank, licensed financial institution, payment gateway, or money transmitter.</strong>
                            </p>
                            <p>
                                The App provides mathematical calculations, bill dividing, and debt-simplification tools to help
                                friends and groups organize shared expenses. Marking an expense or debt as &quot;settled&quot; in SplitNest
                                is an informational record and does not represent an escrow transfer or legal receipt of payment.
                            </p>
                            <p>
                                All actual monetary settlements are performed voluntarily by users outside of SplitNest using their
                                personal banking apps or UPI clients. Users are solely responsible for verifying amounts, recipient
                                UPI IDs, and account numbers prior to authorizing external bank transactions.
                            </p>
                        </div>
                    </section>

                    {/* Section 3: User Accounts & Responsibilities */}
                    <section className="space-y-3">
                        <h2 className="text-sm font-bold text-on-surface flex items-center gap-2">
                            <AppIcon name="person" className="text-primary text-[18px]" />
                            <span>3. User Accounts & Room Governance</span>
                        </h2>
                        <ul className="text-xs text-on-surface-variant space-y-2 list-disc list-inside pl-1 leading-relaxed">
                            <li>You agree to provide accurate information and maintain the security of your login credentials.</li>
                            <li>Room creators (&quot;Owners&quot;) are responsible for managing invite links, room membership, and room lifecycle status (Active, Archived, Closed).</li>
                            <li>Users must not share room invite codes or QR links with unauthorized third parties.</li>
                            <li>You agree not to impersonate other individuals or claim member profiles that do not belong to you.</li>
                        </ul>
                    </section>

                    {/* Section 4: Prohibited Uses */}
                    <section className="space-y-3">
                        <h2 className="text-sm font-bold text-on-surface flex items-center gap-2">
                            <AppIcon name="block" className="text-error text-[18px]" />
                            <span>4. Prohibited Conduct</span>
                        </h2>
                        <p className="text-xs text-on-surface-variant leading-relaxed">
                            You agree not to engage in any of the following prohibited activities:
                        </p>
                        <ul className="text-xs text-on-surface-variant space-y-1.5 list-disc list-inside pl-1 leading-relaxed">
                            <li>Using the App for money laundering, fraudulent schemes, or illegal commercial transactions.</li>
                            <li>Attempting to bypass security controls, rate limiters, or device authorization gates.</li>
                            <li>Reverse engineering, scraping, or launching automated bots against SplitNest servers.</li>
                            <li>Injecting malicious scripts, corrupted payloads, or harmful code.</li>
                        </ul>
                    </section>

                    {/* Section 5: Intellectual Property */}
                    <section className="space-y-3">
                        <h2 className="text-sm font-bold text-on-surface flex items-center gap-2">
                            <AppIcon name="copyright" className="text-primary text-[18px]" />
                            <span>5. Intellectual Property</span>
                        </h2>
                        <p className="text-xs text-on-surface-variant leading-relaxed">
                            SplitNest, its user interface design, logo, icons, documentation, algorithms, and source code are the
                            intellectual property of Niraj Karde. You are granted a personal, non-exclusive, non-transferable license
                            to use the App for personal group expense management.
                        </p>
                    </section>

                    {/* Section 6: Limitation of Liability */}
                    <section className="space-y-3 p-4 rounded-2xl bg-surface-container-low border border-outline-variant/30">
                        <h2 className="text-sm font-bold text-on-surface flex items-center gap-2">
                            <AppIcon name="balance" className="text-primary text-[18px]" />
                            <span>6. Limitation of Liability</span>
                        </h2>
                        <p className="text-xs text-on-surface-variant leading-relaxed">
                            To the fullest extent permitted by applicable law, SplitNest and its developer shall not be liable for
                            any direct, indirect, incidental, or consequential damages resulting from payment errors, bank outages,
                            failed transactions, disputes between room members, or loss of access. SplitNest is provided on an
                            &quot;AS IS&quot; and &quot;AS AVAILABLE&quot; basis without warranties of any kind.
                        </p>
                    </section>

                    {/* Section 7: Contact */}
                    <section className="space-y-3 p-4 rounded-2xl bg-surface-container-low border border-outline-variant/30">
                        <h2 className="text-sm font-bold text-on-surface flex items-center gap-2">
                            <AppIcon name="contact_support" className="text-primary text-[18px]" />
                            <span>7. Questions & Support</span>
                        </h2>
                        <p className="text-xs text-on-surface-variant leading-relaxed">
                            If you have questions regarding these Terms of Service or need assistance with your account, please reach out:
                        </p>
                        <div className="pt-1">
                            <a
                                href="mailto:nirajkarde01@gmail.com"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-on-primary text-xs font-bold hover:bg-primary/90 transition-colors shadow-xs"
                            >
                                <AppIcon name="mail" className="text-[14px]" />
                                <span>nirajkarde01@gmail.com</span>
                            </a>
                        </div>
                    </section>
                </article>
            )}

            {/* Bottom Back Button */}
            <div className="pt-8 text-center">
                <button
                    type="button"
                    onClick={handleBack}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-xs font-semibold text-on-surface transition-colors cursor-pointer border border-outline-variant/30 active:scale-95"
                >
                    <AppIcon name="arrow_back" className="text-[16px]" />
                    <span>Return to SplitNest</span>
                </button>
            </div>
        </div>
    );
};

export default LegalPage;

