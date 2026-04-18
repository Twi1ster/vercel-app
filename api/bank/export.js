const connectDB = require('../_db');
const { BankHesab } = require('../_models');
const XLSX = require('xlsx');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'GET') return res.status(405).end();

  await connectDB();
  const data = await BankHesab.find({}).lean();
  const rows = data.map(d => ({
    'Bank/Hesab': d.bankHesab,
    'Tarix': d.tarix,
    'Ödəyici/Vasitə': d.odeyiciVesait,
    'MəDaxil': d.medaxil,
    'Məxaric': d.mexaric,
    'Qeyd': d.qeyd,
    'Müraciət №/EQF №': d.muracietNomresiEqfNomresi,
    'Hesabat üzrə Təyinat': d.hesabatUzreTeyinat,
    'VOEN': d.voen,
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Bank');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', 'attachment; filename=bank_hesab.xlsx');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  return res.send(buf);
};
