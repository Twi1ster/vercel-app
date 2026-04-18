const connectDB = require('../_db');
const { BankHesab } = require('../_models');
const XLSX = require('xlsx');


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
          resolve(Buffer.from(part.slice(dataStart, dataEnd), 'binary'));
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
      bankHesab: String(row['Bank/Hesab'] || row['bankHesab'] || ''),
      tarix: String(row['Tarix'] || row['tarix'] || ''),
      odeyiciVesait: String(row['Ödəyici/Vasitə'] || row['Odeyici/Vesaiti alan'] || ''),
      medaxil: parseFloat(row['MəDaxil'] || row['Medaxil'] || 0) || 0,
      mexaric: parseFloat(row['Məxaric'] || row['Mexaric'] || 0) || 0,
      qeyd: String(row['Qeyd'] || row['qeyd'] || ''),
      muracietNomresiEqfNomresi: String(row['Müraciət №'] || row['muraciet nomresi(medaxil) / EQF nomresi (mexaric)'] || ''),
      hesabatUzreTeyinat: String(row['Hesabat üzrə Təyinat'] || row['hesabat uzre teyinat'] || ''),
      voen: String(row['VOEN'] || row['voen'] || ''),
    }));

    await BankHesab.insertMany(docs);
    return res.json({ imported: docs.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
