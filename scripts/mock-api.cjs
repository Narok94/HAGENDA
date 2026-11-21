// Version-aware API fixtures for layout-only browser checks. No real backend runs.
module.exports = function mockApi(request, settings = {}) {
  const path = new URL(request.url()).pathname;
  const body = request.method() === 'POST' ? request.postDataJSON() : {};
  if (path === '/api/tasks') return request.method() === 'GET' ? [] : { success: true, task: { ...body, version: 'mock-saved' } };
  const documents = {
    '/api/marketing': { posts: [], brands: ['Passione', 'Narok Store'] },
    '/api/settings': { version: null, userName: 'Henrique', highContrast: false, reminderMinutes: 15, completedStudyDates: [], ...settings },
    '/api/workout-state': { version: null, activeGroupId: 'A', workoutDate: '', completedExercises: {}, weights: {} },
    '/api/diet-state': { version: null, dietDate: '', completedMeals: {}, waterMl: 0 }
  };
  if (documents[path]) {
    if (request.method() === 'GET') return documents[path];
    const key = path.endsWith('settings') ? 'settings' : path.endsWith('workout-state') ? 'workoutState' : 'dietState';
    return { success: true, [key]: { ...documents[path], ...body, version: 'mock-saved' } };
  }
  if (path === '/api/db-status') return { connected: true, mode: 'neon' };
  if (path === '/api/reminders') return { configs: {}, scheduler: {} };
  if (path === '/api/generate-inspiration') return { text: 'Teste local' };
  return { success: true };
};
