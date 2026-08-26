# Kenan - Komut Tabanlı Web Oyunu

Hiyerarşik kölelik sistemi ile çalışan, komut tabanlı bir web oyunu.

## Özellikler

- **Hiyerarşik Kölelik Sistemi**: Her yeni kullanıcı, davet kodunu aldığı kişinin kölesi olarak başlar
- **Günlük Ödül Sistemi**: Köleler günlük altın kazanır, sahipleri de köle başına ödül alır
- **Referral Sistemi**: Oyuna katılmak için bir referral kodu gereklidir
- **Komut Tabanlı Arayüz**: Terminal benzeri komut sistemi
- **Kullanıcı Sistemi**: Kayıt, giriş ve kullanıcı yönetimi
- **Oyun Mekanikleri**: Çalışma, seviye, deneyim ve para sistemi
- **Piramit Yapısı**: Kölelerin köleleri olabilir, sonsuz hiyerarşi

## Kurulum

Detayli yerel/sunucu kurulum adimlari icin [KURULUM.md](KURULUM.md) dosyasina bakin.

1. Bağımlılıkları yükleyin:
```bash
npm install
```

2. Sunucuyu başlatın:
```bash
npm start
```

Geliştirme modu için:
```bash
npm run dev
```

3. Tarayıcıda açın:
```
http://localhost:3000
```

## İlk Kullanım

İlk admin kullanıcı otomatik oluşturulur:
- **Kullanıcı Adı**: `admin`
- **Şifre**: `admin123`
- **Referral Kodu**: `ADMIN001`

Bu referral kodu ile yeni kullanıcılar kayıt olabilir.

## Komutlar

- `help` - Mevcut komutları gösterir
- `stats` - Karakter istatistiklerini gösterir (köle sayısı dahil)
- `referral` - Referral kodunu ve davet linkini gösterir
- `daily` - Günlük ödülünü al (köleler için 50-100 altın)
- `slaves` - Sahip olduğun köleleri listele
- `masters` - Köle sahiplerini göster (hiyerarşik yapı)
- `work` - Çalış ve para kazan
- `level` - Seviye bilgilerini gösterir
- `clear` - Ekranı temizle

## Oyun Mekanikleri

### Kölelik Sistemi
- Yeni kullanıcılar, referral kodunu kullandıkları kişinin kölesi olarak başlar
- Köleler `daily` komutu ile günlük 50-100 altın kazanır
- Köle sahipleri, her kölesi günlük ödül aldığında otomatik olarak 10-20 altın kazanır
- Köleler de başkalarını davet ederek kendi kölelerini oluşturabilir
- Bu şekilde sonsuz hiyerarşik bir piramit yapısı oluşur

### Kazanç Sistemi
- **Köleler**: Günlük 50-100 altın (günde bir kez)
- **Köle Sahipleri**: Her köle başına 10-20 altın (köle günlük ödül aldığında)
- **Çalışma**: `work` komutu ile rastgele 10-60 altın kazanabilirsiniz

## Teknolojiler

- **Backend**: Node.js, Express.js
- **Veritabanı**: SQLite
- **Frontend**: HTML, CSS, JavaScript
- **Kimlik Doğrulama**: JWT

## Analiz ve Gelistirme Notlari

Oyun mantigi hatalari ve tasarim onerileri icin [OYUN_ANALIZI.md](OYUN_ANALIZI.md) dosyasina bakin.
