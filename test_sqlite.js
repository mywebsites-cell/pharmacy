const { transactionsDB } = require('./apps/desktop/dist-electron/sqlite-db.js');

try {
  console.log('Testing getHistoryStats...');
  const stats = transactionsDB.getHistoryStats();
  console.log('Stats:', stats);
  
  console.log('Testing getHistory...');
  const history = transactionsDB.getHistory(200, 0, '', 'all', '', '', 'desc');
  console.log('History length:', history.length);
  if (history.length > 0) {
    console.log('First item:', history[0]);
  }
} catch (e) {
  console.error('ERROR OCCURRED:', e);
}
