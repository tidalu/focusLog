export function buildReminderOverlayControllerScript(occurrenceId: string): string {
  return String.raw`
if (window.__focuslogReminderControllerInstalled) {
  window.__focuslogReminderUpdate && window.__focuslogReminderUpdate();
} else {
window.__focuslogReminderControllerInstalled = true;
const id = ${JSON.stringify(occurrenceId)};
const field = document.querySelector('#response');
const button = document.querySelector('#submit');
const counter = document.querySelector('#counter');
const suggestions = document.querySelector('#suggestions');
const form = document.querySelector('#form');
const api = window.focuslog || {};
if (!field || !button || !counter || !suggestions || !form) {
  throw new Error('Reminder response controls were not found.');
}
let categories = [];
let saving;

function responseText() {
  return String(field.value || '');
}

function renderSuggestions() {
  suggestions.replaceChildren();
  const match = new RegExp('(?:^|\\n)((?:<[^>\\n]+>)*)<([^>\\n]*)$').exec(responseText());
  if (!match) return;
  const parents = [...match[1].matchAll(new RegExp('<([^>]+)>', 'g'))].map((value) =>
    value[1].trim().toLowerCase()
  );
  const prefix = match[2].trim().toLowerCase();
  for (const path of categories
    .filter((value) => {
      const parts = value.split('/');
      return (
        parts.length === parents.length + 1 &&
        parents.every((parent, index) => parts[index] === parent) &&
        parts.at(-1).startsWith(prefix)
      );
    })
    .slice(0, 5)) {
    const choice = document.createElement('button');
    choice.type = 'button';
    choice.textContent = '<' + path + '>';
    choice.addEventListener('click', () => {
      field.value =
        responseText().slice(0, responseText().lastIndexOf('<')) +
        '<' +
        path.split('/').at(-1) +
        '> ';
      field.setSelectionRange(field.value.length, field.value.length);
      update();
      field.focus();
    });
    suggestions.append(choice);
  }
}

function update() {
  const text = responseText();
  const count = [...text.trim()].length;
  button.disabled = count < 20;
  counter.textContent = count + ' / 20' + (count >= 20 ? ' ✓' : '');
  counter.classList.toggle('ready', count >= 20);
  renderSuggestions();
  clearTimeout(saving);
  if (typeof api.preserveDraft === 'function')
    saving = setTimeout(() => void api.preserveDraft(id, text).catch(() => undefined), 80);
}

window.__focuslogReminderUpdate = update;
field.addEventListener('beforeinput', () => setTimeout(update, 0));
field.addEventListener('input', update);
field.addEventListener('keyup', update);
field.addEventListener('change', update);
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  update();
  if (button.disabled) return;
  button.disabled = true;
  try {
    if (typeof api.completeReminder !== 'function') throw new Error('Reminder API unavailable.');
    await api.completeReminder(id, responseText());
    document.body.classList.add('resolved');
  } catch (error) {
    button.disabled = false;
    counter.textContent = error instanceof Error ? error.message : 'Unable to save your response';
  }
});

Promise.resolve(
  typeof api.searchFilters === 'function' ? api.searchFilters() : { categories: [] }
)
  .then((filters) => {
    categories = Array.isArray(filters.categories)
      ? filters.categories.map((category) => category.name).filter(Boolean)
      : [];
    renderSuggestions();
  })
  .catch(() => {
    categories = [];
  });

Promise.resolve(typeof api.getDraft === 'function' ? api.getDraft(id) : '')
  .then((text) => {
    field.value = typeof text === 'string' ? text : '';
    update();
    field.focus();
    field.setSelectionRange(field.value.length, field.value.length);
  })
  .catch(() => {
    field.focus();
    update();
  });

window.addEventListener('focus', () => field.focus());
field.focus();
update();
}
`;
}

export function buildReminderOverlayHtml(occurrenceId: string, intervalMinutes: number): string {
  const script = buildReminderOverlayControllerScript(occurrenceId);
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>FocusLog reminder</title><style>:root{color-scheme:dark;font-family:Inter,"Segoe UI",system-ui,sans-serif}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;overflow:hidden;background:radial-gradient(circle at 50% 15%,#272b3c 0,#101119 42%,#07080d 100%);color:#f7f7fb;animation:appear .24s ease-out}body::before{content:"";position:fixed;inset:0;background:rgba(5,6,10,.42);backdrop-filter:blur(18px);pointer-events:none;z-index:0}main{position:relative;z-index:1;width:min(820px,calc(100vw - 64px));display:grid;gap:30px}h1{max-width:760px;margin:0;font-size:clamp(34px,4.3vw,64px);font-weight:650;letter-spacing:-.045em;line-height:1.05}form{display:grid;gap:14px}label{font-size:14px;font-weight:650;color:#aeb2c3;letter-spacing:.02em}textarea{width:100%;min-height:230px;resize:none;border:1px solid #ffffff24;border-radius:24px;padding:24px 26px;background:#171922e8;color:#fff;box-shadow:0 24px 70px #0008,inset 0 1px #ffffff12;font:500 clamp(20px,2vw,28px)/1.45 inherit;outline:none;transition:border-color .18s,box-shadow .18s}textarea:focus{border-color:#8d91ff;box-shadow:0 0 0 4px #777cff2b,0 30px 90px #0009}.suggestions{display:flex;flex-wrap:wrap;gap:8px}.suggestions:empty{display:none}.suggestions button{padding:7px 11px;border:1px solid #ffffff24;background:#202331;color:#cfd1ff;font-size:12px;box-shadow:none}.footer{display:flex;align-items:center;justify-content:space-between;gap:20px}.counter{margin:0;color:#aeb2c3;font-size:15px}.counter.ready{color:#7ce7ae}button{border:0;border-radius:16px;padding:15px 28px;background:linear-gradient(135deg,#8a8fff,#6d63ef);color:white;font:700 16px inherit;box-shadow:0 12px 30px #6d63ef42;cursor:pointer;transition:transform .16s,opacity .16s}button:hover:not(:disabled){transform:translateY(-2px)}button:focus-visible{outline:3px solid #fff;outline-offset:4px}button:disabled{cursor:not-allowed;opacity:.36;box-shadow:none}body.resolved{animation:resolve .24s ease-in forwards}@keyframes appear{from{opacity:0;transform:scale(1.015)}to{opacity:1;transform:none}}@keyframes resolve{to{opacity:0;transform:scale(.985)}}@media(max-width:640px){main{width:calc(100vw - 32px)}.footer{align-items:stretch;flex-direction:column}button{width:100%}}</style></head><body><main aria-labelledby="question"><h1 id="question">What did you accomplish during the last ${intervalMinutes} minutes?</h1><form id="form"><label for="response">Your response</label><textarea id="response" required minlength="20" aria-describedby="counter" autocomplete="off" spellcheck="true" onbeforeinput="setTimeout(()=>window.__focuslogReminderUpdate&&window.__focuslogReminderUpdate(),0)" oninput="window.__focuslogReminderUpdate&&window.__focuslogReminderUpdate()" onkeyup="window.__focuslogReminderUpdate&&window.__focuslogReminderUpdate()" onchange="window.__focuslogReminderUpdate&&window.__focuslogReminderUpdate()" placeholder="&lt;study&gt;&lt;leetcode&gt;&#10;Describe what you completed…"></textarea><div id="suggestions" class="suggestions" aria-label="Category suggestions"></div><div class="footer"><p id="counter" class="counter" aria-live="polite">0 / 20</p><button id="submit" type="submit" disabled>Submit check-in</button></div></form></main><script>${script}</script></body></html>`;
}
