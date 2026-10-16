'use client';

import { useEffect, useRef, useState, type FormEvent, type TouchEvent } from 'react';
import { ArrowRight, ArrowUpRight, AtSign, BarChart3, Check, ChevronDown, ChevronLeft, ChevronRight, Eye, EyeOff, Gamepad2, Globe2, LockKeyhole, Mail, Menu, Play, Send, ShieldCheck, Smartphone, Trophy, UserRound, X } from 'lucide-react';
import { apiRequest } from '@/lib/hooks/useApi';
import { useApp } from '@/components/layout/providers';
import './affiliate-promo.css';

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

export function AffiliateShowcase() {
  const { locale } = useApp();
  const isFa = locale === 'fa';
  const [menuOpen, setMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
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
  const scrollProducts = (direction: number) => productsRef.current?.scrollBy({ left: direction * Math.min(340, productsRef.current.clientWidth * .83), behavior: 'smooth' });
  const nav = [
    { id: 'bva-features', en: 'Features', fa: 'ویژگی‌ها' },
    { id: 'bva-product', en: 'Product', fa: 'محصولات' },
    { id: 'bva-faq', en: 'FAQ', fa: 'سؤالات' },
    { id: 'bva-about', en: 'About', fa: 'درباره ما' },
    { id: 'bva-signup', en: 'Contacts', fa: 'تماس' },
  ];
  return (
    <div className="bva-root" dir={isFa ? 'rtl' : 'ltr'}>
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
        <section id="bva-features" className="bva-features bva-light-section">
          <div className="bva-section-inner">
            <Reveal><div className="bva-eyebrow">FEATURES</div><h2>{isFa ? 'اکوسیستمی پیشرفته برای رشد همکاری' : 'An advanced ecosystem for partner growth'}</h2></Reveal>
            <Reveal><div className="bva-feature-dark">
              <h3>{isFa ? 'همه‌چیز در دنیای BetVima' : 'Explore the BetVima experience'}</h3>
              <div className="bva-feature-dark-visual"><PhoneMock variant="mobile" /><span className="bva-cube" aria-hidden="true"><Gamepad2 size={36} /></span></div>
            </div></Reveal>
            <Reveal><article className="bva-feature-white"><h3>{isFa ? 'تجربه‌ای یکپارچه' : 'Original product experience'}</h3><p>{isFa ? 'محصولات ورزشی و کازینو با طراحی یکپارچه و مناسب موبایل.' : 'Sports and casino products with a unified mobile-first presentation.'}</p><div className="bva-double-phone"><PhoneMock variant="casino" /><PhoneMock variant="sports" /></div></article></Reveal>
            <div className="bva-feature-grid">
              <Reveal><article className="bva-feature-white bva-mini-feature"><h3>{isFa ? 'محصول موبایل‌محور' : 'Android-first experience'}</h3><p>{isFa ? 'تجربه مناسب کاربران اندروید با پیمایش روان.' : 'Made to feel intuitive and fast on Android.'}</p><div className="bva-feature-symbols"><Smartphone size={34} /><Gamepad2 size={34} /></div></article></Reveal>
              <Reveal delay={110}><article className="bva-feature-white bva-mini-feature"><h3>{isFa ? 'آمار قابل پیگیری' : 'Trackable partner stats'}</h3><p>{isFa ? 'اطلاعات همکاری از پنل اختصاصی قابل مشاهده است.' : 'Monitor your own tracked results in your dashboard.'}</p><div className="bva-graph"><span className="bva-online">● Online</span><svg viewBox="0 0 300 100" role="img" aria-label="Decorative animated trend line"><path d="M0 77 C48 35 82 110 132 62 S222 98 300 17" fill="none" stroke="#4565fa" strokeWidth="3" strokeLinecap="round" className="bva-graph-line" /></svg></div></article></Reveal>
            </div>
            <Reveal><article className="bva-feature-dark bva-chart-feature"><h3>{isFa ? 'داشبوردی برای مدیریت همکاری' : 'A dashboard made for partner insights'}</h3><p>{isFa ? 'لینک‌های اختصاصی، ارجاع‌ها و سوابق کمیسیون را از یکجا ببینید.' : 'Access referral links, tracked users and commission history from one place.'}</p><Bars /></article></Reveal>
            <Reveal><article className="bva-geography"><div className="bva-eyebrow">GLOBAL THINKING</div><h3>{isFa ? 'همکاری با نگاه جهانی' : 'Built for different audiences'}</h3><p>{isFa ? 'پشتیبانی از زبان‌ها و تجربه‌های مختلف با توجه به محدودیت‌های قانونی هر منطقه.' : 'A multilingual product experience. Availability and partnership eligibility depend on applicable regional rules.'}</p>
              <div className="bva-network" aria-hidden="true"><Globe2 size={125} strokeWidth={.9} /><i /><i /><i /><i /></div>
              <p className="bva-eligibility">{isFa ? 'ارائه خدمات فقط در مناطق مجاز و مطابق شرایط برنامه همکاری امکان‌پذیر است.' : 'Services and partner eligibility are subject to local rules and approved territories.'}</p>
              <a className="bva-dark-btn" href="#bva-signup">{isFa ? 'شروع همکاری' : 'Become an affiliate'} <ArrowRight size={18} /></a>
            </article></Reveal>
          </div>
        </section>
        <section id="bva-product" className="bva-products-section">
          <div className="bva-section-inner">
            <Reveal><div className="bva-eyebrow">PRODUCT</div><h2>{isFa ? 'تجربه‌ای که معرفی‌کردن آن ساده است' : 'An experience built to be shared'}</h2><p className="bva-section-lead">{isFa ? 'با بخش‌های متنوع BetVima آشنا شوید.' : 'Discover the experiences available across BetVima.'}</p></Reveal>
            <div ref={productsRef} className="bva-products-scroll" aria-label="Swipeable BetVima product cards">
              {products.map((product) => { const Icon = product.icon; return <article key={product.name} className={'bva-product-card bva-product-' + product.skin}><div className="bva-product-heading"><Icon size={27}/><h3>{isFa ? product.fa : product.name}</h3></div><p>{isFa ? product.descFa : product.desc}</p><span className="bva-product-tag">{product.tag}</span><div className="bva-product-phone"><PhoneMock variant={product.skin} /></div></article>; })}
            </div>
            <div className="bva-slider-controls"><button aria-label="Previous product" type="button" onClick={() => scrollProducts(isFa ? 1 : -1)}><ChevronLeft size={21} /></button><button aria-label="Next product" type="button" onClick={() => scrollProducts(isFa ? -1 : 1)}><ChevronRight size={21} /></button></div>
          </div>
        </section>
        <section id="bva-faq" className="bva-faq bva-light-section">
          <div className="bva-section-inner">
            <Reveal><div className="bva-eyebrow bva-eyebrow--green">FAQ</div><h2>{isFa ? 'سؤالات متداول' : 'Frequently Asked Questions'}</h2></Reveal>
            <Reveal><div className="bva-chat-demo"><div className="bva-chat-in">{isFa ? 'سلام، درباره همکاری با شما توضیح می‌دهید؟' : 'Hello! Tell me about the partner program.'}</div><div className="bva-chat-out">{isFa ? 'سلام! حساب افیلیت بسازید و لینک‌ها و آمار همکاری را از پنل خود مدیریت کنید.' : 'Hi! Join BetVima Partners and manage your referral links and statistics from your own dashboard.'}</div><div className="bva-chat-in">{isFa ? 'عالیه، شروع کنیم!' : "Sounds great. Let's get started!"}</div></div></Reveal>
            <div className="bva-accordion">{faq.map((item, index) => <Reveal key={item.en} delay={index * 40}><div className={'bva-faq-item ' + (openFaq === index ? 'is-open' : '')}><button type="button" aria-expanded={openFaq === index} aria-controls={'bva-answer-' + index} onClick={() => setOpenFaq(openFaq === index ? null : index)}><span>{isFa ? item.fa : item.en}</span><span className="bva-plus">{openFaq === index ? '−' : '+'}</span></button><div id={'bva-answer-' + index} className="bva-answer" aria-hidden={openFaq !== index}><div>{isFa ? item.answerFa : item.answerEn}</div></div></div></Reveal>)}</div>
          </div>
        </section>
        <section id="bva-about" className="bva-about bva-light-section">
          <div className="bva-section-inner">
            <Reveal><div className="bva-eyebrow">ABOUT US</div><h2>{isFa ? 'دنیای BetVima را کشف کنید' : 'Discover the world of BetVima'}</h2><p className="bva-section-lead">{isFa ? 'تجربه‌ها و قابلیت‌های محصولات ما در یک نگاه.' : 'A closer look at our brand and the experiences we are building.'}</p></Reveal>
            <div className="bva-gallery">
              <Reveal className="bva-gallery-item bva-gallery-one"><div className="bva-gallery-orbit"><img src="/brand/betvima-apk-logo.png" alt="BetVima app icon" /></div><strong>BETVIMA<br/>MOBILE</strong></Reveal>
              <Reveal className="bva-gallery-item bva-gallery-two"><Trophy size={66} /><strong>SPORTS<br/>EXPERIENCE</strong></Reveal>
              <Reveal className="bva-gallery-item bva-gallery-three"><Gamepad2 size={62} /><strong>CASINO<br/>DISCOVERY</strong></Reveal>
              <Reveal className="bva-gallery-item bva-gallery-four"><BarChart3 size={62} /><strong>PARTNER<br/>INSIGHTS</strong></Reveal>
            </div>
          </div>
        </section>
        <Signup isFa={isFa} />
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
