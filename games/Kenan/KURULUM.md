# Kenan Sunucu Kurulum Rehberi

Bu belge Kenan oyununu yerel makinede veya bir Linux sunucuda calistirmak icin gerekli adimlari anlatir.

## Gereksinimler

- Node.js 18 veya daha yeni bir surum
- npm
- SQLite destekli `sqlite3` Node paketi
- Sunucuda 3000 portuna erisim izni

## Projeyi Sunucuya Kopyalama

Projeyi sunucuya kopyalamak icin Git kullaniliyorsa:

```bash
git clone <repo-adresi> kenan
cd kenan
```

Dosyalar elle aktariliyorsa proje klasorunde en az su dosyalar bulunmalidir:

- `server.js`
- `package.json`
- `package-lock.json`
- `public/`
- `README.md`

`node_modules/` klasorunu farkli isletim sistemleri arasinda tasimayin. Ozellikle Windows'ta kurulmus `node_modules`, Linux/WSL sunucuda `sqlite3 invalid ELF header` hatasi verebilir.

## Bagimlilik Kurulumu

Sunucuda proje klasorune girip bagimliliklari kurun:

```bash
npm install
```

Eger `node_modules` daha once farkli ortamda olustuysa, temiz kurulum yapin:

```bash
rm -rf node_modules
npm install
```

WSL veya Linux uzerinde sadece `sqlite3` native modulunu yeniden derlemek gerekirse:

```bash
npm rebuild sqlite3
```

## Ortam Degiskenleri

Canli sunucuda varsayilan JWT sirrini kullanmayin.

```bash
export JWT_SECRET="uzun-rastgele-bir-deger"
export PORT=3000
```

Windows PowerShell icin:

```powershell
$env:JWT_SECRET="uzun-rastgele-bir-deger"
$env:PORT="3000"
```

## Sunucuyu Baslatma

Gelistirme veya basit calistirma:

```bash
npm start
```

Basarili acilis ciktisi:

```text
Sunucu http://localhost:3000 adresinde calisiyor
Veritabanina baglandi.
```

Tarayicida acilacak adres:

```text
http://localhost:3000/
```

`http://localhost:3000/api` ana sayfaya yonlendirilir. API endpointleri `/api/login`, `/api/register`, `/api/user` gibi alt yollardadir.

## Ilk Giris

Veritabani ilk kez olustugunda admin kullanici otomatik eklenir:

- Kullanici adi: `admin`
- Sifre: `admin123`
- Davet kodu: `ADMIN001`

Canli sunucuda ilk giristen sonra admin sifresini degistirecek bir yonetim akisi eklenmeli veya veritabaninda sifre guvenli sekilde yenilenmelidir.

## Kalici Calistirma

Basit bir Linux sunucuda uygulamayi surekli acik tutmak icin `pm2` kullanilabilir:

```bash
npm install -g pm2
pm2 start server.js --name kenan
pm2 save
pm2 startup
```

Loglari izlemek:

```bash
pm2 logs kenan
```

Yeniden baslatmak:

```bash
pm2 restart kenan
```

## Reverse Proxy Ornegi

Nginx ile 80 portundan Node uygulamasina yonlendirme:

```nginx
server {
    listen 80;
    server_name oyun.example.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Sik Karsilasilan Sorunlar

### `sqlite3 invalid ELF header`

Sebep: `node_modules` farkli isletim sisteminde kurulmustur.

Cozum:

```bash
rm -rf node_modules
npm install
```

veya:

```bash
npm rebuild sqlite3
```

### Site acilmiyor

Kontrol edin:

```bash
ss -ltnp
```

3000 portunda `node` dinlemelidir. Sonra:

```bash
curl -I http://127.0.0.1:3000/
```

### Port kullanimda

Farkli portla baslatin:

```bash
PORT=3001 npm start
```

ve tarayicida:

```text
http://localhost:3001/
```

