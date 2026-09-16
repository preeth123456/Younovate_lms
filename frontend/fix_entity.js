const fs = require('fs');
const content = fs.readFileSync('src/pages/trainer/WorkshopCertificates.jsx', 'utf8');
const fixed = content.replace('Attendance < 60%', 'Attendance < 60%');
fs.writeFileSync('src/pages/trainer/WorkshopCertificates.jsx', fixed);
console.log('Done');