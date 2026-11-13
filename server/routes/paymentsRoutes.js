const express = require('express');
const pool = require('../db/pool');
const { PORT, mpClient, MP_ACCESS_TOKEN, MP_WEBHOOK_SECRET, Preference, Payment, PLANS } = require('../config/constants');
const { authenticateToken } = require('../middleware/auth');
const { verifyMercadoPagoSignature } = require('../middleware/security');

const port = PORT;
const router = express.Router();

// POST /api/payments/create-preference
// Creates a Mercado Pago checkout preference and returns the init_point URL
router.post('/api/payments/create-preference', authenticateToken, async (req, res) => {
    try {
        if (!MP_ACCESS_TOKEN) {
            return res.status(503).json({ error: 'Gateway de pagamento não configurado no servidor.' });
        }
        const { planType } = req.body;
        const plan = PLANS[planType];
        if (!plan) return res.status(400).json({ error: 'Plano inválido. Use: starter, pro ou business' });

        const preference = new Preference(mpClient);
        const backUrl = process.env.RENDER_EXTERNAL_URL || `http://localhost:${port}`;

        const result = await preference.create({
            body: {
                items: [{
                    title: plan.name,
                    unit_price: plan.price,
                    quantity: 1,
                    currency_id: 'BRL'
                }],
                back_urls: {
                    success: `${backUrl}/payment/success`,
                    failure: `${backUrl}/payment/failure`,
                    pending: `${backUrl}/payment/pending`
                },
                auto_return: 'approved',
                notification_url: `${backUrl}/api/payments/webhook`,
                metadata: {
                    userId: req.user.id,
                    planType
                },
                statement_descriptor: 'MACH3 TRACKER'
            }
        });

        // Save pending payment record
        await pool.query(
            'INSERT INTO payments ("userId", mp_preference_id, plan, status, amount) VALUES ($1, $2, $3, $4, $5)',
            [req.user.id, result.id, planType, 'pending', plan.price]
        );

        res.json({ 
            init_point: result.init_point,
            preference_id: result.id
        });
    } catch (err) {
        console.error('[PAYMENT] create-preference error:', err);
        res.status(500).json({ error: 'Erro ao criar preferência de pagamento: ' + err.message });
    }
});

// POST /api/payments/webhook
// Receives Mercado Pago IPN notifications and updates plan on approval
router.post('/api/payments/webhook', async (req, res) => {
    try {
        const body = req.body || {};
        const { type, data } = body;
        if (type !== 'payment') return res.sendStatus(200);

        const paymentId = data?.id ? String(data.id).trim() : '';
        if (!paymentId) return res.sendStatus(200);
        if (!/^\d{1,30}$/.test(paymentId)) {
            return res.status(400).json({ error: 'ID de pagamento inválido' });
        }

        if (MP_WEBHOOK_SECRET) {
            const okSig = verifyMercadoPagoSignature({
                xSignature: req.headers['x-signature'],
                xRequestId: req.headers['x-request-id'],
                dataId: paymentId,
                secret: MP_WEBHOOK_SECRET
            });
            if (!okSig) {
                console.warn('[WEBHOOK] Assinatura HMAC inválida rejeitada');
                return res.status(401).json({ error: 'Assinatura de webhook inválida' });
            }
        }

        if (!MP_ACCESS_TOKEN) {
            return res.status(503).json({ error: 'MP_ACCESS_TOKEN não configurado' });
        }

        const mpPayment = new Payment(mpClient);
        const paymentData = await mpPayment.get({ id: paymentId });

        const status = paymentData.status;
        const metadata = paymentData.metadata || {};
        const userId = metadata.user_id || metadata.userId;
        const planType = metadata.plan_type || metadata.planType;

        if (!userId || !planType) {
            console.warn('[WEBHOOK] Missing metadata: userId or planType', metadata);
            return res.sendStatus(200);
        }

        console.log(`[WEBHOOK] Payment ${paymentId} status=${status} userId=${userId} plan=${planType}`);

        // Update payment record
        await pool.query(
            'UPDATE payments SET mp_payment_id=$1, status=$2, updated_at=NOW() WHERE mp_preference_id IS NOT NULL AND "userId"=$3 AND plan=$4 AND status=\'pending\'',
            [String(paymentId), status, userId, planType]
        );

        if (status === 'approved') {
            // Calculate trial_expiry: 30 days from now
            const expiry = new Date();
            expiry.setDate(expiry.getDate() + 30);

            await pool.query(
                'UPDATE users SET plan=$1, payment_status=$2, trial_expiry=$3 WHERE id=$4',
                [planType, 'active', expiry.toISOString(), userId]
            );

            console.log(`[WEBHOOK] ✅ User ${userId} upgraded to ${planType} plan!`);
        }

        res.sendStatus(200);
    } catch (err) {
        console.error('[WEBHOOK] Error processing payment:', err);
        res.sendStatus(500);
    }
});

// GET /api/payments/status
// Returns the current plan and last payment info for the authenticated user
router.get('/api/payments/status', authenticateToken, async (req, res) => {
    try {
        const user = (await pool.query(
            'SELECT id, email, plan, payment_status, trial_expiry FROM users WHERE id=$1',
            [req.user.id]
        )).rows[0];

        const lastPayment = (await pool.query(
            'SELECT * FROM payments WHERE "userId"=$1 ORDER BY created_at DESC LIMIT 1',
            [req.user.id]
        )).rows[0];

        res.json({ 
            plan: user.plan || 'starter', 
            payment_status: user.payment_status || 'none',
            trial_expiry: user.trial_expiry,
            last_payment: lastPayment || null
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/payments/history
router.get('/api/payments/history', authenticateToken, async (req, res) => {
    try {
        const rows = (await pool.query(
            'SELECT * FROM payments WHERE "userId" = $1 ORDER BY created_at DESC LIMIT 20',
            [req.user.id]
        )).rows;
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/payments/billing-info
router.post('/api/payments/billing-info', authenticateToken, async (req, res) => {
    try {
        const { company_legal_name, cnpj_cpf, billing_email } = req.body;
        await pool.query(
            'UPDATE users SET company_legal_name = $1, cnpj_cpf = $2, billing_email = $3 WHERE id = $4',
            [company_legal_name || null, cnpj_cpf || null, billing_email || null, req.user.id]
        );
        res.json({ success: true, message: "Dados de faturamento salvos com sucesso!" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/payments/cancel-auto-renew
router.post('/api/payments/cancel-auto-renew', authenticateToken, async (req, res) => {
    try {
        await pool.query(
            'UPDATE users SET payment_status = \'canceled_at_period_end\' WHERE id = $1',
            [req.user.id]
        );
        res.json({ success: true, message: "Renovação automática cancelada. Seu plano continuará ativo até o término do ciclo atual." });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
