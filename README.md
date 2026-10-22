# Acil Künye: NFC Destekli Acil Durum Sağlık Bilgileri Platformu

Kişiler temel sağlık bilgilerini (kan grubu, alerjiler, ilaçlar, acil durum kişileri) kaydeder. Bilgilere, bileklik veya künyedeki **NFC etiketi**, **QR kod** ya da **kısa kod** ile, uygulama indirmeden telefonun tarayıcısından ulaşılır. Acil durum sayfasında yalnızca kullanıcının göstermeyi seçtiği bilgiler bulunur.

> **Önemli:** Gizlilik metni (`/privacy`) bir **taslaktır**, hukuki uygunluk garantisi değildir. Yayına almadan önce hukuk uzmanına gösterin ve içindeki `[AD SOYAD / KURUM – İLETİŞİM E-POSTASI]` yer tutucusunu doldurun (`frontend/src/i18n/locales/tr.json` ve `en.json`, `privacy.sections` altında `controller`).

## İçindekiler

1. [Gereksinimler](#1-gereksinimler)
2. [Klasör yapısı](#2-klasör-yapısı)
3. [Bağımlılıkları kurma](#3-bağımlılıkları-kurma)
4. [Veritabanını oluşturma](#4-veritabanını-oluşturma)
5. [.env dosyasını hazırlama](#5-env-dosyasını-hazırlama)
6. [Migration ve seed](#6-migration-ve-seed)
7. [Geliştirme ortamında başlatma](#7-geliştirme-ortamında-başlatma)
8. [Testler](#8-testler)
9. [Üretim derlemesi](#9-üretim-derlemesi)
10. [NFC etikete URL yazma](#10-nfc-etikete-url-yazma)
11. [QR ve kısa kodla test](#11-qr-ve-kısa-kodla-test)
12. [Yayına alma kontrol listesi](#12-yayına-alma-kontrol-listesi)
13. [API rotaları](#13-api-rotaları)
14. [Güvenlik tasarımı](#14-güvenlik-tasarımı)
15. [Bilinen sınırlar](#15-bilinen-sınırlar)

---

## 1. Gereksinimler

| Araç | Sürüm | Not |
|---|---|---|
| Node.js | **22 LTS** (en az 20.19) | Geliştirme **v22.22.2** ile yapıldı ve test edildi. Backend `node --env-file` kullanır (en az 20.6), Vite 8 en az 20.19 ister. |
| npm | 10+ | Node ile gelir. |
| MySQL | **8.0+** (MariaDB 10.6+ da çalışır) | **MariaDB 10.11** ile test edildi. XAMPP/WAMP ile gelen MySQL/MariaDB de olur. |
| openssl | herhangi | Gizli anahtar üretmek için (Windows'ta alternatif aşağıda). |

MySQL kurulumu: [dev.mysql.com/downloads](https://dev.mysql.com/downloads/mysql/) (Windows/macOS), Ubuntu/Debian için `sudo apt install mysql-server`, macOS için `brew install mysql`. XAMPP kullanıyorsanız XAMPP Control Panel'den **MySQL**'i başlatmanız yeterli.

## 2. Klasör yapısı

```
nfc-health/
├── backend/                  Express + Prisma (JavaScript, ESM)
│   ├── prisma/
│   │   ├── schema.prisma     Veri modeli
│   │   ├── migrations/       SQL migration dosyaları
│   │   └── seed.js           Demo hesap oluşturur
│   ├── prisma.config.js      Prisma yapılandırması (DATABASE_URL buradan okunur)
│   ├── src/
│   │   ├── app.js, server.js
│   │   ├── config/           env doğrulama, çerez adları, sabitler
│   │   ├── lib/              şifreleme, token, parola, doğrulama yardımcıları
│   │   ├── middleware/       güvenlik başlıkları, CSRF, hız sınırı, yetki, hata
│   │   ├── routes/           auth, profile, tags, public, accessLogs, account
│   │   └── services/         etiket, profil, oturum, e-posta, bakım
│   ├── tests/                Vitest + Supertest (gerçek MySQL/MariaDB ile)
│   └── .env.example
├── frontend/                 React + Vite + Tailwind
│   ├── src/
│   │   ├── pages/            sayfalar (pages/dashboard/ panel sayfaları)
│   │   ├── components/       ortak bileşenler
│   │   ├── auth/             oturum bağlamı, korumalı yönlendirme
│   │   ├── api/client.js     tek noktadan API erişimi (CSRF dahil)
│   │   ├── i18n/locales/     tr.json, en.json (tüm kullanıcı metinleri)
│   │   └── test/             Vitest + React Testing Library
│   └── public/
└── README.md
```

## 3. Bağımlılıkları kurma

```bash
cd backend
npm install
npm run db:generate      # Prisma istemcisini üretir (npm install'dan sonra bir kez gerekir)

cd ../frontend
npm install
```

## 4. Veritabanını oluşturma

Geliştirme ve **test** için iki ayrı veritabanı gerekir. Testler tablolardaki verileri siler; bu yüzden test veritabanı geliştirme veritabanından **farklı** olmalıdır.

MySQL'e `root` ile bağlanın (`mysql -u root -p`; XAMPP'te parola genelde boştur: `mysql -u root`) ve şunları çalıştırın (kullanıcı adı ve parolayı değiştirin):

```sql
CREATE DATABASE nfc_health CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE nfc_health_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'nfc'@'localhost' IDENTIFIED BY 'BURAYA_KENDI_PAROLANIZ';
GRANT ALL PRIVILEGES ON nfc_health.* TO 'nfc'@'localhost';
GRANT ALL PRIVILEGES ON nfc_health_test.* TO 'nfc'@'localhost';
FLUSH PRIVILEGES;
```

Aynı komutları phpMyAdmin'in **SQL** sekmesine veya MySQL Workbench'e de yapıştırabilirsiniz. Yeni kullanıcı oluşturmak istemezseniz `root` ile de bağlanabilirsiniz (aşağıdaki adreste `nfc:PAROLA` yerine `root:PAROLA`, XAMPP'te parolasız `root@`), ancak geliştirme için ayrı kullanıcı daha güvenlidir.

## 5. .env dosyasını hazırlama

```bash
cd backend
cp .env.example .env
```

`.env` dosyasını açın ve doldurun. **Gerçek sırları asla Git'e eklemeyin** (`.gitignore` `.env` dosyasını zaten dışarıda bırakır).

| Değişken | Açıklama |
|---|---|
| `DATABASE_URL` | `mysql://KULLANICI:PAROLA@localhost:3306/nfc_health` (parolada `@ : / #` gibi özel karakter varsa URL-kodlayın, ör. `@` → `%40`) |
| `DATABASE_URL_TEST` | Aynısı, veritabanı adı `nfc_health_test` |
| `APP_BASE_URL` | Etiket/QR bağlantılarının üretileceği adres. Geliştirmede `http://localhost:5173`. **Üretimde `https://` olmalı.** |
| `HEALTH_DATA_KEY` | Sağlık verilerini şifreleyen 32 baytlık AES anahtarı (base64). |
| `TOKEN_PEPPER` | Token ve kısa kod özetleri için gizli değer (en az 32 karakter). |
| `CSRF_SECRET` | CSRF belirteçleri için gizli değer (en az 32 karakter). |
| `TRUST_PROXY` | Reverse proxy arkasındaysanız `1`. |
| `SMTP_*`, `MAIL_FROM` | İsteğe bağlı e-posta ayarları (aşağıya bakın). |

Üç gizli değeri üretin ve `.env` içine yapıştırın:

```bash
openssl rand -base64 32    # HEALTH_DATA_KEY
openssl rand -base64 48    # TOKEN_PEPPER
openssl rand -base64 48    # CSRF_SECRET
```

`openssl` yoksa (Windows): `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` (anahtar için 32, diğerleri için 48 yazın).

> ⚠️ **`HEALTH_DATA_KEY` kaybolursa veritabanındaki sağlık verileri bir daha okunamaz.** Yedeğini güvenli bir yerde (parola yöneticisi) saklayın ve anahtarı değiştirmeyin. Anahtar eksik ya da 32 bayt değilse uygulama **başlamaz** ve nedenini yazar.

**E-posta (şifre sıfırlama):** `SMTP_*` boş bırakılırsa e-posta **gönderilmez**. Geliştirmede sıfırlama bağlantısı backend'i çalıştırdığınız terminale yazılır; arayüz de bu durumda "e-posta gönderilmedi" der. Gerçek gönderim için `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` değerlerini doldurun.

## 6. Migration ve seed

```bash
cd backend
npm run db:deploy        # migration'ları uygular (prisma migrate deploy)
npm run db:seed          # isteğe bağlı: demo hesap oluşturur
```

Seed şunu üretir ve bağlantıyı/kısa kodu ekrana yazar (yalnızca geliştirme için, üretimde çalışmayı reddeder):

- E-posta: `demo@example.com`
- Şifre: `DemoSifre123`

> ⚠️ **Migration doğrulama notu.** `prisma/migrations/20261018000000_init/migration.sql` dosyası, Prisma'nın MySQL çıktı biçimine uyularak şemadan **üretilmiştir**; geliştirme ortamında Prisma'nın şema motoru indirilemediği için `prisma migrate` ile hiç karşılaştırılmadı. SQL, MySQL 8.0 ve MariaDB 10.11'e uygulandı ve her ikisinde de 94 backend testinin tamamı geçti. (`npm run db:migrate` geçici bir "shadow" veritabanı oluşturur; bunun için kullanıcının sunucu genelinde `CREATE` yetkisi gerekir. Normal kurulumda yalnızca `npm run db:deploy` kullanılır, ek yetki gerekmez.) İlk kurulumda şunu bir kez yapın: şema değişikliği olmadığı hâlde `npm run db:migrate` yeni bir migration üretmek isterse, bu bir uyumsuzluk (drift) demektir; çıktıyı ekip arkadaşınızla paylaşın ve `schema.prisma` ile SQL'i eşleyin.

Veritabanını sıfırdan kurmak için: `npm run db:reset` (**tüm veriyi siler**).

## 7. Geliştirme ortamında başlatma

İki ayrı terminal:

```bash
# Terminal 1: backend (http://localhost:4000)
cd backend
npm run dev

# Terminal 2: frontend (http://localhost:5173)
cd frontend
npm run dev
```

Tarayıcıda **http://localhost:5173** adresini açın. Vite, `/api` isteklerini backend'e yönlendirir; böylece çerezler tek origin'de kalır ve CORS gerekmez.

## 8. Testler

```bash
cd backend && npm test     # 94 test, gerçek MySQL/MariaDB'e karşı (DATABASE_URL_TEST gerekir)
cd frontend && npm test    # 71 test (jsdom, API taklit edilir)
```

Backend testleri `DATABASE_URL_TEST` veritabanındaki tabloları **siler**. Veritabanı adı `test` içermiyorsa test başlamayı reddeder.

Spesifikasyondaki 12 senaryonun karşılığı:

| # | Senaryo | Nerede |
|---|---|---|
| 1, 2 | Kayıt, giriş, yanlış parola | `backend/tests/auth.test.js` |
| 3 | Sağlık bilgisi kaydet ve geri oku | `backend/tests/profile.test.js` |
| 4 | Başka kullanıcının verisine erişememe | `backend/tests/profile.test.js`, `tags.test.js`, `public.test.js` |
| 5 | Yalnızca görünür alanlar döner | `backend/tests/public.test.js`, `frontend/src/test/emergency.test.jsx` |
| 6, 7 | Geçerli / iptal edilmiş / geçersiz token | `backend/tests/public.test.js`, `tags.test.js` |
| 8 | Kısa kod doğru profile götürür | `backend/tests/public.test.js`, `frontend/src/test/forms.test.jsx` |
| 9 | Geçersiz kod ve hız sınırı | `backend/tests/public.test.js` |
| 10 | `tel:` bağlantısı doğru numarayı kullanır | `frontend/src/test/emergency.test.jsx` |
| 11 | QR kodun içindeki bağlantı sayfayı açar | `frontend/src/test/panel.test.jsx` (QR PNG'si gerçekten çözülür) |
| 12 | Hesap silinince her şey erişilemez olur | `backend/tests/account.test.js` |

**Test edilemeyenler** (gerçek cihaz gerektirir): gerçek bir NFC etiketine yazma/okuma, gerçek bir telefonda mobil görünüm, SMTP ile gerçek e-posta gönderimi. Bunları kendiniz denemelisiniz (bölüm 10-11).

## 9. Üretim derlemesi

```bash
cd frontend
npm run build            # frontend/dist klasörünü üretir
```

Backend, `NODE_ENV=production` iken `frontend/dist` klasörünü kendisi sunar (SPA yönlendirmesi ve `/e/*` için `noindex` dahil). Böylece tek bir süreç ve tek bir origin yeterlidir:

```bash
cd backend
npm run db:deploy
NODE_ENV=production npm start
```

> Üretimde `.env` içinde `NODE_ENV=production` ve `APP_BASE_URL=https://...` olmalıdır; aksi halde backend başlamaz.

## 10. NFC etikete URL yazma

1. **Etiket alın:** NTAG213, NTAG215 veya NTAG216 gibi yaygın NFC etiketleri bu bağlantıyı rahatça taşır (bağlantı yaklaşık 70 bayttır; NTAG213 144 bayt alır).
2. Panelde **Bağlantı ve QR** sayfasından bağlantıyı oluşturun ve **Kopyala**'ya dokunun.
3. Telefonunuza **NFC Tools** (Android/iOS) gibi bir uygulama kurun.
4. Uygulamada **Yaz** → **Kayıt ekle** → **URL/URI** seçin, bağlantıyı yapıştırın, **Tamam**'a dokunun.
5. **Yaz**'a dokunun ve telefonu etiketin üzerine yaklaştırıp bekleyin.
6. Etiketi okutup sayfanın tarayıcıda açıldığını kontrol edin.

Kurallar: etikete **yalnızca bu bağlantı** yazılır, sağlık bilgisi yazılmaz. Etiketi **kilitlemeyin**; bağlantıyı yenilerseniz etiketi yeniden yazmanız gerekir. Kaybolan etiketin bağlantısını panelden iptal edin; eski bağlantı hemen çalışmaz hale gelir.

**Telefonla geliştirme ortamını denemek** (bağlantı `localhost` olduğu sürece telefon açamaz; panel de bunu uyarır):

- Bilgisayar ve telefon aynı Wi-Fi'de olsun. Bilgisayarın yerel IP'sini bulun (ör. `192.168.1.20`).
- `backend/.env` içinde `APP_BASE_URL=http://192.168.1.20:5173` yapın ve backend'i yeniden başlatın.
- Frontend'i `npm run dev -- --host` ile başlatın.
- Panelde bağlantıyı **yeniden oluşturun** (eski bağlantı `localhost` ile üretilmişti).
- HTTPS gerekirse bir tünel aracı (ör. Cloudflare Tunnel, ngrok) kullanın; Vite'ın yabancı alan adlarını reddetmemesi için `frontend/vite.config.js` içindeki `server` bölümüne `allowedHosts` ekleyin.

## 11. QR ve kısa kodla test

- **QR:** Panelde **Bağlantı ve QR** sayfasındaki QR'ı telefonun kamerasıyla tarayın. **QR kodu PNG olarak indir** ile yazdırılabilir dosya alırsınız.
- **Kısa kod:** Panelde gösterilen 10 karakterlik kodu (`XXXXX-XXXXX`) ana sayfadaki alana veya `/access` adresine yazın. Küçük harf ve tire isteğe bağlıdır.
- **Hızlı deneme:** `npm run db:seed` çıktısındaki bağlantıyı tarayıcıda (oturum açmadan, gizli pencerede) açın.
- **Hız sınırı:** Yanlış kodu aynı IP'den 8 kez girince yaklaşık 15 dakika engellenirsiniz.

## 12. Yayına alma kontrol listesi

- [ ] **HTTPS zorunlu.** Uygulamayı bir reverse proxy (Nginx, Caddy) veya HTTPS sağlayan bir platform arkasında çalıştırın. Üretimde çerezler `Secure` + `__Host-` önekiyle gönderilir; HTTPS olmadan giriş çalışmaz.
- [ ] `NODE_ENV=production`, `APP_BASE_URL=https://alanadiniz.com`.
- [ ] Reverse proxy arkasındaysanız `TRUST_PROXY=1` (aksi halde hız sınırı ve erişim geçmişi proxy'nin IP'sini görür).
- [ ] `HEALTH_DATA_KEY`, `TOKEN_PEPPER`, `CSRF_SECRET` ortam değişkeni veya platformun gizli yönetimiyle verilir; depoya girmez. `HEALTH_DATA_KEY` yedeklenmiştir.
- [ ] Veritabanı yedeği alınıyor (şifreli veri, anahtarsız işe yaramaz; anahtar ayrıca yedeklenmeli).
- [ ] `SMTP_*` ayarlıdır (aksi halde şifre sıfırlama e-postası gitmez).
- [ ] Gizlilik metnindeki veri sorumlusu bilgisi dolduruldu ve metin hukuk uzmanınca gözden geçirildi.
- [ ] `npm run db:deploy` çalıştırıldı.
- [ ] **Hız sınırı sayaçları bellektedir.** Tek sunucu için yeterlidir; birden çok sunucu/örnek çalıştıracaksanız Redis gibi ortak bir depo gerekir.
- [ ] Demo seed hesabı üretimde yoktur (seed üretimde zaten çalışmaz).

## 13. API rotaları

Tüm adresler `/api` ile başlar. Yanıtlar JSON'dur. Hatalar `{ "error": { "code", "message", "fields?" } }` biçimindedir; `fields` alan hatalarının çeviri anahtarlarını taşır.

**Yetkilendirme sütunu:** *Yok* = oturumsuz; *Oturum* = geçerli oturum çerezi; *CSRF* = `x-csrf-token` başlığı gerekir (durum değiştiren tüm istekler; önce `GET /api/csrf-token`).

### Genel

| Yöntem | Adres | Yetki | Açıklama |
|---|---|---|---|
| GET | `/api/health` | Yok | Sağlık kontrolü. |
| GET | `/api/csrf-token` | Yok | CSRF belirteci verir. Giriş/çıkıştan sonra yenilenir (yanıtta zaten gelir). |

### Kimlik doğrulama (`/api/auth`)

| Yöntem | Adres | Yetki | Açıklama |
|---|---|---|---|
| POST | `/register` | CSRF | Hesap oluşturur, oturum açar. İki ayrı onay (`acceptPrivacy`, `acceptHealthData`) zorunlu. |
| POST | `/login` | CSRF | Giriş. Hatalı bilgide hesabı belli etmeyen tek hata. |
| POST | `/logout` | CSRF | Oturumu sunucuda kapatır. |
| GET | `/me` | Oturum | Mevcut kullanıcı. |
| POST | `/forgot-password` | CSRF | Şifre sıfırlama talebi. Hesap var/yok aynı yanıt; `delivery` alanı e-posta servisinin yapılandırılıp yapılmadığını bildirir. |
| POST | `/reset-password` | CSRF | Token ile yeni şifre. Token 30 dk geçerli, tek kullanımlık; tüm oturumlar kapanır. |
| POST | `/change-password` | Oturum + CSRF | Şifre değiştirir; diğer oturumlar kapanır. |

### Sağlık profili (`/api/profile`), hepsi Oturum gerektirir

| Yöntem | Adres | Açıklama |
|---|---|---|
| GET | `/` | Tüm profil (çözülmüş), görünürlük ayarları, tamamlanma durumu. |
| PUT | `/` | Ad, doğum tarihi, kan grubu, acil durum notu. |
| PATCH | `/visibility` | Alan bazında göster/gizle (kısmi). |
| POST | `/allergies`, `/conditions`, `/medications`, `/contacts` | Kayıt ekler (CSRF). |
| PUT, DELETE | `/allergies/:id`, `/conditions/:id`, `/medications/:id`, `/contacts/:id` | Düzenler/siler (CSRF). Başkasının kaydı için 404. |
| PUT | `/contacts/order` | Kişi sırasını değiştirir. Gövde: `{ "ids": [...] }` |

### Etiketler (`/api/tags`), Oturum

| Yöntem | Adres | Açıklama |
|---|---|---|
| GET | `/` | Kullanıcının etiketleri. Yalnızca aktif olanın `url` ve `shortCode` alanı vardır. |
| POST | `/` | Etiket oluşturur (CSRF). Aktif etiket varsa 409. |
| POST | `/:id/regenerate` | Eskisini iptal edip yenisini üretir (CSRF). |
| POST | `/:id/revoke` | Etiketi iptal eder (CSRF). |

### Herkese açık (`/api/public`), oturum ve CSRF gerekmez

| Yöntem | Adres | Açıklama |
|---|---|---|
| GET | `/emergency/:token` | Acil durum verisi. Yalnızca görünür alanlar döner. Geçersiz ve iptal edilmiş token aynı 404'ü verir. `?via=code` yalnızca erişim geçmişi etiketini belirler. |
| POST | `/access` | Gövde: `{ "code": "XXXXX-XXXXX" }`. Geçerliyse `{ "token" }` döner, sağlık verisi dönmez. Hız sınırlıdır. |

### Erişim geçmişi ve hesap

| Yöntem | Adres | Yetki | Açıklama |
|---|---|---|---|
| GET | `/api/access-logs?limit&cursor` | Oturum | Yalnızca kendi etiketlerinin erişim kayıtları (sayfalı). |
| GET | `/api/account` | Oturum | Hesap bilgileri ve onay kayıtları. |
| DELETE | `/api/account` | Oturum + CSRF | Hesabı ve ilişkili tüm veriyi siler. Gövde: `{ "password" }` |
| DELETE | `/api/account/health-data` | Oturum + CSRF | Sağlık verisini ve erişim geçmişini siler, etiketi iptal eder. Hesap kalır. Gövde: `{ "password" }` |

### Arayüz sayfaları

`/` ana sayfa · `/register` · `/login` · `/forgot-password` · `/reset-password` · `/privacy` (kullanım bilgisi `/privacy#usage`) · `/access` · `/e/:token` · `/dashboard` · `/dashboard/profile` · `/dashboard/tags` · `/dashboard/access-logs` · `/dashboard/settings`

## 14. Güvenlik tasarımı

- **Parolalar** Argon2id ile özetlenir; düz saklanmaz.
- **Oturum:** çerezde rastgele kimlik, veritabanında yalnızca SHA-256 özeti. Çerez `HttpOnly`, `SameSite=Lax`, üretimde `Secure` + `__Host-`.
- **CSRF:** durum değiştiren tüm kimlikli isteklerde çift gönderim belirteci, oturuma bağlı.
- **Sağlık verisi** alan bazında **AES-256-GCM** ile şifrelenir. Anahtar yalnızca ortam değişkenindedir.
- **Etiket tokenı** 256 bit rastgeledir; veritabanında HMAC-SHA256 özeti ve (panelde tekrar gösterebilmek için) şifreli kopya tutulur. İptalde şifreli kopya da silinir.
- **Kısa kod** 10 karakter (~50 bit). Daha zayıf bir yöntemdir ve bu yüzden: IP başına 8 başarısız deneme sınırı, genel saatlik 500 başarısız deneme tavanı ve yalnızca başarısız denemelerin sayılması uygulanır. Kod doğrudan veri döndürmez, yalnızca token verir.
- **Acil durum yanıtı** beyaz liste ile sunucuda oluşturulur; gizli ve boş alanlar yanıta hiç girmez, iç kimlikler döndürülmez.
- **Erişim kaydı:** zaman, tür, kırpılmış IP (`/24`); sağlık verisi yazılmaz; 30 günden eski kayıtlar silinir.
- **Başlıklar:** Helmet, sıkı CSP, `Referrer-Policy: no-referrer` (token URL'de), API için `Cache-Control: no-store`, acil durum sayfası için `X-Robots-Tag: noindex`.
- **Sahiplik kontrolü** her sorguda sunucuda yapılır (id yalnızca oturum sahibinin profili kapsamında aranır). Başkasının kaydı için 403 yerine 404 döner.
- Üretimde HTTPS olmadan veya gizli anahtarlar eksikken uygulama **başlamaz**.

## 15. Bilinen sınırlar

- **Gerçek cihaz testi yapılmadı:** NFC etikete yazma/okuma, telefonda görsel kontrol (kontrast, taşma) ve SMTP ile e-posta gönderimi. Otomatik testler bunları kapsamaz.
- **`prisma migrate` doğrulanmadı** (bölüm 6'daki not).
- Hız sınırı sayaçları **bellekte**; çok örnekli kurulumda ortak depo gerekir.
- Genel kısa kod sınırı (saatte 500 başarısız deneme) dağıtık bir saldırıda meşru kısa kod girişlerini de geçici olarak engeller; uzun token ile NFC/QR erişimi etkilenmez. Bu bilinçli bir ödünleşimdir.
- E-posta kayıtta zaten kullanılıyorsa bunu söyleriz (spesifikasyon bunu istiyor); bu, hesap varlığının sorgulanabilmesi demektir. Hız sınırı bunu yavaşlatır, tamamen kapatmaz.
- Panelde tek aktif etiket yönetilir; veri modeli çoklu etikete hazırdır.
- Erişim kaydındaki "kısa kod" ayrımı istemci bildirimine dayanır (yetki sağlamaz, yalnızca kullanıcının kendi geçmişindeki etiketi etkiler).
- Gizlilik metni taslaktır; hukuki inceleme gerektirir.
