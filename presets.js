const BUILTIN_FIELDS = [
  { id: 'generalized', label: '一般化対称性・トポロジカル相', query: 'all:"generalized symmetry" OR all:"higher-form symmetry" OR all:"non-invertible symmetry" OR all:fracton OR all:"subsystem symmetry" OR all:"topological order"' },
  { id: 'qft', label: '場の量子論・弦理論', query: 'cat:hep-th OR cat:hep-ph' },
  { id: 'condensed', label: '物性理論', query: 'cat:cond-mat.str-el OR cat:cond-mat.stat-mech OR cat:cond-mat.mes-hall' },
  { id: 'quantum_info', label: '量子情報・量子計算', query: 'cat:quant-ph' },
  { id: 'active', label: 'アクティブマター・確率過程', query: 'all:"active matter" OR all:flocking OR all:"stochastic process" OR cat:cond-mat.soft' }
];

const DEFAULT_SETTINGS = {
  fields: BUILTIN_FIELDS,
  defaultField: 'generalized',
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
