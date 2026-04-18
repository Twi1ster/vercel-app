const connectDB = require('./_db');
const { ElektronQaime, BankHesab } = require('./_models');

const ESAS_TEYINAT = 'Yayım haqqı yığımı';
const EDV_TEYINAT  = 'Digər daxilolmalar (ƏDV)';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'GET') return res.status(405).end();

  await connectDB();

  // Yalnız ödəniş tarixi boş olan EQ-lar
  const [eqData, bankData] = await Promise.all([
    ElektronQaime.find({
      $or: [{ odenisTarixi: '' }, { odenisTarixi: null }, { odenisTarixi: { $exists: false } }],
    }).lean(),
    BankHesab.find({}).lean(),
  ]);

  // Bank-ı icazeNo-ya görə qruplaşdır
  const bankByRef = {};
  bankData.forEach(b => {
    const ref = (b.muracietNomresiEqfNomresi || '').trim();
    if (!ref) return;
    if (!bankByRef[ref]) bankByRef[ref] = [];
    bankByRef[ref].push(b);
  });

  const result = eqData.map(eq => {
    const icaze = (eq.icazeNo || '').trim();
    const matched = bankByRef[icaze] || [];

    const esasRec = matched.filter(b => (b.hesabatUzreTeyinat || '').trim() === ESAS_TEYINAT);
    const edvRec  = matched.filter(b => (b.hesabatUzreTeyinat || '').trim() === EDV_TEYINAT);

    const paidEsas = esasRec.reduce((s, b) => s + (b.medaxil || 0), 0);
    const paidEdv  = edvRec.reduce((s,  b) => s + (b.medaxil || 0), 0);
    const esasTarix = esasRec.length ? esasRec[esasRec.length - 1].tarix : '';
    const edvTarix  = edvRec.length  ? edvRec[edvRec.length   - 1].tarix : '';
    const esasQeyd  = esasRec.map(b => b.qeyd).filter(Boolean).join(', ');
    const edvQeyd   = edvRec.map(b  => b.qeyd).filter(Boolean).join(', ');

    const eqEsas = eq.eqMeblegEsas || 0;
    const eqEdv  = eq.eqMeblegEdv  || 0;

    const artiqEsas = paidEsas > eqEsas + 0.01 ? paidEsas - eqEsas : 0;
    const artiqEdv  = paidEdv  > eqEdv  + 0.01 ? paidEdv  - eqEdv  : 0;

    return {
      reklamYayicisi: eq.reklamYayicisi || '',
      voen:           eq.voen || '',
      icazeNo:        icaze,
      eqTarixi:       eq.eqTarixi || '',
      eqNomresi:      eq.eqNomresi || '',
      eqEsas,
      eqEdv,
      paidEsas,    esasTarix, esasQeyd,
      paidEdv,     edvTarix,  edvQeyd,
      artiqEsas,   artiqEdv,
      hasMatch: matched.length > 0,
    };
  });

  res.json(result);
};
