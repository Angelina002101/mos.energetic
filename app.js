const form = document.querySelector('#lead-form');
const status = document.querySelector('#form-status');
const answer = form.elements.answer;
const label = document.querySelector('#captcha-label');
const refresh = document.querySelector('#refresh-captcha');
let challenge = '', challengeAt = 0, busy = false, loading = false;
const fallback = 'Не удалось связаться с сервером. Позвоните +7 931 314-23-63 или напишите mos.energetic@yandex.ru.';
async function jsonRequest(options = {}) {
  const response = await fetch('/api/contact', { cache: 'no-store', signal: AbortSignal.timeout(15000), ...options });
  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('Форма недоступна. Позвоните +7 931 314-23-63 или напишите mos.energetic@yandex.ru.');
  }
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || fallback);
  return data;
}
async function loadCaptcha() {
  if (loading) return false;
  loading = true; refresh.disabled = true; challenge = ''; answer.value = '';
  try {
    const data = await jsonRequest();
    if (typeof data.challenge !== 'string' || typeof data.question !== 'string') throw new Error(fallback);
    challenge = data.challenge; challengeAt = Date.now();
    label.firstChild.textContent = data.question + ' *'; answer.placeholder = 'Введите ответ';
    return true;
  } catch (error) {
    status.textContent = location.protocol === 'file:'
      ? 'Локальный просмотр: форма заработает после публикации на Vercel и добавления настроек бота.'
      : (error.name === 'TimeoutError' || error.name === 'TypeError' ? fallback : error.message);
    answer.placeholder = 'Проверка недоступна'; return false;
  } finally { loading = false; refresh.disabled = false; }
}
refresh.addEventListener('click', async () => { if (!busy) { status.textContent = ''; await loadCaptcha(); } });
form.addEventListener('focusin', () => {
  if (!busy && !loading && challenge && Date.now() - challengeAt > 480000) {
    status.textContent = 'Проверка обновилась. Введите ответ на новый пример.';
    loadCaptcha();
  }
});
loadCaptcha();
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (busy || loading) return;
  if (!challenge || Date.now() - challengeAt > 540000) {
    if (await loadCaptcha()) status.textContent = 'Введите ответ на новый пример и отправьте заявку.';
    return;
  }
  if (!form.reportValidity()) return;
  busy = true;
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true; refresh.disabled = true;
  button.textContent = 'ОТПРАВЛЯЕМ…'; status.textContent = '';
  try {
    const payload = Object.fromEntries(new FormData(form));
    payload.consent = form.elements.consent.checked; payload.challenge = challenge;
    const data = await jsonRequest({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (data.ok !== true) throw new Error(fallback);
    form.reset(); await loadCaptcha();
    status.textContent = 'Заявка отправлена! Мы свяжемся с вами по указанному телефону.';
  } catch (error) {
    await loadCaptcha();
    status.textContent = error.name === 'TimeoutError' || error.name === 'TypeError'
      ? 'Доставка не подтверждена. Позвоните +7 931 314-23-63 или напишите mos.energetic@yandex.ru.'
      : error.message;
  } finally {
    busy = false; button.disabled = false; refresh.disabled = false;
    button.textContent = 'ПРОВЕРИТЬ МОЮ СИТУАЦИЮ →';
  }
});
