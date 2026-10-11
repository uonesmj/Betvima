import { PageShell } from '@/components/layout/page-shell';

export const metadata = { title: 'Terms of Use' };

export default function TermsPage() {
  return (
    <PageShell title="Terms of Use" subtitle="خلاصه قوانینی که بر این سایت Betting حاکم است">
      <article className="nova-card space-y-3 p-5 text-sm leading-7 nova-muted">
        <p><strong className="text-nova-text">Terms of Use.</strong> باید حداقل ۱۸ سال سن داشته باشید و طبق قوانین حوزه قضایی خود مجاز به Betting باشید. حساب‌ها شخصی و غیرقابل انتقال هستند.</p>
        <p><strong className="text-nova-text">Bets.</strong> Bet فقط زمانی پذیرفته می‌شود که سرور Amount Bet و ضریب را Confirm کند. ضرایب نمایش‌داده‌شده در برگه Bet تا زمان پذیرش قطعی نیستند؛ در صورت تغییر ضریب، Confirm صریح ضریب جدید از شما درخواست می‌شود.</p>
        <p><strong className="text-nova-text">Settlement.</strong> Bets are settled from the authoritative result of each event. If a result is corrected, the previous settlement is reversed and the bet is re-settled - both operations are recorded and visible to you.</p>
        <p><strong className="text-nova-text">Financial matters.</strong> هر تغییر Balance به‌عنوان یک تراکنش در دفتر حساب ثبت می‌شود و Balance جاری به‌روزرسانی می‌گردد. Withdrawals ابتدا نگه داشته و Check می‌شوند و تنها پس از دریافت مرجع خارجی پرداخت، Paid علامت می‌خورند.</p>
        <p><strong className="text-nova-text">Errors.</strong> Obvious pricing or settlement errors may be corrected with the correction documented; no silent edits are made to settled records.</p>
      </article>
    </PageShell>
  );
}
