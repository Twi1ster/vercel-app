const connectDB = require('../_db');
const { BankHesab } = require('../_models');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  await connectDB();
  const { id } = req.query;

  if (req.method === 'PUT') {
    const doc = await BankHesab.findByIdAndUpdate(id, req.body, { new: true });
    return res.json(doc);
  }
  if (req.method === 'DELETE') {
    await BankHesab.findByIdAndDelete(id);
    return res.json({ success: true });
  }
  res.status(405).end();
};
