const connectDB = require('./_db');
const { ElektronQaime, BankHesab } = require('./_models');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'GET') return res.status(405).end();

  await connectDB();

  const [eqCount, bankCount, eqAgg, bankAgg] = await Promise.all([
    ElektronQaime.countDocuments(),
    BankHesab.countDocuments(),
    ElektronQaime.aggregate([{ $group: { _id: null, totalEsas: { $sum: '$eqMeblegEsas' }, totalEdv: { $sum: '$eqMeblegEdv' } } }]),
    BankHesab.aggregate([{ $group: { _id: null, totalMedaxil: { $sum: '$medaxil' }, totalMexaric: { $sum: '$mexaric' } } }]),
  ]);

  res.json({
    eqCount,
    bankCount,
    eqTotalEsas: eqAgg[0]?.totalEsas || 0,
    eqTotalEdv: eqAgg[0]?.totalEdv || 0,
    bankTotalMedaxil: bankAgg[0]?.totalMedaxil || 0,
    bankTotalMexaric: bankAgg[0]?.totalMexaric || 0,
  });
};
