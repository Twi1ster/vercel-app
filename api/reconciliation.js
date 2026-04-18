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

  // "dd.mm.yyyy" tarix string-i müqayisə üçün yyyy-mm-dd-ə çevir
  const sortKey = s => {
    const m = String(s || '').match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (!m) return '';
    return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  };
  const cmpDate = (a, b) => sortKey(a).localeCompare(sortKey(b));

  // EQ-ları VÖEN-ə görə qruplaşdır
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
    // EQ-ları köhnə tarixdən yeni tarixə sırala
    const sorted = eqs.slice().sort((a, b) => cmpDate(a.eqTarixi, b.eqTarixi));

    // Bu adamın bank ödənişlərini topla (icazeNo eşləşməsinə görə)
    const personRefs = new Set(sorted.map(e => (e.icazeNo || '').trim()).filter(Boolean));
    const personBank = bankData.filter(b => personRefs.has((b.muracietNomresiEqfNomresi || '').trim()));

    const esasBank = personBank.filter(b => isEsas(b.hesabatUzreTeyinat)).sort((a, b) => cmpDate(a.tarix, b.tarix));
    const edvBank  = personBank.filter(b => isEdv(b.hesabatUzreTeyinat)).sort((a, b) => cmpDate(a.tarix, b.tarix));

    let esasAvail = esasBank.reduce((s, b) => s + (b.medaxil || 0), 0);
    let edvAvail  = edvBank.reduce((s, b)  => s + (b.medaxil || 0), 0);

    const lastEsasTarix = esasBank.length ? esasBank[esasBank.length - 1].tarix : '';
    const lastEdvTarix  = edvBank.length  ? edvBank[edvBank.length   - 1].tarix : '';
    const esasQeydAll   = esasBank.map(b => b.qeyd).filter(Boolean).join(', ');
    const edvQeydAll    = edvBank.map(b => b.qeyd).filter(Boolean).join(', ');

    // FIFO: köhnə EQ-dən başlayıb ödəyirik
    const rows = sorted.map(eq => {
      const eqEsas = eq.eqMeblegEsas || 0;
      const eqEdv  = eq.eqMeblegEdv  || 0;

      const paidEsas = Math.min(esasAvail, eqEsas);
      esasAvail -= paidEsas;
      const paidEdv  = Math.min(edvAvail, eqEdv);
      edvAvail -= paidEdv;

      return {
        reklamYayicisi: eq.reklamYayicisi || '',
        voen:           eq.voen || '',
        icazeNo:        (eq.icazeNo || '').trim(),
        eqTarixi:       eq.eqTarixi || '',
        eqNomresi:      eq.eqNomresi || '',
        eqEsas, eqEdv,
        paidEsas,
        esasTarix: paidEsas > 0 ? lastEsasTarix : '',
        esasQeyd:  paidEsas > 0 ? esasQeydAll : '',
        paidEdv,
        edvTarix:  paidEdv > 0 ? lastEdvTarix : '',
        edvQeyd:   paidEdv > 0 ? edvQeydAll : '',
        hasMatch: personBank.length > 0,
      };
    });

    // Bütün EQ-lar ödəndikdən sonra qalan = artıq ödəniş
    const leftover = esasAvail + edvAvail;
    const artiq = leftover > 0.01 ? leftover : 0;
    const lastBank = personBank.slice().sort((a, b) => cmpDate(b.tarix, a.tarix))[0];
    const artiqTarix = artiq > 0 && lastBank ? lastBank.tarix : '';

    rows.forEach((r, idx) => {
      const isLast = idx === rows.length - 1;
      result.push({
        ...r,
        artiq:      isLast ? artiq : 0,
        artiqTarix: isLast ? artiqTarix : '',
      });
    });
  });

  res.json(result);
};
