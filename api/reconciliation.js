const connectDB = require('./_db');
const { ElektronQaime, BankHesab } = require('./_models');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'GET') return res.status(405).end();

  await connectDB();

  const [eqData, bankData] = await Promise.all([
    ElektronQaime.find({}).lean(),
    BankHesab.find({}).lean(),
  ]);

  const sortKey = s => {
    const m = String(s || '').match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (!m) return '';
    return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  };
  const cmpDate = (a, b) => sortKey(a).localeCompare(sortKey(b));
  const hasDate = s => !!String(s || '').trim();
  const isEsas = t => (t || '').trim().toLowerCase().includes('yayım');
  const isEdv  = t => {
    const s = (t || '').trim().toLowerCase();
    return s.includes('ədv') || s.includes('edv');
  };

  // İcazə nömrəsi üzrə qrup: hər icazənin EQ-ləri və bank medaxilləri birlikdə
  const groups = {};
  const eqNomresiToIcaze = new Map();
  eqData.forEach(eq => {
    const key = (eq.icazeNo || '').trim() || `__no_icaze__${eq._id}`;
    if (!groups[key]) groups[key] = { eqs: [], banks: [] };
    groups[key].eqs.push(eq);
    const eqNo = (eq.eqNomresi || '').trim();
    if (eqNo) eqNomresiToIcaze.set(eqNo, key);
  });
  // Bank qeydləri Müraciət № / EQF № üzrə uyğunlaşdırılır:
  // əvvəlcə icazə №-si kimi, sonra EQ №-si kimi axtarırıq
  bankData.forEach(b => {
    const ref = (b.muracietNomresiEqfNomresi || '').trim();
    if (!ref) return;
    if (groups[ref]) { groups[ref].banks.push(b); return; }
    const viaEq = eqNomresiToIcaze.get(ref);
    if (viaEq && groups[viaEq]) groups[viaEq].banks.push(b);
  });

  // Bir növbədən (FIFO) müəyyən məbləği çıxar; istifadə olunan son bankın tarix və qeydini qaytar
  const consume = (queue, amount) => {
    let need = amount;
    let paid = 0;
    let date = '';
    let qeyd = '';
    while (need > 0.01 && queue.length > 0) {
      const head = queue[0];
      if (head.remaining <= 0.01) { queue.shift(); continue; }
      const take = Math.min(head.remaining, need);
      head.remaining -= take;
      need -= take;
      paid += take;
      date = head.tarix;
      if (head.qeyd) qeyd = qeyd ? `${qeyd}, ${head.qeyd}` : head.qeyd;
      if (head.remaining < 0.01) queue.shift();
    }
    return { paid, date, qeyd };
  };

  const result = [];

  Object.values(groups).forEach(({ eqs, banks }) => {
    // Bank hovuzları — tarix üzrə sıralı növbə
    const esasQueue = banks
      .filter(b => isEsas(b.hesabatUzreTeyinat))
      .sort((a, b) => cmpDate(a.tarix, b.tarix))
      .map(b => ({ tarix: b.tarix, qeyd: b.qeyd || '', remaining: b.medaxil || 0 }));
    const edvQueue = banks
      .filter(b => isEdv(b.hesabatUzreTeyinat))
      .sort((a, b) => cmpDate(a.tarix, b.tarix))
      .map(b => ({ tarix: b.tarix, qeyd: b.qeyd || '', remaining: b.medaxil || 0 }));

    // Artıq ödənilmiş EQ hissələrini hovuzdan çıxar ki, ikiqat sayılmasın
    eqs.forEach(eq => {
      if (hasDate(eq.odenisTarixi))    consume(esasQueue, eq.odenisMeblegEsas || 0);
      if (hasDate(eq.odenisTarixiEdv)) consume(edvQueue,  eq.odenisMeblegEdv  || 0);
    });

    // Qalan hissələri EQ tarixinə görə FIFO qaydada bank medaxili ilə ödə
    const allocs = new Map();
    const sortedForAlloc = eqs.slice().sort((a, b) => cmpDate(a.eqTarixi, b.eqTarixi));
    sortedForAlloc.forEach(eq => {
      const esasAlloc = !hasDate(eq.odenisTarixi)
        ? consume(esasQueue, eq.eqMeblegEsas || 0)
        : { paid: 0, date: '', qeyd: '' };
      const edvAlloc = !hasDate(eq.odenisTarixiEdv)
        ? consume(edvQueue, eq.eqMeblegEdv || 0)
        : { paid: 0, date: '', qeyd: '' };
      allocs.set(String(eq._id), { esasAlloc, edvAlloc });
    });

    // Qalan bank məbləği — artıq ödəniş
    const leftoverEsas = esasQueue.reduce((s, b) => s + b.remaining, 0);
    const leftoverEdv  = edvQueue.reduce((s, b) => s + b.remaining, 0);
    const artiq = leftoverEsas + leftoverEdv;
    const artiqTarix = artiq > 0.01
      ? banks.map(b => b.tarix).sort((a, b) => cmpDate(b, a))[0] || ''
      : '';

    // Sətirləri orijinal ardıcıllıqla qur
    const rows = eqs.map(eq => {
      const { esasAlloc = { paid: 0, date: '', qeyd: '' }, edvAlloc = { paid: 0, date: '', qeyd: '' } }
        = allocs.get(String(eq._id)) || {};
      const paidEsasAlready = hasDate(eq.odenisTarixi);
      const paidEdvAlready  = hasDate(eq.odenisTarixiEdv);

      return {
        reklamYayicisi: eq.reklamYayicisi || '',
        voen:           eq.voen || '',
        icazeNo:        (eq.icazeNo || '').trim(),
        eqTarixi:       eq.eqTarixi || '',
        eqNomresi:      eq.eqNomresi || '',
        eqEsas:         eq.eqMeblegEsas || 0,
        eqEdv:          eq.eqMeblegEdv  || 0,
        paidEsas:       paidEsasAlready ? (eq.odenisMeblegEsas || 0) : esasAlloc.paid,
        esasTarix:      paidEsasAlready ? (eq.odenisTarixi || '')    : esasAlloc.date,
        esasQeyd:       paidEsasAlready ? (eq.qeyd || '')            : esasAlloc.qeyd,
        paidEdv:        paidEdvAlready  ? (eq.odenisMeblegEdv || 0)  : edvAlloc.paid,
        edvTarix:       paidEdvAlready  ? (eq.odenisTarixiEdv || '') : edvAlloc.date,
        edvQeyd:        paidEdvAlready  ? ''                         : edvAlloc.qeyd,
        hasMatch:       (!paidEsasAlready && esasAlloc.paid > 0) || (!paidEdvAlready && edvAlloc.paid > 0),
        alreadyPaid:    paidEsasAlready && paidEdvAlready,
      };
    });

    rows.forEach((r, idx) => {
      const isLast = idx === rows.length - 1;
      result.push({
        ...r,
        artiq:      isLast && artiq > 0.01 ? artiq : 0,
        artiqTarix: isLast && artiq > 0.01 ? artiqTarix : '',
      });
    });
  });

  res.json(result);
};
