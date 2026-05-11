// controllers/earlyAccessController.js
const supabase = require('../config/db');

// POST /api/early-access
const submitEarlyAccess = async (req, res, next) => {
  try {
    const { role, full_name, company_name, work_email, mobile, city, industry_sector, queries } = req.body;

    if (!role || !full_name || !company_name || !work_email || !mobile) {
      return res.status(400).json({
        success: false,
        message: 'Role, full name, company name, work email, and mobile are required.',
      });
    }

    if (!['buyer', 'manufacturer'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Role must be buyer or manufacturer.' });
    }

    const { data, error } = await supabase
      .from('early_access_registrations')
      .insert({
        role,
        full_name:       full_name.trim(),
        company_name:    company_name.trim(),
        work_email:      work_email.trim().toLowerCase(),
        mobile:          mobile.trim(),
        city:            city?.trim() || null,
        industry_sector: industry_sector?.trim() || null,
        queries:         queries?.trim() || null,
      })
      .select('id')
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      message: 'You\'re on the list! We\'ll reach out soon.',
      id: data.id,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { submitEarlyAccess };
