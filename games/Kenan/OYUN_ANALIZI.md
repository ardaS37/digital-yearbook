# Kenan Oyun Mantigi Analizi ve Oneriler

Bu belge mevcut kod uzerinden tespit edilen mantik hatalarini, teknik riskleri ve oyun tasarimi onerilerini listeler.

## Oncelikli Mantik Hatalari

1. Evlilik ve cocuk sistemi ayni anda iki farkli modele dayanmis durumdaydi.
   Eski kod `spouse_id` kullanirken asil evlilik modeli `marriages` tablosuydu. Bu durum SQL hatalarina ve cocuk listeleme sorunlarina yol aciyordu. Kod `marriages` tablosuna gore duzeltildi.

2. `have-child` endpointinde kadin kullanici icin es bilgisi asenkron okunuyor, fakat cocuk olusturma kodu bu okuma tamamlanmadan devam edebiliyordu.
   Bu durumda `fatherId` bos kalabilir ve cocuk sayisi yanlis guncellenebilirdi. Akis evlilik dogrulamasi tamamlandiktan sonra cocuk olusturacak sekilde duzeltildi.

3. Erkek kullanici icin cocuk yaparken secilen `wifeId` daha once dogrulanmiyordu.
   Kullanici teorik olarak evli olmadigi bir kadin ID'si gonderip cocuk olusturabilirdi. Artik `marriages` tablosundan dogrulaniyor.

4. `/api/sell-slave` iki kez tanimli.
   Ilk tanim Express tarafindan once yakalandigi icin ikinci, krallik bazli surum beklenildigi gibi calismayabilir. Bu route tek hale getirilmeli.

5. Gida satma endpointi gida yerine altin kontrol ediyor.
   `sell-food` icinde kullanicinin yeterli `food` degeri kontrol edilmeli. Mevcut mantik negatif gida veya hatali reddetme uretebilir.

6. Cocuk sayisi ve cocuk kaydi modeli eksik.
   `children` tablosunda sadece `user_id` var ve bu alan anne gibi kullaniliyor. Uzun vadede `mother_id` ve `father_id` seklinde ayrilmali.

7. Gunluk odul ekonomisi cok hizli siser.
   Evlilik bonusu, cocuk bonusu, kole bonusu ve yatirim getirileri birlikte altin enflasyonunu hizlandiriyor.

8. Yatirim sistemi risksiz ve sabit karli.
   Oyuncu yeterli altina ulastiktan sonra yatirim, diger oyun mekaniklerinden daha baskin strateji olur.

9. Savas sonucu sadece toplam seviye ve silah uzerinden hesaplaniyor.
   Strateji, savunma, kayip, ittifak, moral veya komutan etkisi yok. Bu nedenle savaslar sayisal karsilastirma gibi kalabilir.

10. Bazi cok adimli ekonomi islemleri transaction kullanmiyor.
    Kole satin alma, ozgurluk satin alma, vergi ve pazar islemleri kismen tamamlanirsa veriler tutarsiz kalabilir.

## Teknik Riskler

- `JWT_SECRET` varsayilan degerle geliyor. Canli sunucuda ortam degiskeni zorunlu hale getirilmeli.
- Admin hesabi `admin/admin123` olarak otomatik olusuyor. Canli ortamda ilk giris sonrasi sifre degistirme zorunlu olmali.
- Frontend tarafinda bircok veri `innerHTML` ile ekrana basiliyor. Kullanici adlari ve mesaj icerikleri HTML escape edilmezse XSS riski olusur.
- `API_URL` frontendde `http://localhost:3000/api` olarak sabit. Canli ortamda relative `/api` kullanmak daha saglikli olur.
- Veritabani migrationlari dağinik. Ayrica migration versiyon tablosu yok.

## Oyun Tasarimi Onerileri

### Ekonomi

- Gunluk odulleri seviyeye, rütbeye ve krallik refahina baglayin.
- Evlilik bonusunu sabit 500 yerine yuzdesel veya azalan getirili yapin.
- Cocuklar sadece bonus degil, gida tuketimi, egitim maliyeti ve gelecekte rol kazanimi gibi uzun vadeli karar olsun.
- Yatirimlara risk, bekleme suresi, erken bozma cezasi ve krallik ekonomisine bagli degisken getiri ekleyin.

### Krallik ve Rütbe

- Rütbelere net yetkiler verin:
  - Kral: vergi orani, savas ilani, vezir atama.
  - Vezir: pazar vergisi, duyuru, sinirli rütbe atama.
  - Komutan: savas hazirligi ve savunma bonusu.
  - Asilzade: ticaret indirimi veya ek uretim.
- Kralin vergi oranini belirlemesi guzel bir stratejik alan yaratir, fakat cok yuksek vergi isyan riskini artirmali.

### Savas

- Savas gucunu sadece silah ve seviyeden cikarin:
  - Asker sayisi
  - Komutan rütbesi
  - Krallik morali
  - Savunma bonusu
  - Lojistik/gida stoku
- Savas sonunda kazanan her seyi almamali; kaynak kaybi, itibar, tazminat veya vassallik gibi sonuclar olabilir.

### Aile Sistemi

- Cocuklara yas, egitim, meslek ve miras sistemi eklenebilir.
- Cocuklar belirli sure sonra oyuncuya kaynak, asker veya diplomasi bonusi verebilir.
- Evlilikler diplomatik ittifak veya kralliklar arasi iliski mekanigine baglanabilir.

### Pazar

- Malzeme ve gida fiyatlari sabit olmak yerine arz-talep veya krallik vergisine gore degisebilir.
- Kole pazarinda listeleme ucreti, satis vergisi ve pazardan kaldirma islemi eklenmeli.
- Satisa cikarilan kole icin durum bilgisi kullanilmali; aktif satistaki kole tekrar satilamamali veya baska islemlerde kullanilamamali.

### Yeni Oyuncu Deneyimi

- Ilk giriste kisa gorev zinciri ekleyin:
  - Gunluk odul al
  - Referans kodunu gor
  - Haritayi ac
  - Pazardan gıda al
  - Uretim baslat
- README'deki "komut tabanli" tanimi guncellenmeli; arayuz artik sekmeli web oyunu.

