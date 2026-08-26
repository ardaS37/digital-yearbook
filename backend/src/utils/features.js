const CORE_FEATURE_DEFINITIONS = [
  { key: 'announcements', label: 'Duyurular', description: 'Ana sayfa ve duyuru yayınlama akışları' },
  { key: 'gallery', label: 'Galeri', description: 'Galeri görüntüleme, yükleme ve albüm akışları' },
  { key: 'class_pages', label: 'Sınıf Kapakları', description: 'Sınıf kapak sayfası ve düzenleme akışları' },
  { key: 'class_timeline', label: 'Sınıf Zaman Çizelgesi', description: 'Zaman çizelgesi oluşturma ve görüntüleme' },
  { key: 'class_memories', label: 'Sınıf Anıları', description: 'Sınıf anıları paylaşma ve görüntüleme' },
  { key: 'class_polls', label: 'Sınıf Anketleri', description: 'Sınıf içi anket oluşturma ve oy verme' },
  { key: 'class_president_announcements', label: 'Başkan Duyuruları', description: 'Sınıf başkanı duyuruları' },
  { key: 'class_achievements', label: 'Başarı Panosu', description: 'Sınıf başarı kayıtları' },
  { key: 'class_featured_gallery', label: 'Sınıf Galeri Öne Çıkanları', description: 'Sınıf galeriden öne çıkanlar' },
  { key: 'profile_guestbook', label: 'Profil Ziyaretçi Defteri', description: 'Profil notları ve silme akışı' },
  { key: 'profile_featured_message', label: 'Öne Çıkan Mesaj', description: 'Profilde mesaj sabitleme' },
  { key: 'profile_inbox', label: 'Gelen Kutusu', description: 'Profil gelen kutusu ve bildirim listesi' },
  { key: 'self_account_delete', label: 'Kullanıcı Hesap Silme', description: 'Kullanıcıların kendi hesabını silme alanı' },
  { key: 'receiver_message_delete', label: 'Gelen Mesajı Silme', description: 'Öğrencilerin kendi profillerine gelen yıllık mesajları silebilmesi' },
  { key: 'user_reports', label: 'Kullanıcı Bildirimi', description: 'Profilde kullanıcı bildirimi gönderme' },
  { key: 'view_counts', label: 'Görüntülenme Sayıları', description: 'Profil ve galeri görüntülenme sayılarını gösterme' },
  { key: 'teacher_yearbook_messages', label: 'Öğretmene Yıllık Yazısı', description: 'Öğretmen profillerine yıllık mesaj yazma' },
  { key: 'teacher_three_words', label: 'Öğretmene 3 Kelime', description: 'Öğretmen profillerine 3 kelime yazma' },
  { key: 'photo_reactions', label: 'Foto Emoji Tepkileri', description: 'Fotoğraflara emoji tepkisi' },
  { key: 'birthdays', label: 'Doğum Günleri', description: 'Doğum günü alanı ve ana sayfa kartı' },
  { key: 'closing_page', label: 'Kapanış Sayfası', description: 'Kapanış sayfası ve mezuniyet sayacı' },
  { key: 'top_visited_profiles', label: 'En Çok Ziyaret Edilen Profiller', description: 'Ana sayfadaki özgün ziyaretçi sıralaması' },
  { key: 'teacher_farewells', label: 'Öğretmen Veda Köşesi', description: 'Öğretmenler için veda mesajları' },
  { key: 'anonymous_board', label: 'Mantar Pano', description: 'Anonim not panosu ve yayın akışları' }
];

const GAME_MENU_DEFINITIONS = [
  { key: 'game_koi_koi', label: 'Koi Koi', description: '2 kişilik kart oyunu kartı' },
  { key: 'game_wiibatak', label: 'Wiibatak', description: 'Oyunlar listesindeki Wiibatak dış bağlantı kartı' },
  { key: 'game_nane_okey_pc', label: 'Nane Okey PC', description: 'Oyunlar listesindeki masaüstü Nane Okey kartı' },
  { key: 'game_kenan', label: 'Kenan', description: 'Sunucu oyunu Kenan kartı' },
  { key: 'game_reversi', label: 'Reversi', description: 'Reversi kartı' },
  { key: 'game_lingo', label: 'Lingo', description: '4, 5, 6 ve 7 harf seçenekli Lingo kartı' },
  { key: 'game_xox', label: 'XOX', description: 'XOX kartı' },
  { key: 'game_sos', label: 'SOS', description: 'SOS kartı' },
  { key: 'game_kutu_doldurmaca', label: 'Kutu Doldurmaca', description: 'Kutu Doldurmaca kartı' },
  { key: 'game_yilanlar_ve_merdivenler', label: 'Yılanlar ve Merdivenler', description: 'Yılanlar ve Merdivenler kartı' },
  { key: 'game_9_tas', label: '9 Taş', description: '9 Taş kartı' },
  { key: 'game_3_tas', label: '3 Taş', description: '3 Taş kartı' },
  { key: 'game_dama', label: 'Dama', description: 'Dama kartı' },
  { key: 'game_capraz_dama', label: 'Çapraz Dama', description: 'Çapraz Dama kartı' },
  { key: 'game_mangala', label: 'Mangala', description: 'Mangala kartı' },
  { key: 'game_kuyulamac', label: 'Kuyulamaç', description: 'Kuyulamaç kartı' },
  { key: 'game_alti', label: 'Altı', description: 'Altı kartı' },
  { key: 'game_nane_okey', label: 'Nane Okey', description: 'Nane Okey kartı' },
  { key: 'game_okey', label: 'Okey', description: 'Okey kartı' },
  { key: 'game_101_okey', label: '101 Okey', description: '101 Okey kartı' },
  { key: 'game_uno', label: 'UNO', description: 'UNO kartı' },
  { key: 'game_batak', label: 'Batak', description: 'İhaleli Batak kartı' },
  { key: 'game_scrabble', label: 'Scrabble', description: 'Scrabble kartı' },
  { key: 'game_sudoku', label: 'Sudoku', description: 'Sudoku kartı' },
  { key: 'game_kakuro', label: 'Kakuro', description: 'Kakuro kartı' },
  { key: 'game_kare_karala', label: 'Kare Karala', description: 'Kare Karala kartı' },
  { key: 'game_abalone', label: 'Abalone', description: 'Abalone kartı' },
  { key: 'game_tavla', label: 'Tavla', description: 'Tavla kartı' },
  { key: 'game_koridor', label: 'Koridor', description: 'Koridor kartı' },
  { key: 'game_satranc', label: 'Satranç', description: 'Satranç kartı' },
  { key: 'game_dortlu_birlestir', label: '4lü Birleştir', description: '4lü Birleştir kartı' },
  { key: 'game_mastermind', label: 'Mastermind', description: 'Mastermind kartı' },
  { key: 'game_domino', label: 'Domino', description: 'Domino kartı' },
  { key: 'game_go', label: 'Go', description: 'Go kartı' },
  { key: 'game_siseler', label: 'Şişeler', description: 'Eski Otopark kartı' },
  { key: 'game_otopark', label: 'Otopark', description: 'Unblock Red Wood kartı' },
  { key: 'game_kizma_birader', label: 'Kızma Birader', description: 'Kızma Birader kartı' }
];

const FEATURE_DEFINITIONS = [...CORE_FEATURE_DEFINITIONS, ...GAME_MENU_DEFINITIONS];

const PROFILE_PHOTO_EDIT_MODES = [
  { key: 'self', label: 'Herkes Kendi Fotoğrafını Düzenleyebilir' },
  { key: 'admin_only', label: 'Sadece Yönetici Düzenler' }
];

function featureSettingKey(key) {
  return `feature_${key}`;
}

function buildFeatureFlags(db) {
  const rows = db
    .prepare("SELECT setting_key, setting_value FROM app_settings WHERE setting_key LIKE 'feature_%'")
    .all();
  const raw = Object.fromEntries(rows.map((row) => [row.setting_key, row.setting_value]));
  const flags = {};

  FEATURE_DEFINITIONS.forEach((feature) => {
    const value = raw[featureSettingKey(feature.key)];
    flags[feature.key] = value == null ? true : value === '1';
  });

  return flags;
}

function isFeatureEnabled(flags, key) {
  return flags[key] !== false;
}

module.exports = {
  FEATURE_DEFINITIONS,
  CORE_FEATURE_DEFINITIONS,
  GAME_MENU_DEFINITIONS,
  PROFILE_PHOTO_EDIT_MODES,
  featureSettingKey,
  buildFeatureFlags,
  isFeatureEnabled
};
