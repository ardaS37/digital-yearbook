function compareTurkishText(a, b) {
  return String(a || '').localeCompare(String(b || ''), 'tr', {
    sensitivity: 'base',
    numeric: true
  });
}

function compareUsersTurkish(a, b) {
  const roleCompare = compareTurkishText(a.role, b.role);
  if (roleCompare !== 0) {
    return roleCompare;
  }
  const classCompare = compareTurkishText(a.class_branch || a.archived_class_branch, b.class_branch || b.archived_class_branch);
  if (classCompare !== 0) {
    return classCompare;
  }
  return compareTurkishText(a.name, b.name);
}

module.exports = {
  compareTurkishText,
  compareUsersTurkish
};
