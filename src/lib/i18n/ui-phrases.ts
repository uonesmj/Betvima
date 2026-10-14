import { DICTIONARIES } from './dictionaries';
import { EXTRA_FA_LABELS } from './ui-coverage-extra';

/** Canonical English UI copy. Persian applies to display text, never IDs or wager payloads. */
const phrasePairs: string = "\nEvery match.|هر مسابقه.\nOne destination.|یک مقصد.\nStay close to the action with live fixtures, football markets and everything you need in one place.|با مسابقات زنده، بازارهای فوتبال و همه امکانات موردنیاز، همیشه در جریان بازی‌ها باشید.\nExplore football|مشاهده فوتبال\nLive matches|مسابقات زنده\nSportsbook & Live|شرط‌بندی ورزشی و زنده\nHere when you need us.|هر زمان نیاز داشتید، کنار شما هستیم.\nQuestions about your account or a transaction? Reach our support team directly.|برای پرسش درباره حساب یا تراکنش، مستقیم با پشتیبانی ارتباط بگیرید.\nContact support|تماس با پشتیبانی\nGet in touch|تماس با ما\nExplore|کاوش\nAccount & partners|حساب و همکاری\nResponsible play|بازی مسئولانه\nPlay responsibly|مسئولانه بازی کنید\nBetting is for adults only.|شرط‌بندی فقط برای بزرگسالان است.\nCustomer support|پشتیبانی کاربران\nPartnerships|همکاری تجاری\nPartner program|برنامه همکاری\nFeatured clubs|باشگاه‌های منتخب\nPayment methods|روش‌های پرداخت\nPayment method|روش پرداخت\nAll rights reserved.|تمام حقوق محفوظ است.\nPlay safe. Stay in control.|ایمن بازی کنید و کنترل را حفظ کنید.\nLanguage|زبان\nEnglish|انگلیسی\nPersian|فارسی\nFull Time Result|نتیجه پایان بازی\nFull time|پایان بازی\nHalf time|نیمه اول\nHalf Time / Full Time|نیمه اول / پایان بازی\n1st Half|نیمه اول\n2nd Half|نیمه دوم\nFirst Half|نیمه اول\nSecond Half|نیمه دوم\nOvertime|وقت اضافه\nExtra Time|وقت اضافه\nPenalty Shootout|ضربات پنالتی\nIn Play|در جریان\nMATCH TIME|زمان مسابقه\nMATCH|مسابقه\nLIVE NOW|اکنون زنده\nUPCOMING|آینده\nLIVE|زنده\nTop|برترین‌ها\nAll|همه\nMain|اصلی\nToday|امروز\nTomorrow|فردا\nYesterday|دیروز\nStarting soon|به‌زودی شروع می‌شود\nNow|اکنون\nThis week|این هفته\nNext week|هفته آینده\nMatches|مسابقات\nMatch|مسابقه\nEvents|رویدادها\nEvent|رویداد\nLeagues|لیگ‌ها\nLeague|لیگ\nLeague table|جدول لیگ\nStandings|جدول رده‌بندی\nTournament|مسابقات\nTournaments|مسابقات\nPopular|محبوب\nTop leagues|لیگ‌های برتر\nFeatured|منتخب\nFeatured matches|مسابقات منتخب\nView all|مشاهده همه\nSee all|مشاهده همه\nShow all|نمایش همه\nLoad more|بارگذاری بیشتر\nShow more|نمایش بیشتر\nShow less|نمایش کمتر\nCollapse|بستن\nExpand|باز کردن\nMore|بیشتر\nMore markets|بازارهای بیشتر\nAll markets|همه بازارها\nMarkets|بازارها\nMarket|بازار\nOdds|ضرایب\nOdd|ضریب\nOdds unavailable|ضرایب در دسترس نیست\nOdds paused — waiting for a valid current price|ضرایب متوقف شده‌اند؛ منتظر قیمت معتبر بمانید\nAdd to bet slip|افزودن به برگه شرط\nPaused|متوقف\nSuspended|معلق\nClosed|بسته\nOpen|باز\nAvailable|در دسترس\nUnavailable|در دسترس نیست\nSelections|انتخاب‌ها\nSelection|انتخاب\nBet slip|برگه شرط\nMy Bets|شرط‌های من\nBet history|سابقه شرط‌ها\nBet details|جزئیات شرط\nStake|مبلغ شرط\nWinnings|مبلغ برد\nPotential winnings|برد احتمالی\nPotential payout|پرداخت احتمالی\nTotal odds|ضریب کل\nTotal stake|مجموع شرط\nPlace Bet|ثبت شرط\nBet Now|شرط‌بندی\nClear all|پاک‌کردن همه\nQuick Bet|شرط سریع\nQuick stakes|مبلغ‌های پیشنهادی\nSingle|تکی\nMultiple|ترکیبی\nAccumulator|ترکیبی\nSystem bet|شرط سیستمی\nWon|برنده\nLost|بازنده\nVoid|باطل\nRefunded|مستردشده\nSettled|تسویه‌شده\nPending|در انتظار\nCashout|تسویه زودهنگام\nCash Out|تسویه زودهنگام\nBet accepted|شرط پذیرفته شد\nBet rejected|شرط رد شد\nInsufficient balance|موجودی کافی نیست\nBalance|موجودی\nWallet|کیف پول\nMy wallet|کیف پول من\nDeposit|واریز\nWithdraw|برداشت\nWithdrawal|برداشت\nTransactions|تراکنش‌ها\nTransaction history|تاریخچه تراکنش‌ها\nTransaction details|جزئیات تراکنش\nAmount|مبلغ\nCurrency|ارز\nNetwork|شبکه\nChoose network|انتخاب شبکه\nSelect network|انتخاب شبکه\nMinimum deposit|حداقل واریز\nMinimum withdrawal|حداقل برداشت\nMaximum withdrawal|حداکثر برداشت\nAvailable balance|موجودی قابل استفاده\nCurrent balance|موجودی فعلی\nAccount balance|موجودی حساب\nPayment pending|پرداخت در انتظار\nPayment confirmed|پرداخت تأیید شد\nDeposit methods|روش‌های واریز\nWithdrawal methods|روش‌های برداشت\nMy account|حساب من\nAccount|حساب\nAccount details|جزئیات حساب\nProfile|پروفایل\nSettings|تنظیمات\nPersonal details|اطلاعات شخصی\nPersonal information|اطلاعات شخصی\nDisplay name|نام نمایشی\nUsername|نام کاربری\nEmail address|آدرس ایمیل\nEmail|ایمیل\nPassword|رمز عبور\nConfirm password|تکرار رمز عبور\nForgot password?|رمز عبور را فراموش کرده‌اید؟\nReset password|بازنشانی رمز عبور\nNew password|رمز عبور جدید\nCurrent password|رمز عبور فعلی\nSign in|ورود\nSign out|خروج\nLog in|ورود\nLog out|خروج\nLogin|ورود\nRegister|ثبت‌نام\nSign up|ثبت‌نام\nCreate account|ایجاد حساب\nCreate an account|ایجاد حساب\nAlready have an account?|حساب دارید؟\nDon't have an account?|حساب ندارید؟\nContinue|ادامه\nBack|بازگشت\nNext|بعدی\nPrevious|قبلی\nSave|ذخیره\nSave changes|ذخیره تغییرات\nEdit|ویرایش\nCancel|لغو\nConfirm|تأیید\nSubmit|ثبت\nClose|بستن\nDone|انجام شد\nRetry|تلاش دوباره\nRefresh|تازه‌سازی\nSearch|جستجو\nSearch matches|جستجوی مسابقات\nFilter|فیلتر\nFilters|فیلترها\nApply filters|اعمال فیلترها\nClear filters|پاک‌کردن فیلترها\nSort by|مرتب‌سازی بر اساس\nDetails|جزئیات\nStatus|وضعیت\nType|نوع\nDate|تاریخ\nTime|زمان\nCountry|کشور\nRegion|منطقه\nName|نام\nID|شناسه\nActions|عملیات\nAction|عملیات\nTotal|مجموع\nSubtotal|جمع جزء\nSummary|خلاصه\nOverview|نمای کلی\nStatistics|آمار\nStats|آمار\nResults|نتایج\nResult|نتیجه\nScore|نتیجه\nScores|نتایج\nLive score|نتیجه زنده\nKick off|شروع مسابقه\nKickoff|شروع مسابقه\nStart time|زمان شروع\nHome|خانه\nAway|میهمان\nDraw|مساوی\nHalf|نیمه\nFirst|اول\nSecond|دوم\nBoth teams|هر دو تیم\nTeam 1|تیم اول\nTeam 2|تیم دوم\nTBD|هنوز مشخص نیست\nWin|برد\nWin or draw|برد یا مساوی\nLose|باخت\nWinner|برنده\nMatch Winner|برنده مسابقه\nMoneyline|برنده مسابقه\nDouble Chance|شانس دوبرابر\nDraw No Bet|مساوی بدون شرط\nBoth Teams To Score|گل‌زنی هر دو تیم\nCorrect Score|نتیجه دقیق\nTotal Goals|مجموع گل‌ها\nTotal Points|مجموع امتیازها\nTotal Games|مجموع گیم‌ها\nTotal Runs|مجموع ران‌ها\nGoals|گل‌ها\nGoal|گل\nPoints|امتیازها\nRuns|ران‌ها\nSet|ست\nSets|ست‌ها\nGame|گیم\nGames|گیم‌ها\nCorners|کرنرها\nCorner|کرنر\nCards|کارت‌ها\nCard|کارت\nYellow Cards|کارت‌های زرد\nRed Cards|کارت‌های قرمز\nShots|شوت‌ها\nShots on target|شوت در چارچوب\nOffsides|آفسایدها\nFouls|خطاها\nPossession|مالکیت توپ\nPasses|پاس‌ها\nSaves|مهارها\nHandicap|هندیکپ\nAsian Handicap|هندیکپ آسیایی\nAlternate Asian Handicap|هندیکپ آسیایی جایگزین\nPoint Spread|هندیکپ امتیازی\nGoal Handicap|هندیکپ گل\nGame Handicap|هندیکپ گیم\nSet Handicap|هندیکپ ست\nPuck Line|هندیکپ هاکی\nRun Line|هندیکپ ران\nOver|بالای\nUnder|زیر\nYes|بله\nNo|خیر\nOther|سایر\nRegular time|وقت قانونی\nPenalties|پنالتی‌ها\nQuarter|کوارتر\nQuarters|کوارترها\nPeriod|دوره\nPeriods|دوره‌ها\nRound|راند\nRounds|راندها\nInnings|اینینگ‌ها\nTo Qualify|صعود\nFight Winner|برنده مبارزه\nMethod|روش\nVAR|کمک‌داور ویدئویی\nFootball|فوتبال\nSoccer|فوتبال\nBasketball|بسکتبال\nTennis|تنیس\nVolleyball|والیبال\nIce Hockey|هاکی روی یخ\nTable Tennis|تنیس روی میز\nBaseball|بیسبال\nHandball|هندبال\nBoxing|بوکس\nMMA|هنرهای رزمی ترکیبی\nCricket|کریکت\nEsports|ورزش‌های الکترونیکی\nAmerican Football|فوتبال آمریکایی\nChampions League|لیگ قهرمانان اروپا\nEuropa League|لیگ اروپا\nPremier League|لیگ برتر انگلیس\nLa Liga|لالیگا\nLaLiga|لالیگا\nBundesliga|بوندس‌لیگا\nSerie A|سری آ\nLigue 1|لیگ یک فرانسه\nWorld Cup|جام جهانی\nInternational|بین‌المللی\nEurope|اروپا\nAsia|آسیا\nAfrica|آفریقا\nEngland|انگلیس\nIran|ایران\nSpain|اسپانیا\nFrance|فرانسه\nGermany|آلمان\nItaly|ایتالیا\nPortugal|پرتغال\nTurkey|ترکیه\nNetherlands|هلند\nBrazil|برزیل\nArgentina|آرژانتین\nUSA|آمریکا\nUnited States|ایالات متحده آمریکا\nSaudi Arabia|عربستان سعودی\nUnited Arab Emirates|امارات متحده عربی\nRussia|روسیه\nGreece|یونان\nBelgium|بلژیک\nSwitzerland|سوئیس\nAustria|اتریش\nSweden|سوئد\nNorway|نروژ\nDenmark|دانمارک\nAustralia|استرالیا\nCanada|کانادا\nJapan|ژاپن\nSouth Korea|کره جنوبی\nChina|چین\nMexico|مکزیک\nColombia|کلمبیا\nUruguay|اروگوئه\nChile|شیلی\nPeru|پرو\nEcuador|اکوادور\nUkraine|اوکراین\nPoland|لهستان\nCroatia|کرواسی\nSerbia|صربستان\nScotland|اسکاتلند\nWales|ولز\nIreland|ایرلند\nFinland|فنلاند\nAzerbaijan|آذربایجان\nArmenia|ارمنستان\nGeorgia|گرجستان\nUzbekistan|ازبکستان\nQatar|قطر\nBahrain|بحرین\nOman|عمان\nKuwait|کویت\nIraq|عراق\nAfghanistan|افغانستان\nPakistan|پاکستان\nIndia|هند\nEgypt|مصر\nMorocco|مراکش\nNigeria|نیجریه\nSouth Africa|آفریقای جنوبی\nNew Zealand|نیوزیلند\nIndonesia|اندونزی\nMalaysia|مالزی\nThailand|تایلند\nVietnam|ویتنام\nNotifications|اعلان‌ها\nNotification|اعلان\nNo notifications|اعلانی وجود ندارد\nMark all as read|علامت‌گذاری همه به‌عنوان خوانده‌شده\nRead|خوانده‌شده\nUnread|خوانده‌نشده\nRecent activity|فعالیت‌های اخیر\nSupport|پشتیبانی\nHelp|راهنما\nHelp center|مرکز راهنما\nHelp & Support|راهنما و پشتیبانی\n24/7 Support|پشتیبانی شبانه‌روزی\n24/7 Live Chat|گفت‌وگوی زنده شبانه‌روزی\nSend message|ارسال پیام\nSend|ارسال\nMessage|پیام\nMessages|پیام‌ها\nSubject|موضوع\nDescription|توضیحات\nPriority|اولویت\nNew ticket|تیکت جدید\nCreate ticket|ایجاد تیکت\nMy tickets|تیکت‌های من\nTicket|تیکت\nTickets|تیکت‌ها\nWaiting for support|در انتظار پشتیبانی\nResolved|حل‌شده\nReopen|بازگشایی\nOpen ticket|تیکت باز\nSecurity|امنیت\nPrivacy|حریم خصوصی\nPrivacy Policy|سیاست حفظ حریم خصوصی\nTerms & Conditions|قوانین و شرایط\nResponsible Gaming|بازی مسئولانه\nBonuses|بونوس‌ها\nBonus|بونوس\nPromotions|پیشنهادهای ویژه\nPromotion|پیشنهاد ویژه\nRewards|پاداش‌ها\nReward|پاداش\nLoyalty Program|برنامه وفاداری\nVIP Club|باشگاه VIP\nVIP Loyalty Program|برنامه وفاداری VIP\nPoints|امتیازها\nReferral|معرفی\nReferral code|کد معرف\nReferral link|لینک معرفی\nReferrals|زیرمجموعه‌ها\nAffiliate|همکاری در فروش\nAffiliate program|برنامه همکاری\nAffiliate dashboard|داشبورد همکاری\nCommission|کمیسیون\nEarnings|درآمد\nPayouts|پرداخت‌ها\nPayout|پرداخت\nRequest payout|درخواست پرداخت\nPartner|همکار\nInvite friends|دعوت از دوستان\nCopy|کپی\nCopied|کپی شد\nCopy link|کپی لینک\nGift code|کد هدیه\nDashboard|داشبورد\nAdmin Panel|پنل مدیریت\nUsers|کاربران\nUser|کاربر\nManage users|مدیریت کاربران\nPayments|پرداخت‌ها\nReports|گزارش‌ها\nReport|گزارش\nAudit log|گزارش ممیزی\nRoles|نقش‌ها\nPermissions|مجوزها\nRisk|ریسک\nRisk rules|قوانین ریسک\nSettlements|تسویه‌ها\nSettlement|تسویه\nProviders|ارائه‌دهندگان\nProvider|ارائه‌دهنده\nOperations|عملیات\nWorkers|پردازشگرها\nJobs|وظایف\nHealth|سلامت سامانه\nSystem health|سلامت سامانه\nReconciliation|تطبیق حساب‌ها\nLogs|لاگ‌ها\nConfiguration|پیکربندی\nEnabled|فعال\nDisabled|غیرفعال\nActive|فعال\nInactive|غیرفعال\nApproved|تأییدشده\nRejected|ردشده\nFailed|ناموفق\nSuccess|موفق\nCompleted|تکمیل‌شده\nProcessing|در حال پردازش\nLoading|در حال بارگذاری\nLoading...|در حال بارگذاری...\nLoading…|در حال بارگذاری…\nSaving|در حال ذخیره\nSaving...|در حال ذخیره...\nUpdating|در حال به‌روزرسانی\nTry again|دوباره تلاش کنید\nNo results found|نتیجه‌ای پیدا نشد\nNo data available|داده‌ای در دسترس نیست\nNo matches found|مسابقه‌ای پیدا نشد\nNo matches available|مسابقه‌ای در دسترس نیست\nNo live matches|مسابقه زنده‌ای وجود ندارد\nSomething went wrong|مشکلی پیش آمد\nAn error occurred|خطایی رخ داد\nPlease try again later.|لطفاً بعداً دوباره تلاش کنید.\nCheck your connection|اتصال اینترنت را بررسی کنید\nConnection lost|اتصال قطع شد\nYou are offline|شما آفلاین هستید\nMaintenance mode|حالت تعمیر و نگهداری\n";
const extraPhrasePairs: string = "\nLive now|هم‌اکنون زنده\nTop Bets|شرط‌های برتر\nSports navigation|ناوبری ورزش‌ها\nSecure|امن\nLedger|دفتر حساب\nstarts here|از اینجا شروع می‌شود\nJoin NOVA today|همین امروز به BetVima بپیوندید\nFast registration, secure betting and a better experience.|ثبت‌نام سریع، شرط‌بندی امن و تجربه‌ای بهتر.\nPick a match, choose your odds and your bets will appear here.|یک مسابقه و ضریب انتخاب کنید تا شرط‌های شما اینجا نمایش داده شوند.\nWide range|تنوع گسترده\nof markets|از بازارها\nReal-time|لحظه‌ای\nodds|ضرایب\nFast and secure|سریع و امن\nsettlements|تسویه‌ها\nLanguage & Preferences|زبان و تنظیمات\nLanguage and help|زبان و راهنما\nNo recent transactions|تراکنش جدیدی وجود ندارد\nHelp & Contact|راهنما و تماس\nIRR — Iranian Rial|ریال ایران\nUSD — US Dollar ($)|دلار آمریکا ($)\nEUR — Euro (€)|یورو (€)\nGBP — British Pound (£)|پوند انگلیس (£)\nBet Slip|برگه شرط\nShare bet slip|اشتراک‌گذاری برگه شرط\nAnyone with this code can load the current selections and latest available odds.|با این کد می‌توان انتخاب‌های فعلی و آخرین ضرایب موجود را بازیابی کرد.\nMain Account|حساب اصلی\nBonus requirements|شرایط بونوس\nOpen Bet Slip|بازکردن برگه شرط\nBet code|کد شرط\nSelect bonus|انتخاب بونوس\nBet amount|مبلغ شرط\nNOVA Admin|مدیریت BetVima\nSite|سایت\nNOVA SUPPORT|پشتیبانی BetVima\nChat with the BetVima support team.|با تیم پشتیبانی BetVima گفتگو کنید.\nONLINE|آنلاین\nStart a new chat|شروع گفت‌وگوی جدید\nStart chat|شروع گفتگو\nYour conversations|گفتگوهای شما\nNo conversations yet.|هنوز گفتگویی وجود ندارد.\nYour support chat|گفتگوی پشتیبانی شما\nStart a conversation with NOVA support.|گفتگو با پشتیبانی BetVima را آغاز کنید.\nHelp Centre|مرکز راهنما\nNo messages yet.|هنوز پیامی وجود ندارد.\nThis conversation is closed.|این گفتگو بسته شده است.\nAttach|پیوست\nHow can we help?|چطور می‌توانیم کمکتان کنیم؟\nWrite a message...|پیام خود را بنویسید...\nBETVIMA AFFILIATE|همکاری BetVima\nTurn your network into|شبکه ارتباطی خود را به\nreal income|درآمد واقعی تبدیل کنید\nShare your referral link, bring new players to NOVA and earn from their settled net results.|لینک معرفی خود را به اشتراک بگذارید، کاربران جدید دعوت کنید و از نتایج خالص تسویه‌شده آن‌ها درآمد کسب کنید.\nUSD settlement|تسویه دلاری\nCommission rate|نرخ کمیسیون\nPROFIT / LOSS SHARE|سهم سود و زیان\nYour referral link|لینک معرفی شما\nShare|اشتراک‌گذاری\nKey performance|شاخص‌های کلیدی\nAll referred players|همه کاربران معرفی‌شده\nLIVE DATA|داده زنده\nCommission performance|عملکرد کمیسیون\nDaily settled commission|کمیسیون تسویه‌شده روزانه\nAcquisition funnel|قیف جذب کاربر\nSelected period|بازه انتخاب‌شده\nReferred players|کاربران معرفی‌شده\nRecent players acquired through your network|کاربران تازه جذب‌شده از طریق شبکه شما\nPlayer|بازیکن\nWithdrawal|برداشت\nTurnover|گردش مالی\nYour 70%|سهم ۷۰ درصدی شما\nNo referred players yet.|هنوز زیرمجموعه‌ای ندارید.\nBalance & settlement|موجودی و تسویه\nYour current commission balance and next settlement window.|موجودی کمیسیون فعلی و بازه تسویه بعدی شما.\nUSD SETTLEMENT|تسویه دلاری\nBonus balance|موجودی بونوس\nmore play.|بازی بیشتر.\nRefresh bonuses|تازه‌سازی بونوس‌ها\nVIP LOYALTY|وفاداری VIP\nVIP Loyalty Program|برنامه وفاداری VIP\nHigher level —|سطح بالاتر —\nbigger rewards|پاداش‌های بیشتر\nParticipate|شرکت\nHow it works|نحوه کار\nLevels and Rewards|سطوح و پاداش‌ها\nTurnover amount|مبلغ گردش\nJoin VIP Club|عضویت در باشگاه VIP\nReach Gold 3 and unlock unique VIP privileges|به سطح طلایی ۳ برسید و امکانات ویژه VIP را فعال کنید\nLearn more|بیشتر بدانید\nQuestions & Answers|پرسش‌ها و پاسخ‌ها\nTerms of Use.|شرایط استفاده.\nTerms of Use|شرایط استفاده\nBets.|شرط‌ها.\nSettlement.|تسویه.\nFinancial matters.|موضوعات مالی.\nErrors.|خطاها.\nData minimisation.|حداقل‌سازی داده‌ها.\nPayment data.|داده‌های پرداخت.\nYour controls.|اختیارات شما.\nPrivacy policy|سیاست حفظ حریم خصوصی\nPrivacy policy.|سیاست حفظ حریم خصوصی.\n1st Half Total Goals|مجموع گل‌های نیمه اول\n2nd Half Total Goals|مجموع گل‌های نیمه دوم\nFirst Half Winner|برنده نیمه اول\nSecond Half Winner|برنده نیمه دوم\nGoals Over/Under|مجموع گل‌های بالاتر/پایین‌تر\nAsian Total|مجموع آسیایی\nTotal Corners|مجموع کرنرها\nTotal Cards|مجموع کارت‌ها\nPlayer Shots|شوت‌های بازیکن\nPlayer to Score|گل‌زنی بازیکن\nAnytime Goalscorer|گل‌زن در هر زمان\nLast Goalscorer|آخرین گل‌زن\nFirst Goalscorer|اولین گل‌زن\nHalf Time Result|نتیجه نیمه اول\nTotal Goals - 1st Half|مجموع گل‌های نیمه اول\nGoal Kicks|ضربات دروازه\nThrow Ins|اوت دستی\nFree Kicks|ضربات آزاد\nBoth Teams To Score - 1st Half|گل‌زنی هر دو تیم در نیمه اول\nCorrect Score - 1st Half|نتیجه دقیق نیمه اول\nDouble Chance - 1st Half|شانس دوبرابر نیمه اول\n";
const supplementalPairs: string = "\nSign in to view your bets|برای دیدن شرط‌های خود وارد شوید\nYour betting journey|مسیر شرط‌بندی شما\nLog in to view your active bets, follow live results and check your complete betting history.|وارد شوید تا شرط‌های فعال، نتایج زنده و تاریخچه کامل شرط‌هایتان را ببینید.\nNo bets yet|هنوز شرطی ثبت نشده است\nYou haven&apos;t placed your first bet yet.|هنوز اولین شرط خود را ثبت نکرده‌اید.\nExplore sports|مشاهده ورزش‌ها\nView live matches|مشاهده مسابقات زنده\nTrack your bets|پیگیری شرط‌ها\nLive updates|به‌روزرسانی زنده\nFull history|تاریخچه کامل\nGet notified|دریافت اعلان\nQR PREVIEW|پیش‌نمایش QR\nHot Voucher|هات ووچر\nDate range|بازه زمانی\nLast 30 days|۳۰ روز گذشته\nLast 90 days|۹۰ روز گذشته\nAll time|تمام دوره\nUnable to load summary|بارگذاری خلاصه ممکن نشد\nCould not create this gift code.|ساخت این کد هدیه ممکن نشد.\nAll live matches|همه مسابقات زنده\nLive match center|مرکز مسابقه زنده\nLive pressure|فشار زنده بازی\nATTACK MOMENTUM|روند حملات\nOn target|در چارچوب\nLatest event|آخرین رویداد\nLive analytics|تحلیل زنده\nMatch statistics|آمار مسابقه\nYellow cards|کارت‌های زرد\nRed cards|کارت‌های قرمز\nData source|منبع داده\nMatch timeline|خط زمانی مسابقه\nLive events|رویدادهای زنده\nNo live events yet|هنوز رویداد زنده‌ای ثبت نشده است\nEvents will appear here as the live provider reports them.|به‌محض دریافت گزارش از ارائه‌دهنده، رویدادهای بازی اینجا نمایش داده می‌شوند.\nDangerous attacks|حملات خطرناک\nShots on target|شوت‌های در چارچوب\nShots off target|شوت‌های بیرون چارچوب\nPrevious match panel|پنل مسابقه قبلی\nNext match panel|پنل مسابقه بعدی\nNo odds available|ضریبی در دسترس نیست\nNo betting markets available|بازار شرط‌بندی در دسترس نیست\nNo markets available in this category|در این دسته بازاری در دسترس نیست\nSelect another market category.|دسته دیگری را انتخاب کنید.\nSelect an outcome|یک نتیجه انتخاب کنید\nto place a bet|برای ثبت شرط\nView bet|مشاهده شرط\nBetting account|حساب شرط‌بندی\nUse your cash balance|استفاده از موجودی نقدی\nBonus Account|حساب بونوس\nNo active bonus is available for this currency.|برای این ارز بونوس فعالی وجود ندارد.\nPossible win|برد احتمالی\nUnable to create bet slip code|ساخت کد برگه شرط ممکن نشد\nUnable to load bet slip code|بارگذاری کد برگه شرط ممکن نشد\nAffiliates & risk|همکاران و ریسک\nNo jobs recorded yet.|هنوز وظیفه‌ای ثبت نشده است.\nNo worker heartbeat yet — start a worker process to see it here.|هنوز سیگنال فعالیتی از پردازشگر دریافت نشده است.\nOpen bets|شرط‌های باز\nAverage stake|میانگین مبلغ شرط\nCustomer balance liability|تعهد موجودی مشتریان\nPending withdrawals|برداشت‌های در انتظار\nActive affiliates|همکاران فعال\nCommission (period)|کمیسیون دوره\nAffiliate payable|کمیسیون قابل پرداخت\nPayouts pending|پرداخت‌های در انتظار\nFlagged affiliates|همکاران علامت‌گذاری‌شده\nManual review bets|شرط‌های در بررسی دستی\nFailed webhooks|وب‌هوک‌های ناموفق\nSettlement backlog|صف تسویه\nWorkers & jobs|پردازشگرها و وظایف\nLive Support|پشتیبانی زنده\nWallet adjustments|اصلاحات کیف پول\nMatches & results|مسابقات و نتایج\nRisk decisions|تصمیم‌های ریسک\nFraud flags|پرچم‌های تقلب\nKill switches|کلیدهای توقف اضطراری\nAll statuses|همه وضعیت‌ها\nAny KYC|هر وضعیت احراز هویت\nAny status|هر وضعیتی\nAny type|هر نوع\nBets on page|شرط‌های صفحه\nOpen bet amount (page)|مبلغ شرط‌های باز (صفحه)\nOpen liability (page)|تعهد باز (صفحه)\nSearch by bet id, user, match or selection|جستجو با شناسه شرط، کاربر، مسابقه یا انتخاب\nUnable to load support.|بارگذاری پشتیبانی ممکن نشد.\nUnable to load conversation.|بارگذاری گفتگو ممکن نشد.\nUnable to create conversation.|ایجاد گفتگو ممکن نشد.\nUnable to send message.|ارسال پیام ممکن نشد.\nUnable to close conversation.|بستن گفتگو ممکن نشد.\nBetting is entertainment, not income. Set limits before you play and never bet money you cannot afford to lose.|شرط‌بندی سرگرمی است، نه راه کسب درآمد. پیش از بازی محدودیت تعیین کنید و هرگز بیشتر از توان مالی خود شرط نبندید.\nDaily and weekly loss limits, deposit limits, stake caps and session timers are available in your account.|محدودیت زیان روزانه و هفتگی، سقف واریز و شرط و زمان جلسه در حساب شما در دسترس است.\nResponsible gaming|بازی مسئولانه\nResponsible Gaming|بازی مسئولانه\nLeague Winner|قهرمان لیگ\nLeague Championship|قهرمانی لیگ\n1X2|برد، مساوی، باخت\nHome Win|برد میزبان\nAway Win|برد میهمان\nBoth teams to score|گل‌زنی هر دو تیم\nDraw No Bet - Home|مساوی بدون شرط - میزبان\nDraw No Bet - Away|مساوی بدون شرط - میهمان\nFirst Team to Score|تیم زننده گل اول\nSecond Team to Score|تیم زننده گل دوم\nTotal|مجموع\nTotal Over|مجموع بالای\nTotal Under|مجموع زیر\nTotal Shots|مجموع شوت‌ها\nGoal Scorers|گل‌زنان\nScore at Half Time|نتیجه نیمه اول\nMatch Highlights|خلاصه مسابقه\nUpcoming Matches|مسابقات آینده\nRecent Matches|مسابقات اخیر\nTop Matches|بازی‌های برتر\nNext match|بازی بعدی\nPrevious match|بازی قبلی\nKick-off|زمان شروع\nNo upcoming matches|مسابقه آینده‌ای وجود ندارد\n";
const finalPhrasePairs: string = "\nPrimary referral link|لینک معرفی اصلی\nBetVima App download|دانلود اپلیکیشن BetVima\nDownload App|دانلود اپلیکیشن\nCampaign|کمپین\nSource|منبع\nClicks|کلیک‌ها\nCreate referral link|ساخت لینک معرفی\nGenerate a campaign link in seconds.|در چند ثانیه یک لینک کمپین بسازید.\nMedium|رسانه\nLanding path|مسیر صفحه فرود\nAffiliate Login|ورود همکاران\nSign in to your independent BetVima Affiliate account.|به حساب مستقل همکاری BetVima خود وارد شوید.\nReset your Affiliate password|بازنشانی رمز عبور همکاری\nBack to Affiliate Login|بازگشت به ورود همکاران\nForgot password?|رمز عبور را فراموش کرده‌اید؟\nCreate one|ایجاد حساب\nAffiliate Email|ایمیل همکاری\nYour password|رمز عبور شما\ndual approval|تأیید دو مرحله‌ای\nWithdrawal wallets|کیف پول‌های برداشت\nYour crypto addresses|آدرس‌های رمزارز شما\nSave the address for each network you want to use. Payouts are reviewed and paid manually.|آدرس هر شبکه موردنظر را ذخیره کنید. پرداخت‌ها بررسی شده و به‌صورت دستی انجام می‌شوند.\nCrypto payout|پرداخت رمزارزی\nWithdraw your commission|برداشت کمیسیون\nUSD settlement · Manual crypto payout|تسویه دلاری · پرداخت رمزارزی دستی\nPayout destination|مقصد پرداخت\nWithdrawal network|شبکه برداشت\nReferral network|شبکه زیرمجموعه‌ها\nStart building your network|ساخت شبکه خود را شروع کنید\nShare your referral link and bring new players to NOVA. Your commission is calculated from the referred players’ settled profit and loss.|لینک معرفی خود را به اشتراک بگذارید و کاربران جدید جذب کنید. کمیسیون شما براساس سود و زیان تسویه‌شده زیرمجموعه‌ها محاسبه می‌شود.\nCreate a campaign link and start sharing it with your audience.|یک لینک کمپین بسازید و با مخاطبان خود به اشتراک بگذارید.\nBack to dashboard|بازگشت به داشبورد\nFraud signals|نشانه‌های تقلب\nFlags are reviewed by the affiliate team. Commission is never confiscated automatically.|موارد علامت‌گذاری‌شده توسط تیم همکاری بررسی می‌شوند و کمیسیون هرگز به‌صورت خودکار ضبط نمی‌شود.\nRisk score|امتیاز ریسک\nSignals|نشانه‌ها\nEarn 70% commission|۷۰٪ کمیسیون دریافت کنید\nProfit / Loss|سود / زیان\nCreate your Affiliate account|حساب همکاری خود را بسازید\nWeekly settlement|تسویه هفتگی\nAffiliate earnings follow the existing NOVA settlement rules.|درآمد همکاری تابع قوانین فعلی تسویه BetVima است.\nAffiliate earnings and payouts are settled in USD.|درآمد و پرداخت‌های همکاری با دلار آمریکا تسویه می‌شوند.\nAt least 5 active referred users are required each week.|در هر هفته حداقل ۵ کاربر معرفی‌شده فعال لازم است.\nWeekly payout eligibility starts at $40 commission.|حداقل کمیسیون لازم برای پرداخت هفتگی ۴۰ دلار است.\nMinimum 8 characters|حداقل ۸ کاراکتر\nPayout Account ID|شناسه حساب دریافت وجه\nYour payout account ID|شناسه حساب دریافت وجه شما\nDeposit Bonus|بونوس واریز\nBonus amount|مبلغ بونوس\nRemaining|باقی‌مانده\nBonus balance|موجودی بونوس\nGranted|اعطاشده\nValidity|اعتبار\nUse your bonus before the timer reaches zero.|پیش از پایان زمان، از بونوس خود استفاده کنید.\nThis bonus was used and did not qualify for a Main Account reward.|این بونوس استفاده شده اما شرایط پاداش حساب اصلی را نداشته است.\nThis bonus expired before it was successfully used.|اعتبار این بونوس پیش از استفاده موفق به پایان رسید.\nNOVA Rewards|پاداش‌های BetVima\nMake a Deposit|واریز کنید\nBonus Overview|نمای کلی بونوس\nLocked|قفل‌شده\nTotal bonuses|مجموع بونوس‌ها\nAvailable Bonuses|بونوس‌های در دسترس\nYour active rewards and their remaining validity.|پاداش‌های فعال شما و مدت اعتبار باقی‌مانده آن‌ها.\nLoading your bonuses...|در حال بارگذاری بونوس‌های شما...\nNo active bonuses|بونوس فعالی وجود ندارد\nGo to Wallet|رفتن به کیف پول\nBonus History|تاریخچه بونوس\nCompleted, expired and cancelled bonuses.|بونوس‌های تکمیل‌شده، منقضی‌شده و لغوشده.\nDeposit bonus|بونوس واریز\nHow Bonuses Work|بونوس‌ها چگونه کار می‌کنند\nEverything you need to know about your NOVA deposit bonus.|هرآنچه باید درباره بونوس واریز BetVima بدانید.\nNeed help with your bonus?|درباره بونوس به کمک نیاز دارید؟\nOur support team is available whenever you need assistance.|تیم پشتیبانی هر زمان به کمک نیاز داشته باشید در دسترس است.\nType at least 2 characters|حداقل ۲ کاراکتر وارد کنید\nPopular Leagues|لیگ‌های محبوب\nMost followed leagues right now|محبوب‌ترین لیگ‌ها در حال حاضر\nManage your account|مدیریت حساب کاربری\nGet help anytime|هر زمان کمک بگیرید\nFooter language|زبان فوتر\nBetVima site footer|پانوشت سایت BetVima\nFeatured football clubs|باشگاه‌های فوتبال منتخب\nAccount and partners|حساب کاربری و همکاران\nExplore BetVima|مشاهده BetVima\nBetVima home|صفحه اصلی BetVima\nAccount currency:|ارز حساب:\nObvious pricing or settlement errors may be corrected with the correction documented; no silent edits are made to settled records.|خطاهای آشکار قیمت‌گذاری یا تسویه ممکن است با ثبت مستند اصلاح شوند؛ سوابق تسویه‌شده بدون ثبت تغییر نمی‌کنند.\nIP addresses and device strings are never stored in raw form: the platform stores salted hashes used only for fraud and referral-integrity checks.|نشانی IP و اطلاعات دستگاه به‌صورت خام ذخیره نمی‌شوند؛ سامانه فقط هش‌های نمک‌گذاری‌شده را برای بررسی تقلب و یکپارچگی معرفی‌ها نگه می‌دارد.\nCard and bank details are handled by the payment provider. Only a masked destination is stored for payouts and support.|اطلاعات کارت و حساب بانکی توسط ارائه‌دهنده پرداخت مدیریت می‌شود؛ فقط مقصد پوشانده‌شده برای پرداخت و پشتیبانی ذخیره می‌گردد.\nFinancial records are append-only for legal and audit reasons; a correction is a new entry, never an overwrite.|سوابق مالی برای الزامات قانونی و حسابرسی فقط افزایشی‌اند؛ هر اصلاح یک رکورد جدید است و سوابق قبلی بازنویسی نمی‌شوند.\nYou can review your profile, limits and verification status in the account area, and request deletion of non-financial personal data subject to regulatory retention.|می‌توانید پروفایل، محدودیت‌ها و وضعیت احراز هویت خود را در حساب کاربری بررسی کنید و حذف داده‌های شخصی غیرمالی را با رعایت الزامات قانونی درخواست دهید.\nWhat we store and why|چه داده‌هایی و چرا ذخیره می‌کنیم\nNo data available.|داده‌ای در دسترس نیست.\nCheck back shortly for new events.|به‌زودی برای دیدن رویدادهای جدید بازگردید.\nNo esports events available.|رویدادی در ورزش‌های الکترونیکی در دسترس نیست.\nOdds currently unavailable|ضرایب فعلاً در دسترس نیست\nSportsbook|شرط‌بندی ورزشی\nComing soon|به‌زودی\nToday's matches|مسابقات امروز\nTop Bets|شرط‌های برتر\nFull Time Result|نتیجه پایان بازی\nLeague Tables|جدول لیگ‌ها\nLatest News|آخرین اخبار\nView details|مشاهده جزئیات\nOpen event|بازکردن رویداد\nYour active bets|شرط‌های فعال شما\nYour bet history|تاریخچه شرط‌های شما\nAll bets|همه شرط‌ها\nNo recent matches|مسابقه اخیری وجود ندارد\nLive commentary|گزارش زنده\nExtra time|وقت اضافه\nEnd of Match|پایان مسابقه\nHalftime|پایان نیمه اول\nKick-off|شروع بازی\nPlayer stats|آمار بازیکن\nPlayer statistics|آمار بازیکن\nLive odds|ضرایب زنده\nUpcoming odds|ضرایب مسابقات آینده\n";
const additionalSportsPairs: string = "\nCelta Vigo|سلتاویگو\nSalzburg|سالزبورگ\nTSG Hoffenheim|هوفنهایم\nBesiktas JK|بشیکتاش\nJagiellonia Białystok|یاگیلونیا بیالیستوک\nFC Ararat-Armenia|آرارات ارمنستان\nOlympiakos Piraeus|المپیاکوس\nNEC Nijmegen|نایمخن\nPFC Levski Sofia|لوفسکی صوفیه\nTorreense|تورینسه\nSunderland|ساندرلند\nCrystal Palace|کریستال پالاس\nLech Poznań|لخ پوزنان\nSK Sturm Graz|اشتورم گراتس\nBrighton and Hove Albion|برایتون اند هوو آلبیون\nFK Kauno Žalgiris|ژالگیریس کاوناس\nUnion Saint-Gilloise|یونیون سن ژیلواز\nSaitama Seibu Lions|سایتاما سیبو لاینز\nHokkaido Nippon-Ham Fighters|هوکایدو نیپون هم فایترز\nKia Tigers|کیا تایگرز\nLG Twins|ال‌جی تویینز\nSamsung Lions|سامسونگ لاینز\nKT Wiz|کی‌تی ویز\nDoosan Bears|دوسان بیرز\nLotte Giants|لوته جاینتز\nSan Antonio Spurs|سن آنتونیو اسپرز\nMinnesota Timberwolves|مینه‌سوتا تیمبرولوز\nOman|عمان\nNepal|نپال\nUEFA Europa Conference League|لیگ کنفرانس اروپا\nOne Day Internationals|مسابقات بین‌المللی یک‌روزه\nEredivisie|اردیویسه هلند\nLiga Portugal|لیگ پرتغال\nMLS|لیگ آمریکا\nNHL|لیگ هاکی آمریکای شمالی\nNPB|لیگ بیسبال ژاپن\nKBO|لیگ بیسبال کره جنوبی\nNBA|ان‌بی‌ای\nMan United|منچستر یونایتد\n";
const adminPhrasePairs: string = "\nDependency checks|بررسی وابستگی‌ها\nCheck time|زمان بررسی\nA degraded state is reported honestly: unavailable providers show as degraded, never as healthy.|وضعیت نامطلوب به‌صورت واقعی گزارش می‌شود؛ ارائه‌دهندگان غیرفعال هرگز سالم نمایش داده نمی‌شوند.\nAny model|هر مدلی\nFlagged only|فقط موارد علامت‌گذاری‌شده\nSearch code, name or email|جستجوی کد، نام یا ایمیل\nAny direction|هر جهت\nDirection|جهت\nReference|شناسه مرجع\nProvider ref|مرجع ارائه‌دهنده\nNo payment intents.|درخواست پرداختی وجود ندارد.\nFinancial summary|خلاصه مالی\nGross gaming revenue|درآمد ناخالص بازی\nNet cash movement|گردش خالص نقدی\nOpen bet liability|تعهد شرط‌های باز\nAffiliate commission|کمیسیون همکاران\nAffiliate payable (all time)|کمیسیون قابل پرداخت همکاران (کل دوره)\nControl status|وضعیت کنترل‌ها\nFailed webhooks:|وب‌هوک‌های ناموفق:\nManual review bets:|شرط‌های در بررسی دستی:\nFlagged affiliates:|همکاران علامت‌گذاری‌شده:\nAdmin password reset|بازنشانی رمز عبور از پنل مدیریت\nChanges the Supabase Auth password. The new password is never logged.|رمز عبور احراز هویت Supabase تغییر می‌کند؛ رمز جدید هرگز در لاگ ثبت نمی‌شود.\nActive restrictions|محدودیت‌های فعال\nOperator notes|یادداشت‌های مدیر\nNo notes.|یادداشتی وجود ندارد.\nAmount Bet|مبلغ شرط‌بندی‌شده\nBalance after transaction|موجودی پس از تراکنش\nNo wallet movements.|تراکنشی در کیف پول وجود ندارد.\nNo payments.|پرداختی وجود ندارد.\nStake and loss limits (minor units)|سقف شرط و زیان (واحد خرد)\nSave limits|ذخیره محدودیت‌ها\nOpen Wallet adjustments|بازکردن اصلاحات کیف پول\nNo restrictions|محدودیتی وجود ندارد\nAdd an internal note (audited)|افزودن یادداشت داخلی (دارای ثبت حسابرسی)\nOperation|عملیات\nDescription|توضیحات\nNo operations registered.|عملیاتی ثبت نشده است.\nActive kill switches|کلیدهای توقف اضطراری فعال\nActivated|فعال‌شده\nNo kill switch has ever been activated.|هیچ کلید توقف اضطراری‌ای فعال نشده است.\nAll categories|همه دسته‌ها\nAll priorities|همه اولویت‌ها\nCustomer conversations|گفتگوهای مشتریان\nLoading conversations…|در حال بارگذاری گفتگوها…\nNo support tickets found.|تیکت پشتیبانی پیدا نشد.\nSelect a conversation|یک گفتگو انتخاب کنید\nChoose a customer ticket to view and reply.|برای مشاهده و پاسخ‌دادن، تیکت یک مشتری را انتخاب کنید.\nLoading conversation…|در حال بارگذاری گفتگو…\nUnassigned|اختصاص‌نیافته\nNo messages.|پیامی وجود ندارد.\nThis ticket is closed. Change the status above before replying.|این تیکت بسته است. پیش از پاسخ، وضعیت آن را در بالا تغییر دهید.\nTicket unavailable.|تیکت در دسترس نیست.\nSearch subject, email, user ID...|جستجوی موضوع، ایمیل یا شناسه کاربر...\nTicket status|وضعیت تیکت\nTicket priority|اولویت تیکت\nTicket category|دسته تیکت\nSupport agent UUID (optional)|شناسه کارشناس پشتیبانی (اختیاری)\nAssigned support agent|کارشناس پشتیبانی تخصیص‌یافته\nWrite a reply to the customer…|پاسخ خود به مشتری را بنویسید…\nConfigured integrations|اتصال‌های پیکربندی‌شده\nReachable|قابل دسترس\nRequired env|متغیر محیطی ضروری\nProvider health log|گزارش سلامت ارائه‌دهنده\nLast success|آخرین موفقیت\nLast error|آخرین خطا\nNo provider calls recorded|فراخوانی‌ای برای ارائه‌دهنده ثبت نشده است\nThreshold|آستانه\nNo rules configured.|قانونی پیکربندی نشده است.\nAdd a rule|افزودن قانون\nService health|سلامت سرویس\nRefresh status|تازه‌سازی وضعیت\nLast updated|آخرین به‌روزرسانی\nAt a glance|در یک نگاه\nOverview|نمای کلی\nNew users|کاربران جدید\nActive users|کاربران فعال\nTotal users|کل کاربران\nDaily active users|کاربران فعال روزانه\nNet profit|سود خالص\nNet loss|زیان خالص\nProfit / loss|سود / زیان\nHigh risk|ریسک بالا\nLow risk|ریسک پایین\nMedium risk|ریسک متوسط\nSearch users|جستجوی کاربران\nExport report|خروجی گزارش\nDownload report|دریافت گزارش\nThis month|این ماه\nLast month|ماه گذشته\nLast 7 days|۷ روز گذشته\nLast 24 hours|۲۴ ساعت گذشته\n";
const helpLegalPhrasePairs: string = "\nA summary of the terms governing betting on this site|خلاصه قوانین حاکم بر شرط‌بندی در این سایت\nYou must be at least 18 and legally permitted to bet in your jurisdiction. Accounts are personal and non-transferable.|باید دست‌کم ۱۸ سال داشته باشید و طبق قوانین محل زندگی خود مجاز به شرط‌بندی باشید. حساب‌ها شخصی و غیرقابل انتقال‌اند.\nA bet is accepted only when the server confirms the stake and odds. Odds in the bet slip are provisional until acceptance; if they change, you must explicitly accept the new odds.|شرط فقط پس از تأیید مبلغ و ضریب توسط سرور پذیرفته می‌شود. ضرایب برگه شرط تا زمان پذیرش نهایی قطعی نیستند و در صورت تغییر، باید ضریب جدید را صریحاً بپذیرید.\nEvery balance change is recorded as a ledger transaction and the available balance is updated. Withdrawals are held and verified first; they are marked paid only after an external payment reference is received.|هر تغییر موجودی به‌عنوان تراکنش در دفتر حساب ثبت و موجودی قابل استفاده به‌روز می‌شود. برداشت‌ها ابتدا نگهداری و بررسی می‌شوند و تنها پس از دریافت مرجع پرداخت خارجی، پرداخت‌شده ثبت می‌گردند.\nBets are settled from the authoritative result of each event. If a result is corrected, the previous settlement is reversed and the bet is re-settled - both operations are recorded and visible to you.|شرط‌ها براساس نتیجه معتبر هر رویداد تسویه می‌شوند. اگر نتیجه اصلاح شود، تسویه قبلی برگشت می‌خورد و شرط دوباره تسویه می‌شود؛ هر دو عملیات ثبت می‌شوند و برای شما قابل مشاهده‌اند.\nLimits are enforced by the server for every bet and payment request.|محدودیت‌ها توسط سرور برای هر شرط و درخواست پرداخت اعمال می‌شوند.\nSelf-exclusion immediately blocks betting, deposits and affiliate access for the chosen period.|خودمحروم‌سازی بلافاصله شرط‌بندی، واریز و دسترسی به همکاری را برای مدت انتخاب‌شده مسدود می‌کند.\nIf gambling stops being fun, use self-exclusion and seek local support services.|اگر شرط‌بندی دیگر سرگرم‌کننده نیست، از خودمحروم‌سازی استفاده کنید و از مراکز پشتیبانی محلی کمک بگیرید.\nOnly persons aged 18 and over. Underage betting is prohibited.|فقط افراد ۱۸ سال و بالاتر. شرط‌بندی زیر سن قانونی ممنوع است.\nSupport BETVIMA|پشتیبانی BetVima\nHow can we help?|چگونه می‌توانیم کمک کنیم؟\nFind quick answers to common questions about Account, Payments, Betting, Bonuses and VIP benefits. Need more help? Our Support team is available through online chat.|پاسخ‌های سریع پرسش‌های رایج درباره حساب، پرداخت‌ها، شرط‌بندی، بونوس‌ها و مزایای VIP را پیدا کنید. اگر کمک بیشتری خواستید، تیم پشتیبانی از طریق گفت‌وگوی آنلاین در دسترس است.\nChat with BetVima Support|گفت‌وگو با پشتیبانی BetVima\nHelp Topics|موضوعات راهنما\nChoose a topic to find the information you need.|برای پیدا کردن اطلاعات موردنیاز، موضوعی انتخاب کنید.\nRegister, Login, Profile and Account settings.|ثبت‌نام، ورود، پروفایل و تنظیمات حساب کاربری.\nDeposits, withdrawals, balance and payment status.|واریزها، برداشت‌ها، موجودی و وضعیت پرداخت.\nSports, odds, bets, results and early settlement.|ورزش‌ها، ضرایب، شرط‌ها، نتایج و تسویه زودهنگام.\nBonuses, special offers and the VIP loyalty program.|بونوس‌ها، پیشنهادهای ویژه و برنامه وفاداری VIP.\nHow do I create an account?|چگونه حساب کاربری بسازم؟\nI cannot log in|نمی‌توانم وارد حسابم شوم\nHow do I change my account information?|چطور اطلاعات حسابم را تغییر دهم؟\nHow do I make a deposit?|چگونه واریز کنم؟\nWhere is my withdrawal?|برداشت من کجاست؟\nWhy is my payment pending?|چرا پرداخت من در انتظار است؟\nHow are odds and payouts calculated?|ضرایب و پرداخت‌ها چگونه محاسبه می‌شوند؟\nWhat happens if a result is changed?|اگر نتیجه مسابقه تغییر کند چه می‌شود؟\nHow does early settlement work?|تسویه زودهنگام چگونه کار می‌کند؟\nHow do bonuses work?|بونوس‌ها چگونه کار می‌کنند؟\nHow do I view my VIP level?|چطور سطح VIP خود را ببینم؟\nWhen can my bonus balance be used?|چه زمانی می‌توانم از موجودی بونوس استفاده کنم؟\nFrequently Asked Questions|پرسش‌های متداول\nAnswers to some of the most frequently asked questions.|پاسخ برخی از پرتکرارترین پرسش‌ها.\nHow is my bet payout calculated?|پرداخت شرط من چگونه محاسبه می‌شود؟\nYour payout is calculated based on the bet amount and the odds confirmed when the bet was placed. You can view your bet amount, selections, odds and potential payout in My Bets.|پرداخت شما براساس مبلغ شرط و ضرایب تأییدشده هنگام ثبت شرط محاسبه می‌شود. مبلغ، انتخاب‌ها، ضرایب و پرداخت احتمالی را در بخش شرط‌های من می‌توانید ببینید.\nWhat happens if an official result is corrected?|اگر نتیجه رسمی اصلاح شود چه اتفاقی می‌افتد؟\nIf an official result is changed, the bet is recalculated according to the updated result. Any settlement adjustment is applied to your account and you will be notified.|اگر نتیجه رسمی تغییر کند، شرط براساس نتیجه به‌روزشده دوباره محاسبه می‌شود. هر اصلاح تسویه در حساب شما اعمال می‌شود و اطلاع‌رسانی دریافت می‌کنید.\nIf early settlement is available for an eligible open bet, you can accept the current settlement amount offered. Each settlement offer can only be accepted once.|اگر تسویه زودهنگام برای شرط باز واجد شرایط فعال باشد، می‌توانید مبلغ پیشنهادی فعلی را بپذیرید. هر پیشنهاد تسویه فقط یک‌بار قابل پذیرش است.\nWhy is my deposit or withdrawal pending?|چرا واریز یا برداشت من در انتظار است؟\nProcessing a payment through the selected payment method may take some time. If the status does not change, contact Online Support and provide your transaction details.|پردازش پرداخت با روش انتخابی ممکن است زمان ببرد. اگر وضعیت تغییر نکرد، با پشتیبانی آنلاین تماس بگیرید و جزئیات تراکنش را ارائه دهید.\nBonus eligibility and wagering requirements depend on the specific offer. Open the bonus details in your account to view its terms and current status.|شرایط دریافت بونوس و الزامات گردش شرط به پیشنهاد خاص بستگی دارد. برای مشاهده شرایط و وضعیت فعلی، جزئیات بونوس را در حساب خود باز کنید.\nOnline Support 24/7|پشتیبانی آنلاین شبانه‌روزی\nDid not find your answer?|پاسخ خود را پیدا نکردید؟\nChat with the BetVima Support team. We can help with Account, Payments, Betting and technical issues.|با تیم پشتیبانی BetVima گفتگو کنید. برای حساب، پرداخت‌ها، شرط‌بندی و مسائل فنی کمکتان می‌کنیم.\nOpen Online Chat|بازکردن گفت‌وگوی آنلاین\nHelp Center|مرکز راهنما\n";
const defaultEnglishCorrections: string = "\nDecision|تصمیم\nTotal deposits|مجموع واریزها\nConfirm this fraud flag?|این مورد تقلب تأیید شود؟\nCancel this payout?|این پرداخت لغو شود؟\nOdds at placement|ضریب هنگام ثبت\nReviewing the result reverses the current settlement and settles the bet again. Commission is also reversed. Continue?|بازبینی نتیجه، تسویه فعلی را برمی‌گرداند و شرط را دوباره تسویه می‌کند. کمیسیون نیز برگشت می‌خورد. ادامه می‌دهید؟\nOpen liabilities|تعهدات باز\nManual odds changes|تغییر دستی ضرایب\nCurrent odds|ضریب فعلی\nPrevious|قبلی\nVersion|نسخه\nChange|تغییر\nView metrics JSON|مشاهده JSON شاخص‌ها\nView audit JSON|مشاهده JSON ممیزی\nAll figures are calculated on request from the ledger and settlement tables; they are neither cached nor estimated.|تمام ارقام هنگام درخواست از دفتر حساب و جداول تسویه محاسبه می‌شوند و نه ذخیره موقت شده‌اند و نه تخمینی‌اند.\nVerified users|کاربران تأییدشده\nConfirm Withdrawal authorizes payment execution only. Funds are marked paid after the provider reports a terminal successful payout. Rejected or failed withdrawals release the held wallet balance. Deposits may be reversed only through a new correcting ledger entry.|تأیید برداشت فقط مجوز اجرای پرداخت را صادر می‌کند. وجه پس از اعلام موفقیت قطعی از سوی ارائه‌دهنده، پرداخت‌شده ثبت می‌شود. برداشت‌های ردشده یا ناموفق موجودی مسدودشده را آزاد می‌کنند. واریزها فقط از طریق ثبت اصلاحی جدید در دفتر حساب قابل برگشت‌اند.\nSetting|تنظیم\nValue|مقدار\nUpdated|به‌روزرسانی‌شده\nEstimated deposit amount (toman)|مبلغ تقریبی واریز (تومان)\nEstimated deposit amount (rial)|مبلغ تقریبی واریز (ریال)\nuWallet reference rate:|نرخ مرجع uWallet:\nApproximate equivalent|معادل تقریبی\nLive rate unavailable|نرخ لحظه‌ای در دسترس نیست\nMinimum withdrawal equivalent|معادل حداقل برداشت\nLoading uWallet exchange rate...|در حال دریافت نرخ uWallet...\nVoucher value:|مبلغ ووچر:\nWallet debit:|کسر از کیف پول:\nInvalid amount|مبلغ نامعتبر\nThis is a reference exchange rate; the API currently does not provide separate buy and sell prices.|این نرخ تبدیل مرجع است؛ API فعلاً قیمت خرید و فروش جداگانه ارائه نمی‌کند.\n";
const knownSportsNames: Record<string, string> = {
  "Manchester United": "منچستر یونایتد",
  "Manchester City": "منچستر سیتی",
  "Liverpool": "لیورپول",
  "Arsenal": "آرسنال",
  "Chelsea": "چلسی",
  "Tottenham": "تاتنهام",
  "Tottenham Hotspur": "تاتنهام هاتسپر",
  "Newcastle United": "نیوکاسل یونایتد",
  "Everton": "اورتون",
  "Aston Villa": "استون ویلا",
  "West Ham United": "وستهم یونایتد",
  "Brighton": "برایتون",
  "Nottingham Forest": "ناتینگهام فارست",
  "Leicester City": "لسترسیتی",
  "Wolverhampton": "ولورهمپتون",
  "Bournemouth": "بورنموث",
  "Fulham": "فولام",
  "Real Madrid": "رئال مادرید",
  "Barcelona": "بارسلونا",
  "FC Barcelona": "بارسلونا",
  "Atletico Madrid": "اتلتیکو مادرید",
  "Athletic Bilbao": "اتلتیک بیلبائو",
  "Real Sociedad": "رئال سوسیداد",
  "Real Betis": "رئال بتیس",
  "Sevilla": "سویا",
  "Valencia": "والنسیا",
  "Villarreal": "ویارئال",
  "Girona": "خیرونا",
  "Bayern Munich": "بایرن مونیخ",
  "Borussia Dortmund": "بوروسیا دورتموند",
  "RB Leipzig": "لایپزیگ",
  "Bayer Leverkusen": "بایر لورکوزن",
  "Eintracht Frankfurt": "اینتراخت فرانکفورت",
  "VfB Stuttgart": "اشتوتگارت",
  "AC Milan": "آث میلان",
  "Inter Milan": "اینتر میلان",
  "Inter": "اینتر",
  "Juventus": "یوونتوس",
  "Napoli": "ناپولی",
  "AS Roma": "آاس رم",
  "Roma": "رم",
  "Lazio": "لاتزیو",
  "Atalanta": "آتالانتا",
  "Fiorentina": "فیورنتینا",
  "Bologna": "بولونیا",
  "Paris Saint-Germain": "پاری سن ژرمن",
  "PSG": "پاری سن ژرمن",
  "Marseille": "مارسی",
  "Monaco": "موناکو",
  "Lyon": "لیون",
  "Lille": "لیل",
  "Ajax": "آژاکس",
  "PSV Eindhoven": "آیندهوون",
  "Feyenoord": "فاینورد",
  "Benfica": "بنفیکا",
  "Porto": "پورتو",
  "Sporting CP": "اسپورتینگ لیسبون",
  "Fenerbahce": "فنرباغچه",
  "Galatasaray": "گالاتاسرای",
  "Besiktas": "بشیکتاش",
  "Celtic": "سلتیک",
  "Rangers": "رنجرز",
  "Al Nassr": "النصر",
  "Al Hilal": "الهلال",
  "Al Ittihad": "الاتحاد",
  "Al Ahli": "الاهلی",
  "Persepolis": "پرسپولیس",
  "Perspolis": "پرسپولیس",
  "Esteghlal": "استقلال",
  "Sepahan": "سپاهان",
  "Tractor": "تراکتور",
  "Foolad": "فولاد",
  "Zob Ahan": "ذوب‌آهن",
  "Malavan": "ملوان",
  "Gol Gohar": "گل‌گهر",
  "Shams Azar": "شمس‌آذر",
  "Iran Pro League": "لیگ برتر ایران",
  "Persian Gulf Pro League": "لیگ برتر خلیج فارس",
  "English Premier League": "لیگ برتر انگلیس",
  "UEFA Champions League": "لیگ قهرمانان اروپا",
  "UEFA Europa League": "لیگ اروپا",
  "UEFA Conference League": "لیگ کنفرانس اروپا",
  "AFC Champions League": "لیگ قهرمانان آسیا",
  "Coppa Italia": "جام حذفی ایتالیا",
  "FA Cup": "جام حذفی انگلیس",
  "Copa del Rey": "جام حذفی اسپانیا",
  "DFB Pokal": "جام حذفی آلمان",
  "UEFA Nations League": "لیگ ملت‌های اروپا"
};


const phrases = new Map<string, string>();
const normalize = (s: string) => s.trim().replace(/\s+/g, ' ').replace(/[.!?]+$/, '').toLowerCase();
for (const [key, english] of Object.entries(DICTIONARIES.en)) {
  const persian = DICTIONARIES.fa[key];
  if (persian && persian !== english && /[\u0600-\u06FF]/.test(persian)) phrases.set(normalize(english), persian);
}
for (const line of phrasePairs.split('\n')) {
  const split = line.indexOf('|');
  if (split > 0) phrases.set(normalize(line.slice(0, split)), line.slice(split + 1));
}
for (const line of extraPhrasePairs.split('\n')) { const split = line.indexOf('|'); if (split > 0) phrases.set(normalize(line.slice(0,split)), line.slice(split + 1)); }
for (const line of supplementalPairs.split('\n')) { const split = line.indexOf('|'); if (split > 0) phrases.set(normalize(line.slice(0,split)), line.slice(split + 1)); }
for (const corpus of [finalPhrasePairs, additionalSportsPairs]) {
  for (const line of corpus.split('\n')) {
    const index = line.indexOf('|');
    if (index > 0) phrases.set(normalize(line.slice(0, index)), line.slice(index + 1));
  }
}
for (const line of adminPhrasePairs.split('\n')) { const split = line.indexOf('|'); if (split > 0) phrases.set(normalize(line.slice(0,split)), line.slice(split+1)); }
for (const line of helpLegalPhrasePairs.split('\n')) { const sep = line.indexOf('|'); if (sep > 0) phrases.set(normalize(line.slice(0,sep)),line.slice(sep+1)); }
for (const line of defaultEnglishCorrections.split('\n')) { const sep=line.indexOf('|'); if(sep>0) phrases.set(normalize(line.slice(0,sep)),line.slice(sep+1)); }
for (const line of EXTRA_FA_LABELS.split('\n')) {
  const index = line.indexOf('|');
  if (index > 0) phrases.set(normalize(line.slice(0, index)), line.slice(index + 1));
}
for (const [english, persian] of Object.entries(knownSportsNames)) phrases.set(normalize(english), persian);

const teamTerms: Record<string,string> = {
 fc:'اف‌سی',cf:'سی‌اف',sc:'اس‌سی',ac:'آث',united:'یونایتد',city:'سیتی',
 town:'تاون',county:'کانتی',athletic:'اتلتیک',atletico:'اتلتیکو',
 real:'رئال',club:'باشگاه',sporting:'اسپورتینگ',sport:'اسپورت',inter:'اینتر',
 junior:'جونیور',juniors:'جونیورز',women:'زنان',ladies:'بانوان',
 youth:'جوانان',reserves:'ذخیره',team:'تیم',football:'فوتبال',
 manchester:'منچستر',liverpool:'لیورپول',arsenal:'آرسنال',madrid:'مادرید',
 barcelona:'بارسلونا',milan:'میلان',munich:'مونیخ',paris:'پاریس',
 london:'لندن',bayern:'بایرن',borussia:'بوروسیا',dortmund:'دورتموند',
 roma:'رم',al:'ال',el:'ال',new:'نیو',racing:'راسینگ',
 deportivo:'دپورتیوو',universidad:'اونیورسیداد',
 independiente:'ایندیپندینته',league:'لیگ',premier:'برتر',
 division:'دسته',cup:'جام',championship:'چمپیونشیپ',serie:'سری',
 champions:'قهرمانان',super:'سوپر',professional:'حرفه‌ای',
 pro:'حرفه‌ای',first:'اول',second:'دوم',regional:'منطقه‌ای',
 international:'بین‌المللی',friendly:'دوستانه',friendlies:'دوستانه'
};
const digraphs: Array<[string,string]> = [
 ['tion','شن'],['sion','ژن'],['tch','چ'],['sch','ش'],['sh','ش'],['ch','چ'],
 ['kh','خ'],['ph','ف'],['th','ت'],['ck','ک'],['gh','غ'],['qu','کو'],
 ['ou','او'],['oo','و'],['ee','ی'],['ea','ی'],['ai','ای'],
 ['ay','ای'],['ei','ای'],['ie','ی'],['ow','او'],['au','او']
];
const alphabet: Record<string,string> = {
 a:'ا',b:'ب',c:'ک',d:'د',e:'',f:'ف',g:'گ',h:'ه',i:'ی',
 j:'ج',k:'ک',l:'ل',m:'م',n:'ن',o:'و',p:'پ',q:'ق',
 r:'ر',s:'س',t:'ت',u:'و',v:'و',w:'و',x:'کس',y:'ی',z:'ز'
};
function phonetic(token: string): string {
  const fixed = teamTerms[token.toLowerCase()];
  if (fixed) return fixed;
  if (/^[A-Z0-9]{1,4}$/.test(token)) return token;
  const lower = token.toLowerCase();
  let output = '';
  for (let i = 0; i < lower.length;) {
    const pair = digraphs.find(([pattern]) => lower.startsWith(pattern,i));
    if (pair) {output += pair[1]; i += pair[0].length;}
    else {output += alphabet[lower.charAt(i)] ?? lower.charAt(i); i++;}
  }
  return output;
}
export function translateSportName(value: string): string {
  const mapped = phrases.get(normalize(value));
  if (mapped) return mapped;
  return value.replace(/[A-Za-z]+/g, phonetic).replace(/\s+/g, ' ').trim();
}


/**
 * Preserve wager identifiers, currencies, URLs, emails, payment addresses and technical
 * values. These are data, not translatable natural-language copy.
 */
const preserve = /(?:@|https?:\/\/|www\.|\b(?:USD|IRT|IRR|USDT|BTC|ETH|TRX|ERC20|TRC20|API|UUID|HTTP|JSON|SQL)\b)/i;
const safeToken = /^(?:[0-9]+(?:[.,][0-9]+)?%?|\$[0-9]+(?:[.,][0-9]+)?|18\+)$/;
const compactWhitespace = (value: string) => value.replace(/\s+/g, ' ').trim();
const exact = (text: string) => phrases.get(normalize(text));

// Convert multi-part headings, labels and lists only when every language-bearing part
// is translated. Never half-translate an identifier or the user's own data.
function translatedCompound(value: string): string | null {
  const pieces = value.split(/(\s+[•|–—]\s+|\s+\/\s+|\s*:\s+|\s*\|\s*)/u);
  if (pieces.length < 3 || pieces.length > 15) return null;
  let sawTranslated = false;
  const result = pieces.map((part, i) => {
    if (i % 2 !== 0) return part;
    const v = part.trim();
    if (!v) return part;
    const translation = exact(v);
    if (translation) {
      sawTranslated = true;
      return part.replace(v, translation);
    }
    if (safeToken.test(v)) return part;
    return null;
  });
  if (!sawTranslated || result.some(x => x === null)) return null;
  return result.join('');
}

function translatedSimpleWords(value: string): string | null {
  if (!/^[A-Za-z][A-Za-z -]{2,48}$/.test(value)) return null;
  if (value.trim().split(/\s+/).length > 4) return null;
  const tokens = value.split(/(\s+|[-])/);
  let count = 0;
  const mapped = tokens.map(token => {
    if (!/[A-Za-z]/.test(token)) return token;
    // Unknown team names/brands/user data should never be pseudo-translated here.
    const mappedToken = exact(token);
    if (!mappedToken) return null;
    count++;
    return mappedToken;
  });
  return count >= 2 && mapped.every(v => v !== null) ? mapped.join('') : null;
}

export function translateVisibleText(value: string, sportContext = false): string {
  if (!/[A-Za-z]/.test(value)) return value;
  const left = value.match(/^\s*/)?.[0] ?? '';
  const right = value.match(/\s*$/)?.[0] ?? '';
  const core = value.trim();
  if (!core) return value;
  const decoded = core.replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ');
  let localized = exact(decoded);
  if (!localized && preserve.test(core)) return value;

  if (!localized) {
    const patterns: Array<[RegExp, (...args: string[]) => string]> = [
      [/^In (\d+)h$/i, (_all, n) => 'تا ' + n + ' ساعت دیگر'],
      [/^In (\d+) days?$/i, (_all, n) => n + ' روز دیگر'],
      [/^(\d+) markets?$/i, (_all, n) => n + ' بازار'],
      [/^(\d+) matches?$/i, (_all, n) => n + ' مسابقه'],
      [/^(\d+) events?$/i, (_all, n) => n + ' رویداد'],
      [/^(\d+) selections?$/i, (_all, n) => n + ' انتخاب'],
      [/^(\d+) transactions?$/i, (_all, n) => n + ' تراکنش'],
      [/^(\d+) bets?$/i, (_all, n) => n + ' شرط'],
      [/^(\d+) (?:live )?games?$/i, (_all, n) => n + ' بازی'],
      [/^(\d+) minutes? ago$/i, (_all, n) => n + ' دقیقه پیش'],
      [/^(\d+) hours? ago$/i, (_all, n) => n + ' ساعت پیش'],
      [/^(\d+) days? ago$/i, (_all, n) => n + ' روز پیش'],
      [/^Showing (\d+) of (\d+)$/i, (_all, n, total) => 'نمایش ' + n + ' از ' + total],
      [/^(\d+)\/(\d+) selections?$/i, (_all, n, total) => n + ' از ' + total + ' انتخاب'],
      [/^Q([1-4]) (.*)$/i, (_all, n, rest) => 'کوارتر ' + n + ' ' + (exact(rest) ?? rest)],
      [/^(Over|Under) ([\d.,+-]+)$/i, (_all, dir, line) => (dir.toLowerCase() === 'over' ? 'بالای ' : 'زیر ') + line],
      [/^(.+?) - (1st Half|2nd Half)$/i, (_all, a, b) => (exact(a) ?? a) + ' - ' + (exact(b) ?? b)],
      [/^(.+?)\s*:\s*(\d+(?:[.,]\d+)?)$/i, (_all, a, b) => (exact(a) ?? a) + ': ' + b],
    ];
    for (const [pattern, fn] of patterns) {
      const found = decoded.match(pattern);
      if (found) { localized = fn(...found); break; }
    }
  }
  if (!localized) localized = translatedCompound(decoded) ?? undefined;
  if (!localized) localized = translatedSimpleWords(decoded) ?? undefined;
  if (!localized) {
    const composed = decoded.match(/^(.{2,80}?)\s+(-|–|—|vs\.?)\s+(.{2,80})$/i);
    if (composed) {
      const first = composed[1] ?? '';
      const separator = composed[2] ?? '-';
      const last = composed[3] ?? '';
      const l = exact(first);
      const r = exact(last);
      if (l && r) localized = l + ' ' + separator + ' ' + r;
      else if (sportContext && /^[A-Za-z ]+$/.test(first + last)) {
        localized = translateSportName(first) + ' ' + separator + ' ' + translateSportName(last);
      }
    }
  }
  if (!localized && sportContext && /^[\p{L}\p{N} .'\-()&/]+$/u.test(decoded) && /^[A-Za-z]/.test(decoded)) {
    localized = translateSportName(decoded);
  }
  return localized ? left + compactWhitespace(localized) + right : value;
}
