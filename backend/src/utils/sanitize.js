function stripHtml(input) {
  return String(input || '')
    .replace(/<[^>]*>/g, '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim();
}

function normalizeName(input) {
  return stripHtml(input).replace(/\s+/g, ' ');
}

function normalizeTurkishSearchText(input) {
  return stripHtml(input)
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('tr');
}

module.exports = {
  stripHtml,
  normalizeName,
  normalizeTurkishSearchText
};
