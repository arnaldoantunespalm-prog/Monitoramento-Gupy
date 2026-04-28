import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Search, 
  Briefcase, 
  MapPin, 
  Building2, 
  ExternalLink, 
  RefreshCw, 
  Filter,
  ChevronRight,
  Loader2,
  AlertCircle,
  Bell,
  BellRing,
  X,
  Plus,
  Settings2,
  Trash2,
  Eye
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Job {
  id: number;
  name: string;
  companyName: string;
  careerPageName: string;
  type: string;
  publishedDate: string;
  isRemoteWork: boolean;
  city: string;
  state: string;
  jobUrl: string;
  careerPageUrl: string;
}

const DEFAULT_CATEGORIES: Record<string, string[]> = {
  "Agilidade": [
    "Squad Leader", 
    "Projetos", 
    "Sistemas", 
    "Gerente de Sistemas", 
    "Scrum Master", 
    "Agilidade", 
    "Gerente de Projetos", 
    "Coordenador de Projetos", 
    "Coordenador de Sistemas", 
    "PMO", 
    "Delivery"
  ],
  "Comercial": [
    "Propagandista",
    "Propagandista vendedor",
    "Representante farmacêutico",
    "Consultor farmacêutico",
    "Consultor de demanda",
    "Promotor técnico",
    "Executivo de contas farma",
    "Representante comercial farmacêutico",
    "Vendas hospitalares",
    "Visitação médica",
    "Representante comercial",
    "Consultor de vendas",
    "Executivo de vendas",
    "Vendedor externo",
    "Vendedor interno",
    "Key Account",
    "Gerente de contas",
    "Desenvolvimento de negócios",
    "Gerente Comercial",
    "Comercial"
  ]
};

const playBeep = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.1);
    gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  } catch (e) {
    console.error("Audio error", e);
  }
};

export default function App() {
  const [categories, setCategories] = useState<Record<string, string[]>>(() => {
    const saved = localStorage.getItem('gupy_categories');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Ensure new keywords from defaults are added to existing saved commercial category if it's missing them (to apply an update)
        if (parsed["Comercial"]) {
           const mergedComercial = Array.from(new Set([...parsed["Comercial"], ...DEFAULT_CATEGORIES["Comercial"]]));
           parsed["Comercial"] = mergedComercial;
        } else {
           parsed["Comercial"] = DEFAULT_CATEGORIES["Comercial"];
        }
        return parsed;
      } catch (e) {
        return DEFAULT_CATEGORIES;
      }
    }
    const oldSaved = localStorage.getItem('gupy_keywords');
    if (oldSaved) {
      try {
        const parsedOld = JSON.parse(oldSaved);
        return {
           ...DEFAULT_CATEGORIES,
           "Agilidade": parsedOld
        };
      } catch (e) {
        return DEFAULT_CATEGORIES;
      }
    }
    return DEFAULT_CATEGORIES;
  });

  const [activeCategory, setActiveCategory] = useState<string>("Agilidade");
  const keywords = categories[activeCategory] || [];

  const [isEditingKeywords, setIsEditingKeywords] = useState(false);
  const [newKeyword, setNewKeyword] = useState("");

  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [selectedKeyword, setSelectedKeyword] = useState<string>(keywords.length > 0 ? keywords[0] : "");
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [totalJobs, setTotalJobs] = useState(0);

  const [viewedJobs, setViewedJobs] = useState<number[]>(() => {
    const saved = localStorage.getItem('gupy_viewed_jobs');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  const markJobAsViewed = (jobId: number) => {
    setViewedJobs(prev => {
      if (prev.includes(jobId)) return prev;
      const updated = [...prev, jobId];
      localStorage.setItem('gupy_viewed_jobs', JSON.stringify(updated));
      return updated;
    });
  };

  useEffect(() => {
    const currentKeywords = categories[activeCategory] || [];
    if (!currentKeywords.includes(selectedKeyword)) {
      setSelectedKeyword(currentKeywords.length > 0 ? currentKeywords[0] : "");
    }
  }, [activeCategory, categories, selectedKeyword]);

  useEffect(() => {
    localStorage.setItem('gupy_categories', JSON.stringify(categories));
  }, [categories]);

  const updateCategoryKeywords = (newKeywords: string[]) => {
    setCategories(prev => ({
      ...prev,
      [activeCategory]: newKeywords
    }));
  };

  const handleAddKeyword = (e: React.FormEvent) => {
    e.preventDefault();
    if (newKeyword.trim() && !keywords.includes(newKeyword.trim())) {
      updateCategoryKeywords([...keywords, newKeyword.trim()]);
      setNewKeyword("");
    }
  };

  const handleRemoveKeyword = (kwToRemove: string) => {
    const newKeywords = keywords.filter(kw => kw !== kwToRemove);
    updateCategoryKeywords(newKeywords);
    if (selectedKeyword === kwToRemove) {
      setSelectedKeyword(newKeywords.length > 0 ? newKeywords[0] : "");
    }
  };

  // Live Monitor State
  const [workplaceType, setWorkplaceType] = useState<string>("remote");
  const [soundAlerts, setSoundAlerts] = useState(false);
  const [newAlerts, setNewAlerts] = useState<Job[]>([]);
  const seenJobIdsRef = useRef<Set<number>>(new Set());

  // Update seen jobs whenever main list changes
  useEffect(() => {
    jobs.forEach(j => seenJobIdsRef.current.add(j.id));
  }, [jobs]);

  const [selectedState, setSelectedState] = useState<string>("Todos");

  const brazilianStates = [
    "São Paulo", "Acre", "Alagoas", "Amapá", "Amazonas", "Bahia", "Ceará", "Distrito Federal",
    "Espírito Santo", "Goiás", "Maranhão", "Mato Grosso", "Mato Grosso do Sul", "Minas Gerais", 
    "Pará", "Paraíba", "Paraná", "Pernambuco", "Piauí", "Rio de Janeiro", "Rio Grande do Norte", 
    "Rio Grande do Sul", "Rondônia", "Roraima", "Santa Catarina", "Sergipe", "Tocantins"
  ];

  const fetchLiveJobs = useCallback(async (isInitial: boolean = false) => {
    try {
      // Fetch the 100 most recent remote jobs overall
      const response = await fetch(`/api/jobs?limit=100&offset=0&workplaceType=${workplaceType}&state=${encodeURIComponent(selectedState)}`);
      if (!response.ok) return;
      const data = await response.json();
      const fetchedJobs: Job[] = data.data || [];
      
      let foundNewAlerts = false;
      const newlyFoundAlerts: Job[] = [];
      const newlyFoundForCurrentList: Job[] = [];

      fetchedJobs.forEach(job => {
        if (!seenJobIdsRef.current.has(job.id)) {
          seenJobIdsRef.current.add(job.id);
          
          if (isInitial) return;

          const lowerName = job.name.toLowerCase();
          
          // 1. Matches ANY keyword (for the green banner)
          const matchesAnyKeyword = keywords.some(kw => lowerName.includes(kw.toLowerCase()));
          if (matchesAnyKeyword) {
            foundNewAlerts = true;
            newlyFoundAlerts.push(job);
          }

          // 2. Matches CURRENT filter (to update main list)
          const matchesCurrentKeyword = selectedKeyword === "" || lowerName.includes(selectedKeyword.toLowerCase());
          if (matchesCurrentKeyword) {
            newlyFoundForCurrentList.push(job);
          }
        }
      });

      if (newlyFoundAlerts.length > 0) {
        setNewAlerts(prev => [...newlyFoundAlerts, ...prev]);
        if (soundAlerts) {
          newlyFoundAlerts.forEach(job => {
            playBeep();
            if (Notification.permission === "granted") {
              const notification = new Notification(`Nova Vaga: ${job.name}`, {
                body: `${job.companyName} publicou uma nova vaga ${workplaceType === 'remote' ? 'remota' : workplaceType === 'hybrid' ? 'híbrida' : 'presencial'}.`,
              });
              notification.onclick = () => {
                window.open(job.jobUrl, '_blank');
                markJobAsViewed(job.id);
              };
            }
          });
        }
      }

      if (newlyFoundForCurrentList.length > 0) {
        setJobs(prev => {
          const prevIds = new Set(prev.map(j => j.id));
          const uniqueNew = newlyFoundForCurrentList.filter(j => !prevIds.has(j.id));
          return [...uniqueNew, ...prev];
        });
        setTotalJobs(prev => prev + newlyFoundForCurrentList.length);
      }
      
      if (!isInitial && (newlyFoundAlerts.length > 0 || newlyFoundForCurrentList.length > 0)) {
        setLastUpdated(new Date());
      }
    } catch (err) {
      console.error("Live monitor error:", err);
    }
  }, [selectedKeyword, soundAlerts, keywords, workplaceType, selectedState]);

  // Initial population of seen IDs
  useEffect(() => {
    fetchLiveJobs(true);
  }, [fetchLiveJobs]);

  // Auto-refresh interval (always ON)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchLiveJobs(false);
    }, 30000); // Check every 30 seconds for faster updates
    return () => clearInterval(interval);
  }, [fetchLiveJobs]);

  const toggleSoundAlerts = () => {
    if (!soundAlerts) {
      if (Notification.permission !== "granted" && Notification.permission !== "denied") {
        Notification.requestPermission();
      }
      setSoundAlerts(true);
    } else {
      setSoundAlerts(false);
    }
  };

  const fetchJobs = useCallback(async (keyword: string = "", currentOffset: number = 0, append: boolean = false) => {
    setLoading(true);
    if (!append) setError(null);
    try {
      const response = await fetch(`/api/jobs?searchTerm=${encodeURIComponent(keyword)}&offset=${currentOffset}&workplaceType=${workplaceType}&state=${encodeURIComponent(selectedState)}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Erro do servidor (${response.status})`);
      }
      
      const data = await response.json();
      const newJobs = data.data || [];
      
      if (append) {
        setJobs(prev => [...prev, ...newJobs]);
      } else {
        setJobs(newJobs);
      }
      
      if (data.pagination) {
        setTotalJobs(data.pagination.total || 0);
        setHasMore(currentOffset + newJobs.length < data.pagination.total);
      } else {
        setHasMore(false);
      }
      
      setLastUpdated(new Date());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [workplaceType, selectedState]);

  useEffect(() => {
    setOffset(0);
    // Clear list briefly or just fetch fresh
    fetchJobs(selectedKeyword, 0, false);
  }, [selectedKeyword, workplaceType, selectedState, fetchJobs]);

  const handleLoadMore = () => {
    const nextOffset = offset + 100;
    setOffset(nextOffset);
    fetchJobs(selectedKeyword, nextOffset, true);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).format(date);
  };

  return (
    <div className="min-h-screen pb-20">
      {/* Header */}
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-lg">
              <Briefcase className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Gupy Job Tracker</h1>
              <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">
                {workplaceType === 'remote' ? 'Vagas 100% Remotas' : workplaceType === 'hybrid' ? 'Vagas Híbridas' : 'Vagas Presenciais'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {lastUpdated && (
              <span className="text-xs text-zinc-400 mr-2 hidden md:inline">
                Atualizado: {lastUpdated.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={toggleSoundAlerts}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                soundAlerts 
                  ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200' 
                  : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
              }`}
              title="Ativar avisos sonoros e notificações no desktop"
            >
              {soundAlerts ? <BellRing className="w-4 h-4 animate-pulse" /> : <Bell className="w-4 h-4" />}
              <span className="hidden sm:inline">{soundAlerts ? 'Alertas ON' : 'Alertas OFF'}</span>
            </button>
            <button 
              onClick={() => { setOffset(0); fetchJobs(selectedKeyword, 0, false); }}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-100 hover:bg-zinc-200 disabled:opacity-50 text-zinc-700 rounded-lg text-sm font-medium transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Atualizar</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Live Alerts Panel */}
        <AnimatePresence>
          {newAlerts.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="mb-8 bg-emerald-50 border border-emerald-200 rounded-2xl p-4 shadow-sm"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-emerald-800 font-semibold">
                  <BellRing className="w-5 h-5 animate-pulse" />
                  <h3>Novas Vagas Encontradas! ({newAlerts.length})</h3>
                </div>
                <button 
                  onClick={() => setNewAlerts([])}
                  className="text-emerald-600 hover:text-emerald-800 p-1 hover:bg-emerald-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {newAlerts.map(job => (
                  <div key={`alert-${job.id}`} className="bg-white p-3 rounded-xl border border-emerald-100 shadow-sm flex flex-col justify-between">
                    <div>
                      <h4 className="font-bold text-sm text-zinc-900 line-clamp-2">{job.name}</h4>
                      <p className="text-xs text-zinc-500 mt-1">{job.companyName}</p>
                    </div>
                    <a 
                      href={job.jobUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      onClick={() => markJobAsViewed(job.id)}
                      className="mt-3 inline-flex items-center gap-1 text-emerald-600 text-xs font-bold hover:underline"
                    >
                      Candidatar-se agora
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Filters */}
        <section className="mb-8">
          {/* Categories */}
          <div className="flex gap-4 mb-6 border-b border-zinc-200">
            {Object.keys(categories).map(category => (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={`pb-3 text-sm font-semibold transition-colors relative ${
                  activeCategory === category 
                    ? "text-indigo-600" 
                    : "text-zinc-500 hover:text-zinc-700"
                }`}
              >
                {category}
                {activeCategory === category && (
                  <motion.div 
                    layoutId="activeCategoryIndicator"
                    className="absolute left-0 right-0 bottom-0 h-0.5 bg-indigo-600 rounded-t-full"
                  />
                )}
              </button>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-zinc-400" />
              <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">Filtrar por Cargo</h2>
              {totalJobs > 0 && (
                <span className="ml-2 text-xs font-medium bg-zinc-100 text-zinc-600 px-2 py-1 rounded-md hidden sm:inline-block">
                  {totalJobs} vagas encontradas
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <select
                value={workplaceType}
                onChange={(e) => setWorkplaceType(e.target.value)}
                className="px-3 py-1.5 text-sm font-medium bg-zinc-100 border-none rounded-lg text-zinc-700 cursor-pointer outline-none focus:ring-2 focus:ring-indigo-500 hover:bg-zinc-200 transition-colors"
                title="Selecione o modelo de trabalho"
              >
                <option value="remote">🌐 Remotas</option>
                <option value="hybrid">🤝 Híbridas</option>
                <option value="on-site">🏢 Presenciais</option>
              </select>

              <select
                value={selectedState}
                onChange={(e) => setSelectedState(e.target.value)}
                className="px-3 py-1.5 text-sm font-medium bg-zinc-100 border-none rounded-lg text-zinc-700 cursor-pointer outline-none focus:ring-2 focus:ring-indigo-500 hover:bg-zinc-200 transition-colors"
                title="Selecione o estado"
              >
                <option value="Todos">📍 Todos os Estados</option>
                {brazilianStates.map((uf) => (
                  <option key={uf} value={uf}>{uf === "São Paulo" ? `⭐ ${uf}` : uf}</option>
                ))}
              </select>

              <button 
                onClick={() => setIsEditingKeywords(!isEditingKeywords)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  isEditingKeywords ? 'bg-indigo-100 text-indigo-700' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                }`}
              >
                <Settings2 className="w-4 h-4" />
                <span className="hidden sm:inline">{isEditingKeywords ? 'Concluir' : 'Editar Filtros'}</span>
              </button>
            </div>
          </div>

          <AnimatePresence>
            {isEditingKeywords && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-4 overflow-hidden"
              >
                <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-zinc-700 mb-3">Gerenciar Palavras-chave</h3>
                  <form onSubmit={handleAddKeyword} className="flex gap-2 mb-4">
                    <input 
                      type="text" 
                      value={newKeyword}
                      onChange={(e) => setNewKeyword(e.target.value)}
                      placeholder="Adicionar novo cargo ou palavra-chave..."
                      className="flex-1 px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                    <button 
                      type="submit"
                      disabled={!newKeyword.trim()}
                      className="flex items-center gap-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      <span className="hidden sm:inline">Adicionar</span>
                    </button>
                  </form>
                  <div className="flex flex-wrap gap-2">
                    {keywords.map((keyword) => (
                      <div key={`edit-${keyword}`} className="flex items-center gap-1 px-3 py-1.5 bg-white border border-zinc-200 rounded-full text-sm text-zinc-700 shadow-sm">
                        <span>{keyword}</span>
                        <button 
                          onClick={() => handleRemoveKeyword(keyword)}
                          className="text-zinc-400 hover:text-red-500 p-0.5 rounded-full hover:bg-red-50 transition-colors"
                          title="Remover"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex flex-wrap gap-2">
            {keywords.map((keyword) => (
              <button
                key={keyword}
                onClick={() => setSelectedKeyword(keyword)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all border ${
                  selectedKeyword === keyword 
                  ? "bg-indigo-600 border-indigo-600 text-white shadow-md" 
                  : "bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300"
                }`}
              >
                {keyword}
              </button>
            ))}
          </div>
        </section>

        {/* Content */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3 mb-8">
            <AlertCircle className="text-red-600 w-5 h-5 mt-0.5" />
            <div>
              <h3 className="text-red-800 font-semibold">Erro ao carregar vagas</h3>
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          </div>
        )}

        {loading && jobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
            <Loader2 className="w-10 h-10 animate-spin mb-4" />
            <p>Buscando as melhores oportunidades...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence mode="popLayout">
              {jobs.map((job, index) => (
                <motion.div
                  key={job.id || index}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.2, delay: index * 0.05 }}
                  className={`job-card flex flex-col justify-between ${viewedJobs.includes(job.id) ? 'opacity-60 bg-zinc-50' : ''}`}
                >
                  <div>
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2">
                        <span className={`badge ${workplaceType === 'remote' ? 'badge-remote' : workplaceType === 'hybrid' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                          {workplaceType === 'remote' ? 'Remoto' : workplaceType === 'hybrid' ? 'Híbrido' : 'Presencial'}
                        </span>
                        {job.type && <span className="badge bg-zinc-100 text-zinc-600">{job.type}</span>}
                        {viewedJobs.includes(job.id) && (
                          <span className="badge bg-purple-100 text-purple-700 border-purple-200 flex items-center gap-1 font-medium">
                            <Eye className="w-3 h-3" />
                            Visto
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-zinc-400 font-mono">
                        {formatDate(job.publishedDate)}
                      </span>
                    </div>
                    
                    <h3 className="font-bold text-lg leading-tight mb-1 line-clamp-2 group-hover:text-indigo-600 transition-colors">
                      {job.name}
                    </h3>
                    
                    <div className="flex items-center gap-2 text-zinc-600 text-sm mb-4">
                      <Building2 className="w-4 h-4" />
                      <span className="font-medium">{job.companyName}</span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-zinc-100 flex items-center justify-between">
                    <div className="flex items-center gap-1 text-zinc-400 text-xs">
                      <MapPin className="w-3 h-3" />
                      <span>{job.city ? `${job.city}, ${job.state}` : 'Brasil'}</span>
                    </div>
                    
                    <a 
                      href={job.jobUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      onClick={() => markJobAsViewed(job.id)}
                      className="flex items-center gap-1 text-indigo-600 text-sm font-semibold hover:underline"
                    >
                      Ver Vaga
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {hasMore && (
          <div className="mt-8 flex justify-center">
            <button
              onClick={handleLoadMore}
              disabled={loading}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-medium transition-colors flex items-center gap-2 shadow-sm"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Carregando...
                </>
              ) : (
                'Carregar mais vagas'
              )}
            </button>
          </div>
        )}

        {!loading && jobs.length === 0 && !error && (
          <div className="text-center py-20 bg-white border border-dashed border-zinc-300 rounded-2xl">
            <Search className="w-12 h-12 text-zinc-200 mx-auto mb-4" />
            <h3 className="text-zinc-500 font-medium">Nenhuma vaga encontrada para "{selectedKeyword || 'todos'}"</h3>
            <p className="text-zinc-400 text-sm mt-1">Tente outro filtro ou atualize a página.</p>
          </div>
        )}
      </main>

      {/* Footer Info */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-zinc-200 py-3 px-4 z-20">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-2">
          <p className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold">
            Monitorando Portal Gupy
          </p>
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-1.5 transition-colors ${soundAlerts ? 'text-emerald-600' : 'text-zinc-400'}`}>
              <div className={`w-2 h-2 rounded-full ${soundAlerts ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-300'}`}></div>
              <span className="text-[10px] font-bold uppercase tracking-tighter">
                Notificações {soundAlerts ? 'ON' : 'OFF'}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-tighter">
                Atualização Automática ON
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
