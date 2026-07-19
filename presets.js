const BUILTIN_FIELDS = [
  { id: 'hep_th', label: 'High Energy Physics - Theory', query: 'cat:hep-th' },
  { id: 'hep_ph', label: 'High Energy Physics - Phenomenology', query: 'cat:hep-ph' },
  { id: 'gr_qc', label: 'General Relativity and Quantum Cosmology', query: 'cat:gr-qc' },
  { id: 'math_ph', label: 'Mathematical Physics', query: 'cat:math-ph' },
  { id: 'cond_mat', label: 'Condensed Matter', query: 'cat:cond-mat' },
  { id: 'cond_mat_str_el', label: 'Condensed Matter - Strongly Correlated Electrons', query: 'cat:cond-mat.str-el' },
  { id: 'quant_ph', label: 'Quantum Physics', query: 'cat:quant-ph' }
];

const DEFAULT_SETTINGS = {
  fields: BUILTIN_FIELDS,
  defaultField: 'hep_th',
  uiLanguage: 'en',
  authorFilter: '',
  citationSourceMode: 'auto',
  batchSize: 20,
  randomStartDate: '1991-01-01',
  randomEndDate: '',
  randomMinCitations: 0,
  randomMaxCitations: '',
  classicsStartDate: '1991-01-01',
  classicsEndDate: '2012-12-31',
  classicsMinCitations: 200,
  classicsMaxCitations: 5000,
  classicsSearchSource: 'auto'
};
