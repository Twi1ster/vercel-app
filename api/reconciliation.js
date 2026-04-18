const connectDB = require('./_db');
const { ElektronQaime } = require('./_models');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'GET') return res.status(405).end();

  await connectDB();
  const { voen = '', search = '' } = req.query;

  const filter = {};
  if (voen) filter.voen = { $regex: voen, $options: 'i' };
  if (search) {
    filter.$or = [
      { voen: { $regex: search, $options: 'i' } },
      { icazeNo: { $regex: search, $options: 'i' } },
      { reklamYayicisi: { $regex: search, $options: 'i' } },
    ];
  }

  const eqData = await ElektronQaime.find(filter).sort({ eqTarixi: -1 }).lean();

  const result = eqData.map(eq => {
    const eqTotal = (eq.eqMeblegEsas || 0) + (eq.eqMeblegEdv || 0);
    const paidEsas = eq.odenisMeblegEsas || 0;
    const paidEdv = eq.odenisMeblegEdv || 0;
    const paidTotal = paidEsas + paidEdv;
    const qaliq = eqTotal - paidTotal;
    const artiqOdenis = qaliq < -0.01 ? Math.abs(qaliq) : 0;

    let status = 'Ödənilməyib';
    if (Math.abs(qaliq) < 0.01) status = 'Tam Ödənilmiş';
    else if (artiqOdenis > 0) status = 'Artıq Ödəniş';
    else if (paidTotal > 0) status = 'Qismən Ödənilmiş';

    return {
      _id: eq._id,
      voen: eq.voen || '',
      reklamYayicisi: eq.reklamYayicisi || '',
      icazeNo: eq.icazeNo || '',
      eqNomresi: eq.eqNomresi || '',
      eqTarixi: eq.eqTarixi || '',
      eqMeblegEsas: eq.eqMeblegEsas || 0,
      eqMeblegEdv: eq.eqMeblegEdv || 0,
      eqTotal,
      paidEsas,
      paidEdv,
      paidTotal,
      qaliq,
      artiqOdenis,
      artiqOdenisTarixi: artiqOdenis > 0 ? (eq.odenisTarixiEdv || eq.odenisTarixi || '') : '',
      status,
    };
  });

  res.json(result);
};
