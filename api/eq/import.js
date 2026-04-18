const connectDB = require('../_db');
const { ElektronQaime } = require('../_models');
const XLSX = require('xlsx');

export const config = { api: { bodyParser: false } };

async function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      const body = Buffer.concat(chunks);
      const boundary = req.headers['content-type'].split('boundary=')[1];
      const parts = body.toString('binary').split('--' + boundary);
      for (const part of parts) {
        if (part.includes('filename=')) {
          const dataStart = part.indexOf('\r\n\r\n') + 4;
          const dataEnd = part.lastIndexOf('\r\n');
          const fileData = part.slice(dataStart, dataEnd);
          resolve(Buffer.from(fileData, 'binary'));
          return;
        }
      }
      reject(new Error('No file found'));
    });
    req.on('error', reject);
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  await connectDB();

  try {
    const buffer = await parseMultipart(req);
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    const docs = rows.map(row => ({
      voen: String(row['VOEN'] || row['voen'] || ''),
      icazeNo: String(row['İcazə №'] || row['Icaze'] || row['icazeNo'] || ''),
      eqTarixi: String(row['EQ tarixi'] || row['Elektron qaimenin tarixi'] || ''),
      eqMeblegEsas: parseFloat(row['EQ məbləği (əsas)'] || row['EQ meblegi(esas)'] || 0) || 0,
      eqMeblegEdv: parseFloat(row['EQ məbləği (ƏDV)'] || row['EQ meblegi(EDV)'] || 0) || 0,
      odenisTarixi: String(row['Ödəniş tarixi'] || row['Odenish tarixi'] || ''),
      odenisTarixiEsas: String(row['Ödəniş tarixi (əsas)'] || row['odenish tarixi(esas)'] || ''),
      odenisTarixiEdv: String(row['Ödəniş tarixi (ƏDV)'] || row['odenish tarixi(EDV)'] || ''),
      odenisMeblegEdv: parseFloat(row['Ödəniş məbləği (ƏDV)'] || row['Odenish meblegi(EDV)'] || 0) || 0,
      qeyd: String(row['Qeyd'] || row['qeyd'] || ''),
    }));

    await ElektronQaime.insertMany(docs);
    return res.json({ imported: docs.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
