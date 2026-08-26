const KENAN_BASE_PATH = window.KENAN_BASE_PATH || (window.location.pathname.startsWith('/games/kenan/play') ? '/games/kenan/play' : '');
const API_URL = `${window.location.origin}${KENAN_BASE_PATH}/api`;

let authToken = localStorage.getItem('token');
let currentUser = null;
let resources = { gold: 0, food: 0, material: 0, slaves: 0, weapons: 0 };
let adminPanelState = {
    query: '',
    kingdom: 'all',
    rank: 'all'
};
let adminPanelCache = {
    loaded: false,
    users: [],
    kingdoms: [],
    auditLogs: [],
    auditLogError: ''
};

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getInitialPage() {
    const hashPage = window.location.hash.replace('#', '').trim();
    if (hashPage) return hashPage;

    const pathPage = window.location.pathname.replace(/^\/+/, '').trim();
    return pathPage || 'overview';
}

function updateAdminPanelFilter(key, value) {
    adminPanelState[key] = value;
    renderAdminPanel();
}

function resetAdminPanelFilters() {
    adminPanelState.query = '';
    adminPanelState.kingdom = 'all';
    adminPanelState.rank = 'all';
    renderAdminPanel();
}

function getFilteredAdminUsers() {
    const query = String(adminPanelState.query || '').trim().toLowerCase();
    return adminPanelCache.users.filter(user => {
        const matchesQuery = !query
            || String(user.username || '').toLowerCase().includes(query)
            || String(user.kingdom_name || '').toLowerCase().includes(query)
            || String(user.rank || '').toLowerCase().includes(query);
        const matchesKingdom = adminPanelState.kingdom === 'all'
            || Number(user.kingdom_id) === Number(adminPanelState.kingdom);
        const matchesRank = adminPanelState.rank === 'all'
            || String(user.rank || '') === adminPanelState.rank;
        return matchesQuery && matchesKingdom && matchesRank;
    });
}

// Ayarlar
let settings = {
    language: localStorage.getItem('language') || 'tr',
    theme: localStorage.getItem('theme') || 'dark',
    wallpaper: localStorage.getItem('wallpaper') || ''
};

// Çeviriler
const translations = {
    tr: {
        'Genel Bakış': 'Genel Bakış',
        'Harita': 'Harita',
        'Köleler': 'Köleler',
        'Hiyerarşi': 'Hiyerarşi',
        'Davet': 'Davet',
        'Rütbe Yönetimi': 'Rütbe Yönetimi',
        'Köle Pazarı': 'Köle Pazarı',
        'Özgür Kal': 'Özgür Kal',
        'İstatistikler': 'İstatistikler',
        'Ayarlar': 'Ayarlar',
        'Dil': 'Dil',
        'Tema': 'Tema',
        'Duvar Kağıdı': 'Duvar Kağıdı',
        'Aydınlık': 'Aydınlık',
        'Karanlık': 'Karanlık',
        'Türkçe': 'Türkçe',
        'İngilizce': 'İngilizce',
        'Duvar kağıdı URL\'si girin': 'Duvar kağıdı URL\'si girin',
        'Kaydet': 'Kaydet',
        'Altın': 'Altın',
        'Gıda': 'Gıda',
        'Malzeme': 'Malzeme',
        'Köle': 'Köle',
        'Silah': 'Silah',
        'Malzeme Pazarı': 'Malzeme Pazarı',
        'Üretim': 'Üretim',
        'Özgürsünüz!': 'Özgürsünüz!',
        'Zaten özgür bir vatandaşsınız.': 'Zaten özgür bir vatandaşsınız.',
        'Özgürlük Satın Alma': 'Özgürlük Satın Alma',
        'Köle Sahibiniz:': 'Köle Sahibiniz:',
        'Seviyeniz:': 'Seviyeniz:',
        'Mevcut Altınınız:': 'Mevcut Altınınız:',
        'Özgürlük Bedeli:': 'Özgürlük Bedeli:',
        'Yeterli altınınız var!': 'Yeterli altınınız var!',
        'Yeterli altınınız yok!': 'Yeterli altınınız yok!',
        'Eksik:': 'Eksik:',
        'Özgürlüğümü Satın Al': 'Özgürlüğümü Satın Al',
        'Yetersiz Altın': 'Yetersiz Altın',
        'altın': 'altın',
        'Mevcut Krallığınız': 'Mevcut Krallığınız',
        'Bilinmiyor': 'Bilinmiyor',
        'Tüm Krallıklar': 'Tüm Krallıklar',
        'Mevcut': 'Mevcut',
        'Vatandaş Sayısı': 'Vatandaş Sayısı',
        'Kral': 'Kral',
        'Seyahat Et': 'Seyahat Et',
        'Buradasınız': 'Buradasınız',
        'Krallık bulunamadı.': 'Krallık bulunamadı.',
        'Bu krallığa seyahat etmek için 100 altın ödemeniz gerekiyor. Devam etmek istiyor musunuz?': 'Bu krallığa seyahat etmek için 100 altın ödemeniz gerekiyor. Devam etmek istiyor musunuz?',
        'Seyahat maliyeti': 'Seyahat maliyeti',
        'Yeni bakiyeniz': 'Yeni bakiyeniz',
        'Hata oluştu': 'Hata oluştu',
        'Bağlantı hatası': 'Bağlantı hatası',
        'Bu pazarda sadece': 'Bu pazarda sadece',
        'krallığındaki köleler görüntülenir ve satılabilir.': 'krallığındaki köleler görüntülenir ve satılabilir.',
        'Entrika': 'Entrika',
        'İsyan Çıkar': 'İsyan Çıkar',
        'Zaten Kralsınız!': 'Zaten Kralsınız!',
        'krallığının kralısınız.': 'krallığının kralısınız.',
        'Bir krallığın kralısınız.': 'Bir krallığın kralısınız.',
        'İsyan Gereksinimleri': 'İsyan Gereksinimleri',
        'Köle Sayısı': 'Köle Sayısı',
        'Mevcut Krallık': 'Mevcut Krallık',
        'Mevcut Kral': 'Mevcut Kral',
        'Bu krallığın henüz bir kralı yok.': 'Bu krallığın henüz bir kralı yok.',
        'İsyan Çıkar!': 'İsyan Çıkar!',
        'İsyan çıkarmak için gereksinimleri karşılamıyorsunuz.': 'İsyan çıkarmak için gereksinimleri karşılamıyorsunuz.',
        '1000 altın ödeyerek isyan çıkarmak ve kendinizi kral yapmak istediğinize emin misiniz?': '1000 altın ödeyerek isyan çıkarmak ve kendinizi kral yapmak istediğinize emin misiniz?',
        'Yatırımlar': 'Yatırımlar',
        'Yatırım Paketleri': 'Yatırım Paketleri',
        'Yatırım Geçmişim': 'Yatırım Geçmişim',
        'Günlük Yatırım': 'Günlük Yatırım',
        'Kar': 'Kar',
        'Yatırım Tutarı': 'Yatırım Tutarı',
        'Toplam Getiri': 'Toplam Getiri',
        'Yatırım Tarihi': 'Yatırım Tarihi',
        'Tamamlandı': 'Tamamlandı',
        'Beklemede': 'Beklemede',
        'Tamamlanma': 'Tamamlanma',
        'Geri Çek': 'Geri Çek',
        'Henüz yatırım yapmadınız.': 'Henüz yatırım yapmadınız.',
        'Geçerli bir tutar girin! Minimum 100 altın.': 'Geçerli bir tutar girin! Minimum 100 altın.',
        'günlük yatırım için minimum': 'günlük yatırım için minimum',
        'altın gereklidir.': 'altın gereklidir.',
        'altın ile': 'altın ile',
        'günlük yatırım yapmak istediğinize emin misiniz?': 'günlük yatırım yapmak istediğinize emin misiniz?',
        'Yatırımı geri çekmek istediğinize emin misiniz?': 'Yatırımı geri çekmek istediğinize emin misiniz?',
        'Antik Ortadoğu İmparatorluğu': 'Antik Ortadoğu İmparatorluğu',
        'Giriş Yap': 'Giriş Yap',
        'Kullanıcı Adı': 'Kullanıcı Adı',
        'Şifre': 'Şifre',
        'Hesabın yok mu?': 'Hesabın yok mu?',
        'Kayıt Ol': 'Kayıt Ol',
        'Oyuna katılmak için bir referans kodu gereklidir.': 'Oyuna katılmak için bir referans kodu gereklidir.',
        'Referans Kodu': 'Referans Kodu',
        'Cinsiyet Seçin': 'Cinsiyet Seçin',
        'Erkek': 'Erkek',
        'Kadın': 'Kadın',
        'Zaten hesabın var mı?': 'Zaten hesabın var mı?',
        'Çıkış': 'Çıkış',
        'İmparatorluk': 'İmparatorluk',
        'Yönetim': 'Yönetim',
        'Aile': 'Aile',
        'Evlilik': 'Evlilik',
        'Teklifler': 'Teklifler',
        'Pazar': 'Pazar',
        'Gıda Pazarı': 'Gıda Pazarı',
        'Diğer': 'Diğer',
        'Gelen Kutusu': 'Gelen Kutusu',
        'Küresel Sıralamalar': 'Küresel Sıralamalar',
        'İmparatorluğun Genel Bakışı': 'İmparatorluğun Genel Bakışı',
        'Günlük Ödül': 'Günlük Ödül',
        'Günlük Ödülü Al': 'Günlük Ödülü Al',
        'Kölelerim': 'Kölelerim',
        'Davet Sistemi': 'Davet Sistemi',
        'Evlilik Durumu': 'Evlilik Durumu',
        'Gelen/Giden Teklifler': 'Gelen/Giden Teklifler',
        'Dünya Haritası': 'Dünya Haritası',
    },
    en: {
        'Genel Bakış': 'Overview',
        'Harita': 'Map',
        'Köleler': 'Slaves',
        'Hiyerarşi': 'Hierarchy',
        'Davet': 'Invite',
        'Rütbe Yönetimi': 'Rank Management',
        'Köle Pazarı': 'Slave Market',
        'Özgür Kal': 'Buy Freedom',
        'İstatistikler': 'Statistics',
        'Ayarlar': 'Settings',
        'Dil': 'Language',
        'Tema': 'Theme',
        'Duvar Kağıdı': 'Wallpaper',
        'Aydınlık': 'Light',
        'Karanlık': 'Dark',
        'Türkçe': 'Turkish',
        'İngilizce': 'English',
        'Duvar kağıdı URL\'si girin': 'Enter wallpaper URL',
        'Kaydet': 'Save',
        'Altın': 'Gold',
        'Gıda': 'Food',
        'Malzeme': 'Material',
        'Köle': 'Slaves',
        'Silah': 'Weapons',
        'Malzeme Pazarı': 'Material Market',
        'Üretim': 'Production',
        'Özgürsünüz!': 'You are free!',
        'Zaten özgür bir vatandaşsınız.': 'You are already a free citizen.',
        'Özgürlük Satın Alma': 'Buy Freedom',
        'Köle Sahibiniz:': 'Your Master:',
        'Seviyeniz:': 'Your Level:',
        'Mevcut Altınınız:': 'Current Gold:',
        'Özgürlük Bedeli:': 'Freedom Price:',
        'Yeterli altınınız var!': 'You have enough gold!',
        'Yeterli altınınız yok!': 'You don\'t have enough gold!',
        'Eksik:': 'Missing:',
        'Özgürlüğümü Satın Al': 'Buy My Freedom',
        'Yetersiz Altın': 'Insufficient Gold',
        'altın': 'gold',
        'Mevcut Krallığınız': 'Current Kingdom',
        'Bilinmiyor': 'Unknown',
        'Tüm Krallıklar': 'All Kingdoms',
        'Mevcut': 'Current',
        'Vatandaş Sayısı': 'Population',
        'Kral': 'King',
        'Seyahat Et': 'Travel',
        'Buradasınız': 'You are here',
        'Krallık bulunamadı.': 'No kingdoms found.',
        'Bu krallığa seyahat etmek için 100 altın ödemeniz gerekiyor. Devam etmek istiyor musunuz?': 'You need to pay 100 gold to travel to this kingdom. Do you want to continue?',
        'Seyahat maliyeti': 'Travel cost',
        'Yeni bakiyeniz': 'New balance',
        'Hata oluştu': 'An error occurred',
        'Bağlantı hatası': 'Connection error',
        'Bu pazarda sadece': 'In this market, only',
        'krallığındaki köleler görüntülenir ve satılabilir.': 'kingdom\'s slaves are displayed and can be sold.',
        'Entrika': 'Intrigue',
        'İsyan Çıkar': 'Start Revolt',
        'Zaten Kralsınız!': 'You are already a King!',
        'krallığının kralısınız.': 'kingdom\'s king.',
        'Bir krallığın kralısınız.': 'You are a king of a kingdom.',
        'İsyan Gereksinimleri': 'Revolt Requirements',
        'Köle Sayısı': 'Slave Count',
        'Mevcut Krallık': 'Current Kingdom',
        'Mevcut Kral': 'Current King',
        'Bu krallığın henüz bir kralı yok.': 'This kingdom has no king yet.',
        'İsyan Çıkar!': 'Start Revolt!',
        'İsyan çıkarmak için gereksinimleri karşılamıyorsunuz.': 'You do not meet the requirements to start a revolt.',
        '1000 altın ödeyerek isyan çıkarmak ve kendinizi kral yapmak istediğinize emin misiniz?': 'Are you sure you want to pay 1000 gold to start a revolt and make yourself king?',
        'Yatırımlar': 'Investments',
        'Yatırım Paketleri': 'Investment Packages',
        'Yatırım Geçmişim': 'My Investment History',
        'Günlük Yatırım': 'Day Investment',
        'Kar': 'Profit',
        'Yatırım Tutarı': 'Investment Amount',
        'Toplam Getiri': 'Total Return',
        'Yatırım Tarihi': 'Investment Date',
        'Tamamlandı': 'Completed',
        'Beklemede': 'Pending',
        'Tamamlanma': 'Completion',
        'Geri Çek': 'Withdraw',
        'Henüz yatırım yapmadınız.': 'You haven\'t made any investments yet.',
        'Geçerli bir tutar girin! Minimum 100 altın.': 'Enter a valid amount! Minimum 100 gold.',
        'günlük yatırım için minimum': 'minimum for',
        'altın gereklidir.': 'gold required.',
        'altın ile': 'gold for',
        'günlük yatırım yapmak istediğinize emin misiniz?': 'day investment?',
        'Yatırımı geri çekmek istediğinize emin misiniz?': 'Are you sure you want to withdraw the investment?',
        'Antik Ortadoğu İmparatorluğu': 'Ancient Middle Eastern Empire',
        'Giriş Yap': 'Login',
        'Kullanıcı Adı': 'Username',
        'Şifre': 'Password',
        'Hesabın yok mu?': 'Don\'t have an account?',
        'Kayıt Ol': 'Register',
        'Oyuna katılmak için bir referans kodu gereklidir.': 'A referral code is required to join the game.',
        'Referans Kodu': 'Referral Code',
        'Cinsiyet Seçin': 'Select Gender',
        'Erkek': 'Male',
        'Kadın': 'Female',
        'Zaten hesabın var mı?': 'Already have an account?',
        'Çıkış': 'Logout',
        'İmparatorluk': 'Empire',
        'Yönetim': 'Management',
        'Aile': 'Family',
        'Evlilik': 'Marriage',
        'Teklifler': 'Proposals',
        'Pazar': 'Market',
        'Gıda Pazarı': 'Food Market',
        'Diğer': 'Other',
        'Gelen Kutusu': 'Inbox',
        'Küresel Sıralamalar': 'Global Rankings',
        'İmparatorluğun Genel Bakışı': 'Empire Overview',
        'Günlük Ödül': 'Daily Reward',
        'Günlük Ödülü Al': 'Claim Daily Reward',
        'Kölelerim': 'My Slaves',
        'Davet Sistemi': 'Referral System',
        'Evlilik Durumu': 'Marriage Status',
        'Gelen/Giden Teklifler': 'Incoming/Outgoing Proposals',
        'Dünya Haritası': 'World Map',
    }
};

// Çeviri fonksiyonu
function t(key) {
    return translations[settings.language]?.[key] || key;
}

// Kullanıcı verisini merkezi olarak çek
async function fetchCurrentUser() {
    try {
        const response = await fetch(`${API_URL}/user`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (!response.ok) {
            throw new Error('Kullanıcı oturumu geçersiz.');
        }
        currentUser = await response.json();

        // Kaynakları global nesneden güncelle
        if (currentUser) {
            resources.gold = currentUser.coins;
            resources.food = currentUser.food;
            resources.material = currentUser.material;
            resources.slaves = currentUser.slave_count;
            resources.weapons = currentUser.weapons;
        }

        return true;
    } catch (error) {
        console.error('Kullanıcı verisi alınamadı:', error);
        logout(); // Hata durumunda çıkış yap
        return false;
    }
}

// Ayarları uygula
function applySettings() {
    // Dil
    const htmlLang = document.getElementById('html-lang');
    if (htmlLang) {
        htmlLang.setAttribute('lang', settings.language);
    }
    
    // Tema
    const bodyTheme = document.getElementById('body-theme');
    if (bodyTheme) {
        bodyTheme.className = `theme-${settings.theme}`;
    }
    
    // Duvar kağıdı
    if (settings.wallpaper && settings.wallpaper.trim() !== '') {
        // wp/ ile başlıyorsa relative path, değilse absolute URL
        const wallpaperPath = settings.wallpaper.startsWith('wp/') ? settings.wallpaper : settings.wallpaper;
        
        // Duvar kağıdını ayarla - CSS gradient'lerini override etmek için !important kullan
        document.body.setAttribute('data-has-wallpaper', 'true');
        document.body.style.setProperty('background', 'transparent', 'important');
        document.body.style.setProperty('background-image', `url(${wallpaperPath})`, 'important');
        document.body.style.setProperty('background-size', 'cover', 'important');
        document.body.style.setProperty('background-position', 'center', 'important');
        document.body.style.setProperty('background-repeat', 'no-repeat', 'important');
        document.body.style.setProperty('background-attachment', 'fixed', 'important');
    } else {
        // Duvar kağıdı yoksa tüm background ayarlarını temizle
        document.body.removeAttribute('data-has-wallpaper');
        document.body.style.removeProperty('background');
        document.body.style.removeProperty('background-image');
        document.body.style.removeProperty('background-size');
        document.body.style.removeProperty('background-position');
        document.body.style.removeProperty('background-repeat');
        document.body.style.removeProperty('background-attachment');
    }
}


// Sayfa yüklendiğinde
document.addEventListener('DOMContentLoaded', () => {
    // Ayarları uygula
    applySettings();
    const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
    if (mobileMenuToggle) {
        mobileMenuToggle.addEventListener('click', () => {
            const isOpen = document.body.classList.toggle('menu-open');
            mobileMenuToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
            mobileMenuToggle.textContent = isOpen ? '×' : '☰';
        });
    }
    // URL'den referans kodunu al
    const urlParams = new URLSearchParams(window.location.search);
    const refCode = urlParams.get('ref');
    if (refCode) {
        const referralInput = document.getElementById('referral-code');
        if (referralInput) {
            referralInput.value = refCode;
        }
        showRegister();
    }

    if (authToken) {
        checkAuth();
    } else {
        showAuthScreen();
    }

    // Menü item click eventleri
    document.querySelectorAll('.menu-item').forEach(item => {
        item.addEventListener('click', () => {
            const page = item.getAttribute('data-page');
            switchPage(page);
            document.body.classList.remove('menu-open');
            if (mobileMenuToggle) {
                mobileMenuToggle.setAttribute('aria-expanded', 'false');
                mobileMenuToggle.textContent = '☰';
            }
        });
    });

    // Enter tuşu ile giriş/kayıt
    document.getElementById('login-username')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') login();
    });
    document.getElementById('login-password')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') login();
    });
    document.getElementById('register-username')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') register();
    });
    document.getElementById('register-password')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') register();
    });
    document.getElementById('referral-code')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') register();
    });

    // Kaynak güncellemelerini başlat
    if (authToken) {
        setInterval(updateResources, 5000); // Her 5 saniyede bir
    }
});

// Auth kontrolü
async function checkAuth() {
    if (await fetchCurrentUser()) {
        showGameScreen();
        await loadGameData();
    } else {
        showAuthScreen();
    }
}

// Giriş ekranını göster
function showAuthScreen() {
    document.getElementById('auth-screen').classList.add('active');
    document.getElementById('game-screen').classList.remove('active');
}

// Oyun ekranını göster
function showGameScreen() {
    document.getElementById('auth-screen').classList.remove('active');
    document.getElementById('game-screen').classList.add('active');
    updateUserInfo();
}

// Login formunu göster
function showLogin() {
    document.getElementById('register-form').classList.remove('active');
    document.getElementById('login-form').classList.add('active');
    clearMessage();
}

// Register formunu göster
function showRegister() {
    document.getElementById('login-form').classList.remove('active');
    document.getElementById('register-form').classList.add('active');
    clearMessage();
}

// Mesaj göster
function showMessage(text, type) {
    const messageEl = document.getElementById('auth-message');
    messageEl.textContent = text;
    messageEl.className = `message ${type}`;
}

// Mesajı temizle
function clearMessage() {
    const messageEl = document.getElementById('auth-message');
    messageEl.textContent = '';
    messageEl.className = 'message';
}

// Giriş yap
async function login() {
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;

    if (!username || !password) {
        showMessage('Lütfen tüm alanları doldurun', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok) {
            authToken = data.token;
            currentUser = data.user;
            localStorage.setItem('token', authToken);
            showGameScreen();
            await loadGameData();
        } else {
            showMessage(data.error || 'Giriş başarısız', 'error');
        }
    } catch (error) {
        showMessage('Bağlantı hatası', 'error');
        console.error('Login hatası:', error);
    }
}

// Kayıt ol
async function register() {
    const username = document.getElementById('register-username').value;
    const password = document.getElementById('register-password').value;
    const referralCode = document.getElementById('referral-code').value;
    const gender = document.getElementById('register-gender').value;

    if (!username || !password || !referralCode || !gender) {
        showMessage('Lütfen tüm alanları doldurun', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password, referralCode, gender })
        });

        const data = await response.json();

        if (response.ok) {
            authToken = data.token;
            currentUser = data.user;
            localStorage.setItem('token', authToken);
            showGameScreen();
            await loadGameData();
        } else {
            showMessage(data.error || 'Kayıt başarısız', 'error');
        }
    } catch (error) {
        showMessage('Bağlantı hatası', 'error');
        console.error('Register hatası:', error);
    }
}

// Çıkış yap
function logout() {
    localStorage.removeItem('token');
    authToken = null;
    currentUser = null;
    showAuthScreen();
}

// Oyun verilerini yükle
async function loadGameData() {
    await updateResources();
    await updateUserInfo();
    updateMenuTexts();
    updateResourceDisplay();
    switchPage(getInitialPage());
}

// Kaynakları güncelle
async function updateResources() {
    if (await fetchCurrentUser()) {
        updateResourceDisplay();
    }
}

// Kaynak görünümünü güncelle
function updateResourceDisplay() {
    document.getElementById('resource-gold').textContent = formatNumber(resources.gold);
    document.getElementById('resource-food').textContent = formatNumber(resources.food);
    document.getElementById('resource-material').textContent = formatNumber(resources.material);
    document.getElementById('resource-slaves').textContent = formatNumber(resources.slaves);
    document.getElementById('resource-weapons').textContent = formatNumber(resources.weapons || 0);
    
    // Kaynak isimlerini güncelle
    const resourceNames = document.querySelectorAll('.resource-name[data-key]');
    resourceNames.forEach(el => {
        const key = el.getAttribute('data-key');
        if (key) {
            el.textContent = `${t(key)}:`;
        }
    });
    
    // Overview sayfasındaki kaynaklar
    const overviewGold = document.getElementById('overview-gold');
    const overviewFood = document.getElementById('overview-food');
    const overviewMaterial = document.getElementById('overview-material');
    const overviewSlaves = document.getElementById('overview-slaves');
    
    if (overviewGold) overviewGold.textContent = formatNumber(resources.gold);
    if (overviewFood) overviewFood.textContent = formatNumber(resources.food);
    if (overviewMaterial) overviewMaterial.textContent = formatNumber(resources.material);
    if (overviewSlaves) overviewSlaves.textContent = formatNumber(resources.slaves);
    if (document.getElementById('overview-weapons')) document.getElementById('overview-weapons').textContent = formatNumber(resources.weapons || 0);
    
    // Overview sayfasındaki kaynak isimlerini güncelle
    const overviewLabels = document.querySelectorAll('.resource-label[data-key]');
    overviewLabels.forEach(el => {
        const key = el.getAttribute('data-key');
        if (key) {
            el.textContent = t(key);
        }
    });
}

// Sayı formatla
function formatNumber(num) {
    return new Intl.NumberFormat('tr-TR').format(num);
}

// Kullanıcı bilgilerini güncelle
function updateUserInfo() {
    if (currentUser) {
        document.getElementById('user-name').textContent = currentUser.username;
        const adminMenuItem = document.querySelector('[data-page="admin"]');
        if (adminMenuItem) {
            adminMenuItem.style.display = currentUser.username === 'admin' ? '' : 'none';
        }
        
        // Mevcut konumu her zaman göster
        if (currentUser.kingdom_name) {
            document.getElementById('user-kingdom').textContent = `🏰 Konum: ${currentUser.kingdom_name}`;
        }

        // Rütbeyi ve (varsa) krallığı göster
        if (currentUser.rank) {
            const rankEmojis = {
                'Kral': '👑',
                'Vezir': '⚔️',
                'Komutan': '🛡️',
                'Asilzade': '🏰',
                'Vatandaş': '👤'
            };
            const emoji = rankEmojis[currentUser.rank] || '👤';

            let rankText = `${emoji} ${currentUser.rank}`;
            if (currentUser.rank === 'Kral' && currentUser.ruled_kingdom_name) {
                rankText = `${emoji} ${currentUser.rank} (${currentUser.ruled_kingdom_name})`;
            }
            
            document.getElementById('user-rank').textContent = rankText;
        }
    }
}

// Sayfa değiştir
function switchPage(pageName) {
    // Tüm sayfaları gizle
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });

    // Tüm menü itemlerini pasif yap
    document.querySelectorAll('.menu-item').forEach(item => {
        item.classList.remove('active');
    });

    // Seçilen sayfayı göster
    const page = document.getElementById(`page-${pageName}`);
    if (page) {
        page.classList.add('active');
    }

    // Seçilen menü itemini aktif yap
    const menuItem = document.querySelector(`[data-page="${pageName}"]`);
    if (menuItem) {
        menuItem.classList.add('active');
    }

    // Sayfa içeriğini yükle
    loadPage(pageName);

    // Pencereyi yukarı kaydır
    window.scrollTo(0, 0);
}

// Sayfa içeriğini yükle
async function loadPage(pageName) {
    switch (pageName) {
        case 'overview':
            await loadOverview();
            break;
        case 'slaves':
            await loadSlaves();
            break;
        case 'masters':
            await loadMasters();
            break;
        case 'referral':
            await loadReferral();
            break;
        case 'stats':
            await loadStats();
            break;
        case 'slave-market':
            await loadSlaveMarket();
            break;
        case 'buy-freedom':
            await loadBuyFreedom();
            break;
        case 'map':
            await loadMap();
            break;
        case 'ranks':
            await loadRanks();
            break;
        case 'intrigue':
            await loadIntrigue();
            break;
        case 'investments':
            await loadInvestments();
            break;
        case 'material-market':
            await loadMaterialMarket();
            break;
        case 'production':
            await loadProduction();
            break;
        case 'wars':
            await loadWars();
            break;
        case 'food-market':
            await loadFoodMarket();
            break;
        case 'marriage':
            await loadMarriage();
            break;
        case 'proposals':
            await loadProposals();
            break;
        case 'inbox':
            await loadInbox();
            break;
        case 'global-rankings':
            await loadGlobalRankings();
            break;
        case 'admin':
            await loadAdminPanel();
            break;
        case 'settings':
            await loadSettings();
            break;
    }
}

function renderAdminPanel() {
    const content = document.getElementById('admin-content');
    if (!currentUser || currentUser.username !== 'admin') {
        content.innerHTML = '<p style="color: #ff6b6b;">Bu sayfa sadece admin hesabı içindir.</p>';
        return;
    }

    if (!adminPanelCache.loaded) {
        content.innerHTML = '<p>Kullanıcılar yükleniyor...</p>';
        return;
    }

    const users = Array.isArray(adminPanelCache.users) ? adminPanelCache.users : [];
    const kingdoms = Array.isArray(adminPanelCache.kingdoms) ? adminPanelCache.kingdoms : [];
    const auditLogs = Array.isArray(adminPanelCache.auditLogs) ? adminPanelCache.auditLogs : [];
    const rankOptions = ['Kral', 'Vezir', 'Komutan', 'Asilzade', 'Vatandaş'];
    const filteredUsers = getFilteredAdminUsers();
    const kingCount = kingdoms.filter(kingdom => kingdom.king_id).length;
    const kingdomFilterOptions = kingdoms
        .map(kingdom => `<option value="${kingdom.id}" ${Number(adminPanelState.kingdom) === Number(kingdom.id) ? 'selected' : ''}>${escapeHtml(kingdom.name)}</option>`)
        .join('');

    const userRows = filteredUsers.map(user => {
        const safeUsername = escapeHtml(user.username || '-');
        const isAdminAccount = user.username === 'admin';
        const deleteButton = user.username === 'admin'
            ? '<span style="color: #aaa;">Silinemez</span>'
            : `<button onclick="deleteAdminUser(${user.id}, '${safeUsername.replace(/'/g, "\\'")}')" style="padding: 7px 10px; background: #9b2226; border: none; color: #fff; font-weight: bold; border-radius: 5px; cursor: pointer; margin-left: 6px;">Sil</button>`;
        return `
            <tr style="border-top: 1px solid rgba(212,175,55,0.35);">
                <td style="padding: 8px;">${safeUsername}</td>
                <td style="padding: 8px;">
                    ${isAdminAccount
                        ? '<span style="color:#aaa; font-weight:700;">Dokunulmaz</span>'
                        : `<select id="admin-kingdom-${user.id}" class="admin-compact-input">
                            ${kingdoms.map(kingdom => `<option value="${kingdom.id}" ${Number(user.kingdom_id) === Number(kingdom.id) ? 'selected' : ''}>${escapeHtml(kingdom.name)}${Number(kingdom.king_id) === Number(user.id) ? ' 👑' : ''}</option>`).join('')}
                          </select>`}
                </td>
                <td style="padding: 8px;">
                    ${isAdminAccount
                        ? '<span style="color:#aaa; font-weight:700;">Yok</span>'
                        : `<select id="admin-master-${user.id}" class="admin-compact-input">
                            <option value="">Özgür</option>
                            ${users
                                .filter(candidate => candidate.id !== user.id)
                                .map(candidate => `<option value="${candidate.id}" ${Number(user.master_id) === Number(candidate.id) ? 'selected' : ''}>${escapeHtml(candidate.username)}</option>`)
                                .join('')}
                          </select>`}
                </td>
                <td style="padding: 8px;">
                    ${isAdminAccount
                        ? '<span style="color:#aaa; font-weight:700;">Admin</span>'
                        : `<select id="admin-rank-${user.id}" class="admin-compact-input" onchange="syncAdminRankOwner(${user.id})">
                            ${rankOptions.map(rank => `<option value="${rank}" ${user.rank === rank ? 'selected' : ''}>${rank}</option>`).join('')}
                          </select>`}
                </td>
                <td style="padding: 8px;">${isAdminAccount ? '<span style="color:#aaa;">-</span>' : `<input id="admin-level-${user.id}" type="number" min="1" value="${user.level || 1}" class="admin-number-input">`}</td>
                <td style="padding: 8px;">${isAdminAccount ? '<span style="color:#aaa;">-</span>' : `<input id="admin-experience-${user.id}" type="number" min="0" value="${user.experience || 0}" class="admin-number-input">`}</td>
                <td style="padding: 8px;">${isAdminAccount ? '<span style="color:#aaa;">-</span>' : `<input id="admin-coins-${user.id}" type="number" min="0" value="${user.coins || 0}" class="admin-number-input">`}</td>
                <td style="padding: 8px;">${isAdminAccount ? '<span style="color:#aaa;">-</span>' : `<input id="admin-food-${user.id}" type="number" min="0" value="${user.food || 0}" class="admin-number-input">`}</td>
                <td style="padding: 8px;">${isAdminAccount ? '<span style="color:#aaa;">-</span>' : `<input id="admin-material-${user.id}" type="number" min="0" value="${user.material || 0}" class="admin-number-input">`}</td>
                <td style="padding: 8px;">${isAdminAccount ? '<span style="color:#aaa;">-</span>' : `<input id="admin-weapons-${user.id}" type="number" min="0" value="${user.weapons || 0}" class="admin-number-input">`}</td>
                <td style="padding: 8px;">${user.slave_count || 0}</td>
                <td style="padding: 8px; white-space: nowrap;">
                    ${isAdminAccount
                        ? '<span style="color:#aaa; font-weight:700;">Yönetim dışı</span>'
                        : `<button onclick="saveAdminUser(${user.id})" style="padding: 7px 10px; background: #D4AF37; border: none; color: #8B4513; font-weight: bold; border-radius: 5px; cursor: pointer;">Kaydet</button>`}
                    ${deleteButton}
                </td>
            </tr>
        `;
    }).join('');

    const kingdomCards = kingdoms.map(kingdom => {
        const kingdomUsers = users.filter(user => Number(user.kingdom_id) === Number(kingdom.id));
        const currentKing = kingdomUsers.find(user => Number(user.id) === Number(kingdom.king_id));
        return `
            <div style="border: 1px solid rgba(212,175,55,0.35); border-radius: 12px; padding: 16px; background: rgba(0,0,0,0.14);">
                <div style="display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; align-items: start; margin-bottom: 12px;">
                    <div>
                        <h4 style="margin: 0 0 6px; color: #FFD700;">${escapeHtml(kingdom.name)}</h4>
                        <div style="color: #f4e4bc; font-size: 0.92em;">
                            Nüfus: ${kingdom.population || 0} · Kral: ${escapeHtml(kingdom.king_username || 'Yok')} · Vezir: ${kingdom.vezir_count || 0}
                        </div>
                    </div>
                    <div style="color: #f4e4bc; text-align: right;">
                        <div style="font-size: 0.9em;">Koordinat: (${escapeHtml(kingdom.x ?? '-')}, ${escapeHtml(kingdom.y ?? '-')})</div>
                        <div style="font-size: 0.9em;">Vergi: %${escapeHtml(kingdom.tax_rate ?? 10)} · Pazar: %${escapeHtml(kingdom.market_tax_rate ?? 0)}</div>
                    </div>
                </div>
                <div style="display: grid; gap: 10px; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));">
                    <label style="display: grid; gap: 6px; color: #f4e4bc;">
                        <span>Krallık Adı</span>
                        <input id="admin-kingdom-name-${kingdom.id}" type="text" value="${escapeHtml(kingdom.name)}" class="admin-compact-input">
                    </label>
                    <label style="display: grid; gap: 6px; color: #f4e4bc; grid-column: 1 / -1;">
                        <span>Açıklama</span>
                        <textarea id="admin-kingdom-desc-${kingdom.id}" class="admin-compact-input" style="min-height: 70px; resize: vertical;">${escapeHtml(kingdom.description || '')}</textarea>
                    </label>
                    <label style="display: grid; gap: 6px; color: #f4e4bc;">
                        <span>X</span>
                        <input id="admin-kingdom-x-${kingdom.id}" type="number" min="0" max="9999" value="${kingdom.x ?? ''}" class="admin-number-input">
                    </label>
                    <label style="display: grid; gap: 6px; color: #f4e4bc;">
                        <span>Y</span>
                        <input id="admin-kingdom-y-${kingdom.id}" type="number" min="0" max="9999" value="${kingdom.y ?? ''}" class="admin-number-input">
                    </label>
                    <label style="display: grid; gap: 6px; color: #f4e4bc;">
                        <span>Vergi Oranı</span>
                        <input id="admin-kingdom-tax-${kingdom.id}" type="number" min="0" max="25" value="${kingdom.tax_rate ?? 10}" class="admin-number-input">
                    </label>
                    <label style="display: grid; gap: 6px; color: #f4e4bc;">
                        <span>Pazar Vergisi</span>
                        <input id="admin-kingdom-market-tax-${kingdom.id}" type="number" min="0" max="15" value="${kingdom.market_tax_rate ?? 0}" class="admin-number-input">
                    </label>
                    <label style="display: grid; gap: 6px; color: #f4e4bc;">
                        <span>Kral Ata</span>
                        <select id="admin-kingdom-king-${kingdom.id}" class="admin-compact-input">
                            <option value="">Kral seçme / mevcut kalsın</option>
                            ${kingdomUsers.map(user => `<option value="${user.id}" ${Number(currentKing && currentKing.id) === Number(user.id) ? 'selected' : ''}>${escapeHtml(user.username)}</option>`).join('')}
                        </select>
                    </label>
                    <div style="display: flex; flex-direction: column; gap: 8px; justify-content: end;">
                        <button onclick="saveAdminKingdom(${kingdom.id})" style="padding: 9px 12px; background: #D4AF37; border: none; color: #8B4513; font-weight: bold; border-radius: 6px; cursor: pointer;">Krallığı Kaydet</button>
                        <button onclick="saveAdminKingdom(${kingdom.id}, true)" style="padding: 9px 12px; background: #9b2226; border: none; color: #fff; font-weight: bold; border-radius: 6px; cursor: pointer;">Kralı Kaldır</button>
                    </div>
                </div>
                <div id="admin-kingdom-status-${kingdom.id}" style="margin-top: 10px;"></div>
            </div>
        `;
    }).join('');

    content.innerHTML = `
        <div style="display: grid; gap: 20px;">
            <div class="admin-panel-card">
                <h3 style="color: #FFD700; margin-bottom: 15px;">Duyuru Gönder</h3>
                <input id="admin-announcement-title" type="text" placeholder="Başlık" style="width: 100%; padding: 10px; margin-bottom: 10px; background: rgba(0,0,0,0.3); border: 1px solid #444; color: #eee; border-radius: 4px;">
                <textarea id="admin-announcement-content" placeholder="Duyuru metni" style="width: 100%; min-height: 90px; padding: 10px; margin-bottom: 10px; background: rgba(0,0,0,0.3); border: 1px solid #444; color: #eee; border-radius: 4px;"></textarea>
                <button onclick="sendAdminAnnouncement()" style="padding: 10px 16px; background: #D4AF37; border: none; color: #8B4513; font-weight: bold; border-radius: 6px; cursor: pointer;">Gönder</button>
                <div id="admin-announcement-status" style="margin-top: 10px;"></div>
            </div>

            <div class="admin-panel-card">
                <h3 style="color: #FFD700; margin-bottom: 12px;">Kullanıcı Yönetimi</h3>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; margin-bottom: 14px;">
                    <input id="admin-panel-search" type="search" value="${escapeHtml(adminPanelState.query)}" placeholder="Kullanıcı / krallık / rütbe ara" oninput="adminPanelState.query = this.value" style="padding: 10px; background: rgba(0,0,0,0.3); border: 1px solid #444; color: #eee; border-radius: 6px;">
                    <select onchange="updateAdminPanelFilter('kingdom', this.value)" style="padding: 10px; background: rgba(0,0,0,0.3); border: 1px solid #444; color: #eee; border-radius: 6px;">
                        <option value="all" ${adminPanelState.kingdom === 'all' ? 'selected' : ''}>Tüm krallıklar</option>
                        ${kingdomFilterOptions}
                    </select>
                    <select onchange="updateAdminPanelFilter('rank', this.value)" style="padding: 10px; background: rgba(0,0,0,0.3); border: 1px solid #444; color: #eee; border-radius: 6px;">
                        <option value="all" ${adminPanelState.rank === 'all' ? 'selected' : ''}>Tüm rütbeler</option>
                        ${rankOptions.map(rank => `<option value="${rank}" ${adminPanelState.rank === rank ? 'selected' : ''}>${rank}</option>`).join('')}
                    </select>
                    <button onclick="updateAdminPanelFilter('query', document.getElementById('admin-panel-search').value)" style="padding: 10px 14px; background: #7b5e2e; border: none; color: #fff; font-weight: bold; border-radius: 6px; cursor: pointer;">Ara</button>
                    <button onclick="resetAdminPanelFilters()" style="padding: 10px 14px; background: #2d6a73; border: none; color: #fff; font-weight: bold; border-radius: 6px; cursor: pointer;">Filtreleri Temizle</button>
                </div>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px; margin-bottom: 16px;">
                    <div style="padding: 12px; border-radius: 10px; background: rgba(0,0,0,0.2); color: #f4e4bc;">Toplam Kullanıcı<br><strong style="font-size: 1.3em; color: #FFD700;">${users.length}</strong></div>
                    <div style="padding: 12px; border-radius: 10px; background: rgba(0,0,0,0.2); color: #f4e4bc;">Filtrelenen<br><strong style="font-size: 1.3em; color: #FFD700;">${filteredUsers.length}</strong></div>
                    <div style="padding: 12px; border-radius: 10px; background: rgba(0,0,0,0.2); color: #f4e4bc;">Krallık<br><strong style="font-size: 1.3em; color: #FFD700;">${kingdoms.length}</strong></div>
                    <div style="padding: 12px; border-radius: 10px; background: rgba(0,0,0,0.2); color: #f4e4bc;">Kral Ataması<br><strong style="font-size: 1.3em; color: #FFD700;">${kingCount}</strong></div>
                </div>
                <p style="margin-bottom: 12px; color: #f4e4bc;">Kaynak, seviye, krallık, kral atama ve kölelik hiyerarşisi buradan yönetilir. Sahip boşsa kullanıcı özgür olur; rütbe Kral seçilirse seçili krallığa kral atanır.</p>
                <div style="overflow-x: auto;">
                    <table class="admin-user-table">
                        <thead>
                            <tr style="color: #FFD700; text-align: left;">
                                <th>Kullanıcı</th>
                                <th>Krallık</th>
                                <th>Sahip</th>
                                <th>Rütbe</th>
                                <th>Seviye</th>
                                <th>XP</th>
                                <th>Altın</th>
                                <th>Gıda</th>
                                <th>Malzeme</th>
                                <th>Silah</th>
                                <th>Köle</th>
                                <th>İşlem</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${userRows || '<tr><td colspan="12" style="padding: 12px; color: #f4e4bc;">Sonuç yok.</td></tr>'}
                        </tbody>
                    </table>
                </div>
                <div id="admin-user-status" style="margin-top: 12px;"></div>
            </div>

            <div class="admin-panel-card">
                <h3 style="color: #FFD700; margin-bottom: 15px;">Krallık Kontrolü</h3>
                <p style="margin-bottom: 12px; color: #f4e4bc;">Krallık adı, konumu, vergi oranı ve kral ataması ayrı blokta tutulur. Kral alanını boş bırakmak mevcut kralı değiştirmez; kaldırma için butonu kullanın.</p>
                <div style="display: grid; gap: 16px;">
                    ${kingdomCards || '<p style="color:#f4e4bc;">Krallık bulunamadı.</p>'}
                </div>
            </div>

            <div class="admin-panel-card">
                <h3 style="color: #FFD700; margin-bottom: 15px;">Audit Log</h3>
                ${adminPanelCache.auditLogError ? `<p style="color: #ff6b6b;">${escapeHtml(adminPanelCache.auditLogError)}</p>` : `
                    <div style="overflow-x: auto; max-height: 420px; overflow-y: auto;">
                        <table style="width: 100%; border-collapse: collapse; min-width: 1100px;">
                            <thead>
                                <tr style="color: #FFD700; text-align: left;">
                                    <th>Zaman</th>
                                    <th>Kullanıcı</th>
                                    <th>Aksiyon</th>
                                    <th>İstek</th>
                                    <th>Durum</th>
                                    <th>IP</th>
                                    <th>Detay</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${auditLogs.map(log => `
                                    <tr style="border-top: 1px solid rgba(212,175,55,0.35); color: #f4e4bc; vertical-align: top;">
                                        <td style="padding: 8px; white-space: nowrap;">${new Date(log.created_at).toLocaleString('tr-TR')}</td>
                                        <td style="padding: 8px;">${escapeHtml(log.username || '-')}</td>
                                        <td style="padding: 8px;">${escapeHtml(log.action)}</td>
                                        <td style="padding: 8px;">${escapeHtml(log.method)} ${escapeHtml(log.path)}</td>
                                        <td style="padding: 8px; color: ${log.status_code >= 400 ? '#ff6b6b' : '#51cf66'};">${log.status_code}</td>
                                        <td style="padding: 8px;">${escapeHtml(log.ip_address || '-')}</td>
                                        <td style="padding: 8px; max-width: 360px; word-break: break-word; font-family: monospace; font-size: 0.85em;">${escapeHtml(log.request_body || '')}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                `}
            </div>
        </div>
    `;
}

async function loadAdminPanel() {
    const content = document.getElementById('admin-content');
    if (!currentUser || currentUser.username !== 'admin') {
        content.innerHTML = '<p style="color: #ff6b6b;">Bu sayfa sadece admin hesabı içindir.</p>';
        return;
    }

    content.innerHTML = '<p>Kullanıcılar yükleniyor...</p>';
    try {
        const [usersResponse, kingdomsResponse, logsResponse] = await Promise.all([
            fetch(`${API_URL}/admin/users`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            }),
            fetch(`${API_URL}/admin/kingdoms`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            }),
            fetch(`${API_URL}/admin/audit-logs?limit=80`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            })
        ]);
        const users = await usersResponse.json();
        const kingdoms = await kingdomsResponse.json();
        const auditLogs = await logsResponse.json();

        if (!usersResponse.ok || !kingdomsResponse.ok) {
            content.innerHTML = `<p style="color: #ff6b6b;">${users.error || kingdoms.error || 'Admin verileri alınamadı.'}</p>`;
            return;
        }

        adminPanelCache = {
            loaded: true,
            users: Array.isArray(users) ? users : [],
            kingdoms: Array.isArray(kingdoms) ? kingdoms : [],
            auditLogs: Array.isArray(auditLogs) ? auditLogs : [],
            auditLogError: logsResponse.ok ? '' : (auditLogs && auditLogs.error ? auditLogs.error : 'Audit log alınamadı.')
        };
        renderAdminPanel();
    } catch (error) {
        console.error('Admin paneli yükleme hatası:', error);
        content.innerHTML = '<p style="color: #ff6b6b;">Admin paneli yüklenemedi.</p>';
    }
}

async function saveAdminUser(userId) {
    const adminLabel = document.getElementById(`admin-rank-${userId}`);
    if (!adminLabel) {
        const statusEl = document.getElementById('admin-user-status');
        if (statusEl) {
            statusEl.innerHTML = '<p style="color: #ff6b6b;">Bu kullanıcı dokunulmaz.</p>';
        }
        return;
    }

    const payload = {
        rank: document.getElementById(`admin-rank-${userId}`).value,
        kingdom_id: parseInt(document.getElementById(`admin-kingdom-${userId}`).value, 10) || 1,
        master_id: document.getElementById(`admin-master-${userId}`).value || null,
        level: parseInt(document.getElementById(`admin-level-${userId}`).value, 10) || 1,
        experience: parseInt(document.getElementById(`admin-experience-${userId}`).value, 10) || 0,
        coins: parseInt(document.getElementById(`admin-coins-${userId}`).value, 10) || 0,
        food: parseInt(document.getElementById(`admin-food-${userId}`).value, 10) || 0,
        material: parseInt(document.getElementById(`admin-material-${userId}`).value, 10) || 0,
        weapons: parseInt(document.getElementById(`admin-weapons-${userId}`).value, 10) || 0
    };
    const statusEl = document.getElementById('admin-user-status');
    try {
        const response = await fetch(`${API_URL}/admin/users/${userId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        statusEl.innerHTML = response.ok
            ? `<p style="color: #51cf66;">${data.message}</p>`
            : `<p style="color: #ff6b6b;">${data.error || 'Güncelleme başarısız.'}</p>`;
        if (response.ok) {
            await loadAdminPanel();
        }
        await updateResources();
    } catch (error) {
        statusEl.innerHTML = '<p style="color: #ff6b6b;">Bağlantı hatası.</p>';
    }
}

async function saveAdminKingdom(kingdomId, clearKing = false) {
    const statusEl = document.getElementById(`admin-kingdom-status-${kingdomId}`);
    if (!statusEl) return;

    const payload = {
        name: document.getElementById(`admin-kingdom-name-${kingdomId}`).value.trim(),
        description: document.getElementById(`admin-kingdom-desc-${kingdomId}`).value.trim(),
        x: document.getElementById(`admin-kingdom-x-${kingdomId}`).value,
        y: document.getElementById(`admin-kingdom-y-${kingdomId}`).value,
        tax_rate: document.getElementById(`admin-kingdom-tax-${kingdomId}`).value,
        market_tax_rate: document.getElementById(`admin-kingdom-market-tax-${kingdomId}`).value
    };

    if (clearKing) {
        payload.clear_king = true;
    } else {
        const kingSelect = document.getElementById(`admin-kingdom-king-${kingdomId}`);
        if (kingSelect && kingSelect.value) {
            payload.king_user_id = parseInt(kingSelect.value, 10);
        }
    }

    try {
        const response = await fetch(`${API_URL}/admin/kingdoms/${kingdomId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        statusEl.innerHTML = response.ok
            ? `<p style="color: #51cf66;">${data.message || 'Krallık güncellendi.'}</p>`
            : `<p style="color: #ff6b6b;">${data.error || 'Krallık güncellenemedi.'}</p>`;
        if (response.ok) {
            await loadAdminPanel();
        }
    } catch (error) {
        statusEl.innerHTML = '<p style="color: #ff6b6b;">Bağlantı hatası.</p>';
    }
}

function syncAdminRankOwner(userId) {
    const rankEl = document.getElementById(`admin-rank-${userId}`);
    const masterEl = document.getElementById(`admin-master-${userId}`);
    if (rankEl && masterEl && rankEl.value === 'Kral') {
        masterEl.value = '';
    }
}

async function deleteAdminUser(userId, username) {
    const statusEl = document.getElementById('admin-user-status');
    if (!confirm(`${username} kullanıcısı silinsin mi? Bu işlem geri alınamaz.`)) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/admin/users/${userId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        const data = await response.json();
        statusEl.innerHTML = response.ok
            ? `<p style="color: #51cf66;">${data.message}</p>`
            : `<p style="color: #ff6b6b;">${data.error || 'Silme başarısız.'}</p>`;
        if (response.ok) {
            await loadAdminPanel();
        }
    } catch (error) {
        statusEl.innerHTML = '<p style="color: #ff6b6b;">Bağlantı hatası.</p>';
    }
}

async function sendAdminAnnouncement() {
    const title = document.getElementById('admin-announcement-title').value.trim();
    const contentText = document.getElementById('admin-announcement-content').value.trim();
    const statusEl = document.getElementById('admin-announcement-status');
    if (!title || !contentText) {
        statusEl.innerHTML = '<p style="color: #ff6b6b;">Başlık ve içerik gerekli.</p>';
        return;
    }

    try {
        const response = await fetch(`${API_URL}/admin/announcement`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ title, content: contentText })
        });
        const data = await response.json();
        statusEl.innerHTML = response.ok
            ? `<p style="color: #51cf66;">${data.message}</p>`
            : `<p style="color: #ff6b6b;">${data.error || 'Duyuru gönderilemedi.'}</p>`;
    } catch (error) {
        statusEl.innerHTML = '<p style="color: #ff6b6b;">Bağlantı hatası.</p>';
    }
}

async function loadGlobalRankings() {
    const content = document.getElementById('global-rankings-content');
    content.innerHTML = '<p>Sıralamalar yükleniyor...</p>';
    try {
        const response = await fetch(`${API_URL}/rankings`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const rankings = await response.json();

        let html = `
            <div class="rankings-container">
                <div class="ranking-table">
                    <h3>🏆 Seviye Sıralaması</h3>
                    <table>
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Kullanıcı</th>
                                <th>Seviye</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rankings.byLevel.map((user, index) => `
                                <tr>
                                    <td>${index + 1}</td>
                                    <td>${user.username}</td>
                                    <td>${user.level}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                <div class="ranking-table">
                    <h3>💰 Altın Sıralaması</h3>
                    <table>
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Kullanıcı</th>
                                <th>Altın</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rankings.byCoins.map((user, index) => `
                                <tr>
                                    <td>${index + 1}</td>
                                    <td>${user.username}</td>
                                    <td>${formatNumber(user.coins)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                <div class="ranking-table">
                    <h3>👥 Köle Sayısı Sıralaması</h3>
                    <table>
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Kullanıcı</th>
                                <th>Köle Sayısı</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rankings.bySlaves.map((user, index) => `
                                <tr>
                                    <td>${index + 1}</td>
                                    <td>${user.username}</td>
                                    <td>${user.slave_count}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        content.innerHTML = html;
    } catch (error) {
        console.error('Sıralama yükleme hatası:', error);
        content.innerHTML = '<p style="color: #ff6b6b;">Sıralamalar yüklenemedi.</p>';
    }
}

async function loadInbox() {
    const content = document.getElementById('inbox-content');
    content.innerHTML = '<p>Mesajlar yükleniyor...</p>';
    try {
        const response = await fetch(`${API_URL}/inbox`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const messages = await response.json();

        if (messages.length === 0) {
            content.innerHTML = '<p>Gelen kutunuz boş.</p>';
            return;
        }

        let html = '<div class="inbox-list">';
        messages.forEach(msg => {
            html += `
                <div class="inbox-item ${msg.is_read ? 'read' : 'unread'}" onclick="loadMessage(${msg.id})">
                    <div class="inbox-sender">${msg.sender_username || 'Sistem'}</div>
                    <div class="inbox-title">${msg.title}</div>
                    <div class="inbox-date">${new Date(msg.created_at).toLocaleString()}</div>
                </div>
            `;
        });
        html += '</div>';
        content.innerHTML = html;
    } catch (error) {
        console.error('Gelen kutusu yükleme hatası:', error);
        content.innerHTML = '<p style="color: #ff6b6b;">Mesajlar yüklenemedi.</p>';
    }
}

async function loadMessage(messageId) {
    const content = document.getElementById('inbox-content');
    content.innerHTML = '<p>Mesaj yükleniyor...</p>';
    try {
        // Mark as read first
        await fetch(`${API_URL}/inbox/read/${messageId}`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const response = await fetch(`${API_URL}/inbox/${messageId}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const message = await response.json();

        let html = `
            <div class="message-view">
                <button onclick="loadInbox()">Geri</button>
                <h3>${message.title}</h3>
                <p class="message-meta"><strong>Gönderen:</strong> ${message.sender_username || 'Sistem'}</p>
                <p class="message-meta"><strong>Tarih:</strong> ${new Date(message.created_at).toLocaleString()}</p>
                <hr>
                <div class="message-content">${message.content}</div>
            </div>
        `;
        content.innerHTML = html;
    } catch (error) {
        console.error('Mesaj yükleme hatası:', error);
        content.innerHTML = '<p style="color: #ff6b6b;">Mesaj yüklenemedi.</p>';
    }
}

// Overview sayfasını yükle
async function loadOverview() {
    // Zaten güncel kaynaklar gösteriliyor
    updateResourceDisplay();
}

// Günlük ödül al
async function claimDaily() {
    try {
        const response = await fetch(`${API_URL}/command`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ command: 'daily' })
        });

        const data = await response.json();
        const statusEl = document.getElementById('daily-status');
        
        if (response.ok) {
            statusEl.textContent = data.output || 'Günlük ödül alındı!';
            statusEl.className = 'daily-status success';
            await updateResources();
        } else {
            statusEl.textContent = data.error || 'Hata oluştu';
            statusEl.className = 'daily-status error';
        }
    } catch (error) {
        console.error('Günlük ödül hatası:', error);
    }
}

// Köleler sayfasını yükle
async function loadSlaves() {
    try {
        const response = await fetch(`${API_URL}/command`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ command: 'slaves' })
        });

        const data = await response.json();
        const content = document.getElementById('slaves-content');
        
        if (response.ok) {
            // Çıktıyı formatla - alt köleleri daha belirgin göster
            let formattedOutput = data.output || 'Köle bulunamadı';
            // Alt köle satırlarını vurgula
            formattedOutput = formattedOutput.replace(/└─ Alt Köleler:/g, '<span style="color: #FFD700; font-weight: bold;">└─ Alt Köleler:</span>');
            formattedOutput = formattedOutput.replace(/      (\d+)\./g, '<span style="color: #4ecdc4;">      $1.</span>');
            
            content.innerHTML = `<pre style="color: #f4e4bc; white-space: pre-wrap; font-family: 'Courier New', monospace; line-height: 1.6; font-size: 14px;">${formattedOutput}</pre>`;
        } else {
            content.innerHTML = `<p style="color: #ff6b6b;">${data.error || 'Hata oluştu'}</p>`;
        }
    } catch (error) {
        console.error('Köleler yükleme hatası:', error);
    }
}

// Hiyerarşi sayfasını yükle
async function loadMasters() {
    try {
        const response = await fetch(`${API_URL}/command`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ command: 'masters' })
        });

        const data = await response.json();
        const content = document.getElementById('masters-content');
        
        if (response.ok) {
            content.innerHTML = `<pre style="color: #f4e4bc; white-space: pre-wrap; font-family: inherit;">${data.output || 'Hiyerarşi bilgisi bulunamadı'}</pre>`;
        } else {
            content.innerHTML = `<p style="color: #ff6b6b;">${data.error || 'Hata oluştu'}</p>`;
        }
    } catch (error) {
        console.error('Hiyerarşi yükleme hatası:', error);
    }
}

// Referans sayfasını yükle
async function loadReferral() {
    try {
        const response = await fetch(`${API_URL}/command`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ command: 'referral' })
        });

        const data = await response.json();
        const content = document.getElementById('referral-content');
        
        if (response.ok) {
            content.innerHTML = `<pre style="color: #f4e4bc; white-space: pre-wrap; font-family: inherit;">${data.output || 'Referans bilgisi bulunamadı'}</pre>`;
        } else {
            content.innerHTML = `<p style="color: #ff6b6b;">${data.error || 'Hata oluştu'}</p>`;
        }
    } catch (error) {
        console.error('Referans yükleme hatası:', error);
    }
}

// İstatistikler sayfasını yükle
async function loadStats() {
    const content = document.getElementById('stats-content');
    await updateResources(); // Ensure currentUser is up-to-date

    if (!currentUser) {
        content.innerHTML = `<p style="color: #ff6b6b;">Kullanıcı verileri yüklenemedi.</p>`;
        return;
    }

    const {
        username,
        gender,
        spouse_username,
        role,
        level,
        experience,
        coins,
        food,
        material,
        weapons,
        master_username,
        slave_count
    } = currentUser;

    const nextLevelExp = level * 100;

    let html = `
        <div style="background: rgba(139, 69, 19, 0.8); border: 3px solid #D4AF37; border-radius: 12px; padding: 25px; font-family: 'Courier New', monospace; color: #f4e4bc;">
            
            <div style="text-align: center; margin-bottom: 20px;">
                <h3 style="color: #FFD700; font-size: 1.5em;">${username}</h3>
                <p style="color: #4ecdc4; font-size: 1.1em;">Seviye ${level} - ${role || 'Rol Yok'}</p>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px;">
                
                <div style="background: rgba(160, 82, 45, 0.5); padding: 15px; border-radius: 8px;">
                    <h4 style="color: #FFD700; margin-bottom: 10px;">Temel Bilgiler</h4>
                    <p><strong>Cinsiyet:</strong> ${gender === 'male' ? 'Erkek' : 'Kadın'}</p>
                    <p><strong>Aile Durumu:</strong> ${spouse_username ? `Evli (${spouse_username})` : 'Bekar'}</p>
                    <p><strong>Hiyerarşi:</strong> ${master_username ? `${master_username}'nin kölesi` : 'Özgür'}</p>
                    <p><strong>Köle Sayısı:</strong> ${slave_count || 0}</p>
                </div>

                <div style="background: rgba(160, 82, 45, 0.5); padding: 15px; border-radius: 8px;">
                    <h4 style="color: #FFD700; margin-bottom: 10px;">Seviye ve Deneyim</h4>
                    <p><strong>Deneyim:</strong> ${experience} / ${nextLevelExp}</p>
                    <div style="width: 100%; background-color: #8B4513; border-radius: 4px; overflow: hidden; margin-top: 5px;">
                        <div style="width: ${(experience / nextLevelExp) * 100}%; background-color: #FFD700; height: 10px;"></div>
                    </div>
                </div>

                <div style="background: rgba(160, 82, 45, 0.5); padding: 15px; border-radius: 8px;">
                    <h4 style="color: #FFD700; margin-bottom: 10px;">Kaynaklar</h4>
                    <p><strong>🪙 Altın:</strong> ${formatNumber(coins)}</p>
                    <p><strong>🥖 Gıda:</strong> ${formatNumber(food)}</p>
                    <p><strong>🪨 Malzeme:</strong> ${formatNumber(material)}</p>
                    <p><strong>⚔️ Silah:</strong> ${formatNumber(weapons || 0)}</p>
                </div>

            </div>
        </div>
    `;
    
    content.innerHTML = html;
}

async function loadMaterialMarket() {
    const content = document.getElementById('material-market-content');
    await updateResources();

    let html = `
        <div style="background: rgba(139, 69, 19, 0.8); border: 3px solid #D4AF37; border-radius: 12px; padding: 25px;">
            <h3 style="color: #FFD700; margin-bottom: 20px;">🧱 Malzeme Pazarı</h3>
            <div style="background: rgba(160, 82, 45, 0.5); padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                <p><strong>Mevcut Altının:</strong> ${formatNumber(resources.gold)} 🪙</p>
                <p><strong>Mevcut Malzemen:</strong> ${formatNumber(resources.material)} 🪨</p>
                <p style="color: #FFD700; margin-top: 10px;">Fiyat: 1 Malzeme = 10 Altın</p>
            </div>
            <div class="trade-form">
                <input type="number" id="material-amount" placeholder="Miktar" min="1" style="width: 100%; padding: 10px; background: rgba(0,0,0,0.3); border: 1px solid #444; color: #eee; border-radius: 4px; margin-bottom: 10px;">
                <button onclick="buyMaterial()" style="width: 100%; padding: 10px; background: #D4AF37; border: none; color: #fff; font-weight: bold; border-radius: 4px; cursor: pointer;">Satın Al</button>
            </div>
            <div id="material-market-status" style="margin-top: 20px;"></div>
        </div>
    `;
    content.innerHTML = html;
}

async function buyMaterial() {
    const amount = document.getElementById('material-amount').value;
    if (!amount || amount <= 0) {
        alert('Lütfen geçerli bir miktar girin.');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/market/buy-material`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ amount: parseInt(amount) })
        });
        const data = await response.json();
        const statusEl = document.getElementById('material-market-status');

        if (response.ok) {
            statusEl.innerHTML = `<p style="color: #51cf66;">${data.message}</p>`;
            await updateResources();
            loadMaterialMarket();
        } else {
            statusEl.innerHTML = `<p style="color: #ff6b6b;">${data.error}</p>`;
        }
    } catch (error) {
        console.error('Malzeme satın alma hatası:', error);
    }
}


async function loadProduction() {
    const content = document.getElementById('production-content');
    
    try {
        const response = await fetch(`${API_URL}/productions`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const productions = await response.json();

        let html = `
            <div style="background: rgba(139, 69, 19, 0.8); border: 3px solid #D4AF37; border-radius: 12px; padding: 25px;">
                <h3 style="color: #FFD700; margin-bottom: 20px;">🔨 Üretim</h3>
                
                <!-- Production Options -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px;">
                    <!-- Food Production -->
                    <div style="background: rgba(160, 82, 45, 0.5); padding: 15px; border-radius: 8px;">
                        <h4 style="color: #FFD700;">Gıda Üretimi (1 Malzeme / 1 Gıda / 60sn)</h4>
                        <input type="number" id="produce-food-amount" placeholder="Miktar" min="1" style="width: 100%; padding: 8px; margin: 10px 0; background: rgba(0,0,0,0.3); border: 1px solid #444; color: #eee;">
                        <button onclick="startProduction('food')" style="width: 100%; padding: 8px; background: #4CAF50; color: white; border: none; cursor: pointer;">Üretimi Başlat</button>
                    </div>
                    <!-- Weapon Production -->
                    <div style="background: rgba(160, 82, 45, 0.5); padding: 15px; border-radius: 8px;">
                        <h4 style="color: #FFD700;">Silah Üretimi (10 Malzeme / 1 Silah / 5dk)</h4>
                        <input type="number" id="produce-weapon-amount" placeholder="Miktar" min="1" style="width: 100%; padding: 8px; margin: 10px 0; background: rgba(0,0,0,0.3); border: 1px solid #444; color: #eee;">
                        <button onclick="startProduction('weapon')" style="width: 100%; padding: 8px; background: #f44336; color: white; border: none; cursor: pointer;">Üretimi Başlat</button>
                    </div>
                </div>
                <div id="production-status" style="margin-bottom: 20px;"></div>

                <!-- Ongoing Productions -->
                <h4 style="color: #FFD700; margin-bottom: 15px;">Aktif Üretimler</h4>
                <div id="ongoing-productions">
                    ${productions.length > 0 ? productions.map(p => `
                        <div class="production-item" style="background: rgba(0,0,0,0.2); padding: 10px; margin-bottom: 10px; border-radius: 4px;">
                            <span>${p.amount} x ${p.production_type === 'food' ? 'Gıda' : 'Silah'}</span>
                            <span id="timer-${p.id}"></span>
                            <button onclick="claimProduction(${p.id})" id="claim-btn-${p.id}" style="display: none; padding: 5px; background: #4CAF50; color: white; border: none; cursor: pointer;">Topla</button>
                        </div>
                    `).join('') : '<p>Aktif üretim yok.</p>'}
                </div>
            </div>
        `;
        content.innerHTML = html;

        productions.forEach(p => setupProductionTimer(p));

    } catch (error) {
        console.error("Üretim bilgileri alınamadı:", error);
        content.innerHTML = '<p style="color: #ff6b6b;">Üretim bilgileri yüklenemedi.</p>';
    }
}

function setupProductionTimer(production) {
    const timerEl = document.getElementById(`timer-${production.id}`);
    const claimBtn = document.getElementById(`claim-btn-${production.id}`);
    const finishAt = new Date(production.finish_at).getTime();

    const interval = setInterval(() => {
        const now = new Date().getTime();
        const distance = finishAt - now;

        if (distance < 0) {
            clearInterval(interval);
            timerEl.innerHTML = "Tamamlandı!";
            claimBtn.style.display = 'inline-block';
            return;
        }

        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        timerEl.innerHTML = `Kalan Süre: ${hours > 0 ? hours + 's ' : ''}${minutes}d ${seconds}s`;
    }, 1000);
}

async function startProduction(productionType) {
    const amount = document.getElementById(`produce-${productionType}-amount`).value;
    if (!amount || amount <= 0) {
        alert('Lütfen geçerli bir miktar girin.');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/produce`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ productionType, amount: parseInt(amount) })
        });
        const data = await response.json();
        const statusEl = document.getElementById('production-status');

        if (response.ok) {
            statusEl.innerHTML = `<p style="color: #51cf66;">${data.message}</p>`;
            await updateResources();
            loadProduction();
        } else {
            statusEl.innerHTML = `<p style="color: #ff6b6b;">${data.error}</p>`;
        }
    } catch (error) {
        console.error('Üretim başlatma hatası:', error);
    }
}

async function claimProduction(productionId) {

    try {

        const response = await fetch(`${API_URL}/productions/claim`, {

            method: 'POST',

            headers: {

                'Content-Type': 'application/json',

                'Authorization': `Bearer ${authToken}`

            },

            body: JSON.stringify({ productionId })

        });

        const data = await response.json();

        const statusEl = document.getElementById('production-status');



        if (response.ok) {

            statusEl.innerHTML = `<p style="color: #51cf66;">${data.message}</p>`;

            await updateResources();

            loadProduction();

        } else {

            statusEl.innerHTML = `<p style="color: #ff6b6b;">${data.error}</p>`;

        }

    } catch (error) {

        console.error('Üretim tamamlama hatası:', error);

    }

}



async function loadWars() {

    const content = document.getElementById('wars-content');

    

    try {

        const [warsRes, kingdomsRes] = await Promise.all([

            fetch(`${API_URL}/wars`, { headers: { 'Authorization': `Bearer ${authToken}` } }),

            fetch(`${API_URL}/kingdoms`, { headers: { 'Authorization': `Bearer ${authToken}` } })

        ]);



        const wars = await warsRes.json();

        const kingdoms = await kingdomsRes.json();



        let html = `

            <div style="background: rgba(139, 0, 0, 0.3); border: 3px solid #8B0000; border-radius: 12px; padding: 25px;">

                <h3 style="color: #ff6b6b; margin-bottom: 20px;">⚔️ Aktif Savaşlar</h3>

                <div id="ongoing-wars">

        `;



        if (wars.length > 0) {

            wars.forEach(war => {

                html += `

                    <div class="war-item" style="background: rgba(0,0,0,0.4); padding: 15px; margin-bottom: 15px; border-radius: 8px; border-left: 5px solid #ff6b6b;">

                        <div style="display: flex; justify-content: space-between; align-items: center;">

                            <div>

                                <h4 style="color: #ff6b6b;">${war.attacker_kingdom_name} vs ${war.defender_kingdom_name}</h4>

                                <p style="font-size: 0.9em;">Saldıran Kral: ${war.attacker_king} | Savunan Kral: ${war.defender_king}</p>

                            </div>

                            <div id="war-timer-${war.id}" style="color: #ffae42;"></div>

                        </div>

                    </div>

                `;

            });

        } else {

            html += '<p>Şu anda aktif bir savaş yok.</p>';

        }

        html += '</div>';



        if (currentUser && currentUser.rank === 'Kral') {
            const attackableKingdoms = kingdoms.filter(k => k.id !== currentUser.kingdom_id && k.king_id);
            html += `
                <div id="declare-war-section" style="margin-top: 30px;">
                    <h4 style="color: #ff6b6b; border-top: 1px solid #8B0000; padding-top: 20px;">Savaş İlan Et (Maliyet: 10,000 Altın + 500 Silah)</h4>
                    <p>Savaşlar 24 saat sürer. Kazanan taraf, kaybeden tarafın krallığını ele geçirir.</p>
            `;
            if (attackableKingdoms.length > 0) {
                html += `
                    <select id="defender-kingdom-select" style="width: 100%; padding: 8px; margin: 10px 0; background: rgba(0,0,0,0.3); border: 1px solid #444; color: #eee;">
                        <option value="">Krallık Seç</option>
                        ${attackableKingdoms.map(k => `<option value="${k.id}">${k.name} (Kral: ${k.king_name})</option>`).join('')}
                    </select>
                    <button onclick="declareWar()" style="width: 100%; padding: 10px; background: #8B0000; color: white; border: none; cursor: pointer; font-size: 1.1em;">Savaş İlan Et</button>
                `;
            } else {
                html += `<p style="color: #ffae42; margin-top: 10px;">Şu anda saldırılabilecek başka bir krallık yok.</p>`;
            }
            html += `
                    <div id="declare-war-status" style="margin-top: 15px;"></div>
                </div>
            `;
        }



        html += '</div>';

        content.innerHTML = html;

        

        wars.forEach(war => {

            const timerEl = document.getElementById(`war-timer-${war.id}`);

            const endDate = new Date(war.war_end_date).getTime();

                        const interval = setInterval(() => {

                            const now = new Date().getTime();

                            const distance = endDate - now;

                            if(distance < 0) {

                                clearInterval(interval);

                                timerEl.innerHTML = `Sona Erdi! <button onclick="resolveWar(${war.id})" style="padding: 3px 5px; background: #ffae42; color: #000; border: none; cursor: pointer; margin-left: 10px;">Sonucu Gör</button>`;

                                return;

                            }

                            const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

                            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));

                            const seconds = Math.floor((distance % (1000 * 60)) / 1000);

                            timerEl.innerHTML = `Bitiş: ${hours}s ${minutes}d ${seconds}s`;

                        }, 1000);

                    });

            

                } catch (error) {

                    console.error("Savaş bilgileri alınamadı:", error);

                    content.innerHTML = '<p style="color: #ff6b6b;">Savaş bilgileri yüklenemedi.</p>';

                }

            }

            

            async function resolveWar(warId) {

                const statusEl = document.getElementById('declare-war-status');

                statusEl.innerHTML = `<p>Savaş sonucu hesaplanıyor...</p>`;

                try {

                    const response = await fetch(`${API_URL}/war/resolve/${warId}`, {

                        method: 'POST',

                        headers: { 'Authorization': `Bearer ${authToken}` }

                    });

                    const data = await response.json();

                    if (response.ok) {

                        statusEl.innerHTML = `<p style="color: #51cf66;">${data.message}</p>`;

                        loadWars();

                        updateResources();

                    } else {

                        statusEl.innerHTML = `<p style="color: #ff6b6b;">${data.error}</p>`;

                    }

                } catch(e) {

                    statusEl.innerHTML = `<p style="color: #ff6b6b;">Bir hata oluştu.</p>`;

                    console.error('Savaş sonuçlandırma hatası:', e);

                }

            }



async function declareWar() {

    const defender_kingdom_id = document.getElementById('defender-kingdom-select').value;

    if (!defender_kingdom_id) {

        alert('Lütfen bir krallık seçin.');

        return;

    }



    if (!confirm('Bu krallığa savaş ilan etmek istediğinize emin misiniz? Bu işlem 10,000 altına mal olacaktır.')) {

        return;

    }



    try {

        const response = await fetch(`${API_URL}/war/declare`, {

            method: 'POST',

            headers: {

                'Content-Type': 'application/json',

                'Authorization': `Bearer ${authToken}`

            },

            body: JSON.stringify({ defender_kingdom_id: parseInt(defender_kingdom_id) })

        });

        const data = await response.json();

        const statusEl = document.getElementById('declare-war-status');

        if (response.ok) {

            statusEl.innerHTML = `<p style="color: #51cf66;">${data.message}</p>`;

            await updateResources();

            loadWars();

        } else {

            statusEl.innerHTML = `<p style="color: #ff6b6b;">${data.error}</p>`;

        }

    } catch(e) {

        console.error("Savaş ilanı hatası:", e);

    }

}



// Köle pazarı sayfasını yükle (sahipler kölelerini satabilir) - Krallık bazlı

async function loadSlaveMarket() {
    try {
        const response = await fetch(`${API_URL}/kingdom-slave-market`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        const data = await response.json();
        const content = document.getElementById('slave-market-content');
        
        if (response.ok) {
            let html = `
                <div style="background: rgba(139, 69, 19, 0.8); border: 3px solid #D4AF37; border-radius: 12px; padding: 25px;">
                    <div style="margin-bottom: 20px; padding: 15px; background: rgba(160, 82, 45, 0.5); border-radius: 8px; border: 2px solid #D4AF37;">
                        <h3 style="color: #FFD700; margin-bottom: 10px;">🏛️ ${data.kingdomName || 'Köle'} Pazarı</h3>
                        <p style="color: #f4e4bc; font-size: 0.9em;">
                            📍 ${t('Mevcut Krallık')}: <strong>${data.kingdomName || t('Bilinmiyor')}</strong>
                        </p>
                        <p style="color: #4ecdc4; font-size: 0.85em; margin-top: 5px;">
                            ${t('Bu pazarda sadece')} <strong>${data.kingdomName || ''}</strong> ${t('krallığındaki köleler görüntülenir ve satılabilir.')}
                        </p>
                    </div>
            `;

            // Satışta olan köleler (pazardan satın alınabilir)
            if (data.marketSlaves && data.marketSlaves.length > 0) {
                html += `
                    <h4 style="color: #FFD700; margin: 20px 0 15px 0; border-bottom: 2px solid #D4AF37; padding-bottom: 10px;">
                        📋 Pazardaki Köleler
                    </h4>
                    <div style="display: grid; gap: 15px; margin-bottom: 30px;">
                `;

                data.marketSlaves.forEach(sale => {
                    const isOwnSale = currentUser && sale.seller_id === currentUser.id;
                    html += `
                        <div style="background: rgba(160, 82, 45, 0.5); border: 2px solid #D4AF37; border-radius: 8px; padding: 15px;">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div>
                                    <h4 style="color: #FFD700; margin-bottom: 5px;">${sale.slave_username}</h4>
                                    <p style="color: #f4e4bc; font-size: 0.9em;">Seviye: ${sale.slave_level} | Satıcı: ${sale.seller_username}</p>
                                </div>
                                <div style="text-align: right;">
                                    <p style="color: #FFD700; font-weight: bold; font-size: 1.2em; margin-bottom: 10px;">${formatNumber(sale.price)} altın</p>
                                    ${isOwnSale ? `
                                    <button onclick="cancelSlaveSale(${sale.id})" 
                                            style="padding: 8px 16px; background: linear-gradient(135deg, #ff922b 0%, #f76707 100%); 
                                                   border: none; border-radius: 6px; color: #fff; font-weight: bold; cursor: pointer;">
                                        Satıştan Kaldır
                                    </button>
                                    ` : `
                                    <button onclick="buySlaveFromMarket(${sale.id}, ${sale.price})" 
                                            style="padding: 8px 16px; background: linear-gradient(135deg, #D4AF37 0%, #FFD700 100%); 
                                                   border: none; border-radius: 6px; color: #8B4513; font-weight: bold; cursor: pointer;">
                                        🛒 Satın Al
                                    </button>
                                    `}
                                </div>
                            </div>
                        </div>
                    `;
                });

                html += `</div>`;
            } else {
                html += `
                    <div style="background: rgba(160, 82, 45, 0.3); border: 2px solid #D4AF37; border-radius: 8px; padding: 15px; margin-bottom: 30px; text-align: center;">
                        <p style="color: #f4e4bc;">Şu anda pazarda satışa çıkarılmış köle yok.</p>
                    </div>
                `;
            }

            // Kendi kölelerim (satışa çıkarılabilir)
            if (data.mySlaves && data.mySlaves.length > 0) {
                html += `
                    <h4 style="color: #FFD700; margin: 20px 0 15px 0; border-bottom: 2px solid #D4AF37; padding-bottom: 10px;">
                        👥 Kölelerim (Satışa Çıkar)
                    </h4>
                    <div style="display: grid; gap: 15px;">
                `;

                data.mySlaves.forEach(slave => {
                    const estimatedPrice = slave.level * 500; // Seviye * 500 altın tahmini fiyat
                    html += `
                        <div style="background: rgba(160, 82, 45, 0.5); border: 2px solid #D4AF37; border-radius: 8px; padding: 15px;">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div>
                                    <h4 style="color: #FFD700; margin-bottom: 5px;">${slave.username}</h4>
                                    <p style="color: #f4e4bc; font-size: 0.9em;">Seviye: ${slave.level} | Altın: ${formatNumber(slave.coins)} | Alt köleler: ${slave.sub_slaves || 0}</p>
                                </div>
                                <div style="text-align: right;">
                                    <input type="number" id="price-${slave.id}" value="${estimatedPrice}" min="1" 
                                           style="width: 120px; padding: 5px; margin-bottom: 10px; background: rgba(139, 69, 19, 0.8); 
                                                  border: 2px solid #D4AF37; border-radius: 4px; color: #f4e4bc; text-align: center;">
                                    <br>
                                    <button onclick="sellSlave(${slave.id})" 
                                            style="padding: 8px 16px; background: linear-gradient(135deg, #D4AF37 0%, #FFD700 100%); 
                                                   border: none; border-radius: 6px; color: #8B4513; font-weight: bold; cursor: pointer;">
                                        💰 Satışa Çıkar
                                    </button>
                                </div>
                            </div>
                        </div>
                    `;
                });

                html += `</div>`;
            } else {
                html += `
                    <div style="background: rgba(160, 82, 45, 0.3); border: 2px solid #D4AF37; border-radius: 8px; padding: 15px; text-align: center;">
                        <p style="color: #f4e4bc;">Henüz satışa çıkarabileceğiniz köle yok.</p>
                    </div>
                `;
            }

            html += `
                    <div id="sell-status" style="margin-top: 20px;"></div>
                </div>
            `;

            content.innerHTML = html;
        } else {
            content.innerHTML = `<p style="color: #ff6b6b;">${data.error || 'Hata oluştu'}</p>`;
        }
    } catch (error) {
        console.error('Köle pazarı yükleme hatası:', error);
        const content = document.getElementById('slave-market-content');
        content.innerHTML = `<p style="color: #ff6b6b;">Bağlantı hatası</p>`;
    }
}

async function cancelSlaveSale(saleId) {
    try {
        const response = await fetch(`${API_URL}/cancel-slave-sale`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ saleId })
        });

        const data = await response.json();
        const statusEl = document.getElementById('sell-status');
        if (response.ok) {
            statusEl.innerHTML = `<p style="color: #51cf66;">${data.message}</p>`;
            loadSlaveMarket();
        } else {
            statusEl.innerHTML = `<p style="color: #ff6b6b;">${data.error || 'Hata oluştu'}</p>`;
        }
    } catch (error) {
        console.error('Satış iptal hatası:', error);
    }
}

// Köle satışa çıkar
async function sellSlave(slaveId) {
    const priceInput = document.getElementById(`price-${slaveId}`);
    const price = parseInt(priceInput.value);
    
    if (!price || price < 1) {
        alert('Geçerli bir fiyat girin!');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/sell-slave`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ slaveId, price })
        });

        const data = await response.json();
        const statusEl = document.getElementById('sell-status');
        
        if (response.ok) {
            statusEl.innerHTML = `
                <div style="background: rgba(0, 100, 0, 0.3); border: 2px solid #006400; padding: 15px; border-radius: 8px;">
                    <p style="color: #51cf66; font-weight: bold;">✅ ${data.message}</p>
                    <p style="color: #f4e4bc; margin-top: 5px;">Köle: ${data.slave.username} - Fiyat: ${formatNumber(data.slave.price)} altın</p>
                </div>
            `;
            await updateResources();
            setTimeout(() => {
                loadSlaveMarket();
            }, 2000);
        } else {
            statusEl.innerHTML = `
                <div style="background: rgba(139, 0, 0, 0.3); border: 2px solid #8B0000; padding: 15px; border-radius: 8px;">
                    <p style="color: #ff6b6b;">${data.error || 'Hata oluştu'}</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Köle satış hatası:', error);
    }
}

// Pazardan köle satın al
async function buySlaveFromMarket(saleId, price) {
    if (!confirm(`${formatNumber(price)} altın ödeyerek bu köleyi satın almak istediğinize emin misiniz?`)) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/buy-slave`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ saleId })
        });

        const data = await response.json();
        const statusEl = document.getElementById('sell-status');
        
        if (response.ok) {
            statusEl.innerHTML = `
                <div style="background: rgba(0, 100, 0, 0.3); border: 2px solid #006400; padding: 15px; border-radius: 8px;">
                    <p style="color: #51cf66; font-weight: bold; font-size: 1.1em;">✅ ${data.message}</p>
                    <p style="color: #f4e4bc; margin-top: 5px;">Köle: ${data.slave.username} (Seviye: ${data.slave.level})</p>
                    <p style="color: #f4e4bc;">Yeni bakiyeniz: ${formatNumber(data.newBalance)} altın</p>
                </div>
            `;
            await updateResources();
            setTimeout(() => {
                loadSlaveMarket();
            }, 2000);
        } else {
            statusEl.innerHTML = `
                <div style="background: rgba(139, 0, 0, 0.3); border: 2px solid #8B0000; padding: 15px; border-radius: 8px;">
                    <p style="color: #ff6b6b;">${data.error || 'Hata oluştu'}</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Köle satın alma hatası:', error);
    }
}

// Özgürlük satın alma sayfasını yükle
async function loadBuyFreedom() {
    try {
        const response = await fetch(`${API_URL}/buy-freedom-info`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        const data = await response.json();
        const content = document.getElementById('buy-freedom-content');
        
        if (response.ok) {
            if (!data.isSlave) {
                content.innerHTML = `
                    <div style="background: rgba(0, 100, 0, 0.3); border: 2px solid #006400; padding: 20px; border-radius: 8px; text-align: center;">
                        <h3 style="color: #51cf66; margin-bottom: 15px;">🎉 ${t('Özgürsünüz!')}</h3>
                        <p style="color: #f4e4bc; font-size: 1.1em;">${t('Zaten özgür bir vatandaşsınız.')}</p>
                    </div>
                `;
            } else {
                const statusText = data.canAfford ? t('Yeterli altınınız var!') : t('Yeterli altınınız yok!');
                const statusIcon = data.canAfford ? '✅' : '❌';
                
                content.innerHTML = `
                    <div style="background: rgba(139, 69, 19, 0.8); border: 3px solid #D4AF37; border-radius: 12px; padding: 25px;">
                        <h3 style="color: #FFD700; margin-bottom: 20px;">🔓 ${t('Özgürlük Satın Alma')}</h3>
                        
                        <div style="background: rgba(160, 82, 45, 0.5); padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                            <p style="color: #f4e4bc; margin-bottom: 10px;"><strong>${t('Köle Sahibiniz:')}</strong> ${data.masterUsername}</p>
                            <p style="color: #f4e4bc; margin-bottom: 10px;"><strong>${t('Seviyeniz:')}</strong> ${data.level}</p>
                            <p style="color: #f4e4bc; margin-bottom: 10px;"><strong>${t('Mevcut Altınınız:')}</strong> ${formatNumber(data.currentCoins)} ${t('altın')}</p>
                            <p style="color: #FFD700; font-size: 1.2em; font-weight: bold; margin-top: 15px;">
                                ${t('Özgürlük Bedeli:')} ${formatNumber(data.freedomPrice)} ${t('altın')}
                            </p>
                        </div>

                        <div style="background: rgba(212, 175, 55, 0.2); border: 2px solid #D4AF37; padding: 15px; border-radius: 8px; margin-bottom: 20px; text-align: center;">
                            <p style="color: #f4e4bc; font-size: 1.1em; margin-bottom: 10px;">
                                ${statusIcon} <strong>${statusText}</strong>
                            </p>
                            ${!data.canAfford ? `<p style="color: #ff6b6b;">${t('Eksik:')} ${formatNumber(data.freedomPrice - data.currentCoins)} ${t('altın')}</p>` : ''}
                        </div>

                        <button id="buy-freedom-btn" 
                                onclick="buyFreedom()" 
                                ${!data.canAfford ? 'disabled' : ''}
                                style="width: 100%; padding: 15px; background: ${data.canAfford ? 'linear-gradient(135deg, #D4AF37 0%, #FFD700 100%)' : 'rgba(139, 69, 19, 0.5)'}; 
                                       border: none; border-radius: 8px; color: ${data.canAfford ? '#8B4513' : '#888'}; 
                                       font-size: 1.1em; font-weight: bold; cursor: ${data.canAfford ? 'pointer' : 'not-allowed'}; 
                                       transition: transform 0.2s;"
                                onmouseover="${data.canAfford ? 'this.style.transform=\'scale(1.05)\'' : ''}"
                                onmouseout="${data.canAfford ? 'this.style.transform=\'scale(1)\'' : ''}">
                            ${data.canAfford ? `🪙 ${t('Özgürlüğümü Satın Al')}` : t('Yetersiz Altın')}
                        </button>

                        <div id="freedom-status" style="margin-top: 20px;"></div>
                    </div>
                `;
            }
        } else {
            content.innerHTML = `<p style="color: #ff6b6b;">${data.error || 'Hata oluştu'}</p>`;
        }
    } catch (error) {
        console.error('Özgürlük sayfası yükleme hatası:', error);
        const content = document.getElementById('buy-freedom-content');
        if (content) {
            content.innerHTML = `<p style="color: #ff6b6b;">Bağlantı hatası</p>`;
        }
    }
}

// Özgürlük satın al
async function buyFreedom() {
    const btn = document.getElementById('buy-freedom-btn');
    const statusEl = document.getElementById('freedom-status');
    
    if (!btn || btn.disabled) return;
    
    btn.disabled = true;
    btn.textContent = settings.language === 'tr' ? 'İşlem yapılıyor...' : 'Processing...';
    
    try {
        const response = await fetch(`${API_URL}/buy-freedom`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            }
        });

        const data = await response.json();
        
        if (response.ok) {
            statusEl.innerHTML = `
                <div style="background: rgba(0, 100, 0, 0.3); border: 2px solid #006400; padding: 15px; border-radius: 8px; text-align: center;">
                    <p style="color: #51cf66; font-size: 1.2em; font-weight: bold; margin-bottom: 10px;">
                        🎉 ${data.message}
                    </p>
                    <p style="color: #f4e4bc;">${settings.language === 'tr' ? 'Ödenen:' : 'Paid:'} ${formatNumber(data.paidAmount)} ${t('altın')}</p>
                    <p style="color: #f4e4bc;">${settings.language === 'tr' ? 'Yeni bakiyeniz:' : 'New balance:'} ${formatNumber(data.newBalance)} ${t('altın')}</p>
                </div>
            `;
            
            // Kaynakları güncelle
            await updateResources();
            
            // Sayfayı yeniden yükle
            setTimeout(() => {
                loadBuyFreedom();
            }, 2000);
        } else {
            statusEl.innerHTML = `
                <div style="background: rgba(139, 0, 0, 0.3); border: 2px solid #8B0000; padding: 15px; border-radius: 8px;">
                    <p style="color: #ff6b6b;">${data.error || (settings.language === 'tr' ? 'Hata oluştu' : 'An error occurred')}</p>
                </div>
            `;
            btn.disabled = false;
            btn.textContent = `🪙 ${t('Özgürlüğümü Satın Al')}`;
        }
    } catch (error) {
        console.error('Özgürlük satın alma hatası:', error);
        statusEl.innerHTML = `
            <div style="background: rgba(139, 0, 0, 0.3); border: 2px solid #8B0000; padding: 15px; border-radius: 8px;">
                <p style="color: #ff6b6b;">${settings.language === 'tr' ? 'Bağlantı hatası' : 'Connection error'}</p>
            </div>
        `;
        btn.disabled = false;
        btn.textContent = `🪙 ${t('Özgürlüğümü Satın Al')}`;
    }
}

// Entrika sayfasını yükle
async function loadIntrigue() {
    try {
        const content = document.getElementById('intrigue-content');
        if (currentUser?.username === 'admin') {
            content.innerHTML = `
                <div style="padding: 20px; border: 2px solid rgba(255,255,255,0.15); border-radius: 12px; background: rgba(0,0,0,0.18); color: #f4e4bc;">
                    <h3 style="margin-bottom: 10px;">Admin Hesabı</h3>
                    <p>Bu hesap oyun içi etkileşimlerden muaftır. Sadece yönetim işlemleri kullanılabilir.</p>
                </div>
            `;
            return;
        }

        const response = await fetch(`${API_URL}/revolt-info`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        const data = await response.json();
        
        if (response.ok) {
            let html = `
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 20px;">

                    <!-- İsyan Bölümü -->
                    <div style="background: rgba(139, 69, 19, 0.8); border: 3px solid #D4AF37; border-radius: 12px; padding: 25px; display: flex; flex-direction: column;">
                        <h3 style="color: #FFD700; margin-bottom: 20px; border-bottom: 2px solid #D4AF37; padding-bottom: 10px;">
                            ⚔️ ${t('İsyan Çıkar')}
                        </h3>
            `;

            if (data.isKing) {
                html += `
                    <div style="background: rgba(0, 100, 0, 0.3); border: 2px solid #006400; padding: 20px; border-radius: 8px; text-align: center; flex-grow: 1; display: flex; align-items: center; justify-content: center;">
                        <div>
                            <h3 style="color: #51cf66; margin-bottom: 15px;">👑 ${t('Zaten Kralsınız!')}</h3>
                            <p style="color: #f4e4bc; font-size: 1.1em;">
                                ${data.kingdom ? `${data.kingdom.name} ${t('krallığının kralısınız.')}` : t('Bir krallığın kralısınız.')}
                            </p>
                        </div>
                    </div>
                `;
            } else {
                html += `
                    <div style="background: rgba(160, 82, 45, 0.5); border: 2px solid #D4AF37; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
                        <h4 style="color: #FFD700; margin-bottom: 15px;">${t('İsyan Gereksinimleri')}</h4>
                        <div style="display: grid; gap: 10px;">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <span style="color: #f4e4bc;">${t('Köle Sayısı')}:</span>
                                <span style="color: ${data.slaveCount >= data.requiredSlaves ? '#51cf66' : '#ff6b6b'}; font-weight: bold;">
                                    ${data.slaveCount} / ${data.requiredSlaves}
                                    ${data.slaveCount >= data.requiredSlaves ? ' ✅' : ' ❌'}
                                </span>
                            </div>
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <span style="color: #f4e4bc;">${t('Altın')}:</span>
                                <span style="color: ${data.currentCoins >= data.requiredCoins ? '#51cf66' : '#ff6b6b'}; font-weight: bold;">
                                    ${formatNumber(data.currentCoins)} / ${formatNumber(data.requiredCoins)} ${t('altın')}
                                    ${data.currentCoins >= data.requiredCoins ? ' ✅' : ' ❌'}
                                </span>
                            </div>
                        </div>
                    </div>
                `;

                if (data.kingdom) {
                    html += `
                        <div style="background: rgba(160, 82, 45, 0.5); border: 2px solid #D4AF37; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
                             <h4 style="color: #FFD700; margin-bottom: 15px;">${t('Mevcut Krallık')}</h4>
                            <p style="color: #f4e4bc; margin-bottom: 10px;">
                                <strong>${data.kingdom.name}</strong>
                            </p>
                            ${data.kingdom.king_username ? `
                                <p style="color: #D4AF37; margin-top: 10px;">
                                    👑 ${t('Mevcut Kral')}: <strong>${data.kingdom.king_username}</strong>
                                </p>
                            ` : `
                                <p style="color: #4ecdc4; margin-top: 10px;">
                                    ${t('Bu krallığın henüz bir kralı yok.')}
                                </p>
                            `}
                        </div>
                    `;
                }

                if (data.canRevolt) {
                    html += `
                        <div style="text-align: center; margin-top: auto;">
                            <button onclick="startRevolt()" 
                                    style="padding: 15px 30px; background: linear-gradient(135deg, #8B0000 0%, #DC143C 100%); 
                                           border: none; border-radius: 8px; color: #fff; font-weight: bold; 
                                           font-size: 1.2em; cursor: pointer; box-shadow: 0 4px 8px rgba(0,0,0,0.3);">
                                ⚔️ ${t('İsyan Çıkar!')} (${formatNumber(data.requiredCoins)} ${t('altın')})
                            </button>
                        </div>
                    `;
                } else {
                    html += `
                        <div style="background: rgba(139, 0, 0, 0.3); border: 2px solid #8B0000; padding: 20px; border-radius: 8px; text-align: center; margin-top: auto;">
                            <p style="color: #ff6b6b; font-size: 1.1em;">
                                ${t('İsyan çıkarmak için gereksinimleri karşılamıyorsunuz.')}
                            </p>
                        </div>
                    `;
                }
            }

            html += `
                    <div id="revolt-status" style="margin-top: 20px;"></div>
                </div>

                <!-- Hırsızlık Bölümü -->
                <div style="background: rgba(100, 100, 100, 0.3); border: 3px solid #666; border-radius: 12px; padding: 25px; display: flex; flex-direction: column;">
                    <h3 style="color: #ccc; margin-bottom: 20px; border-bottom: 2px solid #666; padding-bottom: 10px;">
                        🔪 Hırsızlık
                    </h3>
                    <div style="background: rgba(0, 0, 0, 0.2); border: 2px solid #666; border-radius: 8px; padding: 20px; margin-bottom: 20px; flex-grow: 1;">
                        <p style="color: #ddd; margin-bottom: 15px;">Başka bir oyuncudan altın çalmayı dene. Başarı şansın seviye farkına bağlıdır.</p>
                        <p style="color: #ffae42; margin-bottom: 15px;"><strong>Maliyet:</strong> Her deneme 25 altın.</p>
                        
                        <input type="text" id="steal-target-username" placeholder="Hedef Kullanıcı Adı"
                               style="width: 100%; padding: 10px; background: rgba(0, 0, 0, 0.4); 
                                      border: 2px solid #666; border-radius: 4px; color: #ddd; margin-bottom: 15px;">
                        
                        <button onclick="attemptTheft()" 
                                style="width: 100%; padding: 15px; background: linear-gradient(135deg, #555 0%, #888 100%); 
                                       border: none; border-radius: 8px; color: #fff; font-weight: bold; 
                                       font-size: 1.2em; cursor: pointer; box-shadow: 0 4px 8px rgba(0,0,0,0.3);">
                            💰 Altın Çal
                        </button>
                    </div>
                    <div id="steal-status" style="margin-top: 20px;"></div>
                </div>

                <!-- Süikast Bölümü -->
                <div style="background: rgba(139, 0, 0, 0.3); border: 3px solid #8B0000; border-radius: 12px; padding: 25px; display: flex; flex-direction: column;">
                    <h3 style="color: #ff6b6b; margin-bottom: 20px; border-bottom: 2px solid #8B0000; padding-bottom: 10px;">
                        ☠️ Süikast
                    </h3>
                    <div style="background: rgba(139, 0, 0, 0.2); border: 2px solid #8B0000; border-radius: 8px; padding: 20px; margin-bottom: 20px; flex-grow: 1;">
                        <p style="color: #ffcccc; margin-bottom: 15px;">Bir krala süikast düzenleyerek krallığını ve tüm servetini ele geçirmeyi dene.</p>
                        <p style="color: #ff6b6b; margin-bottom: 15px; font-weight: bold; font-size: 1.1em;">UYARI: Bu eylem SON DERECE RİSKLİDİR.</p>
                        <p style="color: #ffae42; margin-bottom: 15px;"><strong>Maliyet:</strong> Her deneme 5,000 altın.</p>
                        
                        <input type="text" id="assassinate-target-username" placeholder="Hedef Kralın Adı"
                               style="width: 100%; padding: 10px; background: rgba(139, 0, 0, 0.4); 
                                      border: 2px solid #8B0000; border-radius: 4px; color: #ffcccc; margin-bottom: 15px;">
                        
                        <button onclick="attemptAssassination()" 
                                style="width: 100%; padding: 15px; background: linear-gradient(135deg, #8B0000 0%, #DC143C 100%); 
                                       border: none; border-radius: 8px; color: #fff; font-weight: bold; 
                                       font-size: 1.2em; cursor: pointer; box-shadow: 0 4px 8px rgba(0,0,0,0.3);">
                            ☠️ Süikast Düzenle
                        </button>
                    </div>
                    <div id="assassination-status" style="margin-top: 20px;"></div>
                </div>

            </div>
            `;

            content.innerHTML = html;
        } else {
            content.innerHTML = `<p style="color: #ff6b6b;">${data.error || t('Hata oluştu')}</p>`;
        }
    } catch (error) {
        console.error('Entrika yükleme hatası:', error);
        const content = document.getElementById('intrigue-content');
        content.innerHTML = `<p style="color: #ff6b6b;">${t('Bağlantı hatası')}</p>`;
    }
}

// İsyan çıkar
async function startRevolt() {
    try {
        if (currentUser?.username === 'admin') {
            alert('Admin hesabı oyun içi etkileşimlerden muaftır.');
            return;
        }
        // Kullanıcının krallık bilgisini al
        const userResponse = await fetch(`${API_URL}/user`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        const userData = await userResponse.json();
        
        if (!userData.kingdom_id) {
            alert(t('Krallık bilgisi alınamadı.'));
            return;
        }

        if (!confirm(t('1000 altın ödeyerek isyan çıkarmak ve kendinizi kral yapmak istediğinize emin misiniz?'))) {
            return;
        }

        const response = await fetch(`${API_URL}/revolt`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ kingdomId: userData.kingdom_id })
        });

        const data = await response.json();
        const statusEl = document.getElementById('revolt-status');
        
        if (response.ok) {
            statusEl.innerHTML = `
                <div style="background: rgba(0, 100, 0, 0.3); border: 2px solid #006400; padding: 20px; border-radius: 8px;">
                    <p style="color: #51cf66; font-weight: bold; font-size: 1.2em;">✅ ${data.message}</p>
                    <p style="color: #f4e4bc; margin-top: 10px;">
                        ${t('Yeni bakiyeniz')}: ${formatNumber(data.newBalance)} ${t('altın')}
                    </p>
                </div>
            `;
            
            await updateResources();
            await updateUserInfo();
            
            setTimeout(() => {
                loadIntrigue();
            }, 2000);
        } else {
            statusEl.innerHTML = `
                <div style="background: rgba(139, 0, 0, 0.3); border: 2px solid #8B0000; padding: 20px; border-radius: 8px;">
                    <p style="color: #ff6b6b; font-weight: bold;">❌ ${data.error || t('Hata oluştu')}</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('İsyan hatası:', error);
        const statusEl = document.getElementById('revolt-status');
        statusEl.innerHTML = `
            <div style="background: rgba(139, 0, 0, 0.3); border: 2px solid #8B0000; padding: 20px; border-radius: 8px;">
                <p style="color: #ff6b6b;">${t('Bağlantı hatası')}</p>
            </div>
        `;
    }
}

async function attemptTheft() {
    if (currentUser?.username === 'admin') {
        alert('Admin hesabı oyun içi etkileşimlerden muaftır.');
        return;
    }

    const targetUsernameInput = document.getElementById('steal-target-username');
    const targetUsername = targetUsernameInput.value.trim();

    if (!targetUsername) {
        alert('Lütfen bir hedef kullanıcı adı girin.');
        return;
    }

    const statusEl = document.getElementById('steal-status');
    statusEl.innerHTML = `<p style="color: #ffcccc;">Hırsızlık deneniyor...</p>`;

    try {
        const response = await fetch(`${API_URL}/intrigue/steal`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ targetUsername })
        });

        const data = await response.json();

        if (response.ok) {
            statusEl.innerHTML = `
                <div style="background: rgba(0, 100, 0, 0.3); border: 2px solid #006400; padding: 15px; border-radius: 8px;">
                    <p style="color: #51cf66; font-weight: bold;">✅ ${data.message}</p>
                </div>
            `;
            await updateResources();
        } else {
            statusEl.innerHTML = `
                <div style="background: rgba(139, 0, 0, 0.5); border: 2px solid #8B0000; padding: 15px; border-radius: 8px;">
                    <p style="color: #ff6b6b; font-weight: bold;">❌ ${data.message}</p>
                </div>
            `;
             await updateResources(); // Update resources even on failure to show cost deduction
        }
    } catch (error) {
        statusEl.innerHTML = `
            <div style="background: rgba(139, 0, 0, 0.5); border: 2px solid #8B0000; padding: 15px; border-radius: 8px;">
                <p style="color: #ff6b6b;">Bağlantı hatası.</p>
            </div>
        `;
    }
}

async function attemptAssassination() {
    if (currentUser?.username === 'admin') {
        alert('Admin hesabı oyun içi etkileşimlerden muaftır.');
        return;
    }

    const targetUsernameInput = document.getElementById('assassinate-target-username');
    const targetUsername = targetUsernameInput.value.trim();

    if (!targetUsername) {
        alert('Lütfen bir hedef kral adı girin.');
        return;
    }

    if (!confirm(`5,000 altın karşılığında ${targetUsername} adlı krala suikast düzenlemek istediğinize emin misiniz? Bu son derece riskli bir işlemdir ve başarısız olursanız paranızı kaybedersiniz.`)) {
        return;
    }

    const statusEl = document.getElementById('assassination-status');
    statusEl.innerHTML = `<p style="color: #ffcccc;">Süikast planlanıyor...</p>`;

    try {
        const response = await fetch(`${API_URL}/intrigue/assassinate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ targetUsername })
        });

        const data = await response.json();

        if (response.ok) {
            statusEl.innerHTML = `
                <div style="background: rgba(0, 100, 0, 0.3); border: 2px solid #006400; padding: 15px; border-radius: 8px;">
                    <p style="color: #51cf66; font-weight: bold; font-size: 1.2em;">✅ BAŞARILI! ${data.message}</p>
                </div>
            `;
            await updateResources();
            await updateUserInfo();
            setTimeout(() => loadIntrigue(), 2000);
        } else {
            statusEl.innerHTML = `
                <div style="background: rgba(139, 0, 0, 0.5); border: 2px solid #8B0000; padding: 15px; border-radius: 8px;">
                    <p style="color: #ff6b6b; font-weight: bold;">❌ BAŞARISIZ! ${data.message}</p>
                </div>
            `;
             await updateResources(); // Update resources on failure to show cost deduction
        }
    } catch (error) {
        statusEl.innerHTML = `
            <div style="background: rgba(139, 0, 0, 0.5); border: 2px solid #8B0000; padding: 15px; border-radius: 8px;">
                <p style="color: #ff6b6b;">Bağlantı hatası.</p>
            </div>
        `;
    }
}

// Rütbe yönetimi sayfasını yükle
async function loadRanks() {
    try {
        const response = await fetch(`${API_URL}/kingdom-members`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        const data = await response.json();
        const content = document.getElementById('ranks-content');
        
        if (response.ok) {
            const userRank = data.userRank;
            const canAssign = ['Kral', 'Vezir', 'Komutan', 'Asilzade'].includes(userRank);
            
            const rankHierarchy = {
                'Kral': { level: 5, canAssign: ['Vezir', 'Komutan', 'Asilzade', 'Vatandaş'], emoji: '👑' },
                'Vezir': { level: 4, canAssign: ['Komutan', 'Asilzade', 'Vatandaş'], emoji: '⚔️' },
                'Komutan': { level: 3, canAssign: ['Asilzade', 'Vatandaş'], emoji: '🛡️' },
                'Asilzade': { level: 2, canAssign: ['Vatandaş'], emoji: '🏰' },
                'Vatandaş': { level: 1, canAssign: [], emoji: '👤' }
            };

            let policyHtml = '';
            try {
                const policyResponse = await fetch(`${API_URL}/kingdom-policy`, {
                    headers: { 'Authorization': `Bearer ${authToken}` }
                });
                const policy = await policyResponse.json();
                if (policyResponse.ok) {
                    policyHtml = `
                        <div style="margin-bottom: 20px; padding: 15px; background: rgba(160, 82, 45, 0.5); border-radius: 8px; border: 2px solid #D4AF37;">
                            <h3 style="color: #FFD700; margin-bottom: 10px;">Krallık Politikası</h3>
                            <p style="color: #f4e4bc; margin-bottom: 10px;">${policy.kingdomName || 'Krallık'} günlük vergi: <strong>%${policy.taxRate}</strong> | pazar vergisi: <strong>%${policy.marketTaxRate}</strong></p>
                            ${policy.canEdit ? `
                                <div style="display: flex; gap: 12px; flex-wrap: wrap; align-items: end;">
                                    <label style="color: #f4e4bc;">Günlük vergi
                                        <input type="number" id="kingdom-tax-rate" min="0" max="25" value="${policy.taxRate}" style="display: block; width: 120px; margin-top: 5px; padding: 8px; background: rgba(139, 69, 19, 0.8); border: 2px solid #D4AF37; border-radius: 6px; color: #f4e4bc;">
                                    </label>
                                    <label style="color: #f4e4bc;">Pazar vergisi
                                        <input type="number" id="kingdom-market-tax-rate" min="0" max="15" value="${policy.marketTaxRate}" style="display: block; width: 120px; margin-top: 5px; padding: 8px; background: rgba(139, 69, 19, 0.8); border: 2px solid #D4AF37; border-radius: 6px; color: #f4e4bc;">
                                    </label>
                                    <button onclick="saveKingdomPolicy()" style="padding: 10px 16px; background: linear-gradient(135deg, #D4AF37 0%, #FFD700 100%); border: none; border-radius: 6px; color: #8B4513; font-weight: bold; cursor: pointer;">Kaydet</button>
                                </div>
                            ` : ''}
                            <div id="kingdom-policy-status" style="margin-top: 10px;"></div>
                        </div>
                    `;
                }
            } catch (error) {
                console.error('Krallık politikası yükleme hatası:', error);
            }

            let html = `
                <div style="background: rgba(139, 69, 19, 0.8); border: 3px solid #D4AF37; border-radius: 12px; padding: 25px;">
                    ${policyHtml}
                    <div style="margin-bottom: 20px; padding: 15px; background: rgba(160, 82, 45, 0.5); border-radius: 8px;">
                        <h3 style="color: #FFD700; margin-bottom: 10px;">Mevcut Rütbeniz</h3>
                        <p style="color: #f4e4bc; font-size: 1.2em;">
                            ${rankHierarchy[userRank]?.emoji || '👤'} <strong>${userRank}</strong>
                        </p>
                        ${canAssign ? `<p style="color: #4ecdc4; margin-top: 10px;">Bu rütbeleri atayabilirsiniz: ${rankHierarchy[userRank]?.canAssign.join(', ')}</p>` : 
                          '<p style="color: #a0a0a0; margin-top: 10px;">Rütbe atama yetkiniz yok.</p>'}
                    </div>

                    <h3 style="color: #FFD700; margin: 20px 0 15px 0; border-bottom: 2px solid #D4AF37; padding-bottom: 10px;">
                        👥 Krallık Üyeleri
                    </h3>
                    <div style="display: grid; gap: 15px;">
            `;

            if (data.members && data.members.length > 0) {
                data.members.forEach(member => {
                    const memberRank = rankHierarchy[member.rank] || { emoji: '👤', level: 0 };
                    const canAssignToThis = canAssign && 
                                          memberRank.level < rankHierarchy[userRank].level &&
                                          member.id !== currentUser.id;
                    
                    html += `
                        <div style="background: rgba(160, 82, 45, 0.5); border: 2px solid #D4AF37; border-radius: 8px; padding: 15px;">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div>
                                    <h4 style="color: #FFD700; margin-bottom: 5px; display: flex; align-items: center; gap: 8px;">
                                        ${memberRank.emoji} ${member.username}
                                        ${member.id === currentUser.id ? '<span style="color: #4ecdc4; font-size: 0.8em;">(Siz)</span>' : ''}
                                    </h4>
                                    <p style="color: #f4e4bc; font-size: 0.9em;">
                                        Rütbe: <strong>${member.rank}</strong> | Seviye: ${member.level} | Altın: ${formatNumber(member.coins)} | Köleler: ${member.slave_count || 0}
                                    </p>
                                </div>
                                ${canAssignToThis ? `
                                    <div style="text-align: right;">
                                        <select id="rank-select-${member.id}" 
                                                style="padding: 8px; background: rgba(139, 69, 19, 0.8); border: 2px solid #D4AF37; 
                                                       border-radius: 6px; color: #f4e4bc; margin-bottom: 10px;">
                                            <option value="">Rütbe Seç</option>
                                            ${rankHierarchy[userRank].canAssign.filter(rank => {
                                                const targetRankLevel = rankHierarchy[rank]?.level || 0;
                                                return targetRankLevel > memberRank.level;
                                            }).map(rank => 
                                                `<option value="${rank}">${rankHierarchy[rank]?.emoji || ''} ${rank}</option>`
                                            ).join('')}
                                        </select>
                                        <br>
                                        <button onclick="assignRank(${member.id}, '${member.username.replace(/'/g, "\\'")}')" 
                                                style="padding: 8px 16px; background: linear-gradient(135deg, #D4AF37 0%, #FFD700 100%); 
                                                       border: none; border-radius: 6px; color: #8B4513; font-weight: bold; cursor: pointer;">
                                            ⚔️ Rütbe Ata
                                        </button>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    `;
                });
            } else {
                html += `<p style="color: #f4e4bc; text-align: center;">Krallıkta üye bulunamadı.</p>`;
            }

            html += `
                    </div>
                    <div id="rank-status" style="margin-top: 20px;"></div>
                </div>
            `;

            content.innerHTML = html;
        } else {
            content.innerHTML = `<p style="color: #ff6b6b;">${data.error || 'Hata oluştu'}</p>`;
        }
    } catch (error) {
        console.error('Rütbe yönetimi yükleme hatası:', error);
        const content = document.getElementById('ranks-content');
        content.innerHTML = `<p style="color: #ff6b6b;">Bağlantı hatası</p>`;
    }
}

async function saveKingdomPolicy() {
    const taxRate = parseInt(document.getElementById('kingdom-tax-rate')?.value || '0');
    const marketTaxRate = parseInt(document.getElementById('kingdom-market-tax-rate')?.value || '0');
    const statusEl = document.getElementById('kingdom-policy-status');

    try {
        const response = await fetch(`${API_URL}/kingdom-policy`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ taxRate, marketTaxRate })
        });

        const data = await response.json();
        if (response.ok) {
            statusEl.innerHTML = `<p style="color: #51cf66;">${data.message}</p>`;
        } else {
            statusEl.innerHTML = `<p style="color: #ff6b6b;">${data.error || 'Hata oluştu'}</p>`;
        }
    } catch (error) {
        console.error('Krallık politikası kaydetme hatası:', error);
        statusEl.innerHTML = `<p style="color: #ff6b6b;">Bağlantı hatası</p>`;
    }
}

// Rütbe ata
async function assignRank(userId, username) {
    const selectEl = document.getElementById(`rank-select-${userId}`);
    const rank = selectEl.value;

    if (!rank) {
        alert('Lütfen bir rütbe seçin!');
        return;
    }

    if (!confirm(`${username} kullanıcısına ${rank} rütbesini atamak istediğinize emin misiniz?`)) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/assign-rank`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ userId, rank })
        });

        const data = await response.json();
        const statusEl = document.getElementById('rank-status');
        
        if (response.ok) {
            statusEl.innerHTML = `
                <div style="background: rgba(0, 100, 0, 0.3); border: 2px solid #006400; padding: 15px; border-radius: 8px;">
                    <p style="color: #51cf66; font-weight: bold;">✅ ${data.message}</p>
                </div>
            `;
            
            await updateResources();
            await updateUserInfo();
            
            setTimeout(() => {
                loadRanks();
            }, 2000);
        } else {
            statusEl.innerHTML = `
                <div style="background: rgba(139, 0, 0, 0.3); border: 2px solid #8B0000; padding: 15px; border-radius: 8px;">
                    <p style="color: #ff6b6b;">${data.error || 'Hata oluştu'}</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Rütbe atama hatası:', error);
    }
}

// Harita sayfasını yükle
async function loadMap() {
    try {
        const response = await fetch(`${API_URL}/map`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        const data = await response.json();
        const content = document.getElementById('map-content');
        
        if (response.ok) {
            let html = `
                <div style="background: rgba(139, 69, 19, 0.8); border: 3px solid #D4AF37; border-radius: 12px; padding: 25px;">
                    <div style="margin-bottom: 20px; padding: 15px; background: rgba(160, 82, 45, 0.5); border-radius: 8px;">
                        <h3 style="color: #FFD700; margin-bottom: 10px;">📍 ${t('Mevcut Krallığınız')}</h3>
                        <p style="color: #f4e4bc; font-size: 1.2em;">
                            <strong>${data.currentKingdom || t('Bilinmiyor')}</strong>
                        </p>
                    </div>

                    <h3 style="color: #FFD700; margin: 20px 0 15px 0; border-bottom: 2px solid #D4AF37; padding-bottom: 10px;">
                        🗺️ ${t('Tüm Krallıklar')}
                    </h3>
                    <div style="display: grid; gap: 15px;">
            `;

            if (data.kingdoms && data.kingdoms.length > 0) {
                data.kingdoms.forEach(kingdom => {
                    const isCurrentKingdom = kingdom.name === data.currentKingdom;
                    const canTravel = !isCurrentKingdom;
                    
                    html += `
                        <div style="background: rgba(160, 82, 45, 0.5); border: 2px solid ${isCurrentKingdom ? '#51cf66' : '#D4AF37'}; border-radius: 8px; padding: 15px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px;">
                                <div style="flex: 1; min-width: 200px;">
                                    <h4 style="color: #FFD700; margin-bottom: 8px; display: flex; align-items: center; gap: 8px;">
                                        ${isCurrentKingdom ? '📍' : '🏛️'} ${kingdom.name}
                                        ${isCurrentKingdom ? `<span style="color: #51cf66; font-size: 0.8em;">(${t('Mevcut')})</span>` : ''}
                                    </h4>
                                    <p style="color: #f4e4bc; font-size: 0.9em; margin-bottom: 5px;">
                                        ${kingdom.description || ''}
                                    </p>
                                    <p style="color: #4ecdc4; font-size: 0.9em; margin-top: 8px;">
                                        👥 ${t('Vatandaş Sayısı')}: <strong>${kingdom.population || 0}</strong>
                                    </p>
                                    ${kingdom.king_name ? `
                                        <p style="color: #D4AF37; font-size: 0.9em; margin-top: 5px;">
                                            👑 ${t('Kral')}: <strong>${kingdom.king_name}</strong>
                                        </p>
                                    ` : ''}
                                </div>
                                ${canTravel ? `
                                    <div style="text-align: right;">
                                        <button onclick="travelToKingdom(${kingdom.id}, '${kingdom.name.replace(/'/g, "\\'")}')" 
                                                style="padding: 10px 20px; background: linear-gradient(135deg, #D4AF37 0%, #FFD700 100%); 
                                                       border: none; border-radius: 6px; color: #8B4513; font-weight: bold; cursor: pointer;
                                                       font-size: 1em;">
                                            🚶 ${t('Seyahat Et')} (100 ${t('altın')})
                                        </button>
                                    </div>
                                ` : `
                                    <div style="text-align: right;">
                                        <span style="color: #51cf66; font-weight: bold; padding: 10px 20px;">
                                            ✓ ${t('Buradasınız')}
                                        </span>
                                    </div>
                                `}
                            </div>
                        </div>
                    `;
                });
            } else {
                html += `<p style="color: #f4e4bc; text-align: center;">${t('Krallık bulunamadı.')}</p>`;
            }

            html += `
                    </div>
                    <div id="travel-status" style="margin-top: 20px;"></div>
                </div>
            `;

            content.innerHTML = html;
        } else {
            content.innerHTML = `<p style="color: #ff6b6b;">${data.error || t('Hata oluştu')}</p>`;
        }
    } catch (error) {
        console.error('Harita yükleme hatası:', error);
        const content = document.getElementById('map-content');
        content.innerHTML = `<p style="color: #ff6b6b;">${t('Bağlantı hatası')}</p>`;
    }
}

// Krallığa seyahat et
async function travelToKingdom(kingdomId, kingdomName) {
    if (!confirm(t('Bu krallığa seyahat etmek için 100 altın ödemeniz gerekiyor. Devam etmek istiyor musunuz?'))) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/travel`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ kingdomId })
        });

        const data = await response.json();
        const statusEl = document.getElementById('travel-status');
        
        if (response.ok) {
            statusEl.innerHTML = `
                <div style="background: rgba(0, 100, 0, 0.3); border: 2px solid #006400; padding: 15px; border-radius: 8px;">
                    <p style="color: #51cf66; font-weight: bold; font-size: 1.1em;">✅ ${data.message}</p>
                    <p style="color: #f4e4bc; margin-top: 5px;">
                        ${t('Seyahat maliyeti')}: ${formatNumber(data.travelCost)} ${t('altın')}
                    </p>
                    <p style="color: #f4e4bc;">
                        ${t('Yeni bakiyeniz')}: ${formatNumber(data.newBalance)} ${t('altın')}
                    </p>
                </div>
            `;
            
            await updateResources();
            await updateUserInfo();
            
            setTimeout(() => {
                loadMap();
            }, 2000);
        } else {
            statusEl.innerHTML = `
                <div style="background: rgba(139, 0, 0, 0.3); border: 2px solid #8B0000; padding: 15px; border-radius: 8px;">
                    <p style="color: #ff6b6b;">${data.error || t('Hata oluştu')}</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Seyahat hatası:', error);
        const statusEl = document.getElementById('travel-status');
        statusEl.innerHTML = `
            <div style="background: rgba(139, 0, 0, 0.3); border: 2px solid #8B0000; padding: 15px; border-radius: 8px;">
                <p style="color: #ff6b6b;">${t('Bağlantı hatası')}</p>
            </div>
        `;
    }
}

// Yatırımlar sayfasını yükle
async function loadInvestments() {
    try {
        const response = await fetch(`${API_URL}/investments`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        const data = await response.json();
        const content = document.getElementById('investments-content');
        
        if (response.ok) {
            let html = `
                <div style="background: rgba(139, 69, 19, 0.8); border: 3px solid #D4AF37; border-radius: 12px; padding: 25px;">
                    <h3 style="color: #FFD700; margin-bottom: 20px;">💰 ${t('Yatırım Paketleri')}</h3>
                    
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 30px;">
                        <div style="background: rgba(160, 82, 45, 0.5); border: 2px solid #D4AF37; border-radius: 8px; padding: 20px;">
                            <h4 style="color: #FFD700; margin-bottom: 10px;">📅 1 Günlük Yatırım</h4>
                            <p style="color: #f4e4bc; margin-bottom: 10px;">Kar Oranı: <strong style="color: #51cf66;">%8</strong></p>
                            <p style="color: #f4e4bc; margin-bottom: 10px;">Risk: Düşük</p>
                            <p style="color: #f4e4bc; margin-bottom: 15px; font-size: 0.9em;">Minimum: 100 altın</p>
                            <input type="number" id="invest-amount-1" placeholder="Tutar" min="100" 
                                   style="width: 100%; padding: 8px; margin-bottom: 10px; background: rgba(139, 69, 19, 0.8); 
                                          border: 2px solid #D4AF37; border-radius: 4px; color: #f4e4bc;">
                            <button onclick="makeInvestment(1)" 
                                    style="width: 100%; padding: 10px; background: linear-gradient(135deg, #D4AF37 0%, #FFD700 100%); 
                                           border: none; border-radius: 6px; color: #8B4513; font-weight: bold; cursor: pointer;">
                                💰 Yatırım Yap
                            </button>
                        </div>

                        <div style="background: rgba(160, 82, 45, 0.5); border: 2px solid #D4AF37; border-radius: 8px; padding: 20px;">
                            <h4 style="color: #FFD700; margin-bottom: 10px;">📅 3 Günlük Yatırım</h4>
                            <p style="color: #f4e4bc; margin-bottom: 10px;">Kar Oranı: <strong style="color: #51cf66;">%18</strong></p>
                            <p style="color: #f4e4bc; margin-bottom: 10px;">Risk: Orta</p>
                            <p style="color: #f4e4bc; margin-bottom: 15px; font-size: 0.9em;">Minimum: 500 altın</p>
                            <input type="number" id="invest-amount-3" placeholder="Tutar" min="500" 
                                   style="width: 100%; padding: 8px; margin-bottom: 10px; background: rgba(139, 69, 19, 0.8); 
                                          border: 2px solid #D4AF37; border-radius: 4px; color: #f4e4bc;">
                            <button onclick="makeInvestment(3)" 
                                    style="width: 100%; padding: 10px; background: linear-gradient(135deg, #D4AF37 0%, #FFD700 100%); 
                                           border: none; border-radius: 6px; color: #8B4513; font-weight: bold; cursor: pointer;">
                                💰 Yatırım Yap
                            </button>
                        </div>

                        <div style="background: rgba(160, 82, 45, 0.5); border: 2px solid #D4AF37; border-radius: 8px; padding: 20px;">
                            <h4 style="color: #FFD700; margin-bottom: 10px;">📅 7 Günlük Yatırım</h4>
                            <p style="color: #f4e4bc; margin-bottom: 10px;">Kar Oranı: <strong style="color: #51cf66;">%32</strong></p>
                            <p style="color: #f4e4bc; margin-bottom: 10px;">Risk: Yüksek</p>
                            <p style="color: #f4e4bc; margin-bottom: 15px; font-size: 0.9em;">Minimum: 1000 altın</p>
                            <input type="number" id="invest-amount-7" placeholder="Tutar" min="1000" 
                                   style="width: 100%; padding: 8px; margin-bottom: 10px; background: rgba(139, 69, 19, 0.8); 
                                          border: 2px solid #D4AF37; border-radius: 4px; color: #f4e4bc;">
                            <button onclick="makeInvestment(7)" 
                                    style="width: 100%; padding: 10px; background: linear-gradient(135deg, #D4AF37 0%, #FFD700 100%); 
                                           border: none; border-radius: 6px; color: #8B4513; font-weight: bold; cursor: pointer;">
                                💰 Yatırım Yap
                            </button>
                        </div>
                    </div>

                    <h3 style="color: #FFD700; margin: 30px 0 15px 0; border-bottom: 2px solid #D4AF37; padding-bottom: 10px;">
                        📋 ${t('Yatırım Geçmişim')}
                    </h3>
            `;

            if (data.investments && data.investments.length > 0) {
                html += `<div style="display: grid; gap: 15px;">`;
                
                data.investments.forEach(inv => {
                    const investedDate = new Date(inv.invested_at);
                    const completionDate = inv.completed_at ? new Date(inv.completed_at) : 
                                          new Date(investedDate.getTime() + inv.duration_days * 24 * 60 * 60 * 1000);
                    const now = new Date();
                    const isCompleted = inv.status === 'completed';
                    const canWithdraw = isCompleted && now >= completionDate;
                    const canEarlyWithdraw = inv.status === 'active';
                    const riskLabels = { low: 'Düşük', medium: 'Orta', high: 'Yüksek' };
                    
                    html += `
                        <div style="background: rgba(160, 82, 45, 0.5); border: 2px solid ${isCompleted ? '#51cf66' : '#D4AF37'}; border-radius: 8px; padding: 15px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px;">
                                <div style="flex: 1; min-width: 200px;">
                                    <h4 style="color: #FFD700; margin-bottom: 8px;">
                                        ${inv.duration_days} ${t('Günlük Yatırım')} - ${inv.profit_rate}% ${t('Kar')}
                                    </h4>
                                    <p style="color: #f4e4bc; font-size: 0.9em; margin-bottom: 5px;">
                                        ${t('Yatırım Tutarı')}: <strong>${formatNumber(inv.amount)}</strong> ${t('altın')}
                                    </p>
                                    <p style="color: #f4e4bc; font-size: 0.9em; margin-bottom: 5px;">
                                        ${t('Toplam Getiri')}: <strong style="color: #51cf66;">${formatNumber(inv.total_return)}</strong> ${t('altın')}
                                    </p>
                                    <p style="color: #f4e4bc; font-size: 0.9em; margin-bottom: 5px;">
                                        Risk: <strong>${riskLabels[inv.risk_level] || inv.risk_level || 'Düşük'}</strong>
                                    </p>
                                    <p style="color: #f4e4bc; font-size: 0.9em; margin-bottom: 5px;">
                                        ${t('Yatırım Tarihi')}: ${investedDate.toLocaleDateString('tr-TR')}
                                    </p>
                                    ${isCompleted ? `
                                        <p style="color: #51cf66; font-size: 0.9em; font-weight: bold;">
                                            ✅ ${t('Tamamlandı')}
                                        </p>
                                    ` : `
                                        <p style="color: #FFD700; font-size: 0.9em;">
                                            ⏳ ${t('Beklemede')} - ${t('Tamamlanma')}: ${completionDate.toLocaleDateString('tr-TR')}
                                        </p>
                                    `}
                                </div>
                                ${canWithdraw ? `
                                    <div style="text-align: right;">
                                        <button onclick="withdrawInvestment(${inv.id})" 
                                                style="padding: 10px 20px; background: linear-gradient(135deg, #51cf66 0%, #40c057 100%); 
                                                       border: none; border-radius: 6px; color: #fff; font-weight: bold; cursor: pointer;">
                                            💰 ${t('Geri Çek')}
                                        </button>
                                    </div>
                                ` : canEarlyWithdraw ? `
                                    <div style="text-align: right;">
                                        <button onclick="withdrawInvestment(${inv.id}, true)" 
                                                style="padding: 10px 20px; background: linear-gradient(135deg, #ff922b 0%, #f76707 100%); 
                                                       border: none; border-radius: 6px; color: #fff; font-weight: bold; cursor: pointer;">
                                            Erken Boz (-%20)
                                        </button>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    `;
                });
                
                html += `</div>`;
            } else {
                html += `
                    <div style="background: rgba(160, 82, 45, 0.3); border: 2px solid #D4AF37; border-radius: 8px; padding: 20px; text-align: center;">
                        <p style="color: #f4e4bc;">${t('Henüz yatırım yapmadınız.')}</p>
                    </div>
                `;
            }

            html += `
                    <div id="investment-status" style="margin-top: 20px;"></div>
                </div>
            `;

            content.innerHTML = html;
        } else {
            content.innerHTML = `<p style="color: #ff6b6b;">${data.error || t('Hata oluştu')}</p>`;
        }
    } catch (error) {
        console.error('Yatırımlar yükleme hatası:', error);
        const content = document.getElementById('investments-content');
        content.innerHTML = `<p style="color: #ff6b6b;">${t('Bağlantı hatası')}</p>`;
    }
}

// Yatırım yap
async function makeInvestment(durationDays) {
    const amountInput = document.getElementById(`invest-amount-${durationDays}`);
    const amount = parseInt(amountInput.value);

    if (!amount || amount < 100) {
        alert(t('Geçerli bir tutar girin! Minimum 100 altın.'));
        return;
    }

    const minAmounts = { 1: 100, 3: 500, 7: 1000 };
    if (amount < minAmounts[durationDays]) {
        alert(`${durationDays} ${t('günlük yatırım için minimum')} ${minAmounts[durationDays]} ${t('altın gereklidir.')}`);
        return;
    }

    if (!confirm(`${formatNumber(amount)} ${t('altın ile')} ${durationDays} ${t('günlük yatırım yapmak istediğinize emin misiniz?')}`)) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/invest`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ amount, durationDays })
        });

        const data = await response.json();
        const statusEl = document.getElementById('investment-status');
        
        if (response.ok) {
            statusEl.innerHTML = `
                <div style="background: rgba(0, 100, 0, 0.3); border: 2px solid #006400; padding: 20px; border-radius: 8px;">
                    <p style="color: #51cf66; font-weight: bold; font-size: 1.1em;">✅ ${data.message}</p>
                    <p style="color: #f4e4bc; margin-top: 10px;">
                        ${t('Yeni bakiyeniz')}: ${formatNumber(data.newBalance)} ${t('altın')}
                    </p>
                </div>
            `;
            
            await updateResources();
            amountInput.value = '';
            
            setTimeout(() => {
                loadInvestments();
            }, 2000);
        } else {
            statusEl.innerHTML = `
                <div style="background: rgba(139, 0, 0, 0.3); border: 2px solid #8B0000; padding: 20px; border-radius: 8px;">
                    <p style="color: #ff6b6b; font-weight: bold;">❌ ${data.error || t('Hata oluştu')}</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Yatırım hatası:', error);
        const statusEl = document.getElementById('investment-status');
        statusEl.innerHTML = `
            <div style="background: rgba(139, 0, 0, 0.3); border: 2px solid #8B0000; padding: 20px; border-radius: 8px;">
                <p style="color: #ff6b6b;">${t('Bağlantı hatası')}</p>
            </div>
        `;
    }
}

// Yatırımı geri çek
async function withdrawInvestment(investmentId, early = false) {
    const confirmText = early
        ? 'Yatırımı erken bozmak istediğinize emin misiniz? %20 ceza uygulanır.'
        : t('Yatırımı geri çekmek istediğinize emin misiniz?');
    if (!confirm(confirmText)) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/withdraw-investment`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ investmentId })
        });

        const data = await response.json();
        const statusEl = document.getElementById('investment-status');
        
        if (response.ok) {
            statusEl.innerHTML = `
                <div style="background: rgba(0, 100, 0, 0.3); border: 2px solid #006400; padding: 20px; border-radius: 8px;">
                    <p style="color: #51cf66; font-weight: bold; font-size: 1.1em;">✅ ${data.message}</p>
                    <p style="color: #f4e4bc; margin-top: 10px;">
                        ${t('Yeni bakiyeniz')}: ${formatNumber(data.newBalance)} ${t('altın')}
                    </p>
                </div>
            `;
            
            await updateResources();
            
            setTimeout(() => {
                loadInvestments();
            }, 2000);
        } else {
            statusEl.innerHTML = `
                <div style="background: rgba(139, 0, 0, 0.3); border: 2px solid #8B0000; padding: 20px; border-radius: 8px;">
                    <p style="color: #ff6b6b; font-weight: bold;">❌ ${data.error || t('Hata oluştu')}</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Yatırım geri çekme hatası:', error);
        const statusEl = document.getElementById('investment-status');
        statusEl.innerHTML = `
            <div style="background: rgba(139, 0, 0, 0.3); border: 2px solid #8B0000; padding: 20px; border-radius: 8px;">
                <p style="color: #ff6b6b;">${t('Bağlantı hatası')}</p>
            </div>
        `;
    }
}

async function loadFoodMarket() {
    const content = document.getElementById('food-market-content');
    const foodPrice = 10; // 1 food = 10 gold

    let html = `
        <div style="background: rgba(139, 69, 19, 0.8); border: 3px solid #D4AF37; border-radius: 12px; padding: 25px;">
            <div style="text-align: center; margin-bottom: 20px;">
                <h3 style="color: #FFD700;">Gıda Pazarı</h3>
                <p style="color: #f4e4bc;">1 Birim Gıda = ${foodPrice} Altın</p>
            </div>

            <div style="display: flex; justify-content: space-around; background: rgba(160, 82, 45, 0.5); padding: 15px; border-radius: 8px; margin-bottom: 20px; text-align: center;">
                <div>
                    <p style="color: #f4e4bc; font-size: 1.1em;">Mevcut Altının</p>
                    <p style="color: #FFD700; font-size: 1.5em; font-weight: bold;">${formatNumber(resources.gold)} 🪙</p>
                </div>
                <div>
                    <p style="color: #f4e4bc; font-size: 1.1em;">Mevcut Gıdan</p>
                    <p style="color: #4ecdc4; font-size: 1.5em; font-weight: bold;">${formatNumber(resources.food)} 🥖</p>
                </div>
            </div>

            <div style="background: rgba(160, 82, 45, 0.5); border: 2px solid #D4AF37; border-radius: 8px; padding: 20px;">
                <h4 style="color: #FFD700; margin-bottom: 15px; text-align: center;">İşlem Yap</h4>
                <div style="display: flex; flex-direction: column; align-items: center; gap: 15px;">
                    <input type="number" id="food-amount" placeholder="Miktar" min="1" 
                           style="width: 50%; padding: 10px; background: rgba(139, 69, 19, 0.8); 
                                  border: 2px solid #D4AF37; border-radius: 4px; color: #f4e4bc; text-align: center;">
                    <div style="display: flex; gap: 15px;">
                        <button onclick="buyFood()" style="padding: 10px 20px; background: linear-gradient(135deg, #51cf66 0%, #40c057 100%); border: none; border-radius: 6px; color: #fff; font-weight: bold; cursor: pointer;">
                            Gıda Satın Al
                        </button>
                        <button onclick="sellFood()" style="padding: 10px 20px; background: linear-gradient(135deg, #ff6b6b 0%, #fa5252 100%); border: none; border-radius: 6px; color: #fff; font-weight: bold; cursor: pointer;">
                            Gıda Sat
                        </button>
                    </div>
                </div>
            </div>
            
            <div id="food-market-status" style="margin-top: 20px;"></div>
        </div>
    `;
    content.innerHTML = html;
}

async function buyFood() {
    const amountInput = document.getElementById('food-amount');
    const amount = parseInt(amountInput.value);
    if (!amount || amount <= 0) {
        alert('Lütfen geçerli bir miktar girin.');
        return;
    }

    const statusEl = document.getElementById('food-market-status');
    statusEl.innerHTML = `<p style="color: #FFD700;">İşlem yapılıyor...</p>`;

    try {
        const response = await fetch(`${API_URL}/market/buy-food`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
            body: JSON.stringify({ amount })
        });
        const data = await response.json();
        if (response.ok) {
            statusEl.innerHTML = `<p style="color: #51cf66;">✅ ${data.message}</p>`;
            await updateResources();
            loadFoodMarket(); // Refresh the market UI
        } else {
            statusEl.innerHTML = `<p style="color: #ff6b6b;">❌ ${data.error}</p>`;
        }
    } catch (error) {
        statusEl.innerHTML = `<p style="color: #ff6b6b;">❌ Bağlantı hatası.</p>`;
    }
}

async function sellFood() {
    const amountInput = document.getElementById('food-amount');
    const amount = parseInt(amountInput.value);
    if (!amount || amount <= 0) {
        alert('Lütfen geçerli bir miktar girin.');
        return;
    }

    const statusEl = document.getElementById('food-market-status');
    statusEl.innerHTML = `<p style="color: #FFD700;">İşlem yapılıyor...</p>`;

    try {
        const response = await fetch(`${API_URL}/market/sell-food`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
            body: JSON.stringify({ amount })
        });
        const data = await response.json();
        if (response.ok) {
            statusEl.innerHTML = `<p style="color: #51cf66;">✅ ${data.message}</p>`;
            await updateResources();
            loadFoodMarket(); // Refresh the market UI
        } else {
            statusEl.innerHTML = `<p style="color: #ff6b6b;">❌ ${data.error}</p>`;
        }
    } catch (error) {
        statusEl.innerHTML = `<p style="color: #ff6b6b;">❌ Bağlantı hatası.</p>`;
    }
}

async function loadMarriage() {
    const content = document.getElementById('marriage-content');
    
    if (!currentUser) {
        content.innerHTML = `<p style="color: #ff6b6b;">Kullanıcı verileri yüklenemedi.</p>`;
        return;
    }

    await fetchCurrentUser(); // Always get latest user data

    let html = '<div style="background: rgba(139, 69, 19, 0.8); border: 3px solid #D4AF37; border-radius: 12px; padding: 25px;">';

    // Fetch children
    let childrenHtml = '';
    try {
        const response = await fetch(`${API_URL}/children`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (response.ok) {
            const children = await response.json();
            if (children.length > 0) {
                childrenHtml += '<h4 style="color: #FFD700; margin-top: 20px;">Çocuklar</h4><ul style="list-style-type: none; padding: 0;">';
                children.forEach(child => {
                    childrenHtml += `<li style="color: #f4e4bc; margin-bottom: 5px;">${child.child_name} (${child.child_gender === 'male' ? 'Erkek' : 'Kadın'}) - ${child.role || 'Çocuk'}, yaş ${child.age || 0}</li>`;
                });
                childrenHtml += '</ul>';
            }
        }
    } catch (error) {
        console.error('Çocuklar yüklenemedi:', error);
    }

    if (currentUser.gender === 'male') {
        if (currentUser.wives && currentUser.wives.length > 0) {
            html += `
                <div style="background: rgba(160, 82, 45, 0.5); padding: 20px; border-radius: 8px; text-align: center;">
                    <h3 style="color: #FFD700;">Evlilik Durumu</h3>
                    <p style="color: #f4e4bc; margin-top: 10px;">Eş Sayısı: ${currentUser.wives.length}</p>
                    <ul style="list-style-type: none; padding: 0; margin-top: 10px;">`;
            currentUser.wives.forEach(wife => {
                html += `<li style="color: #f4e4bc; margin-bottom: 5px;">${wife.username} <button onclick="divorce(${wife.id})" style="padding: 5px 10px; background: linear-gradient(135deg, #8B0000 0%, #DC143C 100%); border: none; border-radius: 6px; color: #fff; font-weight: bold; cursor: pointer; margin-left: 10px;">Boşan</button></li>`;
            });
            html += `</ul>
                    <p style="color: #f4e4bc; margin-top: 10px;">Çocuk Sayısı: ${currentUser.children_count || 0}</p>
                    ${childrenHtml}
                    <div style="margin-top: 20px;">
                        <select id="wife-for-child" style="padding: 10px; background: rgba(0,0,0,0.3); border: 1px solid #444; color: #eee; border-radius: 4px;">`;
            currentUser.wives.forEach(wife => {
                html += `<option value="${wife.id}">${wife.username}</option>`;
            });
            html += `</select>
                        <button onclick="haveChild()" style="padding: 10px 20px; background: linear-gradient(135deg, #D4AF37 0%, #FFD700 100%); border: none; border-radius: 6px; color: #8B4513; font-weight: bold; cursor: pointer; margin-left: 10px;">
                            Çocuk Yap
                        </button>
                    </div>
                </div>`;
        } else {
             html += `
            <div style="background: rgba(160, 82, 45, 0.5); padding: 20px; border-radius: 8px; text-align: center;">
                <h3 style="color: #FFD700;">Evlen</h3>
                <p style="color: #f4e4bc; font-size: 1.1em; margin-top: 10px;">
                    Bekarsınız. Başka bir oyuncuya evlilik teklif edebilirsiniz.
                </p>
                <div style="margin-top: 20px;">
                    <input type="text" id="propose-username" placeholder="Kullanıcı Adı" style="padding: 10px; width: 60%; background: rgba(0,0,0,0.3); border: 1px solid #444; color: #eee; border-radius: 4px;">
                    <button onclick="proposeMarriage()" style="padding: 10px 20px; background: linear-gradient(135deg, #D4AF37 0%, #FFD700 100%); border: none; border-radius: 6px; color: #8B4513; font-weight: bold; cursor: pointer;">
                        Evlilik Teklif Et
                    </button>
                </div>
            </div>
        `;
        }
    } else { // female
        if (currentUser.husband) {
             html += `
            <div style="background: rgba(160, 82, 45, 0.5); padding: 20px; border-radius: 8px; text-align: center;">
                <h3 style="color: #FFD700;">Evlilik Durumu</h3>
                <p style="color: #f4e4bc; font-size: 1.2em; margin-top: 10px;">
                    ${currentUser.husband.username} ile evlisiniz.
                </p>
                <p style="color: #f4e4bc; margin-top: 10px;">Çocuk Sayısı: ${currentUser.children_count || 0}</p>
                ${childrenHtml}
                <button onclick="haveChild()" style="padding: 10px 20px; background: linear-gradient(135deg, #D4AF37 0%, #FFD700 100%); border: none; border-radius: 6px; color: #8B4513; font-weight: bold; cursor: pointer; margin-top: 20px;">
                    Çocuk Yap
                </button>
                <button onclick="divorce()" style="padding: 10px 20px; background: linear-gradient(135deg, #8B0000 0%, #DC143C 100%); border: none; border-radius: 6px; color: #fff; font-weight: bold; cursor: pointer; margin-top: 20px; margin-left: 10px;">
                    Boşan
                </button>
            </div>
        `;
        } else {
             html += `
            <div style="background: rgba(160, 82, 45, 0.5); padding: 20px; border-radius: 8px; text-align: center;">
                <h3 style="color: #FFD700;">Evlen</h3>
                <p style="color: #f4e4bc; font-size: 1.1em; margin-top: 10px;">
                    Bekarsınız. Başka bir oyuncuya evlilik teklif edebilirsiniz.
                </p>
                <div style="margin-top: 20px;">
                    <input type="text" id="propose-username" placeholder="Kullanıcı Adı" style="padding: 10px; width: 60%; background: rgba(0,0,0,0.3); border: 1px solid #444; color: #eee; border-radius: 4px;">
                    <button onclick="proposeMarriage()" style="padding: 10px 20px; background: linear-gradient(135deg, #D4AF37 0%, #FFD700 100%); border: none; border-radius: 6px; color: #8B4513; font-weight: bold; cursor: pointer;">
                        Evlilik Teklif Et
                    </button>
                </div>
            </div>
        `;
        }
    }

    html += `<div id="marriage-status" style="margin-top: 20px;"></div></div>`;
    content.innerHTML = html;
}

async function haveChild() {
    const statusEl = document.getElementById('marriage-status');
    statusEl.innerHTML = '';
    let wifeId = null;
    if (currentUser.gender === 'male') {
        const wifeSelector = document.getElementById('wife-for-child');
        if (!wifeSelector) {
            statusEl.innerHTML = `<div style="color: #ff6b6b;">Eş seçimi yapılamadı.</div>`;
            return;
        }
        wifeId = wifeSelector.value;
    }

    try {
        const response = await fetch(`${API_URL}/have-child`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ wifeId })
        });

        const data = await response.json();

        if (response.ok) {
            statusEl.innerHTML = `<div style="color: #51cf66; font-weight: bold;">${data.message}</div>`;
            await fetchCurrentUser(); // Update currentUser
            await loadMarriage(); // Reload the marriage section to show the new child
        } else {
            statusEl.innerHTML = `<div style="color: #ff6b6b;">${data.error}</div>`;
        }
    } catch (error) {
        statusEl.innerHTML = `<div style="color: #ff6b6b;">Bir hata oluştu.</div>`;
    }
}

async function loadProposals() {
    const content = document.getElementById('proposals-content');
    content.innerHTML = `<p style="color: #FFD700;">Yükleniyor...</p>`;

    try {
        const response = await fetch(`${API_URL}/proposals`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (!response.ok) throw new Error('Teklifler alınamadı.');
        const data = await response.json();

        let html = `<div style="background: rgba(139, 69, 19, 0.8); border: 3px solid #D4AF37; border-radius: 12px; padding: 25px;">`;

        // Gelen Teklifler
        html += `<h3 style="color: #FFD700;">Gelen Teklifler</h3>`;
        if (data.incoming && data.incoming.length > 0) {
            html += `<div style="display: grid; gap: 15px; margin-bottom: 30px;">`;
            data.incoming.forEach(p => {
                html += `
                    <div style="background: rgba(160, 82, 45, 0.5); border: 2px solid #D4AF37; padding: 15px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
                        <p style="color: #f4e4bc;">Teklif eden: <strong style="color: #4ecdc4;">${p.proposer_username}</strong></p>
                        <div>
                            <button onclick="acceptProposal(${p.id})" style="padding: 8px 12px; background-color: #51cf66; color: white; border: none; cursor: pointer; border-radius: 4px; margin-right: 10px;">Kabul Et</button>
                            <button onclick="declineProposal(${p.id})" style="padding: 8px 12px; background-color: #ff6b6b; color: white; border: none; cursor: pointer; border-radius: 4px;">Reddet</button>
                        </div>
                    </div>
                `;
            });
            html += `</div>`;
        } else {
            html += `<p style="color: #a0a0a0;">Gelen evlilik teklifi yok.</p>`;
        }

        // Giden Teklifler
        html += `<h3 style="color: #FFD700; margin-top: 30px;">Giden Teklifler</h3>`;
        if (data.outgoing && data.outgoing.length > 0) {
            html += `<div style="display: grid; gap: 15px;">`;
            data.outgoing.forEach(p => {
                html += `
                    <div style="background: rgba(160, 82, 45, 0.5); border: 2px solid #D4AF37; padding: 15px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
                        <p style="color: #f4e4bc;">Teklif edilen: <strong style="color: #4ecdc4;">${p.proposed_username}</strong></p>
                        <button onclick="cancelProposal(${p.id})" style="padding: 8px 12px; background-color: #777; color: white; border: none; cursor: pointer; border-radius: 4px;">İptal Et</button>
                    </div>
                `;
            });
            html += `</div>`;
        } else {
            html += `<p style="color: #a0a0a0;">Giden evlilik teklifi yok.</p>`;
        }

        html += `<div id="proposals-status" style="margin-top: 20px;"></div></div>`;
        content.innerHTML = html;

    } catch (error) {
        content.innerHTML = `<p style="color: #ff6b6b;">Hata: ${error.message}</p>`;
    }
}

async function proposeMarriage() {
    const usernameInput = document.getElementById('propose-username');
    const proposedUsername = usernameInput.value.trim();
    if (!proposedUsername) {
        alert('Lütfen bir kullanıcı adı girin.');
        return;
    }
    const statusEl = document.getElementById('marriage-status');
    statusEl.innerHTML = `<p style="color: #FFD700;">İşlem yapılıyor...</p>`;

    try {
        const response = await fetch(`${API_URL}/propose-marriage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
            body: JSON.stringify({ proposedUsername })
        });
        const data = await response.json();
        if (response.ok) {
            statusEl.innerHTML = `<p style="color: #51cf66;">✅ ${data.message}</p>`;
            usernameInput.value = '';
        } else {
            statusEl.innerHTML = `<p style="color: #ff6b6b;">❌ ${data.error}</p>`;
        }
    } catch(e) {
        statusEl.innerHTML = `<p style="color: #ff6b6b;">❌ Bağlantı hatası.</p>`;
    }
}

async function acceptProposal(proposalId) {
    const statusEl = document.getElementById('proposals-status');
    statusEl.innerHTML = `<p style="color: #FFD700;">İşlem yapılıyor...</p>`;
     try {
        const response = await fetch(`${API_URL}/accept-proposal`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
            body: JSON.stringify({ proposalId })
        });
        const data = await response.json();
        if (response.ok) {
            statusEl.innerHTML = `<p style="color: #51cf66;">✅ ${data.message}</p>`;
            await loadProposals();
        } else {
            statusEl.innerHTML = `<p style="color: #ff6b6b;">❌ ${data.error}</p>`;
        }
    } catch(e) {
        statusEl.innerHTML = `<p style="color: #ff6b6b;">❌ Bağlantı hatası.</p>`;
    }
}

async function declineProposal(proposalId) {
    const statusEl = document.getElementById('proposals-status');
    statusEl.innerHTML = `<p style="color: #FFD700;">İşlem yapılıyor...</p>`;
     try {
        const response = await fetch(`${API_URL}/decline-proposal`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
            body: JSON.stringify({ proposalId })
        });
        const data = await response.json();
        if (response.ok) {
            statusEl.innerHTML = `<p style="color: #51cf66;">✅ ${data.message}</p>`;
            await loadProposals();
        } else {
            statusEl.innerHTML = `<p style="color: #ff6b6b;">❌ ${data.error}</p>`;
        }
    } catch(e) {
        statusEl.innerHTML = `<p style="color: #ff6b6b;">❌ Bağlantı hatası.</p>`;
    }
}

async function cancelProposal(proposalId) {
    const statusEl = document.getElementById('proposals-status');
    statusEl.innerHTML = `<p style="color: #FFD700;">İşlem yapılıyor...</p>`;
     try {
        const response = await fetch(`${API_URL}/cancel-proposal`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
            body: JSON.stringify({ proposalId })
        });
        const data = await response.json();
        if (response.ok) {
            statusEl.innerHTML = `<p style="color: #51cf66;">✅ ${data.message}</p>`;
            await loadProposals();
        } else {
            statusEl.innerHTML = `<p style="color: #ff6b6b;">❌ ${data.error}</p>`;
        }
    } catch(e) {
        statusEl.innerHTML = `<p style="color: #ff6b6b;">❌ Bağlantı hatası.</p>`;
    }
}

async function divorce(wifeId = null) {
    if (!confirm('Boşanmak istediğinizden emin misiniz?')) return;

    const statusEl = document.getElementById('marriage-status');
    statusEl.innerHTML = `<p style="color: #FFD700;">İşlem yapılıyor...</p>`;

    try {
        const response = await fetch(`${API_URL}/divorce`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
            body: JSON.stringify({ wifeId })
        });
        const data = await response.json();
        if (response.ok) {
            statusEl.innerHTML = `<p style="color: #51cf66;">✅ ${data.message}</p>`;
            await fetchCurrentUser();
            await loadMarriage();
        } else {
            statusEl.innerHTML = `<p style="color: #ff6b6b;">❌ ${data.error}</p>`;
        }
    } catch(e) {
        statusEl.innerHTML = `<p style="color: #ff6b6b;">❌ Bağlantı hatası.</p>`;
    }
}

// Ayarlar sayfasını yükle
// Ayarlar sayfasını yükle
async function loadSettings() {
    const content = document.getElementById('settings-content');
    
    let html = `
        <div style="background: rgba(139, 69, 19, 0.8); border: 3px solid #D4AF37; border-radius: 12px; padding: 25px;">
            <h3 style="color: #FFD700; margin-bottom: 20px;">${t('Ayarlar')}</h3>
            
            <!-- Dil Ayarları -->
            <div style="background: rgba(160, 82, 45, 0.5); border: 2px solid #D4AF37; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
                <h4 style="color: #FFD700; margin-bottom: 15px;">🌐 ${t('Dil')}</h4>
                <div style="display: flex; gap: 15px; align-items: center;">
                    <label style="color: #f4e4bc; display: flex; align-items: center; gap: 8px; cursor: pointer;">
                        <input type="radio" name="language" value="tr" ${settings.language === 'tr' ? 'checked' : ''} 
                               onchange="changeLanguage('tr')" style="cursor: pointer;">
                        <span>🇹🇷 ${t('Türkçe')}</span>
                    </label>
                    <label style="color: #f4e4bc; display: flex; align-items: center; gap: 8px; cursor: pointer;">
                        <input type="radio" name="language" value="en" ${settings.language === 'en' ? 'checked' : ''} 
                               onchange="changeLanguage('en')" style="cursor: pointer;">
                        <span>🇬🇧 ${t('İngilizce')}</span>
                    </label>
                </div>
            </div>

            <!-- Tema Ayarları -->
            <div style="background: rgba(160, 82, 45, 0.5); border: 2px solid #D4AF37; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
                <h4 style="color: #FFD700; margin-bottom: 15px;">🎨 ${t('Tema')}</h4>
                <div style="display: flex; gap: 15px; align-items: center;">
                    <button onclick="changeTheme('light')" 
                            style="padding: 12px 24px; background: ${settings.theme === 'light' ? 'linear-gradient(135deg, #D4AF37 0%, #FFD700 100%)' : 'rgba(139, 69, 19, 0.8)'}; 
                                   border: 2px solid #D4AF37; border-radius: 8px; color: ${settings.theme === 'light' ? '#8B4513' : '#f4e4bc'}; 
                                   font-weight: bold; cursor: pointer; transition: all 0.3s;">
                        ☀️ ${t('Aydınlık')}
                    </button>
                    <button onclick="changeTheme('dark')" 
                            style="padding: 12px 24px; background: ${settings.theme === 'dark' ? 'linear-gradient(135deg, #D4AF37 0%, #FFD700 100%)' : 'rgba(139, 69, 19, 0.8)'}; 
                                   border: 2px solid #D4AF37; border-radius: 8px; color: ${settings.theme === 'dark' ? '#8B4513' : '#f4e4bc'}; 
                                   font-weight: bold; cursor: pointer; transition: all 0.3s;">
                        🌙 ${t('Karanlık')}
                    </button>
                </div>
            </div>

            <!-- Duvar Kağıdı Ayarları -->
            <div style="background: rgba(160, 82, 45, 0.5); border: 2px solid #D4AF37; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
                <h4 style="color: #FFD700; margin-bottom: 15px;">🖼️ ${t('Duvar Kağıdı')}</h4>
                
                <!-- Hazır Duvar Kağıtları -->
                <div style="margin-bottom: 20px;">
                    <p style="color: #f4e4bc; margin-bottom: 10px; font-weight: bold;">Hazır Duvar Kağıtları:</p>
                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 15px;">
    `;
    
    // 5 duvar kağıdı
    const wallpapers = [
        { id: 1, name: 'Duvar Kağıdı 1', path: 'wp/wp1.jpg' },
        { id: 2, name: 'Duvar Kağıdı 2', path: 'wp/wp2.jpg' },
        { id: 3, name: 'Duvar Kağıdı 3', path: 'wp/wp3.jpg' },
        { id: 4, name: 'Duvar Kağıdı 4', path: 'wp/wp4.jpg' },
        { id: 5, name: 'Duvar Kağıdı 5', path: 'wp/wp5.jpg' }
    ];
    
    wallpapers.forEach(wp => {
        const isSelected = settings.wallpaper === wp.path || settings.wallpaper === `/${wp.path}`;
        html += `
                        <div style="position: relative; cursor: pointer; border: ${isSelected ? '3px solid #FFD700' : '2px solid #D4AF37'}; 
                                    border-radius: 8px; overflow: hidden; transition: transform 0.2s;"
                             onclick="selectWallpaper('${wp.path}')"
                             onmouseover="this.style.transform='scale(1.05)'"
                             onmouseout="this.style.transform='scale(1)'">
                            <img src="${wp.path}" alt="${wp.name}" 
                                 style="width: 100%; height: 100px; object-fit: cover; display: block;">
                            <div style="position: absolute; bottom: 0; left: 0; right: 0; 
                                        background: rgba(0, 0, 0, 0.7); padding: 5px; text-align: center;">
                                <p style="color: #f4e4bc; font-size: 0.85em; margin: 0;">${wp.name}</p>
                            </div>
                            ${isSelected ? '<div style="position: absolute; top: 5px; right: 5px; background: #FFD700; border-radius: 50%; width: 25px; height: 25px; display: flex; align-items: center; justify-content: center;">✓</div>' : ''}
                        </div>
        `;
    });
    
    html += `
                    </div>
                </div>
                
                <!-- Özel URL -->
                <div style="border-top: 2px solid #D4AF37; padding-top: 15px; margin-top: 15px;">
                    <p style="color: #f4e4bc; margin-bottom: 10px; font-weight: bold;">Özel Duvar Kağıdı URL:</p>
                    <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                        <input type="text" id="wallpaper-url" placeholder="${t('Duvar kağıdı URL\'si girin')}" 
                               value="${settings.wallpaper && !settings.wallpaper.startsWith('wp/') ? settings.wallpaper : ''}"
                               style="flex: 1; min-width: 200px; padding: 10px; background: rgba(139, 69, 19, 0.8); 
                                      border: 2px solid #D4AF37; border-radius: 6px; color: #f4e4bc;">
                        <button onclick="saveWallpaper()" 
                                style="padding: 10px 20px; background: linear-gradient(135deg, #D4AF37 0%, #FFD700 100%); 
                                       border: none; border-radius: 6px; color: #8B4513; font-weight: bold; cursor: pointer;">
                            💾 ${t('Kaydet')}
                        </button>
                        <button onclick="removeWallpaper()" 
                                style="padding: 10px 20px; background: rgba(139, 0, 0, 0.8); 
                                       border: 2px solid #8B0000; border-radius: 6px; color: #ffcccc; font-weight: bold; cursor: pointer;">
                            🗑️ Kaldır
                        </button>
                    </div>
                </div>
            </div>

            <!-- Credits -->
            <div style="background: rgba(160, 82, 45, 0.5); border: 2px solid #D4AF37; border-radius: 8px; padding: 20px; margin-top: 20px;">
                <h4 style="color: #FFD700; margin-bottom: 15px;">🌟 Credits</h4>
                <div style="color: #f4e4bc; font-size: 0.9em; line-height: 1.6;">
                    <p style="margin-bottom: 10px;"><strong>Yapımcı:</strong> Kenan Yılmaz, Arda Saplıoğlu, Ömer Taha Dilek</p>
                    <p><strong>Teşekkürler:</strong> Haluk Kerem Tuncuk, Abdulkadir Küpelikılınç, Arif Yiğit, Eşrefcan Demiralay, Hasan, Kağan Yavuz, Muhammed Veli Ülker, Muharrem Çoban, Ramazan Çimen, Sarp Karaatlı</p>
                </div>
            </div>

            <div id="settings-status" style="margin-top: 20px;"></div>
        </div>
    `;

    content.innerHTML = html;
}

// Dil değiştir
function changeLanguage(lang) {
    settings.language = lang;
    localStorage.setItem('language', lang);
    document.getElementById('html-lang').setAttribute('lang', lang);
    
    // Menü metinlerini güncelle
    updateMenuTexts();
    
    // Kaynak görünümünü güncelle
    updateResourceDisplay();
    
    // Aktif sayfayı yeniden yükle
    const activePage = document.querySelector('.page.active');
    if (activePage) {
        const pageId = activePage.id.replace('page-', '');
        loadPage(pageId);
    }
    
    // Sayfayı yeniden yükle
    loadSettings();
}

// Tema değiştir
function changeTheme(theme) {
    settings.theme = theme;
    localStorage.setItem('theme', theme);
    
    // Ayarları uygula (duvar kağıdı dahil)
    applySettings();
    
    // Sayfayı yeniden yükle
    loadSettings();
}

// Duvar kağıdı seç
function selectWallpaper(path) {
    settings.wallpaper = path;
    localStorage.setItem('wallpaper', path);
    applySettings();
    
    const statusEl = document.getElementById('settings-status');
    statusEl.innerHTML = `
        <div style="background: rgba(0, 100, 0, 0.3); border: 2px solid #006400; padding: 15px; border-radius: 8px;">
            <p style="color: #51cf66; font-weight: bold;">✅ Duvar kağıdı seçildi!</p>
        </div>
    `;
    
    setTimeout(() => {
        loadSettings();
    }, 1000);
}

// Duvar kağıdı kaydet
function saveWallpaper() {
    const url = document.getElementById('wallpaper-url').value.trim();
    
    if (url) {
        settings.wallpaper = url;
        localStorage.setItem('wallpaper', url);
        applySettings();
        
        const statusEl = document.getElementById('settings-status');
        statusEl.innerHTML = `
            <div style="background: rgba(0, 100, 0, 0.3); border: 2px solid #006400; padding: 15px; border-radius: 8px;">
                <p style="color: #51cf66; font-weight: bold;">✅ Duvar kağıdı kaydedildi!</p>
            </div>
        `;
        
        setTimeout(() => {
            loadSettings();
        }, 1500);
    } else {
        alert('Lütfen geçerli bir URL girin!');
    }
}

// Duvar kağıdı kaldır
function removeWallpaper() {
    settings.wallpaper = '';
    localStorage.removeItem('wallpaper');
    applySettings();
    
    const statusEl = document.getElementById('settings-status');
    statusEl.innerHTML = `
        <div style="background: rgba(0, 100, 0, 0.3); border: 2px solid #006400; padding: 15px; border-radius: 8px;">
            <p style="color: #51cf66; font-weight: bold;">✅ Duvar kağıdı kaldırıldı!</p>
        </div>
    `;
    
    setTimeout(() => {
        loadSettings();
    }, 1500);
}

// Menü metinlerini güncelle
function updateMenuTexts() {
    const menuTranslations = {
        'overview': t('Genel Bakış'),
        'map': t('Harita'),
        'slaves': t('Köleler'),
        'masters': t('Hiyerarşi'),
        'referral': t('Davet'),
        'ranks': t('Rütbe Yönetimi'),
        'slave-market': t('Köle Pazarı'),
        'buy-freedom': t('Özgür Kal'),
        'investments': t('Yatırımlar'),
        'stats': t('İstatistikler'),
        'settings': t('Ayarlar')
    };

    document.querySelectorAll('.menu-item').forEach(item => {
        const page = item.getAttribute('data-page');
        const textSpan = item.querySelector('span:last-child');
        if (page && textSpan && menuTranslations[page]) {
            textSpan.textContent = menuTranslations[page];
        }
    });
}
