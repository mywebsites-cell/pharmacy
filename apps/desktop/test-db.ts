import { dbQuery, transactionsDB } from './electron/sqlite-db';

try {
  console.log('Testing getHistoryStats...');
  const stats = transactionsDB.getHistoryStats();
  console.log('Stats:', stats);
  
  console.log('Testing getHistory...');
  const history = transactionsDB.getHistory(1, 200);
  console.log('History length:', history.length);
  if (history.length > 0) {
    console.log('First item:', history[0]);
  }
} catch (e) {
  console.error('Error:', e);
}
