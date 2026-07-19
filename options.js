const form = document.querySelector('#settingsForm');
const savedMessage = document.querySelector('#savedMessage');
const fieldsContainer = document.querySelector('#fieldsContainer');
const defaultField = document.querySelector('#defaultField');
let fields = [];

function newId() { return `field_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`; }
function renderFields() {
  fieldsContainer.replaceChildren(); defaultField.replaceChildren();
  fields.forEach((field, index) => {
    const row = document.createElement('div'); row.className = 'field-editor';
    row.innerHTML = `<label><span data-i18n="fieldLabelName">Display name</span><input class="field-label" value=""></label><label><span data-i18n="fieldQueryLabel">arXiv query</span><textarea class="field-query" rows="3"></textarea></label><button type="button" class="secondary remove-field" data-i18n="removeField">Remove</button>`;
    row.querySelector('.field-label').value = field.label;
    row.querySelector('.field-query').value = field.query;
    row.querySelector('.field-label').addEventListener('input', e => { fields[index].label = e.target.value; renderDefaultOptions(); });
    row.querySelector('.field-query').addEventListener('input', e => { fields[index].query = e.target.value; });
    row.querySelector('.remove-field').addEventListener('click', () => { if (fields.length > 1) { fields.splice(index, 1); renderFields(); } });
    fieldsContainer.appendChild(row);
    applyI18n(row);
  });
  renderDefaultOptions();
}
function renderDefaultOptions() {
  const previous = defaultField.value;
  defaultField.replaceChildren();
  fields.forEach(field => { const option = document.createElement('option'); option.value = field.id; option.textContent = field.label || i18n('unnamedField'); defaultField.appendChild(option); });
  if (fields.some(f => f.id === previous)) defaultField.value = previous;
}
function setValue(id, value) { document.querySelector(`#${id}`).value = value ?? ''; }
(async () => {
  const settings = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  fields = structuredClone(Array.isArray(settings.fields) && settings.fields.length ? settings.fields : BUILTIN_FIELDS);
  renderFields(); defaultField.value = settings.defaultField;
  ['authorFilter','citationSourceMode','batchSize','randomStartDate','randomEndDate','randomMinCitations','randomMaxCitations','classicsSearchSource','classicsStartDate','classicsEndDate','classicsMinCitations','classicsMaxCitations'].forEach(id => setValue(id, settings[id]));
})();
document.querySelector('#addField').addEventListener('click', () => { fields.push({ id: newId(), label: i18n('newFieldLabel'), query: 'cat:hep-th' }); renderFields(); });
document.querySelector('#restoreFields').addEventListener('click', () => { fields = structuredClone(BUILTIN_FIELDS); renderFields(); });
form.addEventListener('submit', async event => {
  event.preventDefault();
  const cleaned = fields.map(f => ({ id: f.id || newId(), label: f.label.trim(), query: f.query.trim() })).filter(f => f.label && f.query);
  if (!cleaned.length) { savedMessage.textContent = i18n('validationNeedField'); return; }
  const numberOrBlank = id => document.querySelector(`#${id}`).value === '' ? '' : Number(document.querySelector(`#${id}`).value);
  await chrome.storage.sync.set({
    fields: cleaned, defaultField: cleaned.some(f => f.id === defaultField.value) ? defaultField.value : cleaned[0].id,
    authorFilter: document.querySelector('#authorFilter').value.trim(),
    citationSourceMode: document.querySelector('#citationSourceMode').value,
    batchSize: Number(document.querySelector('#batchSize').value),
    randomStartDate: document.querySelector('#randomStartDate').value, randomEndDate: document.querySelector('#randomEndDate').value,
    randomMinCitations: numberOrBlank('randomMinCitations'), randomMaxCitations: numberOrBlank('randomMaxCitations'),
    classicsSearchSource: document.querySelector('#classicsSearchSource').value,
    classicsStartDate: document.querySelector('#classicsStartDate').value, classicsEndDate: document.querySelector('#classicsEndDate').value,
    classicsMinCitations: numberOrBlank('classicsMinCitations'), classicsMaxCitations: numberOrBlank('classicsMaxCitations')
  });
  savedMessage.textContent = i18n('settingsSaved'); setTimeout(() => { savedMessage.textContent = ''; }, 1800);
});
