function isSchoolManager(user) {
  return Boolean(
    user &&
      (user.role === 'admin' ||
        (user.role === 'teacher' && ['principal', 'vice_principal', 'head_vice_principal'].includes(user.teacher_category || '')))
  );
}

function getUserSchoolScope(user) {
  if (!user) {
    return { canManage: false, allSchools: false, schoolId: 0 };
  }
  if (user.role === 'admin') {
    return { canManage: true, allSchools: true, schoolId: 0 };
  }
  if (isSchoolManager(user) && user.school_id) {
    return { canManage: true, allSchools: false, schoolId: Number(user.school_id) };
  }
  return { canManage: false, allSchools: false, schoolId: Number(user.school_id || 0) };
}

function canAccessSchool(user, schoolId) {
  const scope = getUserSchoolScope(user);
  if (scope.allSchools) return true;
  return scope.canManage && Number(scope.schoolId) === Number(schoolId);
}

function appendSchoolScope(where, params, user, column = 'school_id') {
  const scope = getUserSchoolScope(user);
  if (scope.allSchools) return;
  if (scope.schoolId) {
    where.push(`${column} = ?`);
    params.push(scope.schoolId);
  } else {
    where.push('1 = 0');
  }
}

module.exports = {
  appendSchoolScope,
  canAccessSchool,
  getUserSchoolScope,
  isSchoolManager
};
