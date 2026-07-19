const BUILTIN_FIELDS = [
  { id: 'generalized', label: 'Generalized Symmetry and Topological Phases', query: 'all:"generalized symmetry" OR all:"higher-form symmetry" OR all:"non-invertible symmetry" OR all:fracton OR all:"subsystem symmetry" OR all:"topological order"' },
  { id: 'qft', label: 'Quantum Field Theory and Strings', query: 'cat:hep-th OR cat:hep-ph' },
  { id: 'condensed', label: 'Condensed Matter Theory', query: 'cat:cond-mat.str-el OR cat:cond-mat.stat-mech OR cat:cond-mat.mes-hall' },
  { id: 'quantum_info', label: 'Quantum Information and Computing', query: 'cat:quant-ph' },
  { id: 'active', label: 'Active Matter and Stochastic Processes', query: 'all:"active matter" OR all:flocking OR all:"stochastic process" OR cat:cond-mat.soft' }
];

const DEFAULT_SETTINGS = {
  fields: BUILTIN_FIELDS,
  defaultField: 'generalized',
  uiLanguage: 'en',
  authorFilter: '',
  citationSourceMode: 'auto',
  batchSize: 20,
  randomStartDate: '1991-01-01',
  randomEndDate: '',
  randomMinCitations: 0,
  randomMaxCitations: '',
  classicsStartDate: '1991-01-01',
  classicsEndDate: '',
  classicsMinCitations: 500,
  classicsMaxCitations: '',
  classicsSearchSource: 'auto'
};
