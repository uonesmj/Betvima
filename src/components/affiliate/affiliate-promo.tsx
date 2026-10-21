'use client';

import { useEffect, useRef, useState, type FormEvent, type TouchEvent } from 'react';
import { ArrowRight, ArrowUpRight, AtSign, BarChart3, Check, ChevronDown, ChevronLeft, ChevronRight, Eye, EyeOff, Gamepad2, Globe2, LockKeyhole, Mail, Menu, Play, Send, ShieldCheck, Smartphone, Trophy, UserRound, X } from 'lucide-react';
import { apiRequest } from '@/lib/hooks/useApi';
import { useApp } from '@/components/layout/providers';
import './affiliate-promo.css';
import './affiliate-connected.css';

type FaqItem = { en: string; fa: string; answerEn: string; answerFa: string };
const faq: FaqItem[] = [
  { en: 'How can I earn through the partner program?', fa: 'چطور از برنامه همکاری درآمد کسب کنم؟', answerEn: 'Create an affiliate account, share your unique tracking link, and review eligible referrals and commissions in your partner dashboard. Your approved agreement determines how earnings are calculated.', answerFa: 'حساب همکاری ایجاد کنید، لینک اختصاصی خود را به اشتراک بگذارید و ارجاع‌ها و کمیسیون‌های واجد شرایط را در داشبورد بررسی کنید. محاسبه درآمد مطابق قرارداد تأییدشده شماست.' },
  { en: 'What is the difference between RevShare and CPA?', fa: 'تفاوت RevShare و CPA چیست؟', answerEn: 'RevShare is based on the eligible revenue from referred customers. CPA is a fixed amount per qualifying action, where offered under a separately approved agreement. CPA is not automatically activated by registration.', answerFa: 'RevShare بر مبنای درآمد واجد شرایط کاربران معرفی‌شده محاسبه می‌شود. CPA مبلغ ثابتی برای اقدام واجد شرایط است که فقط در صورت قرارداد جداگانه ارائه می‌شود.' },
  { en: 'Where can I see my statistics?', fa: 'آمار همکاری را کجا ببینم؟', answerEn: 'After signing in, open your affiliate dashboard to see referral links, tracked users, ledger entries and available payout information.', answerFa: 'پس از ورود، در داشبورد افیلیت می‌توانید لینک‌های ارجاع، کاربران معرفی‌شده، سوابق مالی و اطلاعات پرداخت را ببینید.' },
  { en: 'When are commissions paid?', fa: 'کمیسیون‌ها چه زمانی پرداخت می‌شوند؟', answerEn: 'Eligibility and payout dates depend on the current BetVima affiliate terms, the settlement cycle and review requirements shown in your account. No payout is guaranteed by this promotional page.', answerFa: 'زمان و شرایط پرداخت به مقررات فعلی افیلیت BetVima، دوره تسویه و بررسی‌های حساب بستگی دارد. این صفحه وعده پرداخت قطعی نمی‌دهد.' },
  { en: 'How do I contact the team?', fa: 'چطور با تیم همکاری ارتباط بگیرم؟', answerEn: 'Use the contact email below for partnership questions, CPA enquiries or help getting started.', answerFa: 'برای پرسش‌های همکاری، درخواست CPA یا راهنمایی شروع، از ایمیل تماس پایین صفحه استفاده کنید.' },
];

const products = [
  { name: 'Casino', fa: 'کازینو', icon: Gamepad2, tag: 'SLOTS · LIVE · GAMES', desc: 'An engaging casino lobby with game discovery and smooth navigation.', descFa: 'لابی جذاب کازینو با دسترسی سریع به بازی‌ها و پیمایش روان.', skin: 'casino' },
  { name: 'Sports', fa: 'ورزش', icon: Trophy, tag: 'LIVE · PRE-MATCH', desc: 'Follow sport markets and discover live and upcoming events.', descFa: 'بازارهای ورزشی و رویدادهای زنده و آینده را دنبال کنید.', skin: 'sports' },
  { name: 'Mobile', fa: 'موبایل', icon: Smartphone, tag: 'ANDROID EXPERIENCE', desc: 'A mobile-first experience designed for convenient navigation.', descFa: 'تجربه‌ای موبایل‌محور با ناوبری ساده و سریع.', skin: 'mobile' },
] as const;

const features = [
  { title: 'BetVima experience', fa: 'تجربه BetVima', body: 'Sports and casino experiences in one recognisable brand.', bodyFa: 'تجربه ورزشی و کازینو با هویت یکپارچه BetVima.', icon: Gamepad2 },
  { title: 'Mobile-first product', fa: 'محصول موبایل‌محور', body: 'Designed to be explored on phones and tablets.', bodyFa: 'طراحی‌شده برای استفاده راحت در موبایل و تبلت.', icon: Smartphone },
  { title: 'Partner dashboard', fa: 'داشبورد همکاران', body: 'Track links, referrals and your affiliate ledger.', bodyFa: 'مشاهده لینک‌ها، ارجاع‌ها و دفتر کمیسیون افیلیت.', icon: BarChart3 },
] as const;

function PhoneMock({ variant = 'casino' }: { variant?: 'casino' | 'sports' | 'mobile' }) {
  return (
    <div className={'bva-phone bva-phone--' + variant} aria-label="BetVima mobile product preview">
      <div className="bva-phone-notch" aria-hidden="true" />
      <div className="bva-phone-screen">
        <div className="bva-phone-top"><img src="/brand/betvima-logo-transparent.png" alt="BetVima" /><span>● LIVE</span></div>
        <div className="bva-phone-pills"><span>Lobby</span><span>Live</span><span>Games</span></div>
        <div className="bva-phone-banner">
          <small>BETVIMA EXPERIENCE</small>
          <b>{variant === 'sports' ? 'Top live events' : variant === 'mobile' ? 'Everything in one place' : 'Discover games'}</b>
          <span>Explore the action <ArrowRight size={11} /></span>
        </div>
        <div className="bva-phone-cards">
          <span className="bva-tile bva-tile-one"><Gamepad2 size={22} /><b>CASINO</b></span>
          <span className="bva-tile bva-tile-two"><Trophy size={22} /><b>SPORTS</b></span>
          <span className="bva-tile bva-tile-three"><Play size={22} /><b>LIVE</b></span>
          <span className="bva-tile bva-tile-four"><BarChart3 size={22} /><b>STATS</b></span>
        </div>
        <div className="bva-phone-bottom"><span>⌂</span><span>◉</span><span>▦</span><span>☰</span></div>
      </div>
    </div>
  );
}

function Reveal({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  return <div className={'bva-reveal ' + className} style={{ transitionDelay: delay + 'ms' }}>{children}</div>;
}

function Counter({ end, suffix = '' }: { end: number; suffix?: string }) {
  const el = useRef<HTMLSpanElement>(null);
  const [value, setValue] = useState(0);
  useEffect(() => {
    const element = el.current;
    if (!element) return;
    let raf = 0;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      observer.disconnect();
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setValue(end); return; }
      const start = performance.now();
      const tick = (time: number) => {
        const progress = Math.min(1, (time - start) / 1250);
        setValue(Math.round(end * (1 - Math.pow(1 - progress, 3))));
        if (progress < 1) raf = window.requestAnimationFrame(tick);
      };
      raf = window.requestAnimationFrame(tick);
    }, { threshold: 0.4 });
    observer.observe(element);
    return () => { observer.disconnect(); window.cancelAnimationFrame(raf); };
  }, [end]);
  return <span ref={el} className="bva-num">{value.toLocaleString('en-US')}{suffix}</span>;
}

function Bars({ small = false }: { small?: boolean }) {
  return (
    <div className={'bva-bars ' + (small ? 'bva-bars--small' : '')} aria-label="Illustrative animated statistics chart (not actual earnings)">
      {[34, 20, 43, 58, 48, 88, 72, 100].map((v, index) => (
        <div key={index} className={'bva-bar ' + (index === 2 || index === 5 ? 'bva-bar--active' : '')} style={{ height: v + '%', transitionDelay: (index * 85) + 'ms' }} />
      ))}
      <div className="bva-chart-tip">Live insights <span>↗</span></div>
    </div>
  );
}

function Signup({ isFa }: { isFa: boolean }) {
  const [plan, setPlan] = useState<'revshare' | 'cpa'>('revshare');
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ email: '', username: '', password: '', payoutAccountId: '' });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);
  const change = (key: keyof typeof form, value: string) => setForm((prev) => ({ ...prev, [key]: value }));
  const valid = form.email.includes('@') && /^[a-z0-9_]{3,32}$/.test(form.username) && form.password.length >= 8 && form.payoutAccountId.trim().length >= 4;
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (plan !== 'revshare' || !valid || busy) return;
    setMessage('');
    setBusy(true);
    try {
      await apiRequest('/api/v1/affiliate/register', { method: 'POST', json: form });
      setSuccess(true);
      setForm({ email: '', username: '', password: '', payoutAccountId: '' });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : (isFa ? 'ثبت‌نام انجام نشد.' : 'Could not create the account.'));
    } finally { setBusy(false); }
  };
  return (
    <div id="bva-signup" className="bva-signup-area">
      <Reveal><div className="bva-eyebrow bva-eyebrow--green">JOIN US</div><h2>{isFa ? 'همین حالا همکاری را شروع کنید' : 'Start earning right now'}</h2><p>{isFa ? 'حساب همکاران خود را بسازید و به پنل اختصاصی دسترسی پیدا کنید.' : 'Create your partner account and access your dedicated affiliate dashboard.'}</p></Reveal>
      <Reveal delay={110}><div className="bva-register-card">
        <h3>{isFa ? 'ثبت‌نام' : 'Sign up'}</h3>
        <p className="bva-login-hint">{isFa ? 'حساب دارید؟' : 'Already have an account?'} <a href="/affiliate/login">{isFa ? 'ورود' : 'Log in'}</a></p>
        <div className="bva-plan-tabs" role="group" aria-label="Partnership model">
          <button type="button" className={plan === 'revshare' ? 'is-active' : ''} onClick={() => { setPlan('revshare'); setMessage(''); }}>● RevShare</button>
          <button type="button" className={plan === 'cpa' ? 'is-active' : ''} onClick={() => { setPlan('cpa'); setMessage(''); }}>● CPA</button>
        </div>
        {plan === 'cpa' ? (
          <div className="bva-cpa-note">
            <h4>{isFa ? 'درخواست همکاری CPA' : 'CPA partnership enquiry'}</h4>
            <p>{isFa ? 'ثبت‌نام عادی CPA را فعال نمی‌کند. شرایط این مدل پس از بررسی و تأیید جداگانه تعیین می‌شود.' : 'Standard registration does not activate CPA. Terms must be reviewed and approved separately.'}</p>
            <a href="mailto:BetVimaSupport@gmail.com?subject=BetVima%20CPA%20Partnership">{isFa ? 'درخواست شرایط CPA' : 'Request CPA terms'} <ArrowUpRight size={17} /></a>
          </div>
        ) : success ? (
          <div className="bva-success" role="status"><Check size={28} /><h4>{isFa ? 'حساب شما ایجاد شد' : 'Your account was created'}</h4><p>{isFa ? 'اکنون می‌توانید وارد پنل همکاری شوید.' : 'You can now log in to your partner dashboard.'}</p><a href="/affiliate/login">{isFa ? 'ورود به حساب' : 'Log in'} <ArrowRight size={17} /></a></div>
        ) : (
          <form className="bva-form" onSubmit={(event) => void submit(event)}>
            <label><UserRound size={20} /><input required autoComplete="username" minLength={3} maxLength={32} pattern="[a-z0-9_]{3,32}" placeholder={isFa ? 'نام کاربری' : 'Username'} aria-label="Username" value={form.username} onChange={(e) => change('username', e.target.value.toLowerCase())} /></label>
            <label><Mail size={20} /><input required type="email" autoComplete="email" placeholder={isFa ? 'ایمیل' : 'Email'} aria-label="Email" value={form.email} onChange={(e) => change('email', e.target.value)} /></label>
            <label><LockKeyhole size={20} /><input required type={showPassword ? 'text' : 'password'} minLength={8} autoComplete="new-password" placeholder={isFa ? 'رمز عبور (حداقل ۸ کاراکتر)' : 'Password (at least 8 characters)'} aria-label="Password" value={form.password} onChange={(e) => change('password', e.target.value)} /><button type="button" className="bva-reveal-password" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button></label>
            <label><AtSign size={20} /><input required minLength={4} autoComplete="off" placeholder={isFa ? 'شناسه حساب تسویه' : 'Payout Account ID'} aria-label="Payout Account ID" value={form.payoutAccountId} onChange={(e) => change('payoutAccountId', e.target.value)} /></label>
            <div className="bva-form-info"><ShieldCheck size={16} />{isFa ? 'این حساب مستقل از حساب شرط‌بندی BetVima است.' : 'This partner account is separate from your BetVima player account.'}</div>
            {message ? <div className="bva-form-error" role="alert">{message}</div> : null}
            <button className="bva-primary bva-submit" type="submit" disabled={busy || !valid}>{busy ? (isFa ? 'در حال ثبت‌نام…' : 'Creating account…') : (isFa ? 'ثبت‌نام' : 'Sign up')} <ArrowRight size={20} /></button>
          </form>
        )}
      </div></Reveal>
    </div>
  );
}


/** SVG meets both adjacent section edges; it is a connector, not a floating divider. */
function AffiliateCircuit({ variant = 'right' }: { variant?: 'left' | 'right' }) {
  return <div className={'bva2-circuit bva2-circuit--' + variant} aria-hidden="true">
    <svg viewBox="0 0 1000 84" preserveAspectRatio="none" focusable="false">
      <defs><filter id={'bva2-glow-' + variant}><feGaussianBlur stdDeviation="5" /></filter></defs>
      <path className="bva2-trace-glow" filter={'url(#bva2-glow-' + variant + ')'} d={variant === 'left' ? 'M0 2 H90 L135 40 H340 L385 72 H610 L665 32 H875 L914 2 H1000' : 'M0 74 H86 L126 33 H345 L390 8 H635 L682 51 H883 L927 74 H1000'}/>
      <path className="bva2-trace" d={variant === 'left' ? 'M0 2 H90 L135 40 H340 L385 72 H610 L665 32 H875 L914 2 H1000' : 'M0 74 H86 L126 33 H345 L390 8 H635 L682 51 H883 L927 74 H1000'}/>
      <path className="bva2-trace-secondary" d={variant === 'left' ? 'M0 26 H115 L152 61 H290 M450 53 H599 L656 13 H791 L834 35 H1000' : 'M0 48 H95 L149 66 H311 L355 39 H554 M635 21 H798 L849 56 H1000'}/>
      <circle cx={variant === 'left' ? '385' : '390'} cy={variant === 'left' ? '72' : '8'} r="9" className="bva2-node" />
      <circle cx={variant === 'left' ? '665' : '682'} cy={variant === 'left' ? '32' : '51'} r="5" className="bva2-node" />
    </svg>
  </div>;
}

const affiliateEditorial = [
  { key: 'portrait-blue', en: 'Editorial portrait', fa: 'پرتره تبلیغاتی', position: '0% 0%' },
  { key: 'portrait-dark', en: 'Fashion campaign', fa: 'کمپین مد و برند', position: '100% 0%' },
  { key: 'lifestyle-golf', en: 'Outdoor lifestyle', fa: 'سبک زندگی و ورزش', position: '0% 100%' },
  { key: 'studio-white', en: 'Studio campaign', fa: 'عکاسی استودیویی', position: '100% 100%' },
] as const;

export function AffiliateShowcase() {
  const { locale } = useApp();
  const isFa = locale === 'fa';
  const [menuOpen, setMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [activePhoto, setActivePhoto] = useState<number | null>(null);
  const productsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = document.querySelector('.bva-root');
    if (!root) return;
    const items = root.querySelectorAll('.bva-reveal');
    if (!('IntersectionObserver' in window)) { items.forEach((item) => item.classList.add('bva-visible')); return; }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => { if (entry.isIntersecting) { entry.target.classList.add('bva-visible'); observer.unobserve(entry.target); } });
    }, { threshold: 0.08, rootMargin: '0px 0px -35px 0px' });
    items.forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, [locale]);
  useEffect(() => {
    if (activePhoto === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActivePhoto(null);
      if (event.key === 'ArrowRight') setActivePhoto((value) => value === null ? null : (value + 1) % affiliateEditorial.length);
      if (event.key === 'ArrowLeft') setActivePhoto((value) => value === null ? null : (value + affiliateEditorial.length - 1) % affiliateEditorial.length);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [activePhoto]);
  const scrollProducts = (direction: number) => productsRef.current?.scrollBy({ left: direction * Math.min(340, productsRef.current.clientWidth * .83), behavior: 'smooth' });
  const nav = [
    { id: 'bva-features', en: 'Features', fa: 'ویژگی‌ها' },
    { id: 'bva-product', en: 'Product', fa: 'محصولات' },
    { id: 'bva-faq', en: 'FAQ', fa: 'سؤالات' },
    { id: 'bva-about', en: 'Benefits', fa: 'مزایا' },
    { id: 'bva2-gallery', en: 'Gallery', fa: 'گالری' },
    { id: 'bva-signup', en: 'Contacts', fa: 'تماس' },
  ];
  return (
    <div className="bva-root bva-v2" dir={isFa ? 'rtl' : 'ltr'}>
      <header className="bva-header">
        <a href="#bva-top" className="bva-brand"><img src="/brand/betvima-logo-transparent.png" alt="BetVima Partners" /><span>PARTNERS</span></a>
        <div className="bva-header-actions"><a className="bva-header-login" href="/affiliate/login">{isFa ? 'ورود' : 'Log in'}</a><button aria-label={isFa ? 'منو' : 'Menu'} type="button" className="bva-menu-btn" onClick={() => setMenuOpen((v) => !v)}>{menuOpen ? <X size={23} /> : <Menu size={23} />}</button></div>
        {menuOpen ? <nav className="bva-menu" aria-label="Affiliate sections">{nav.map((item) => <a key={item.id} href={'#' + item.id} onClick={() => setMenuOpen(false)}>{isFa ? item.fa : item.en}<ArrowUpRight size={16} /></a>)}</nav> : null}
      </header>
      <main>
        <section id="bva-top" className="bva-hero">
          <div className="bva-hero-orb" aria-hidden="true" />
          <div className="bva-eyebrow bva-eyebrow--green bva-hero-kicker">BETVIMA PARTNERS</div>
          <h1>{isFa ? 'با همکاری در یک پلتفرم ورزشی و کازینویی، رشد کنید' : <>Grow with a leading <span>Sports &amp; Casino</span> experience</>}</h1>
          <a href="#bva-signup" className="bva-primary bva-hero-cta">{isFa ? 'همکار BetVima شوید' : 'Become an affiliate'} <ArrowRight size={20} /></a>
          <p className="bva-hero-login">{isFa ? 'قبلاً ثبت‌نام کرده‌اید؟' : 'Already have an account?'} <a href="/affiliate/login">{isFa ? 'ورود' : 'Log in'}</a></p>
          <div className="bva-hero-visual" aria-label="Animated BetVima product presentation">
            <div className="bva-hero-halo" aria-hidden="true" />
            <div className="bva-hero-phone"><PhoneMock /></div>
            <div className="bva-float-card bva-float-rev"><strong>RevShare</strong><span>{isFa ? 'مبتنی بر قرارداد' : 'Agreement based'}</span></div>
            <div className="bva-float-card bva-float-cpa"><strong>CPA</strong><span>{isFa ? 'با تأیید جداگانه' : 'By arrangement'}</span></div>
          </div>
          <div className="bva-blue-stats">
            <p>{isFa ? 'از ابزارهای اختصاصی برای رشد همکاری استفاده کنید' : "Tools to support your growth, all in one place"}</p>
            <div className="bva-stat"><strong><Counter end={1} /></strong><span>{isFa ? 'پنل همکاری یکپارچه' : 'Partner dashboard'}</span></div>
            <div className="bva-stat"><strong><Counter end={2} /></strong><span>{isFa ? 'شیوه همکاری قابل بررسی' : 'Partnership models to explore'}</span></div>
            <div className="bva-stat"><strong><Counter end={3} /></strong><span>{isFa ? 'دسته محصول' : 'Product experiences'}</span></div>
          </div>
        </section>

        <AffiliateCircuit variant="right" />
        <section id="bva-features" className="bva2-partnership">
          <div className="bva2-inner">
            <Reveal><div className="bva2-kicker">{isFa ? 'همکاری شما' : 'YOUR PARTNERSHIP'}</div><h2>{isFa ? 'ساخته‌شده برای رشد واقعی' : 'Built for real growth'}</h2><p className="bva2-lead">{isFa ? 'BetVima را به مخاطبان خود معرفی کنید و کمیسیون‌ها را در یک پنل امن مدیریت کنید.' : 'Share BetVima with your audience and manage commissions from one secure dashboard.'}</p></Reveal>
            <Reveal delay={70}><div className="bva2-revenue"><span className="bva2-rate">70%</span><div><b>{isFa ? 'نرخ پایه مشارکت در درآمد' : 'Default revenue share'}</b><p>{isFa ? 'برای حساب‌های تأییدشده؛ نرخ نهایی مطابق قرارداد هر همکار تعیین می‌شود.' : 'For approved accounts. Your actual rate is shown after sign-in and is subject to your agreement.'}</p></div></div></Reveal>
            <Reveal delay={120}><div className="bva2-benefits">
              <div className="bva2-benefit"><span><ShieldCheck size={28}/></span><div><b>{isFa ? 'تسویه طبق قرارداد' : 'Agreement-based settlement'}</b><small>{isFa ? 'زمان پرداخت پس از تأیید و مطابق شرایط حساب' : 'Settlement timing depends on your approved terms'}</small></div></div>
              <div className="bva2-benefit"><span><BarChart3 size={28}/></span><div><b>{isFa ? 'آمار قابل‌پیگیری همکاران' : 'Verified partner analytics'}</b><small>{isFa ? 'پیگیری ثبت‌نام‌ها و کمیسیون ثبت‌شده' : 'Track attributed signups and earned commission'}</small></div></div>
              <div className="bva2-benefit"><span><Smartphone size={28}/></span><div><b>{isFa ? 'تجربه مخصوص اندروید' : 'Native Android workspace'}</b><small>{isFa ? 'کمپین‌ها و پرداخت‌ها در یک محیط' : 'Campaigns and payouts in one workspace'}</small></div></div>
            </div></Reveal>
          </div>
        </section>
        <AffiliateCircuit variant="left" />
        <section id="bva-product" className="bva2-products">
          <div className="bva2-inner">
            <Reveal><div className="bva2-kicker">{isFa ? 'محصولات ما' : 'OUR PRODUCTS'}</div><h2>{isFa ? 'بازیکنان را کنار هم بیاورید' : 'Bring players together'}</h2><p className="bva2-lead">{isFa ? 'تجربه‌هایی را ببینید که می‌توانید به مخاطبان معرفی کنید.' : 'Explore the experiences you can introduce to your audience.'}</p></Reveal>
            <div ref={productsRef} className="bva2-product-scroll">
              <a className="bva2-product-tile bva2-tile--sport" href="/bets"><span className="bva2-product-icon"><Trophy size={28}/></span><strong>{isFa ? 'ورزش' : 'Sports'}</strong><small>{isFa ? 'رویدادهای زنده و بازارهای پیش از مسابقه' : 'Live fixtures and pre-match markets'}</small><i /></a>
              <a className="bva2-product-tile bva2-tile--casino" href="/casino"><span className="bva2-product-icon"><Gamepad2 size={28}/></span><strong>{isFa ? 'کازینو' : 'Casino'}</strong><small>{isFa ? 'کشف بازی‌های موجود در کازینو' : 'Discover available casino games'}</small><i /></a>
              <a className="bva2-product-tile bva2-tile--mobile" href="#bva-signup"><span className="bva2-product-icon"><Smartphone size={28}/></span><strong>{isFa ? 'اپلیکیشن' : 'Mobile app'}</strong><small>{isFa ? 'تجربه موبایلی BetVima' : 'The BetVima mobile experience'}</small><i /></a>
            </div>
            <div className="bva2-slider-controls"><button type="button" aria-label="Previous product" onClick={() => scrollProducts(isFa ? 1 : -1)}><ChevronLeft size={22}/></button><button type="button" aria-label="Next product" onClick={() => scrollProducts(isFa ? -1 : 1)}><ChevronRight size={22}/></button></div>
          </div>
        </section>
        <AffiliateCircuit variant="right" />
        <section id="bva-faq" className="bva2-faq">
          <div className="bva2-inner">
            <Reveal><div className="bva2-kicker">FAQ</div><h2>{isFa ? 'سؤالات متداول' : 'Frequently asked questions'}</h2></Reveal>
            <div className="bva2-accordion">{faq.map((item,index) => <div className="bva2-faq-item" key={item.en}><button type="button" aria-expanded={openFaq===index} aria-controls={'bva2-faq-'+index} onClick={()=>setOpenFaq(openFaq===index?null:index)}><span>{isFa?item.fa:item.en}</span><span className="bva2-plus">{openFaq===index?'−':'+'}</span></button><div id={'bva2-faq-'+index} hidden={openFaq!==index}><p>{isFa?item.answerFa:item.answerEn}</p></div></div>)}</div>
          </div>
        </section>
        <AffiliateCircuit variant="left" />
        <section id="bva-about" className="bva2-advantages">
          <div className="bva2-inner">
            <Reveal><div className="bva2-kicker">{isFa ? 'مزایای همکاری' : 'AFFILIATE ADVANTAGES'}</div><h2>{isFa ? 'معرفی کنید. پیگیری کنید. رشد کنید.' : 'Share. Track. Grow.'}</h2><p className="bva2-lead">{isFa ? 'لینک اختصاصی، گزارش‌های شفاف و کنترل همکاری، همه در پنل همکاران.' : 'Your links, reporting and partner tools in a focused dashboard.'}</p></Reveal>
            <div className="bva2-advantages-grid"><div><ShieldCheck size={27}/><strong>{isFa?'حساب اختصاصی':'Dedicated account'}</strong></div><div><BarChart3 size={27}/><strong>{isFa?'گزارش کمیسیون':'Commission reporting'}</strong></div><div><Globe2 size={27}/><strong>{isFa?'پشتیبانی چندزبانه':'Multilingual experience'}</strong></div></div>
          </div>
        </section>
        <AffiliateCircuit variant="right" />
        <Signup isFa={isFa} />

        <AffiliateCircuit variant="left" />
        <section id="bva2-gallery" className="bva2-editorial">
          <div className="bva2-inner">
            <div className="bva2-kicker">{isFa ? 'گالری برند' : 'BRAND GALLERY'}</div>
            <h2>{isFa ? 'لحظه‌هایی با حال‌وهوای BetVima' : 'A closer look at BetVima'}</h2>
            <p className="bva2-lead">{isFa ? 'چهار نمونه تصویری با چهره‌های واقعی و طراحی پیشنهادی برند.' : 'Four branded editorial concepts featuring real people.'}</p>
            <div className="bva2-editorial-grid">
              {affiliateEditorial.map((photo,index) => <button key={photo.key} type="button" className={'bva2-editorial-card bva2-photo-'+index} aria-label={(isFa?photo.fa:photo.en)+' — '+(isFa?'بزرگ‌نمایی':'Open photo')} onClick={()=>setActivePhoto(index)}><span className="bva2-editorial-image" aria-hidden="true" style={{backgroundPosition:photo.position}}/><span className="bva2-editorial-label">{isFa?photo.fa:photo.en} <ArrowUpRight size={17}/></span></button>)}
            </div>
            <small className="bva2-photo-note">{isFa ? 'تصاویر، نمونه‌های خلاقانه برگرفته از عکس‌های مرجع هستند و مستند رویداد رسمی BetVima نیستند.' : 'Illustrative creative mockups based on supplied reference photos; not photographs of official BetVima events.'}</small>
          </div>
        </section>
        {activePhoto!==null ? <div className="bva2-lightbox" role="dialog" aria-modal="true" aria-label={isFa?'نمایش تصویر':'Gallery image viewer'}><button className="bva2-lightbox-backdrop" type="button" aria-label={isFa?'بستن':'Close'} onClick={()=>setActivePhoto(null)}/><div className="bva2-lightbox-content"><button className="bva2-lightbox-close" type="button" aria-label="Close gallery" onClick={()=>setActivePhoto(null)}><X size={25}/></button><div className="bva2-editorial-image" role="img" aria-label={isFa?affiliateEditorial[activePhoto].fa:affiliateEditorial[activePhoto].en} style={{backgroundPosition:affiliateEditorial[activePhoto].position}}/><div className="bva2-lightbox-nav"><button type="button" aria-label="Previous photo" onClick={()=>setActivePhoto((activePhoto+affiliateEditorial.length-1)%affiliateEditorial.length)}><ChevronLeft/></button><span>{activePhoto+1} / {affiliateEditorial.length}</span><button type="button" aria-label="Next photo" onClick={()=>setActivePhoto((activePhoto+1)%affiliateEditorial.length)}><ChevronRight/></button></div></div></div> : null}
      </main>
      <footer className="bva-footer"><div className="bva-footer-inner"><img src="/brand/betvima-logo-transparent.png" alt="BetVima" /><div className="bva-footer-contact"><span>{isFa ? 'ارتباط با ما' : 'Contact us'}</span><a href="mailto:BetVimaSupport@gmail.com"><Mail size={19} /> BetVimaSupport@gmail.com</a></div><div className="bva-footer-links"><a href="/legal/terms">{isFa ? 'شرایط و قوانین' : 'Terms and conditions'}</a><a href="/legal/privacy">{isFa ? 'حریم خصوصی' : 'Privacy Policy'}</a></div><small>© {new Date().getFullYear()} BetVima Partners. {isFa ? 'شرایط همکاری و تسویه مطابق قرارداد مورد تأیید است.' : 'Partnership and payout terms are subject to the approved agreement.'}</small></div></footer>
    </div>
  );
}

export function AffiliatePromoSheet({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDivElement>(null);
  const gesture = useRef<number | null>(null);
  const [closing, setClosing] = useState(false);
  const close = () => { if (closing) return; setClosing(true); window.setTimeout(onClose, 240); };
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const node = dialog.current;
    node?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setClosing(true); window.setTimeout(onClose, 240); }
      if (event.key !== 'Tab' || !node) return;
      const tabbables = Array.from(node.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled])')).filter((el) => el.offsetParent !== null);
      if (!tabbables.length) return;
      const first = tabbables[0], last = tabbables[tabbables.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', key);
    return () => { document.body.style.overflow = previous; document.removeEventListener('keydown', key); };
  }, [onClose]);
  const start = (event: TouchEvent<HTMLButtonElement>) => { gesture.current = event.touches[0]?.clientY ?? null; };
  const end = (event: TouchEvent<HTMLButtonElement>) => { if (gesture.current !== null && (event.changedTouches[0]?.clientY ?? 0) - gesture.current > 85) close(); gesture.current = null; };
  return <div className={'bva-overlay ' + (closing ? 'is-closing' : '')} role="presentation">
    <button type="button" aria-label="Close affiliate page" className="bva-backdrop" onClick={close} />
    <div ref={dialog} className="bva-sheet" tabIndex={-1} role="dialog" aria-modal="true" aria-label="BetVima Partners">
      <div className="bva-sheet-grabber"><button type="button" aria-label="Close affiliate popup, or swipe down" onClick={close} onTouchStart={start} onTouchEnd={end}><span /></button><button type="button" className="bva-close-button" aria-label="Close" onClick={close}><X size={18} /></button></div>
      <div className="bva-sheet-scroll"><AffiliateShowcase /></div>
    </div>
  </div>;
}
