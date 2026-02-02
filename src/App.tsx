import { useState, useEffect, useCallback } from 'react'
import { Trophy, ClipboardCheck, Plus, Trash2, Star, Calendar, ChevronDown, Target, Users, Sparkles, Database, Wifi, WifiOff, RefreshCw, Pencil, X } from 'lucide-react'
import { supabase, episodeApi, brandApi, type Episode, type Brand } from './lib/supabase'

type JudgeKey = 'judge1' | 'judge2' | 'judge3'
type ScoreKey = 'strategy' | 'acquisition' | 'private'

// 每个评审负责一个维度（按维度命名）
const JUDGES = [
  { key: 'judge1' as JudgeKey, name: 'AI战略', dimension: 'strategy' as ScoreKey, color: 'from-purple-500 to-indigo-500', icon: Target },
  { key: 'judge2' as JudgeKey, name: 'AI获客', dimension: 'acquisition' as ScoreKey, color: 'from-cyan-500 to-teal-500', icon: Users },
  { key: 'judge3' as JudgeKey, name: 'AI私域', dimension: 'private' as ScoreKey, color: 'from-orange-500 to-red-500', icon: Sparkles },
]

const DIMENSIONS = [
  { key: 'strategy' as ScoreKey, name: 'AI战略', icon: Target, color: 'purple' },
  { key: 'acquisition' as ScoreKey, name: 'AI获客', icon: Users, color: 'cyan' },
  { key: 'private' as ScoreKey, name: 'AI私域', icon: Sparkles, color: 'orange' },
]

// 本地存储工具
const storage = {
  getEpisodes: (): Episode[] => {
    const data = localStorage.getItem('ranking_episodes')
    return data ? JSON.parse(data) : []
  },
  setEpisodes: (episodes: Episode[]) => {
    localStorage.setItem('ranking_episodes', JSON.stringify(episodes))
  },
  getBrands: (episodeId: string): Brand[] => {
    const data = localStorage.getItem(`ranking_brands_${episodeId}`)
    return data ? JSON.parse(data) : []
  },
  setBrands: (episodeId: string, brands: Brand[]) => {
    localStorage.setItem(`ranking_brands_${episodeId}`, JSON.stringify(brands))
  }
}

function App() {
  const [activeTab, setActiveTab] = useState<'scoring' | 'ranking'>('scoring')
  const [episodes, setEpisodes] = useState<Episode[]>([])
  const [currentEpisode, setCurrentEpisode] = useState<Episode | null>(null)
  const [brands, setBrands] = useState<Brand[]>([])
  const [newBrandName, setNewBrandName] = useState('')
  const [newEpisodeName, setNewEpisodeName] = useState('')
  const [selectedJudge, setSelectedJudge] = useState<JudgeKey>('judge1')
  const [showEpisodeDropdown, setShowEpisodeDropdown] = useState(false)
  const [showNewEpisodeModal, setShowNewEpisodeModal] = useState(false)
  const [editingEpisode, setEditingEpisode] = useState<Episode | null>(null)
  const [editEpisodeName, setEditEpisodeName] = useState('')
  const [deletingEpisode, setDeletingEpisode] = useState<Episode | null>(null)
  const [isOnline, setIsOnline] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)

  // 检查Supabase连接
  const checkConnection = useCallback(async () => {
    try {
      const { error } = await supabase.from('episodes').select('id').limit(1)
      setIsOnline(!error)
      return !error
    } catch {
      setIsOnline(false)
      return false
    }
  }, [])

  // 加载数据
  const loadData = useCallback(async () => {
    setIsLoading(true)
    const online = await checkConnection()
    
    if (online) {
      try {
        const eps = await episodeApi.getAll()
        setEpisodes(eps)
        storage.setEpisodes(eps)
        
        const active = eps.find(e => e.is_active) || eps[0]
        if (active) {
          setCurrentEpisode(active)
          const brs = await brandApi.getByEpisode(active.id)
          setBrands(brs)
          storage.setBrands(active.id, brs)
        }
      } catch (e) {
        console.error('加载云端数据失败:', e)
        loadFromLocal()
      }
    } else {
      loadFromLocal()
    }
    setIsLoading(false)
  }, [checkConnection])

  const loadFromLocal = () => {
    const eps = storage.getEpisodes()
    setEpisodes(eps)
    const active = eps.find(e => e.is_active) || eps[0]
    if (active) {
      setCurrentEpisode(active)
      setBrands(storage.getBrands(active.id))
    }
  }

  useEffect(() => {
    loadData()
  }, [loadData])

  // 切换期数
  const switchEpisode = async (episode: Episode) => {
    setCurrentEpisode(episode)
    setShowEpisodeDropdown(false)
    
    if (isOnline) {
      try {
        await episodeApi.setActive(episode.id)
        const brs = await brandApi.getByEpisode(episode.id)
        setBrands(brs)
        storage.setBrands(episode.id, brs)
      } catch {
        setBrands(storage.getBrands(episode.id))
      }
    } else {
      setBrands(storage.getBrands(episode.id))
    }
    
    // 更新本地活跃状态
    const updatedEps = episodes.map(e => ({ ...e, is_active: e.id === episode.id }))
    setEpisodes(updatedEps)
    storage.setEpisodes(updatedEps)
  }

  // 创建新期
  const createEpisode = async () => {
    if (!newEpisodeName.trim()) return
    
    const newEp: Episode = {
      id: Date.now().toString(),
      name: newEpisodeName.trim(),
      created_at: new Date().toISOString(),
      is_active: true
    }
    
    if (isOnline) {
      try {
        const created = await episodeApi.create(newEpisodeName.trim())
        newEp.id = created.id
      } catch (e) {
        console.error('创建期数失败:', e)
      }
    }
    
    const updatedEps = episodes.map(e => ({ ...e, is_active: false }))
    updatedEps.unshift(newEp)
    setEpisodes(updatedEps)
    storage.setEpisodes(updatedEps)
    setCurrentEpisode(newEp)
    setBrands([])
    storage.setBrands(newEp.id, [])
    setNewEpisodeName('')
    setShowNewEpisodeModal(false)
  }

  // 编辑期数
  const updateEpisode = async () => {
    if (!editingEpisode || !editEpisodeName.trim()) return
    
    if (isOnline) {
      try {
        await supabase.from('episodes').update({ name: editEpisodeName.trim() }).eq('id', editingEpisode.id)
      } catch (e) {
        console.error('更新期数失败:', e)
      }
    }
    
    const updatedEps = episodes.map(ep => 
      ep.id === editingEpisode.id ? { ...ep, name: editEpisodeName.trim() } : ep
    )
    setEpisodes(updatedEps)
    storage.setEpisodes(updatedEps)
    
    if (currentEpisode?.id === editingEpisode.id) {
      setCurrentEpisode({ ...currentEpisode, name: editEpisodeName.trim() })
    }
    
    setEditingEpisode(null)
    setEditEpisodeName('')
  }

  // 删除期数
  const deleteEpisode = async (ep: Episode) => {
    if (isOnline) {
      try {
        await episodeApi.delete(ep.id)
      } catch (e) {
        console.error('删除期数失败:', e)
      }
    }
    
    const updatedEps = episodes.filter(e => e.id !== ep.id)
    setEpisodes(updatedEps)
    storage.setEpisodes(updatedEps)
    localStorage.removeItem(`ranking_brands_${ep.id}`)
    
    // 如果删除的是当前期，切换到第一个
    if (currentEpisode?.id === ep.id) {
      const next = updatedEps[0] || null
      setCurrentEpisode(next)
      if (next) {
        setBrands(storage.getBrands(next.id))
      } else {
        setBrands([])
      }
    }
    
    setDeletingEpisode(null)
    setShowEpisodeDropdown(false)
  }

  // 开始编辑期数
  const startEditEpisode = (ep: Episode, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingEpisode(ep)
    setEditEpisodeName(ep.name)
    setShowEpisodeDropdown(false)
  }

  // 添加品牌
  const addBrand = async () => {
    if (!newBrandName.trim() || !currentEpisode) return
    
    const newBrand: Brand = {
      id: Date.now().toString(),
      episode_id: currentEpisode.id,
      name: newBrandName.trim(),
      scores: {
        judge1: { strategy: 0, acquisition: 0, private: 0 },
        judge2: { strategy: 0, acquisition: 0, private: 0 },
        judge3: { strategy: 0, acquisition: 0, private: 0 },
      },
    }
    
    if (isOnline) {
      try {
        const created = await brandApi.create(currentEpisode.id, newBrandName.trim())
        newBrand.id = created.id
      } catch (e) {
        console.error('添加品牌失败:', e)
      }
    }
    
    const updated = [...brands, newBrand]
    setBrands(updated)
    storage.setBrands(currentEpisode.id, updated)
    setNewBrandName('')
  }

  // 删除品牌
  const deleteBrand = async (id: string) => {
    if (!currentEpisode) return
    
    if (isOnline) {
      try {
        await brandApi.delete(id)
      } catch (e) {
        console.error('删除品牌失败:', e)
      }
    }
    
    const updated = brands.filter(b => b.id !== id)
    setBrands(updated)
    storage.setBrands(currentEpisode.id, updated)
  }

  // 更新分数
  const updateScore = async (brandId: string, judge: JudgeKey, dimension: ScoreKey, value: number) => {
    if (!currentEpisode) return
    
    const updated = brands.map(brand => {
      if (brand.id === brandId) {
        const newScores = {
          ...brand.scores,
          [judge]: {
            ...brand.scores[judge],
            [dimension]: value,
          },
        }
        
        // 异步同步到云端
        if (isOnline) {
          brandApi.updateScores(brandId, newScores).catch(console.error)
        }
        
        return { ...brand, scores: newScores }
      }
      return brand
    })
    
    setBrands(updated)
    storage.setBrands(currentEpisode.id, updated)
  }

  // 同步数据
  const syncData = async () => {
    if (!isOnline || !currentEpisode) return
    setIsSyncing(true)
    
    try {
      // 同步品牌数据
      for (const brand of brands) {
        await brandApi.updateScores(brand.id, brand.scores)
      }
    } catch (e) {
      console.error('同步失败:', e)
    }
    
    setIsSyncing(false)
  }

  // 计算总分（三个维度分数之和，满分300）
  // 每个维度由一个评审负责打分
  const getTotalScore = (brand: Brand) => {
    return brand.scores.judge1.strategy + brand.scores.judge2.acquisition + brand.scores.judge3.private
  }

  // 获取单维度分数（每个维度只有一个评审打分）
  const getDimensionScore = (brand: Brand, dimension: ScoreKey) => {
    if (dimension === 'strategy') return brand.scores.judge1.strategy
    if (dimension === 'acquisition') return brand.scores.judge2.acquisition
    return brand.scores.judge3.private
  }

  // 排序品牌
  const rankedBrands = [...brands].sort((a, b) => getTotalScore(b) - getTotalScore(a))

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">加载中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-4 md:p-6">
      {/* 头部 */}
      <header className="max-w-6xl mx-auto mb-6 animate-fade-in">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-main flex items-center justify-center shadow-glow">
              <Trophy className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold gradient-text">品牌计分排行榜</h1>
              <p className="text-muted-foreground text-xs">AI项目路演评分系统</p>
            </div>
          </div>
          
          {/* 状态指示器 */}
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs ${isOnline ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
              {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              {isOnline ? '云端同步' : '本地模式'}
            </div>
            {isOnline && (
              <button 
                onClick={syncData}
                disabled={isSyncing}
                className="p-2 rounded-lg bg-muted/50 hover:bg-muted transition-all"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* 期数选择器 */}
      <div className="max-w-6xl mx-auto mb-4 animate-slide-up">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <button
              className="glass-card px-4 py-2 flex items-center gap-2 hover:bg-muted/50 transition-all"
              onClick={() => setShowEpisodeDropdown(!showEpisodeDropdown)}
            >
              <Calendar className="w-4 h-4 text-primary" />
              <span className="font-medium">{currentEpisode?.name || '选择期数'}</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${showEpisodeDropdown ? 'rotate-180' : ''}`} />
            </button>
            
            {showEpisodeDropdown && (
              <div className="absolute top-full left-0 mt-2 w-72 glass-card p-2 z-50 animate-scale-in">
                {episodes.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-3 text-center">暂无期数</p>
                ) : (
                  episodes.map(ep => (
                    <div
                      key={ep.id}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${currentEpisode?.id === ep.id ? 'bg-primary/20' : 'hover:bg-muted/50'}`}
                    >
                      <button
                        className="flex-1 text-left truncate"
                        onClick={() => switchEpisode(ep)}
                      >
                        <span className={currentEpisode?.id === ep.id ? 'text-primary font-medium' : ''}>{ep.name}</span>
                      </button>
                      <div className="flex items-center gap-1">
                        {ep.is_active && <span className="text-xs bg-primary/30 px-1.5 py-0.5 rounded">当前</span>}
                        <button
                          className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-all"
                          onClick={(e) => startEditEpisode(ep, e)}
                          title="编辑"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          className="p-1 rounded hover:bg-red-500/20 text-muted-foreground hover:text-red-400 transition-all"
                          onClick={(e) => { e.stopPropagation(); setDeletingEpisode(ep); setShowEpisodeDropdown(false) }}
                          title="删除"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
          
          <button
            className="btn-secondary flex items-center gap-2 text-sm"
            onClick={() => setShowNewEpisodeModal(true)}
          >
            <Plus className="w-4 h-4" />
            新建期数
          </button>
        </div>
      </div>

      {/* 标签页切换 */}
      <div className="max-w-6xl mx-auto mb-4">
        <div className="glass-card p-1.5 inline-flex gap-1">
          <button
            className={`tab-btn flex items-center gap-2 text-sm ${activeTab === 'scoring' ? 'active' : ''}`}
            onClick={() => setActiveTab('scoring')}
          >
            <ClipboardCheck className="w-4 h-4" />
            打分
          </button>
          <button
            className={`tab-btn flex items-center gap-2 text-sm ${activeTab === 'ranking' ? 'active' : ''}`}
            onClick={() => setActiveTab('ranking')}
          >
            <Trophy className="w-4 h-4" />
            排行榜
          </button>
        </div>
      </div>

      {!currentEpisode ? (
        <div className="max-w-6xl mx-auto">
          <div className="glass-card p-12 text-center">
            <Database className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">请先创建一个期数开始打分</p>
            <button className="btn-primary" onClick={() => setShowNewEpisodeModal(true)}>
              <Plus className="w-4 h-4 inline mr-2" />
              创建第一期
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* 打分看板 */}
          {activeTab === 'scoring' && (
            <div className="max-w-6xl mx-auto space-y-4 animate-fade-in">
              {/* 添加品牌 + 评审选择 */}
              <div className="glass-card p-4">
                <div className="flex flex-wrap gap-4 items-end">
                  <div className="flex-1 min-w-[200px]">
                    <label className="text-xs text-muted-foreground mb-1.5 block">添加品牌</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        className="input-field flex-1 py-2 text-sm"
                        placeholder="输入品牌名称..."
                        value={newBrandName}
                        onChange={(e) => setNewBrandName(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && addBrand()}
                      />
                      <button className="btn-primary py-2 px-4 text-sm" onClick={addBrand}>
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">选择评审维度</label>
                    <div className="flex gap-1">
                      {JUDGES.map(judge => {
                        const Icon = judge.icon
                        return (
                          <button
                            key={judge.key}
                            className={`px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
                              selectedJudge === judge.key
                                ? `bg-gradient-to-r ${judge.color} text-white`
                                : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                            }`}
                            onClick={() => setSelectedJudge(judge.key)}
                          >
                            <Icon className="w-3.5 h-3.5" />
                            {judge.name}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* 品牌打分列表 */}
              {brands.length === 0 ? (
                <div className="glass-card p-12 text-center">
                  <Star className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">暂无参赛品牌，请先添加品牌</p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {brands.map((brand, index) => {
                    const currentJudge = JUDGES.find(j => j.key === selectedJudge)!
                    const Icon = currentJudge.icon
                    const score = brand.scores[selectedJudge][currentJudge.dimension]
                    
                    return (
                      <div 
                        key={brand.id} 
                        className="glass-card p-4 animate-slide-up"
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        <div className="flex items-center gap-4">
                          {/* 品牌名称 */}
                          <div className="flex-1 min-w-0">
                            <h3 className="text-lg font-bold truncate">{brand.name}</h3>
                          </div>
                          
                          {/* 打分输入框 */}
                          <div className="flex items-center gap-2">
                            <Icon className="w-5 h-5 text-muted-foreground" />
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={score}
                              onChange={(e) => {
                                const val = Math.min(100, Math.max(0, Number(e.target.value) || 0))
                                updateScore(brand.id, selectedJudge, currentJudge.dimension, val)
                              }}
                              className="input-field w-20 text-center text-lg font-bold py-2"
                              placeholder="0"
                            />
                            <span className="text-sm text-muted-foreground">/ 100</span>
                          </div>
                          
                          {/* 删除按钮 */}
                          <button
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-400/10 transition-all"
                            onClick={() => deleteBrand(brand.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* 排行榜看板 - 简洁表格式 */}
          {activeTab === 'ranking' && (
            <div className="max-w-6xl mx-auto animate-fade-in">
              {rankedBrands.length === 0 ? (
                <div className="glass-card p-12 text-center">
                  <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">暂无排名数据</p>
                </div>
              ) : (
                <div className="glass-card overflow-hidden">
                  {/* 表头 */}
                  <div className="grid grid-cols-12 gap-2 p-3 bg-muted/30 text-xs font-semibold text-muted-foreground border-b border-border">
                    <div className="col-span-1 text-center">排名</div>
                    <div className="col-span-4">品牌名称</div>
                    <div className="col-span-2 text-center">AI战略</div>
                    <div className="col-span-2 text-center">AI获客</div>
                    <div className="col-span-2 text-center">AI私域</div>
                    <div className="col-span-1 text-center">总分</div>
                  </div>
                  
                  {/* 数据行 */}
                  {rankedBrands.map((brand, index) => {
                    const rank = index + 1
                    const totalScore = getTotalScore(brand)
                    const strategyScore = getDimensionScore(brand, 'strategy')
                    const acquisitionScore = getDimensionScore(brand, 'acquisition')
                    const privateScore = getDimensionScore(brand, 'private')
                    
                    return (
                      <div
                        key={brand.id}
                        className={`grid grid-cols-12 gap-2 p-3 items-center border-b border-border/50 last:border-b-0 hover:bg-muted/20 transition-all animate-slide-up ${rank <= 3 ? 'bg-gradient-to-r' : ''} ${rank === 1 ? 'from-gold/10 to-transparent' : rank === 2 ? 'from-silver/10 to-transparent' : rank === 3 ? 'from-bronze/10 to-transparent' : ''}`}
                        style={{ animationDelay: `${index * 30}ms` }}
                      >
                        {/* 排名 */}
                        <div className="col-span-1 flex justify-center">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${rank === 1 ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-yellow-900' : rank === 2 ? 'bg-gradient-to-br from-gray-300 to-gray-500 text-gray-900' : rank === 3 ? 'bg-gradient-to-br from-orange-400 to-orange-600 text-orange-900' : 'bg-muted text-muted-foreground'}`}>
                            {rank}
                          </div>
                        </div>
                        
                        {/* 品牌名称 */}
                        <div className="col-span-4 font-semibold truncate">{brand.name}</div>
                        
                        {/* 三维度分数 */}
                        <div className="col-span-2 text-center">
                          <span className="inline-block px-2 py-1 rounded bg-purple-500/20 text-purple-300 font-mono font-bold text-sm">{strategyScore}</span>
                        </div>
                        <div className="col-span-2 text-center">
                          <span className="inline-block px-2 py-1 rounded bg-cyan-500/20 text-cyan-300 font-mono font-bold text-sm">{acquisitionScore}</span>
                        </div>
                        <div className="col-span-2 text-center">
                          <span className="inline-block px-2 py-1 rounded bg-orange-500/20 text-orange-300 font-mono font-bold text-sm">{privateScore}</span>
                        </div>
                        
                        {/* 总分 */}
                        <div className="col-span-1 text-center">
                          <span className="font-bold text-lg gradient-text">{totalScore}</span>
                        </div>
                      </div>
                    )
                  })}
                  
                  {/* 底部说明 */}
                  <div className="p-3 bg-muted/20 text-xs text-muted-foreground text-center">
                    总分 = AI战略 + AI获客 + AI私域，满分300
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* 新建期数弹窗 */}
      {showNewEpisodeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowNewEpisodeModal(false)}>
          <div className="glass-card p-6 w-full max-w-md animate-scale-in" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              新建期数
            </h3>
            <input
              type="text"
              className="input-field mb-4"
              placeholder="例如：第一期、2024年1月..."
              value={newEpisodeName}
              onChange={(e) => setNewEpisodeName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && createEpisode()}
              autoFocus
            />
            <div className="flex gap-3 justify-end">
              <button className="btn-secondary" onClick={() => setShowNewEpisodeModal(false)}>取消</button>
              <button className="btn-primary" onClick={createEpisode}>创建</button>
            </div>
          </div>
        </div>
      )}

      {/* 编辑期数弹窗 */}
      {editingEpisode && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setEditingEpisode(null)}>
          <div className="glass-card p-6 w-full max-w-md animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Pencil className="w-5 h-5 text-primary" />
                编辑期数
              </h3>
              <button 
                className="p-1 rounded-lg hover:bg-muted/50 text-muted-foreground"
                onClick={() => setEditingEpisode(null)}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <input
              type="text"
              className="input-field mb-4"
              placeholder="输入期数名称..."
              value={editEpisodeName}
              onChange={(e) => setEditEpisodeName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && updateEpisode()}
              autoFocus
            />
            <div className="flex gap-3 justify-end">
              <button className="btn-secondary" onClick={() => setEditingEpisode(null)}>取消</button>
              <button className="btn-primary" onClick={updateEpisode}>保存</button>
            </div>
          </div>
        </div>
      )}

      {/* 删除期数确认弹窗 */}
      {deletingEpisode && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setDeletingEpisode(null)}>
          <div className="glass-card p-6 w-full max-w-md animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-400" />
              </div>
              <h3 className="text-lg font-bold">确认删除</h3>
            </div>
            <p className="text-muted-foreground mb-6">
              确定要删除「<span className="text-foreground font-medium">{deletingEpisode.name}</span>」吗？<br />
              该期所有品牌数据也将被删除，此操作不可恢复。
            </p>
            <div className="flex gap-3 justify-end">
              <button className="btn-secondary" onClick={() => setDeletingEpisode(null)}>取消</button>
              <button 
                className="px-4 py-2 rounded-xl font-semibold bg-red-500 hover:bg-red-600 text-white transition-all"
                onClick={() => deleteEpisode(deletingEpisode)}
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App

