// Serviço de Notificações Push Web/PWA para o Mach3 Tracker

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export const pushService = {
  isSupported() {
    return (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window
    );
  },

  async registerServiceWorker() {
    if (!this.isSupported()) return null;
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      await navigator.serviceWorker.ready;
      return reg;
    } catch (err) {
      console.error('[SW Register Error]', err);
      return null;
    }
  },

  async getSubscriptionState() {
    if (!this.isSupported()) {
      return {
        supported: false,
        permission: 'unsupported',
        subscribed: false
      };
    }

    const permission = Notification.permission;
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) {
        return { supported: true, permission, subscribed: false };
      }
      const sub = await reg.pushManager.getSubscription();
      return {
        supported: true,
        permission,
        subscribed: !!sub
      };
    } catch (e) {
      return { supported: true, permission, subscribed: false };
    }
  },

  async subscribe(token) {
    if (!this.isSupported()) {
      throw new Error('Seu navegador ou celular não suporta notificações push.');
    }

    // 1. Solicitar permissão ao usuário
    const permResult = await Notification.requestPermission();
    if (permResult !== 'granted') {
      throw new Error('Permissão para notificações foi recusada ou fechada.');
    }

    // 2. Garantir registro do Service Worker
    const registration = await this.registerServiceWorker();
    if (!registration) {
      throw new Error('Não foi possível inicializar o Service Worker.');
    }

    // 3. Obter chave pública VAPID do servidor
    const keyRes = await fetch('/api/push/vapid-public-key', {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    if (!keyRes.ok) {
      throw new Error('Erro ao obter chave do servidor de notificações.');
    }
    const { publicKey } = await keyRes.json();
    if (!publicKey) {
      throw new Error('Chave VAPID pública não configurada no servidor.');
    }

    // 4. Criar inscrição Push no navegador/celular
    const convertedKey = urlBase64ToUint8Array(publicKey);
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: convertedKey
    });

    // 5. Salvar inscrição no servidor
    const subRes = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ subscription })
    });

    if (!subRes.ok) {
      const errData = await subRes.json().catch(() => ({}));
      throw new Error(errData.error || 'Erro ao registrar assinatura no servidor.');
    }

    return true;
  },

  async unsubscribe(token) {
    if (!this.isSupported()) return true;

    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          const endpoint = sub.endpoint;
          await sub.unsubscribe();

          await fetch('/api/push/unsubscribe', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {})
            },
            body: JSON.stringify({ endpoint })
          }).catch(() => {});
        }
      }
      return true;
    } catch (err) {
      console.error('[Unsubscribe Error]', err);
      throw err;
    }
  },

  async testNotification(token) {
    const res = await fetch('/api/push/test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Falha ao disparar notificação de teste.');
    }
    return data;
  },

  async autoSync(token) {
    if (!this.isSupported() || !token) return;
    if (Notification.permission !== 'granted') return;

    try {
      const reg = await this.registerServiceWorker();
      if (!reg) return;

      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        const keyRes = await fetch('/api/push/vapid-public-key', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!keyRes.ok) return;
        const { publicKey } = await keyRes.json();
        if (!publicKey) return;

        const convertedKey = urlBase64ToUint8Array(publicKey);
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedKey
        });
      }

      if (sub) {
        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ subscription: sub })
        });
        console.log('[PUSH] Dispositivo sincronizado com sucesso no servidor.');
      }
    } catch (err) {
      console.warn('[PUSH AutoSync Warning]:', err.message);
    }
  },

  playChime() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const now = ctx.currentTime;

      // Primeiro tom: D5 (587.33 Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now);
      gain1.gain.setValueAtTime(0.25, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.45);

      // Segundo tom: A5 (880.00 Hz)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880.00, now + 0.12);
      gain2.gain.setValueAtTime(0.3, now + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.12);
      osc2.stop(now + 0.7);

      // Vibração no celular se compatível
      if (navigator.vibrate) {
        navigator.vibrate([300, 100, 300, 100, 500]);
      }
    } catch (e) {
      // Ignora silenciosamente se áudio bloqueado antes de gesto
    }
  }
};
