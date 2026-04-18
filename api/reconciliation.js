const connectDB = require('./_db');
const { ElektronQaime, BankHesab } = require('./_models');

const ESAS_TEYINAT = 'Yayım haqqı yığımı';
const EDV_TEYINAT  = 'Digər daxilolmalar (ƏDV)';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'GET') return res.status(405).end();

  await connectDB();
  const { search = '', page = 1, limit = 100 } = req.query;

  const eqFilter = {};
  if (search) {
    eqFilter.$or = [
      { voen:           { $regex: search, $options: 'i' } },
      { icazeNo:        { $regex: search, $options: 'i' } },
      { reklamYayicisi: { $regex: search, $options: 'i' } },
    ];
  }

  const skip = (Number(page) - 1) * Number(limit);
  const [eqData, total, bankData] = await Promise.all([
    ElektronQaime.find(eqFilter).sort({ eqTarixi: -1 }).skip(skip).limit(Number(limit)).lean(),
    ElektronQaime.countDocuments(eqFilter),
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

    const esasPayments = matched.filter(b =>
      (b.hesabatUzreTeyinat || '').trim() === ESAS_TEYINAT
    );
    const edvPayments = matched.filter(b =>
      (b.hesabatUzreTeyinat || '').trim() === EDV_TEYINAT
    );

    const paidEsas = esasPayments.reduce((s, b) => s + (b.medaxil || 0), 0);
    const paidEdv  = edvPayments.reduce((s,  b) => s + (b.medaxil || 0), 0);

    const esasTarix = esasPayments.length ? esasPayments[esasPayments.length - 1].tarix : '';
    const edvTarix  = edvPayments.length  ? edvPayments[edvPayments.length   - 1].tarix : '';
    const esasQeyd  = esasPayments.map(b => b.qeyd).filter(Boolean).join(', ');
    const edvQeyd   = edvPayments.map(b  => b.qeyd).filter(Boolean).join(', ');

    const eqEsas = eq.eqMeblegEsas || 0;
    const eqEdv  = eq.eqMeblegEdv  || 0;

    const qaliqEsas = eqEsas - paidEsas;
    const qaliqEdv  = eqEdv  - paidEdv;
    const artiqEsas = qaliqEsas < -0.01 ? Math.abs(qaliqEsas) : 0;
    const artiqEdv  = qaliqEdv  < -0.01 ? Math.abs(qaliqEdv)  : 0;

    const paidTotal  = paidEsas + paidEdv;
    const eqTotal    = eqEsas + eqEdv;
    const qaliq      = eqTotal - paidTotal;
    const artiqOdenis = artiqEsas + artiqEdv;

    let status = 'Ödənilməyib';
    if (matched.length > 0) {
      if (Math.abs(qaliq) < 0.01)  status = 'Tam Ödənilmiş';
      else if (artiqOdenis > 0.01) status = 'Artıq Ödəniş';
      else                         status = 'Qismən Ödənilmiş';
    }

    return {
      _id: eq._id,
      voen: eq.voen || '',
      reklamYayicisi: eq.reklamYayicisi || '',
      icazeNo: icaze,
      eqNomresi: eq.eqNomresi || '',
      eqTarixi: eq.eqTarixi || '',
      eqEsas, eqEdv, eqTotal,
      paidEsas, esasTarix,
      paidEdv,  edvTarix,
      paidTotal,
      qaliqEsas, qaliqEdv, qaliq,
      artiqEsas, artiqEdv, artiqOdenis,
      esasQeyd, edvQeyd,
      status,
      bankCount: matched.length,
    };
  });

  res.json({ data: result, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
};
