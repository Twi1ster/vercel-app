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
  const invoiceAmount = eq => (eq.eqMeblegEsas || 0) + (eq.eqMeblegEdv || 0);

  // Qrup açarı: İCAZƏ №. EQ №-si ilə də axtarış üçün köməkçi xəritə qururuq.
  const groups = {};
  const eqNomresiToIcaze = new Map();
  eqData.forEach(eq => {
    const key = (eq.icazeNo || '').trim() || `__no_icaze__${eq._id}`;
    if (!groups[key]) groups[key] = { icazeNo: (eq.icazeNo || '').trim(), voen: eq.voen || '', reklamYayicisi: eq.reklamYayicisi || '', eqs: [], banks: [] };
    groups[key].eqs.push(eq);
    const eqNo = (eq.eqNomresi || '').trim();
    if (eqNo) eqNomresiToIcaze.set(eqNo, key);
  });
  // Bank → qrup: əvvəlcə icazə №-si, sonra EQ №-si kimi uyğunlaşdırılır
  bankData.forEach(b => {
    if (!(b.medaxil > 0)) return;
    const ref = (b.muracietNomresiEqfNomresi || '').trim();
    if (!ref) return;
    if (groups[ref]) { groups[ref].banks.push(b); return; }
    const viaEq = eqNomresiToIcaze.get(ref);
    if (viaEq && groups[viaEq]) groups[viaEq].banks.push(b);
  });

  const result = [];
  const summary = [];

  Object.values(groups).forEach(({ icazeNo, voen, reklamYayicisi, eqs, banks }) => {
    // 1. Yalnız ödəniş tarixi boş olan qaimələri götür
    // 2. Tarix üzrə yaşlıdan yeniyə sırala
    const unpaid = eqs
      .filter(eq => !hasDate(eq.odenisTarixi))
      .sort((a, b) => cmpDate(a.eqTarixi, b.eqTarixi))
      .map(eq => ({
        invoiceId: String(eq._id),
        icazeNo: (eq.icazeNo || '').trim(),
        eqNomresi: eq.eqNomresi || '',
        eqTarixi: eq.eqTarixi || '',
        voen: eq.voen || '',
        reklamYayicisi: eq.reklamYayicisi || '',
        originalAmount: invoiceAmount(eq),
        paidAmount: 0,
        remainingAmount: invoiceAmount(eq),
        status: 'UNPAID',
        paymentDate: '',
      }));

    if (unpaid.length === 0) return;

    // 3. Bank medaxilləri tarix üzrə sıralı
    const bankTxs = banks
      .slice()
      .sort((a, b) => cmpDate(a.tarix, b.tarix))
      .map(b => ({ tarix: b.tarix, remaining: b.medaxil || 0 }));

    // 4. FIFO allokasiya
    let invIdx = 0;
    for (const tx of bankTxs) {
      while (tx.remaining > 0.01 && invIdx < unpaid.length) {
        const inv = unpaid[invIdx];
        const take = Math.min(tx.remaining, inv.remaining);
        inv.paidAmount += take;
        inv.remainingAmount -= take;
        tx.remaining -= take;
        inv.paymentDate = tx.tarix;
        if (inv.remainingAmount < 0.01) {
          inv.remainingAmount = 0;
          inv.status = 'PAID';
          invIdx++;
        } else {
          inv.status = 'PARTIAL';
        }
      }
      if (invIdx >= unpaid.length) break;
    }

    // Heç ödənilməmiş qalanlar UNPAID olaraq qalır
    unpaid.forEach(inv => result.push(inv));

    // 5. Bank məbləğindən artıq qalanlar → OVERPAYMENT sətri
    const overpaymentTotal = bankTxs.reduce((s, tx) => s + Math.max(0, tx.remaining), 0);
    let overpaymentDate = '';
    if (overpaymentTotal > 0.01) {
      overpaymentDate = bankTxs.filter(tx => tx.remaining > 0.01).map(tx => tx.tarix).sort((a, b) => cmpDate(b, a))[0] || '';
      result.push({
        invoiceId: '',
        icazeNo,
        eqNomresi: '',
        eqTarixi: '',
        voen,
        reklamYayicisi,
        originalAmount: 0,
        paidAmount: 0,
        remainingAmount: overpaymentTotal,
        status: 'OVERPAYMENT',
        paymentDate: overpaymentDate,
      });
    }

    // Summary per İCAZƏ
    const totalInvoice = unpaid.reduce((s, i) => s + i.originalAmount, 0);
    const totalPaid = unpaid.reduce((s, i) => s + i.paidAmount, 0);
    const totalRemaining = unpaid.reduce((s, i) => s + i.remainingAmount, 0);
    summary.push({
      icazeNo,
      voen,
      reklamYayicisi,
      totalInvoiceAmount: totalInvoice,
      totalPaid,
      remainingBalance: totalRemaining,
      overpayment: overpaymentTotal > 0.01 ? overpaymentTotal : 0,
    });
  });

  res.json({ rows: result, summary });
};
