const connectDB = require('./_db');
const { ElektronQaime, BankHesab } = require('./_models');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'GET') return res.status(405).end();

  await connectDB();

  // Bütün EQ və Bank qeydləri
  const [eqData, bankData] = await Promise.all([
    ElektronQaime.find({}).lean(),
    BankHesab.find({}).lean(),
  ]);

  // "dd.mm.yyyy" -> "yyyy-mm-dd" sıralama açarı
  const sortKey = s => {
    const m = String(s || '').match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (!m) return '';
    return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  };
  const cmpDate = (a, b) => sortKey(a).localeCompare(sortKey(b));

  const isPaid = eq => !!String(eq.odenisTarixi || '').trim();
  const isEsas = t => (t || '').trim().toLowerCase().includes('yayım');
  const isEdv  = t => {
    const s = (t || '').trim().toLowerCase();
    return s.includes('ədv') || s.includes('edv');
  };

  // EQ-ları VÖEN üzrə qruplaşdır
  const eqByVoen = {};
  eqData.forEach(eq => {
    const key = (eq.voen || '').trim() || (eq.reklamYayicisi || '').trim() || '__no_voen__';
    if (!eqByVoen[key]) eqByVoen[key] = [];
    eqByVoen[key].push(eq);
  });

  const result = [];

  Object.values(eqByVoen).forEach(eqs => {
    // Yalnız ödəniş tarixi boş olanlara FIFO tətbiq edirik
    const unpaidSorted = eqs.filter(e => !isPaid(e)).sort((a, b) => cmpDate(a.eqTarixi, b.eqTarixi));
    const unpaidRefs = new Set(unpaidSorted.map(e => (e.icazeNo || '').trim()).filter(Boolean));

    // Bank hovuzu: yalnız boş EQ-lərin icazəNo-suna uyğun ödənişlər
    const personBank = bankData.filter(b => unpaidRefs.has((b.muracietNomresiEqfNomresi || '').trim()));
    const esasBank = personBank.filter(b => isEsas(b.hesabatUzreTeyinat)).sort((a, b) => cmpDate(a.tarix, b.tarix));
    const edvBank  = personBank.filter(b => isEdv(b.hesabatUzreTeyinat)).sort((a, b) => cmpDate(a.tarix, b.tarix));

    let esasAvail = esasBank.reduce((s, b) => s + (b.medaxil || 0), 0);
    let edvAvail  = edvBank.reduce((s, b)  => s + (b.medaxil || 0), 0);

    const lastEsasTarix = esasBank.length ? esasBank[esasBank.length - 1].tarix : '';
    const lastEdvTarix  = edvBank.length  ? edvBank[edvBank.length   - 1].tarix : '';
    const esasQeydAll   = esasBank.map(b => b.qeyd).filter(Boolean).join(', ');
    const edvQeydAll    = edvBank.map(b => b.qeyd).filter(Boolean).join(', ');

    // FIFO bölgü — nəticələri icazeNo-ya görə saxlayırıq
    const allocByIcaze = {};
    unpaidSorted.forEach(eq => {
      const icaze = (eq.icazeNo || '').trim();
      const eqEsas = eq.eqMeblegEsas || 0;
      const eqEdv  = eq.eqMeblegEdv  || 0;

      const paidEsas = Math.min(esasAvail, eqEsas);
      esasAvail -= paidEsas;
      const paidEdv = Math.min(edvAvail, eqEdv);
      edvAvail -= paidEdv;

      allocByIcaze[icaze] = { paidEsas, paidEdv };
    });

    const leftover = esasAvail + edvAvail;
    const artiq = leftover > 0.01 ? leftover : 0;
    const lastBank = personBank.slice().sort((a, b) => cmpDate(b.tarix, a.tarix))[0];
    const artiqTarix = artiq > 0 && lastBank ? lastBank.tarix : '';

    // EQ-ları orijinal ardıcıllıqla yaz
    const rows = eqs.map(eq => {
      const icaze = (eq.icazeNo || '').trim();

      if (isPaid(eq)) {
        // Ödəniş tarixi olanlara toxunma — olduğu kimi yaz
        return {
          reklamYayicisi: eq.reklamYayicisi || '',
          voen:           eq.voen || '',
          icazeNo:        icaze,
          eqTarixi:       eq.eqTarixi || '',
          eqNomresi:      eq.eqNomresi || '',
          eqEsas:         eq.eqMeblegEsas || 0,
          eqEdv:          eq.eqMeblegEdv  || 0,
          paidEsas:       eq.odenisMeblegEsas || 0,
          esasTarix:      eq.odenisTarixi || '',
          esasQeyd:       eq.qeyd || '',
          paidEdv:        eq.odenisMeblegEdv || 0,
          edvTarix:       eq.odenisTarixiEdv || '',
          edvQeyd:        '',
          hasMatch:       false,
          alreadyPaid:    true,
        };
      }

      const alloc = allocByIcaze[icaze] || { paidEsas: 0, paidEdv: 0 };
      return {
        reklamYayicisi: eq.reklamYayicisi || '',
        voen:           eq.voen || '',
        icazeNo:        icaze,
        eqTarixi:       eq.eqTarixi || '',
        eqNomresi:      eq.eqNomresi || '',
        eqEsas:         eq.eqMeblegEsas || 0,
        eqEdv:          eq.eqMeblegEdv  || 0,
        paidEsas:       alloc.paidEsas,
        esasTarix:      alloc.paidEsas > 0 ? lastEsasTarix : '',
        esasQeyd:       alloc.paidEsas > 0 ? esasQeydAll : '',
        paidEdv:        alloc.paidEdv,
        edvTarix:       alloc.paidEdv > 0 ? lastEdvTarix : '',
        edvQeyd:        alloc.paidEdv > 0 ? edvQeydAll : '',
        hasMatch:       alloc.paidEsas > 0 || alloc.paidEdv > 0,
        alreadyPaid:    false,
      };
    });

    // Artıq ödəniş sətri adamın sonuncu EQ-sindən sonra bir dəfə
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
