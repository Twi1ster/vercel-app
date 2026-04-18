const connectDB = require('../_db');
const { ElektronQaime } = require('../_models');
const XLSX = require('xlsx');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'GET') return res.status(405).end();

  await connectDB();
  const data = await ElektronQaime.find({}).lean();
  const rows = data.map(d => ({
    'VOEN': d.voen,
    'İcazə №': d.icazeNo,
    'EQ Tarixi': d.eqTarixi,
    'EQ Məbləği (Əsas)': d.eqMeblegEsas,
    'EQ Məbləği (ƏDV)': d.eqMeblegEdv,
    'Ödəniş Tarixi': d.odenisTarixi,
    'Ödəniş Tarixi (Əsas)': d.odenisTarixiEsas,
    'Ödəniş Tarixi (ƏDV)': d.odenisTarixiEdv,
    'Ödəniş Məbləği (ƏDV)': d.odenisMeblegEdv,
    'Qeyd': d.qeyd,
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'EQ');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', 'attachment; filename=elektron_qaime.xlsx');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  return res.send(buf);
};
