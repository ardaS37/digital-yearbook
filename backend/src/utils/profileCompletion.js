function hasContact(user) {
  return Boolean(
    user.contact_phone ||
      user.contact_email ||
      user.contact_instagram ||
      user.contact_x ||
      user.contact_facebook ||
      user.contact_linkedin ||
      user.contact_nsocial ||
      (user.custom_contacts_json && user.custom_contacts_json !== '[]')
  );
}

function calculateProfileCompletion(user) {
  const checks = [
    { key: 'photo', label: 'Fotoğraf', done: Boolean(user.photo_path) },
    { key: 'slogan', label: 'Slogan', done: Boolean(String(user.slogan || '').trim()) },
    { key: 'bio', label: 'Biyografi', done: Boolean(String(user.bio || '').trim()) },
    { key: 'free_text', label: 'Serbest yazı', done: Boolean(String(user.free_text || '').trim()) },
    { key: 'contact', label: 'İletişim', done: hasContact(user) },
    { key: 'memory', label: 'Anı', done: Boolean(String(user.favorite_memory || '').trim()) },
    { key: 'quote', label: 'Alıntı', done: Boolean(String(user.favorite_quote || '').trim()) }
  ];
  const done = checks.filter((item) => item.done).length;
  return {
    percent: Math.round((done / checks.length) * 100),
    done,
    total: checks.length,
    missing: checks.filter((item) => !item.done).map((item) => item.label)
  };
}

module.exports = {
  calculateProfileCompletion
};
