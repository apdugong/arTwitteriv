const BUILTIN_FIELDS = [
  { id: 'hep_th', label: 'High Energy Physics - Theory', query: 'cat:hep-th' },
  { id: 'hep_ph', label: 'High Energy Physics - Phenomenology', query: 'cat:hep-ph' },
  { id: 'gr_qc', label: 'General Relativity and Quantum Cosmology', query: 'cat:gr-qc' },
  { id: 'math_ph', label: 'Mathematical Physics', query: 'cat:math-ph' },
  { id: 'cond_mat', label: 'Condensed Matter Theory', query: 'cat:cond-mat.str-el OR cat:cond-mat.stat-mech OR cat:cond-mat.mes-hall OR cat:cond-mat.soft' },
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
