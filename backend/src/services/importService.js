const XLSX = require('xlsx');
const { isValidClassBranch } = require('../db');
const { normalizeName, stripHtml } = require('../utils/sanitize');

function parseRowsFromExcel(fileBuffer) {
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('Excel dosyasında sayfa bulunamadı.');
  }

  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName], {
    header: 1,
    blankrows: false,
    defval: ''
  });

  return rows
    .map((row) => row.map((cell) => stripHtml(String(cell))))
    .filter((row) => row.some((cell) => cell.length > 0));
}

function normalizeStudentRows(rows) {
  const normalizedRows = [...rows];
  if (normalizedRows.length) {
    const first = normalizedRows[0].map((c) => c.toLowerCase());
    const isHeaderRow =
      (first[0].includes('name') || first[0].includes('ad')) &&
      (first[1].includes('student') || first[1].includes('öğrenci')) &&
      (first[2].includes('class') || first[2].includes('sınıf'));
    if (isHeaderRow) {
      normalizedRows.shift();
    }
  }
  if (!normalizedRows.length) {
    throw new Error('Excel dosyasında içe aktarılacak öğrenci satırı yok.');
  }

  return normalizedRows.map((row, index) => {
    const name = normalizeName(row[0]);
    const studentNumber = stripHtml(row[1]);
    const classBranch = stripHtml(row[2]).toUpperCase();

    if (!name || !studentNumber || !classBranch) {
      throw new Error(`Satır ${index + 1}: ad soyad, öğrenci numarası ve sınıf şubesi zorunludur.`);
    }

    if (!isValidClassBranch(classBranch)) {
      throw new Error(`Satır ${index + 1}: geçersiz sınıf şubesi (${classBranch}).`);
    }

    return {
      name,
      student_number: studentNumber,
      class_branch: classBranch,
      role: 'student'
    };
  });
}

function normalizeTeacherRows(rows) {
  const normalizedRows = [...rows];
  if (normalizedRows.length) {
    const first = normalizedRows[0].map((c) => c.toLowerCase());
    if (first[0].includes('name') || first[0].includes('ad')) {
      normalizedRows.shift();
    }
  }
  if (!normalizedRows.length) {
    throw new Error('Excel dosyasında içe aktarılacak öğretmen satırı yok.');
  }

  return normalizedRows.map((row, index) => {
    const name = normalizeName(row[0]);
    if (!name) {
      throw new Error(`Satır ${index + 1}: ad soyad zorunludur.`);
    }

    return {
      name,
      student_number: null,
      class_branch: null,
      role: 'teacher'
    };
  });
}

module.exports = {
  parseRowsFromExcel,
  normalizeStudentRows,
  normalizeTeacherRows
};
