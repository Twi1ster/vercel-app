const connectDB = require('./_db');
const { ElektronQaime, BankHesab } = require('./_models');

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

  // EQ-ları VÖEN-ə görə qruplaşdır (bir adamın bir neçə qaiməsi ola bilər)
  const eqByVoen = {};
  eqData.forEach(eq => {
    const key = (eq.voen || '').trim() || (eq.reklamYayicisi || '').trim() || '__no_voen__';
    if (!eqByVoen[key]) eqByVoen[key] = [];
    eqByVoen[key].push(eq);
  });

  const isEsas = t => (t || '').trim().toLowerCase().includes('yayım');
  const isEdv  = t => {
    const s = (t || '').trim().toLowerCase();
    return s.includes('ədv') || s.includes('edv');
  };

  const result = [];

  Object.values(eqByVoen).forEach(eqs => {
    // Bu adamın bütün bank ödənişlərini topla (icazeNo-ya görə)
    const personRefs = new Set(eqs.map(e => (e.icazeNo || '').trim()).filter(Boolean));
    const personBank = bankData.filter(b => personRefs.has((b.muracietNomresiEqfNomresi || '').trim()));

    let personEqTotal = 0;
    let personPaidTotal = 0;

    const rows = eqs.map(eq => {
      const icaze = (eq.icazeNo || '').trim();
      const matched = bankByRef[icaze] || [];

      const esasRec = matched.filter(b => isEsas(b.hesabatUzreTeyinat));
      const edvRec  = matched.filter(b => isEdv(b.hesabatUzreTeyinat));

      const paidEsas = esasRec.reduce((s, b) => s + (b.medaxil || 0), 0);
      const paidEdv  = edvRec.reduce((s, b) => s + (b.medaxil || 0), 0);
      const esasTarix = esasRec.length ? esasRec[esasRec.length - 1].tarix : '';
      const edvTarix  = edvRec.length  ? edvRec[edvRec.length   - 1].tarix : '';
      const esasQeyd  = esasRec.map(b => b.qeyd).filter(Boolean).join(', ');
      const edvQeyd   = edvRec.map(b => b.qeyd).filter(Boolean).join(', ');

      const eqEsas = eq.eqMeblegEsas || 0;
      const eqEdv  = eq.eqMeblegEdv  || 0;

      personEqTotal   += eqEsas + eqEdv;
      personPaidTotal += paidEsas + paidEdv;

      return {
        reklamYayicisi: eq.reklamYayicisi || '',
        voen:           eq.voen || '',
        icazeNo:        icaze,
        eqTarixi:       eq.eqTarixi || '',
        eqNomresi:      eq.eqNomresi || '',
        eqEsas, eqEdv,
        paidEsas, esasTarix, esasQeyd,
        paidEdv,  edvTarix,  edvQeyd,
        hasMatch: matched.length > 0,
      };
    });

    // Şəxs üzrə artıq ödəniş — son sətirə əlavə olunacaq
    const personArtiq = personPaidTotal > personEqTotal + 0.01
      ? personPaidTotal - personEqTotal
      : 0;
    const lastBank = personBank
      .slice()
      .sort((a, b) => String(b.tarix || '').localeCompare(String(a.tarix || '')))[0];
    const artiqTarix = personArtiq > 0 && lastBank ? lastBank.tarix : '';

    rows.forEach((r, idx) => {
      const isLast = idx === rows.length - 1;
      result.push({
        ...r,
        artiq:      isLast ? personArtiq : 0,
        artiqTarix: isLast ? artiqTarix : '',
      });
    });
  });

  res.json(result);
};
