import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://bmqdlhxboorvespqqedm.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJtcWRsaHhib29ydmVzcHFxZWRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwMjI0MjMsImV4cCI6MjA4NTU5ODQyM30.aBQjFJIH3zHYKAzEVeLdvEWBHPAL_fUDICMoKl7kD1Q'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// 数据库类型定义
export interface Episode {
  id: string
  name: string
  created_at: string
  is_active: boolean
}

export interface Brand {
  id: string
  episode_id: string
  name: string
  scores: {
    judge1: { strategy: number; acquisition: number; private: number }
    judge2: { strategy: number; acquisition: number; private: number }
    judge3: { strategy: number; acquisition: number; private: number }
  }
}

// Episode 相关操作
export const episodeApi = {
  // 获取所有期数
  async getAll(): Promise<Episode[]> {
    const { data, error } = await supabase
      .from('episodes')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw error
    return data || []
  },
  
  // 创建新期数
  async create(name: string): Promise<Episode> {
    // 先将其他期设为非活跃
    await supabase.from('episodes').update({ is_active: false }).eq('is_active', true)
    
    const { data, error } = await supabase
      .from('episodes')
      .insert({ name, is_active: true })
      .select()
      .single()
    if (error) throw error
    return data
  },
  
  // 切换活跃期
  async setActive(id: string): Promise<void> {
    await supabase.from('episodes').update({ is_active: false }).eq('is_active', true)
    const { error } = await supabase.from('episodes').update({ is_active: true }).eq('id', id)
    if (error) throw error
  },
  
  // 删除期数
  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('episodes').delete().eq('id', id)
    if (error) throw error
  }
}

// Brand 相关操作
export const brandApi = {
  // 获取某期所有品牌
  async getByEpisode(episodeId: string): Promise<Brand[]> {
    const { data, error } = await supabase
      .from('brands')
      .select('*')
      .eq('episode_id', episodeId)
    if (error) throw error
    return data || []
  },
  
  // 添加品牌
  async create(episodeId: string, name: string): Promise<Brand> {
    const defaultScores = {
      judge1: { strategy: 0, acquisition: 0, private: 0 },
      judge2: { strategy: 0, acquisition: 0, private: 0 },
      judge3: { strategy: 0, acquisition: 0, private: 0 },
    }
    const { data, error } = await supabase
      .from('brands')
      .insert({ episode_id: episodeId, name, scores: defaultScores })
      .select()
      .single()
    if (error) throw error
    return data
  },
  
  // 更新品牌分数
  async updateScores(id: string, scores: Brand['scores']): Promise<void> {
    const { error } = await supabase
      .from('brands')
      .update({ scores })
      .eq('id', id)
    if (error) throw error
  },
  
  // 删除品牌
  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('brands').delete().eq('id', id)
    if (error) throw error
  }
}
