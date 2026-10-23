package com.betvima.app.ui

/**
 * Turkish copy for the four native Information guides.
 * The official published policies and provider checks remain authoritative.
 * English/Persian source strings and UI geometry remain untouched.
 */
internal object FooterTurkish170 {
    private val metadata = mapOf(
        "terms" to Triple(
            "Şartlar ve Koşullar",
            "HESAP • ORANLAR • HESAPLAŞMA",
            "Hesap uygunluğu, kabul edilen bahisler, doğru kayıtlar, ödemeler ve yükümlülükleriniz hakkında açıklayıcı rehber. Yayımlanan web sitesi şartları resmî ve bağlayıcı başvuru kaynağıdır."),
        "privacy" to Triple(
            "Gizlilik ve Veri Koruması",
            "VERİ • GÜVENLİK • SEÇİMLERİNİZ",
            "Hesap verileri, finansal kayıtlar, güvenlik kontrolleri, hizmet sağlayıcılar ve kişisel bilgilerle ilgili yardım taleplerini öğrenin."),
        "responsible" to Triple(
            "Sorumlu Oyun",
            "KONTROL • İYİ OLUŞ • DESTEK",
            "Limit belirlemek, zararlı davranışları erken tanımak, oyuna ara vermek ve yardım bulmak için pratik bilgiler. Kumar gerçek bir maddi kayıp riski taşır."),
        "guide" to Triple(
            "BetVima Kullanım Rehberi",
            "HESAP • SPOR • CÜZDAN",
            "BetVima uygulamasındaki hesap, bahis, cüzdan ve destek özelliklerine yönelik açıklayıcı rehber. Güncel işlemlerde sağlayıcı ve sunucu kuralları geçerlidir.")
    )
    private val sections: Map<String, Pair<String,String>> = mapOf(
        "Eligibility, age and local law" to Pair(
            "Uygunluk, yaş ve yerel hukuk",
            "BetVima yalnızca 18 yaşını doldurmuş ve bulundukları veya hizmeti kullandıkları yerde ilgili hizmete yasal olarak erişebilen yetişkinler içindir. İnternet bağlantısı, çevrilmiş arayüz ya da erişilebilir alan adı yasal uygunluk kanıtı değildir. Yerel kurallar çevrim içi kumarı, ödeme hizmetlerini, reklamları veya bazı oyunları kısıtlayabilir. Kayıt olmadan, hesaba para yatırmadan ya da bahis yapmadan önce size uygulanan hukuku doğrulayın. Kısıtlamalar ve sağlayıcı erişimi değişebilir; her ülkede erişim taahhüt edilmez."),
        "Registration and personal account" to Pair(
            "Kayıt ve kişisel hesap",
            "Kontrolünüzde olan doğru bilgiler ve giriş bilgileriyle kayıt olun. Her hesap kişiseldir; satılmamalı, paylaşılmamalı veya devredilmemelidir. Şifrenizi, kurtarma yöntemlerinizi ve doğrulama kodlarınızı gizli tutun. Yetkisiz erişimden şüphelenirseniz hesabınızı güvenceye alın ve Destek ile görüşün. Yasa, ödeme sağlayıcıları veya dolandırıcılık önleme kontrolleri gerektirirse platform ek inceleme ya da belge isteyebilir. Hesap para birimi seçimi ödeme kurallarını veya bölgesel kısıtlamaları geçersiz kılmaz."),
        "How a bet becomes official" to Pair(
            "Bir bahis nasıl resmîleşir?",
            "Bir etkinlik seçin, açık olan bahis pazarını açın ve seçiminize dokunarak kupona ekleyin. Sonucu, pazarı, bahis tutarını, olası ödemeyi ve para birimini inceleyin. Karar verirken gösterilen oran değişebilir. Orana dokunmak veya kuponu açmak bahis kabul edildiği anlamına gelmez; yalnızca başarılı sunucu onayı bahsi resmîleştirir. Fiyat değişirse yeni oran gönderimden önce gösterilmeli ve açıkça kabul edilmelidir. Kilitli veya yalnızca bilgi amaçlı gösterilen oranlarla bahis yapılamaz."),
        "Singles, multiples and returns" to Pair(
            "Tekli, kombine bahisler ve ödemeler",
            "Tekli bahis bir seçim içerir. Kombine bahis, pazar uyumluluğu ve sunucu kuralları çerçevesinde uygun seçimleri birleştirir. Olası ödeme, kabul edilmiş oran ve tutara dayanan tahmindir; garantili kâr değildir. Kabul öncesinde gösterilen ödeme değişebilir. Kazanan bahislerde geçerli olduğunda toplam ödeme ilk bahis tutarını da içerir; net kâr ise toplam ödemeden bu tutarın çıkarılmasıdır. Olası ödemeyi çekilebilir bakiye ile karıştırmayın."),
        "Results, voids and corrections" to Pair(
            "Sonuçlar, geçersizlikler ve düzeltmeler",
            "Açık bahisler güvenilir etkinlik sonuçlarına ve seçilen pazarın kurallarına göre sonuçlandırılır. Erteleme, iptal, geçersiz sonuç veya düzeltilmiş resmî sonuç, ilgili pazar kurallarına göre hesaplaşmayı etkileyebilir. Yayımlanan şartlara göre düzeltmeler önceki hesaplaşmanın ters kaydı ve yeni kayıt ile yapılır; finansal geçmiş sessizce değiştirilmez. Kabul edilen seçimler, etkinlik sonucu ve son durum için Bahislerim bölümünü kontrol edin."),
        "Wallet, deposits and withdrawals" to Pair(
            "Cüzdan, yatırma ve çekme",
            "Cüzdan kullanılabilir, toplam ve ayrılmış bakiyeleri birbirinden ayırır. Hesap defteri alacak ve borç işlemlerini ödeme durumu geçmişinden ayrı kaydeder. Para yatırma, sağlayıcı onayına kadar beklemede kalabilir; çekim tutarı dış ödeme doğrulanana kadar ayrılabilir. Çekim talebi tamamlanmış ödeme değildir. Uygulama mevcut yöntemleri, limitleri, kur bilgilerini ve alıcı şartlarını gösterir. Sunucu ve sağlayıcı verileri örnek ve rehberlerden önceliklidir."),
        "Pricing, mistakes and service interruptions" to Pair(
            "Fiyatlandırma, hatalar ve kesintiler",
            "Sağlayıcı verileri, oranlar veya etkinlik durumu güvenilir biçimde doğrulanamadığında pazarlar geçici olarak durdurulabilir. Site, yayımlanan şartlara göre açık fiyatlama veya hesaplaşma hatalarını kayıtlarda düzeltme göstererek giderebilir. Sunucu reddi, bağlantı kesintisi veya süresi dolmuş oran kabul edilmiş bahis değildir. İstenmeyen ikinci bir bahis oluşturmamak için tekrar göndermeden önce son kaydı kontrol edin. Açıklanamayan farkları bahis ya da işlem referansıyla Destek'e bildirin."),
        "Responsibility and fair use" to Pair(
            "Sorumluluk ve adil kullanım",
            "Kampanya ödüllerini kötüye kullanmayın; yanıltıcı hesap açmayın, yetkisiz erişim denemeyin, teknik veya yasal kısıtlamaları aşmayın. Kampanya, bonus ve VIP avantajlarının ayrı uygunluk ve kullanma koşulları olabilir. Kabul etmeden önce ilgili kampanyayı inceleyin. İş ortaklığı bağlantısı bahis uygunluğunu, kabul edilmiş oranları veya cüzdan haklarını değiştirmez. Bütçe belirleyin, yatırma ve bahis limitlerine uyun, bahsi gelir kaynağı saymayın."),
        "Disputes, records and updates" to Pair(
            "İtirazlar, kayıtlar ve güncellemeler",
            "İtiraz için etkinlik kimliğini, tam seçimi, kabul edilmiş oranları, zaman damgalarını ve varsa ödeme referansını toplayın. Bu bilgileri destek merkezi üzerinden gönderin ve onay mesajını saklayın. Şartlar ve ödeme yöntemleri zamanla değişebilir; işlem yapmadan önce sitedeki en güncel metni ve uygulamadaki sağlayıcı kurallarını inceleyin. Bu açıklayıcı rehber bağlayıcı bir hukuki sözleşmenin yerine geçmez ve resmî şartlarda bulunmayan haklar yaratmaz."),
        "Information used to operate an account" to Pair(
            "Hesap işlemlerinde kullanılan bilgiler",
            "Hesap işlevleri giriş kimliğinizi, hesap ayarlarını, seçilen para birimini, kimlik doğrulama durumunu ve işlem referanslarını gerektirebilir. Bahis kayıtları etkinlik, pazar, seçim, tutar, kabul edilmiş oran ve sonucu içerir; bunlar hesaplaşmayı açıklamak veya itirazı incelemek için kullanılır. İstenen bilgiler kullandığınız özelliğe bağlıdır. Açık destek mesajlarına gereksiz belge veya hassas ayrıntı göndermeyin."),
        "Security and device signals" to Pair(
            "Güvenlik ve cihaz sinyalleri",
            "Yayımlanan gizlilik politikasına göre ham IP adresleri ve cihaz dizeleri saklanmaz; dolandırıcılık ve yönlendirme bütünlüğü kontrollerinde tuzlanmış özet değerleri kullanılır. Kimlik doğrulama, oturum yönetimi ve kötüye kullanım korumaları teknik sinyallerin işlenmesini gerektirebilir. Tek kullanımlık kodları, kurtarma sırlarını ve şifrelerinizi destek görevlisi olduğunu söyleyenlerle bile paylaşmayın. Cihaz güvenliğini kullanın ve uygulamayı güvenilir kanallardan güncelleyin."),
        "Payments and protected identifiers" to Pair(
            "Ödemeler ve korunan tanımlayıcılar",
            "Ödeme sağlayıcıları kendi ödeme kimlik bilgilerini ve ağ ayrıntılarını işler. Kamuya açık politika tam kart veya banka bilgileri yerine maskelenmiş ödeme hedeflerinin saklanmasını açıklar. Uygulama bir transfer için gereken cüzdan adresi veya kupon alıcısını gösterebilir; yalnızca seçilen yöntem için zorunlu bilgileri girin. Blokzincir ağlarının herkese açık işlem kayıtları ve uygulamanın kontrolü dışında kendi gizlilik özellikleri vardır."),
        "Why the account ledger is retained" to Pair(
            "Hesap defteri neden saklanır?",
            "Yayımlanan politikaya göre finansal kayıtlar yalnızca ekleme yapılabilen bir denetim izi oluşturur. Hesaplaşma düzeltmesi eski işlemi silmek veya gizlice değiştirmek yerine yeni olay olarak kaydedilir. Bu, yatırmaları, ayrılan bakiyeleri, borçları, kazançları, iadeleri ve çekimleri izlemeye yardımcı olur. Diğer profil bilgilerinin silinmesini isteseniz bile bazı kayıtların finansal, hukuki veya uyuşmazlık çözümü yükümlülükleri için saklanması gerekebilir."),
        "Support tickets and attachments" to Pair(
            "Destek talepleri ve ekler",
            "Destek görüşmesi talebinizi incelemek için gerekli hesap tanımlayıcıları, metinler, ekler ve zaman damgaları içerebilir. Belgeleri yalnızca doğrulanmış hizmet süreçlerinde istendiğinde gönderin ve yüklemeden önce ilgisiz kişisel bilgileri kaldırın. Kurtarma ifadeleri, şifreler, özel anahtarlar veya tam ödeme sırlarını sohbete yazmayın. Takip için destek talebi referansının bir kopyasını saklayın."),
        "Service providers and cross-border use" to Pair(
            "Hizmet sağlayıcılar ve sınır ötesi kullanım",
            "Ödeme, kimlik doğrulama, analiz veya mesajlaşma gibi özellikler kendi gizlilik ve güvenlik politikalarına sahip dış sağlayıcılara dayanabilir. Bir ülkede ödeme veya oyunun görünmesi, ilgili sağlayıcının orada işlem desteklediği veya yasal yetkiye sahip olduğu anlamına gelmez. Veri paylaşmadan veya ödeme yapmadan önce sağlayıcı bilgilerini ve geçerli yasal kısıtlamaları inceleyin."),
        "Your controls and requests" to Pair(
            "Kontrolleriniz ve talepleriniz",
            "Hesabınızdan profil bilgilerini, mevcutsa son girişleri, cüzdan hareketlerini ve bahis geçmişini inceleyebilirsiniz. Yayımlanan politika, yasal saklama yükümlülüklerine tabi olmak kaydıyla finansal olmayan kişisel verilerin silinmesini talep etmeye izin verir. Veri sorunu bildirmek, inceleme veya saklama hakkında bilgi almak için resmî destek kanalıyla görüşün ve ilgili kayıt veya özelliği belirtin. Hassas hesap taleplerinde kimlik doğrulaması gerekebilir."),
        "Updates, children and safety" to Pair(
            "Güncellemeler, çocuklar ve güvenlik",
            "Hizmet en az 18 yaşındaki yetişkinler içindir; çocuklar bahis hesabı açamaz veya kullanamaz. Paylaşılan cihazlarda hesap erişimini koruyun ve finansal ayrıntıları gösteren bildirim önizlemelerini gizleyin. Gizlilik uygulamaları ve sağlayıcı entegrasyonları gelişebilir. Geçerli politika için ekran görüntüleri, iletilmiş mesajlar veya bu eğitsel özet yerine bağlantılı resmî siteyi kullanın."),
        "Entertainment, not a financial plan" to Pair(
            "Finansal plan değil, eğlence",
            "Her bahis tutarını tamamen kaybedebileceğiniz para olarak düşünün. Oranlar bir pazar fiyatını ve olası ödemeyi gösterir; güvenilir tahmin veya kâr garantisi değildir. Kira, borç, eğitim veya yaşam giderlerini karşılamak için kumara güvenmeyin. Sakin olduğunuzda en yüksek eğlence bütçenizi belirleyin ve kayıplardan sonra bu limiti artırmayın."),
        "Deposit, loss, stake and session limits" to Pair(
            "Yatırma, kayıp, bahis ve oturum limitleri",
            "Yayımlanan sorumlu oyun sayfası günlük ve haftalık kayıp limitlerini, yatırma sınırlarını, bahis tutarı üst sınırlarını ve oturum sürelerini açıklar. Bu kontroller hesabınızda mevcutsa başlamadan önce ayarlayın ve sunucuda uygulanan kısıtlamalara uyun. Rahatça kaybedebileceğiniz tutarı ve sınırlı oyun süresini seçin. Limitlerden kaçınmak için ek hesap açmayın veya ödeme yöntemi değiştirmeyin."),
        "Recognize warning signs early" to Pair(
            "Uyarı işaretlerini erken fark edin",
            "Kayıpları telafi etmeye çalışma, harcamaları gizleme, iş veya aile sorumluluklarını aksatma, oynamak için borç alma, uykusuzluk, duramama hissi ve sonuçlardan sonra yoğun sıkıntı uyarı işaretleridir. Yatırılan, bahis oynanan ve çekilen toplam tutarları takip etmek bu örüntüleri görünür kılar. Oynamak artık isteğe bağlı gelmiyorsa yeni bahis yapmak yerine durun ve destek arayın."),
        "Taking a break and self-exclusion" to Pair(
            "Mola ve kendini hariç tutma",
            "Yoğun oturumların veya ani kararların ardından sakinleşmek için ara verin. Kamuya açık politika, seçilen süre boyunca bahisleri, yatırmaları ve iş ortaklığı erişimini engelleyen kendini hariç tutmayı açıklar. Bu kontrol hesabınızda varsa yalnızca iradeye güvenmek yerine kullanın. Bulamıyorsanız erişimi nasıl kısıtlayacağınızı ve hangi onayın bekleneceğini Destek'e sorun. Hariç tutulmayı aşmaya çalışmayın."),
        "Minors and vulnerable users" to Pair(
            "Küçükler ve hassas kullanıcılar",
            "18 yaşından küçükler bahis özelliklerini kullanamaz. Paylaşılan telefon veya bilgisayarda işiniz bitince çıkış yapın, şifreleri koruyun ve çocukların cüzdanlara veya kayıtlı ödeme yöntemlerine erişmesini önleyin. Alkol, yoğun stres, uykusuzluk ve bazı duygusal durumlar muhakemeyi bozabilir. Riskleri açıkça değerlendirebilecek hale gelene kadar mali kararları erteleyin."),
        "Finding confidential help" to Pair(
            "Gizli destek bulmak",
            "Kumar finansal durumunuza, ilişkilerinize veya ruh sağlığınıza zarar veriyorsa güvendiğiniz biriyle, lisanslı bir ruh sağlığı uzmanıyla veya bulunduğunuz yerde bağımsız kumar desteği veren kuruluşla görüşün. BetVima Destek hesaba özgü limitler ve erişim sorularında yardımcı olabilir, ancak klinik yardımın yerine geçmez. Acil tehlike veya kriz yaşıyorsanız yerel acil servisleri arayın."),
        "Fraud, false promises and tips" to Pair(
            "Dolandırıcılık, sahte vaatler ve ipuçları",
            "Kesin kazanç, garantili kombine sonuç, gizli bahis algoritması veya manipüle edilmiş etkinliklere erişim vaat edenlere dikkat edin. Kazanan bahis ekran görüntüsü güvenilir stratejinin kanıtı değildir. Şifreleri, kripto kurtarma ifadelerini veya kayıpları geri alabileceklerini söyleyen yabancılara para vermeyin. Şüpheli kötüye kullanımı doğrulanmış destek kanallarından bildirin."),
        "A short personal safety checklist" to Pair(
            "Kısa kişisel güvenlik kontrol listesi",
            "Her oturum öncesinde kendinize sorun: En az 18 yaşında mıyım ve oynamam yasal mı? Bu parayı kaybetmeyi göze alabilir miyim? Kayıp limiti ve bitiş saati belirledim mi? Pazarı ve kaybetme ihtimalini anlıyor muyum? Sakin miyim? Herhangi bir yanıt hayır ise oyunu erteleyin. Hesap dökümünüzü düzenli inceleyin ve kontrol kaybolduğunda bağımsız yardım alın.")
    )
    private val guideSections = mapOf(
        "What is BetVima?" to Pair("BetVima nedir?", "BetVima, spor karşılaşmalarını, mevcut bahis pazarlarını, canlı skor bilgilerini, hesap cüzdanını, bahis geçmişini ve casino gezintisini web ve Android arayüzlerinde bir araya getirir. Özellikler, oranlar ve oyun erişimi canlı veri sağlayıcılarına, hesap durumuna, ödemelere, yürürlükteki hukuka ve sunucu kontrollerine bağlıdır. Bilgilendirme amaçlı veya askıya alınmış pazarlar arayüzde görünse bile onaylı bahis yapılmasına izin vermeyebilir. Güncel kullanılabilirliği ilgili sayfadan kontrol edin."),
        "Create an account and secure it" to Pair("Hesap oluşturun ve güvenliğini sağlayın", "Kayıt sayfasını açın, kontrol ettiğiniz e-posta adresini girin, güçlü ve benzersiz bir şifre oluşturun, desteklenen hesap para birimini seçin ve yaş ile koşul onaylarını inceleyin. Bot önleme doğrulaması görünürse resmî arayüzde tamamlayın. Hesabınıza dönmek için Giriş'i kullanın. Kurtarma bilgilerini gizli tutun ve mevcutsa ek giriş koruması etkinleştirin. Dil veya para birimi desteği, herhangi bir bölgede bahis oynamanın yasal olduğunu garanti etmez."),
        "Find sports, leagues and events" to Pair("Sporları, ligleri ve maçları bulun", "Ana sayfa Canlı, Popüler Bahisler ve Yaklaşan gibi bölümleri öne çıkarır. Spor ve E-spor mevcut karşılaşma kataloğunu filtrelemenizi sağlar. Takım, yarışma veya maç bulmak için Arama'yı kullanın; filtreler görünenleri daraltır ancak veri sağlayıcısının gerçek kapsamını değiştirmez. Canlı süreler, sonuçlar ve istatistikler alınan akışlara dayanır ve gecikebilir. Bir oran seçmeden önce etkinlik başlığını ve doğru pazarı kontrol edin."),
        "How to place a single bet" to Pair("Tekli bahis nasıl yapılır?", "Önce hesabınızın uygun ve bakiyeli olduğundan, seçilen pazarın açık olduğundan emin olun. Maçı açın, istediğiniz pazar seçimine dokunun ve açılan bahis kuponunu inceleyin. Kaybetmeyi göze alabileceğiniz bir tutar girin; oranları ve olası ödemeyi kontrol edin, yalnızca kupon tam olarak istediğiniz seçimi gösterdiğinde onaylayın. Oranlar değişirse yeni fiyatı inceleyip açıkça kabul edin. Sunucunun başarılı kabul yanıtını bekleyin ve ardından Bahislerim'deki kaydı doğrulayın. Kilitli pazara dokunmak veya taslak kupon görmek bahis yapmaz."),
        "Multiple bets and bet history" to Pair("Kombine bahisler ve bahis geçmişi", "Destekleniyorsa uyumlu seçimleri ekleyerek kombine oluşturun ve birleşik oranı inceleyin. Birden çok etkinlik eklemek kombinenin kesin kabul edileceği anlamına gelmez; sunucu uyumluluğu ve kullanılabilirliği denetler. Bahislerim uygun olduğunda açık, kazanan, kaybeden, geçersiz ve sonuçlanan kayıtları gösterir. Kuponu genişleterek kaydedilmiş pazarı, seçimi, kabul edilen oranı ve etkinlik sonucunu inceleyin. Hesaplaşmaya itirazınız varsa destek için kupon referansını saklayın."),
        "Understand wallet balances" to Pair("Cüzdan bakiyelerini anlayın", "Kullanılabilir bakiye uygun işlemler için o anda kullanılabilecek tutardır; ayrılan bakiye bekleyen yükümlülükler için tutulur, toplam bakiye ikisini de içerebilir. Para Yatır, Para Çek ve Geçmiş para hareketlerinin farklı bölümlerini gösterir. Hesap defteri bakiye değişikliklerini, ödeme geçmişi ise sağlayıcı taleplerini ve durumlarını izler. Son işlemler listesinde görünmesi, işlenmekte olan ödemenin tamamlandığı anlamına gelmez."),
        "Cryptocurrency deposits" to Pair("Kripto para yatırma", "Cüzdan → Para Yatır → Kripto yolunu izleyin. USDT gibi yalnızca listelenen mevcut varlığı seçin ve o varlık için sunulan tam blokzincir ağını belirleyin. Tutarı, güncel asgari limiti, kuru ve sağlayıcı yönergelerini inceleyin. Yalnızca doğrulanmış ödeme talebiniz için gerçekten oluşturulan adrese para gönderin. Ağ tam olarak eşleşmelidir: örneğin TRC-20 adresine farklı zincirden para göndermek güvenli değildir. Ağ transferleri geri alınamaz olabilir. Gerekli sağlayıcı onaylarını bekleyin ve işlem durumunu kontrol edin."),
        "Crypto withdrawal and settlement" to Pair("Kripto çekme ve hesaplaşma", "Cüzdan → Para Çek → Kripto bölümünü açın. Desteklenen coin'i ve uygun ağı seçin; o anki asgari ve azami limitleri kontrol edin, hedef cüzdan adresini girin ve bütün karakterleri inceleyin. Uygulama genel örneklerden farklı sağlayıcı limitleri de gösterebilir. Gönderilen talep incelenirken ve aktarılırken cüzdan tutarı ayrılabilir. İşlem yalnızca dış ödeme referansı ve durumu kaydedildikten sonra tamamlanmış kabul edilir. Yanlış adres veya ağ kalıcı kayba neden olabilir."),
        "U-Voucher and HotVoucher deposits" to Pair("U-Voucher ve HotVoucher yatırma", "Cüzdan para yatırma formunda etkinse U-Voucher veya HotVoucher seçin. İlgili tutarı, gerçek sağlayıcıdan alınan kupon kodunu ve istenen diğer bilgileri girin. Kodun geçerli, kullanılmamış, beklenen para biriminde ve seçilen transfer için uygun olduğunu doğrulayın. Ekran görüntüsü veya sohbet mesajı değil, ödeme ağ geçidinin onayı geldikten sonra cüzdan bakiyesi artmalıdır. Kupon kodlarını yabancılarla paylaşmayın."),
        "U-Voucher and HotVoucher withdrawals" to Pair("U-Voucher ve HotVoucher çekme", "Kuponla çekim yöntemi etkinse Para Çek bölümünden seçin, güncel limitleri inceleyin ve resmî formun istediği alıcı tanımlayıcısını, uygun olduğunda desteklenen cüzdan e-postasını girin. Tutarı yazın, alıcıyı dikkatle kontrol edin ve inceleme adımını tamamlayın. Talep, sağlayıcı ve muhasebe sistemi hesaplaşmayı onaylayana kadar beklemede kalabilir. Ücretler, ödeme süreleri, desteklenen ülkeler ve yöntemler sağlayıcıya bağlıdır; sabit bir garanti varsaymak yerine güncel form değerlerine bakın veya Destek'e sorun."),
        "Account currency, exchange rates and fees" to Pair("Hesap para birimi, kurlar ve ücretler", "Cüzdan hesabının para birimi ile ödeme varlığının para birimi her zaman aynı değildir. Seçilen yöntem kur hesabı, dinamik asgari sağlayıcı tutarları, ağ ücretleri veya tahmini transfer tutarı içerebilir. Her tutarın yanındaki para birimini doğrulayın ve istendiğinde sağlayıcı kurlarını yenileyin. Nihai ödenecek veya alınacak tutar ve bütün gerekli limitler statik bir makaleye değil gerçek işlem ekranına ve sağlayıcı yanıtına bağlıdır."),
        "Using BetVima from Iran" to Pair("BetVima'yı İran'dan kullanmak", "Farsça arayüz veya IRR para birimi seçeneği İran'da bahis için yasal izin ya da ödeme ve oyunların çalışacağı garantisi değildir. Kumar ve ilgili finansal hizmetlerin erişimi sıkı kısıtlamalara tabi olabilir. Kullanıcılar geçerli hukuku kontrol etmeli ve yetkisiz etkinliklerden kaçınmalıdır; hizmet kullanılabilirliği, yaptırımlar ve ödeme sağlayıcısı kuralları erişimi engelleyebilir. Farklı alan adı veya alternatif erişim yolunun uygunluk sağladığını varsaymayın."),
        "Using BetVima from Turkey" to Pair("BetVima'yı Türkiye'den kullanmak", "Türkiye bahis ve oyun faaliyetlerini düzenler; genel olarak tüm yurt dışı çevrim içi bahis işletmelerini yetkilendirmez. BetVima'nın cihazda açılması veya Türkçeye çevrilmesi Türkiye'den bahis yapmanın hesabınız için yasal olduğunu doğrulamaz. Güncel yerel yetki ve kısıtlamaları bağımsız olarak araştırın. Uygulamada belirli bir ödeme varlığı görünse bile gerçek sağlayıcı ve yasal denetimler işlemi engelleyebilir."),
        "Using BetVima from Afghanistan" to Pair("BetVima'yı Afganistan'dan kullanmak", "Afganistan'da kumar ciddi hukuki ve toplumsal kısıtlamalara tabidir. Çevrim içi hesabın, dijital varlık transferinin veya yabancı bir sitenin bahis oynamayı yasal hale getirdiğini varsaymayın. BetVima burada yasal yetkilendirilmiş hizmeti veya kesintisiz ödemeyi taahhüt edemez. Size uygulanan kuralları doğrulayın, bütün kısıtlamalara uyun ve yasak olan yerde bahis yapmayın."),
        "Using BetVima from Tajikistan" to Pair("BetVima'yı Tacikistan'dan kullanmak", "Kumar, çevrim içi hizmetler ve sınır ötesi ödemelerin kuralları ülkelere göre farklılık gösterebilir ve zaman içinde değişebilir. Çevrilmiş arayüz veya desteklenen para birimi ülkeye özel lisans değildir. Tacikistan'da yaşayanlar veya ziyaretçiler belirli bahis ya da ödeme işleminin yasal olup olmadığını ve ilgili sağlayıcının bunu destekleyip desteklemediğini bağımsız olarak doğrulamalıdır. Hizmet kısıtlıysa kontrolleri aşmaya çalışmayın."),
        "Security, support and dispute tracking" to Pair("Güvenlik, destek ve itiraz takibi", "Yardım için Destek'i açıp talep oluşturun veya mevcut doğrulanmış sohbeti kullanın. İlgili bölüm, bahis veya ödeme referansı, zaman ve kısa açıklamayı ekleyin; şifrenizi, kurtarma ifadenizi veya tam gizli ödeme bilgilerinizi asla paylaşmayın. Talep kimliğini saklayın ve uygulamadaki yanıtı okuyun. Ödeme işleniyorsa ikinci transferden önce hesap defterini ve sağlayıcı durumunu kontrol edin. Tartışmalı bahislerde kabul edilmiş pazarı ve kupon ayrıntılarını verin."),
        "Responsible participation and latest information" to Pair("Sorumlu katılım ve güncel bilgiler", "Bahis gerçek maddi risk taşır ve yalnızca en az 18 yaşındaki uygun yetişkinler içindir. Limit belirleyin, kayıpların peşinden gitmeyin ve gerekirse kendini hariç tutma veya bağımsız yardım kullanın. Oranlar, programlar, etkin ödeme yöntemleri, para birimleri, sağlayıcı ücretleri ve yasal erişim dinamiktir. Gerçek hizmet koşulları için güncel ekran kontrollerine, resmî şart ve gizlilik sayfalarına ve gerekirse nitelikli yerel hukuk danışmanlığına başvurun. Bu rehber arayüzü açıklar; kazanç, para çekme süresi veya bölgesel erişim garantisi vermez."),
    )
    fun article(lang: Lang, article: FooterInfoArticle, field: String): String? {
        if (lang != Lang.TR) return null
        val row = metadata[article.id] ?: return null
        return when(field) {
            "title" -> row.first
            "subtitle" -> row.second
            "summary" -> row.third
            else -> null
        }
    }
    fun section(lang: Lang, part: FooterInfoSection, heading: Boolean): String? {
        if (lang != Lang.TR) return null
        return (sections[part.headingEn] ?: guideSections[part.headingEn])?.let { if(heading) it.first else it.second }
    }
}
