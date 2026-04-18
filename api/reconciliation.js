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

  // Debug: ilk 5 bank refini və ilk 5 EQ icazeNo-nu logla
  const bankRefs = Object.keys(bankByRef).slice(0, 5);
  const eqIcazes = eqData.slice(0, 5).map(e => e.icazeNo);
  const teyinatlar = [...new Set(bankData.map(b => b.hesabatUzreTeyinat).filter(Boolean))];
  console.log('BANK REFS:', bankRefs);
  console.log('EQ ICAZES:', eqIcazes);
  console.log('TEYINATLAR:', teyinatlar);

  const result = eqData.map(eq => {
    const icaze = (eq.icazeNo || '').trim();
    const matched = bankByRef[icaze] || [];

    const esasRec = matched.filter(b => (b.hesabatUzreTeyinat || '').trim().toLowerCase().includes('yayım'));
    const edvRec  = matched.filter(b => (b.hesabatUzreTeyinat || '').trim().toLowerCase().includes('ədv') || (b.hesabatUzreTeyinat || '').trim().toLowerCase().includes('edv'));

    const paidEsas = esasRec.reduce((s, b) => s + (b.medaxil || 0), 0);
    const paidEdv  = edvRec.reduce((s,  b) => s + (b.medaxil || 0), 0);
    const esasTarix = esasRec.length ? esasRec[esasRec.length - 1].tarix : '';
    const edvTarix  = edvRec.length  ? edvRec[edvRec.length   - 1].tarix : '';
    const esasQeyd  = esasRec.map(b => b.qeyd).filter(Boolean).join(', ');
    const edvQeyd   = edvRec.map(b  => b.qeyd).filter(Boolean).join(', ');

    const eqEsas = eq.eqMeblegEsas || 0;
    const eqEdv  = eq.eqMeblegEdv  || 0;

    const eqTotal   = eqEsas + eqEdv;
    const paidTotal = paidEsas + paidEdv;
    const artiq     = paidTotal > eqTotal + 0.01 ? paidTotal - eqTotal : 0;
    const artiqTarix = artiq > 0
      ? (edvTarix || esasTarix)
      : '';

    return {
      reklamYayicisi: eq.reklamYayicisi || '',
      voen:           eq.voen || '',
      icazeNo:        icaze,
      eqTarixi:       eq.eqTarixi || '',
      eqNomresi:      eq.eqNomresi || '',
      eqEsas, eqEdv,
      paidEsas, esasTarix, esasQeyd,
      paidEdv,  edvTarix,  edvQeyd,
      artiq, artiqTarix,
      hasMatch: matched.length > 0,
    };
  });

  res.json(result);
};
