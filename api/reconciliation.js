const connectDB = require('./_db');
const { ElektronQaime, BankHesab } = require('./_models');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'GET') return res.status(405).end();

  await connectDB();
  const { voen = '' } = req.query;

  let eqFilter = {}, bankFilter = {};
  if (voen) {
    eqFilter.voen = { $regex: voen, $options: 'i' };
    bankFilter.voen = { $regex: voen, $options: 'i' };
  }

  const [eqData, bankData] = await Promise.all([
    ElektronQaime.find(eqFilter).lean(),
    BankHesab.find(bankFilter).lean(),
  ]);

  const voenMap = {};
  eqData.forEach(eq => {
    const v = eq.voen || 'Naməlum';
    if (!voenMap[v]) voenMap[v] = { voen: v, eq: [], bank: [] };
    voenMap[v].eq.push(eq);
  });
  bankData.forEach(b => {
    const v = b.voen || 'Naməlum';
    if (!voenMap[v]) voenMap[v] = { voen: v, eq: [], bank: [] };
    voenMap[v].bank.push(b);
  });

  const result = Object.values(voenMap).map(item => {
    const totalEqEsas = item.eq.reduce((s, e) => s + (e.eqMeblegEsas || 0), 0);
    const totalEqEdv = item.eq.reduce((s, e) => s + (e.eqMeblegEdv || 0), 0);
    const totalEq = totalEqEsas + totalEqEdv;
    const totalMedaxil = item.bank.reduce((s, b) => s + (b.medaxil || 0), 0);
    const totalMexaric = item.bank.reduce((s, b) => s + (b.mexaric || 0), 0);
    const ferq = totalEq - totalMedaxil;
    return {
      voen: item.voen,
      eqCount: item.eq.length,
      bankCount: item.bank.length,
      totalEqEsas, totalEqEdv, totalEq,
      totalMedaxil, totalMexaric, ferq,
      status: Math.abs(ferq) < 0.01 ? 'Balansda' : ferq > 0 ? 'EQ Artıq' : 'Bank Artıq',
    };
  });

  res.json(result.sort((a, b) => Math.abs(b.ferq) - Math.abs(a.ferq)));
};
