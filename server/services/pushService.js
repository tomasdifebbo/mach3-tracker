const webpush = require('web-push');
const pool = require('../db/pool');
const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_EMAIL } = require('../config/constants');

let pushConfigured = false;
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    pushConfigured = true;
} else {
    console.warn('[PUSH] Chaves VAPID ausentes no ambiente (.env). Notificações Web Push desativadas.');
}

async function sendPushToUser(userId, payload) {
    if (!pushConfigured) return;
    try {
        const subs = (await pool.query('SELECT * FROM push_subscriptions WHERE "userId" = $1', [userId])).rows;
        if (!subs || subs.length === 0) {
            console.log(`[PUSH] Nenhum dispositivo cadastrado para o usuário #${userId}`);
            return;
        }

        const stringPayload = typeof payload === 'string' ? payload : JSON.stringify(payload);
        const pushOptions = {
            TTL: 86400, // 24 horas de validade no gateway FCM/APNs
            urgency: 'high', // CRÍTICO: Acorda o celular mesmo com a tela desligada (Android Doze Mode)
            topic: 'mach3_job_done'
        };

        for (const sub of subs) {
            const pushConfig = {
                endpoint: sub.endpoint,
                keys: {
                    p256dh: sub.p256dh,
                    auth: sub.auth
                }
            };
            try {
                await webpush.sendNotification(pushConfig, stringPayload, pushOptions);
                console.log(`[PUSH OK] Enviado com sucesso para dispositivo #${sub.id} (${(sub.user_agent || 'App').substring(0, 40)}...)`);
            } catch (err) {
                if (err.statusCode === 410 || err.statusCode === 404) {
                    console.log(`[PUSH] Subscrição inativa/expirada removida (${sub.id}): ${err.statusCode}`);
                    await pool.query('DELETE FROM push_subscriptions WHERE id = $1', [sub.id]);
                } else {
                    console.error(`[PUSH SEND ERROR #${sub.id}]:`, err.statusCode || '', err.message);
                }
            }
        }
    } catch (e) {
        console.error('[PUSH DISPATCH ERROR]:', e.message);
    }
}


module.exports = { webpush, sendPushToUser };
