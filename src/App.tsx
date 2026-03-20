import { useState, useEffect, useRef } from 'react'

// ============================================================
// 高德地图 API Key（用户可自行替换）
// 申请地址：https://lbs.amap.com/
// 免费额度：每天 5000 次调用
// ============================================================
const AMAP_KEY = '0e5ae49f5ee73a959a80ef4da21ef06c' // 示例Key，请替换为你的
const AMAP_KEY_INPUT_KEY = 'amap_user_key'

// 搜索类型
const CUISINE_TYPES = [
  { label: '全部', value: '' },
  { label: '中餐', value: '050000' },
  { label: '快餐', value: '050100' },
  { label: '火锅', value: '050200' },
  { label: '烧烤', value: '050300' },
  { label: '川菜', value: '050400' },
  { label: '面馆', value: '050500' },
  { label: '日料', value: '080000' },
  { label: '西餐', value: '090000' },
  { label: '韩餐', value: '100000' },
  { label: '小吃', value: '150000' },
  { label: '甜品', value: '200000' },
]

interface Restaurant {
  id: string
  name: string
  address: string
  distance: string
  type: string
  location: string
  tel?: string
}

type Tab = 'nearby' | 'decide' | 'saved'

export default function App() {
  const [tab, setTab] = useState<Tab>('nearby')
  const [keyword, setKeyword] = useState('')
  const [cuisineType, setCuisineType] = useState('')
  const [radius, setRadius] = useState('3000')
  const [results, setResults] = useState<Restaurant[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [hasLocation, setHasLocation] = useState(false)
  const [locationInfo, setLocationInfo] = useState<{ lat: number; lng: number } | null>(null)
  const [userKey, setUserKey] = useState('')
  const [showKeyModal, setShowKeyModal] = useState(false)
  const [decideResult, setDecideResult] = useState<Restaurant | null>(null)
  const [isRolling, setIsRolling] = useState(false)
  const [showResult, setShowResult] = useState(false)
  const [copied, setCopied] = useState('')
  const [savedList, setSavedList] = useState<Restaurant[]>([])
  const [filterDistance, setFilterDistance] = useState('0')
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // 加载保存的Key
  useEffect(() => {
    const saved = localStorage.getItem(AMAP_KEY_INPUT_KEY)
    if (saved) setUserKey(saved)
  }, [])

  // 获取定位
  const getLocation = () => {
    if (!navigator.geolocation) {
      setError('浏览器不支持定位')
      return
    }
    setLoading(true)
    setError('')
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        setLocationInfo({ lat, lng })
        setHasLocation(true)
        setLoading(false)
        // 立即搜索附近商家
        searchNearby(lat, lng, '', '')
      },
      (err) => {
        setError('定位失败，请开启位置权限')
        setLoading(false)
        // 用默认地址试一下
        const defaultLng = 120.1551
        const defaultLat = 30.2741
        setLocationInfo({ lat: defaultLat, lng: defaultLng })
        setHasLocation(true)
        searchNearby(defaultLat, defaultLng, '', '')
      }
    )
  }

  // 搜索附近商家
  const searchNearby = (lat: number, lng: number, kw: string, type: string) => {
    const key = userKey || AMAP_KEY
    if (!key || key === '0e5ae49f5ee73a959a80ef4da21ef06c') {
      setError('请先填写高德API Key（点击右上角设置）')
      setResults([])
      return
    }
    setLoading(true)
    setError('')
    setResults([])

    const params = new URLSearchParams({
      key,
      location: `${lng},${lat}`,
      keywords: kw || '餐饮,餐厅,美食',
      types: type,
      radius: radius,
      offset: '20',
      page: '1',
      extensions: 'all',
      output: 'JSON',
    })

    fetch(`https://restapi.amap.com/v3/place/around?${params}`)
      .then(r => r.json())
      .then(data => {
        setLoading(false)
        if (data.status === '0') {
          setError(data.info || '查询失败')
          return
        }
        const pois: Restaurant[] = (data.pois || []).map((p: any) => ({
          id: p.id,
          name: p.name,
          address: p.address || '暂无地址',
          distance: formatDist(p.distance),
          type: p.type.split(';')[1] || p.type.split(';')[0] || '餐饮',
          location: p.location,
          tel: p.tel,
        }))
        setResults(pois)
        if (pois.length === 0) setError('附近没有找到商家，试试扩大范围')
      })
      .catch(() => {
        setLoading(false)
        setError('网络请求失败')
      })
  }

  const formatDist = (d: string) => {
    const n = Number(d)
    if (!n) return d
    return n >= 1000 ? `${(n / 1000).toFixed(1)}km` : `${n}m`
  }

  const handleSearch = () => {
    if (!locationInfo) return
    searchNearby(locationInfo.lat, locationInfo.lng, keyword, cuisineType)
  }

  const saveKey = () => {
    if (userKey.trim()) {
      localStorage.setItem(AMAP_KEY_INPUT_KEY, userKey.trim())
      setShowKeyModal(false)
      if (hasLocation && locationInfo) {
        searchNearby(locationInfo.lat, locationInfo.lng, keyword, cuisineType)
      }
    }
  }

  const copyAndJump = (r: Restaurant, platform: 'meituan' | 'ele') => {
    navigator.clipboard.writeText(r.name).catch(() => {})
    setCopied(r.id)
    setTimeout(() => setCopied(''), 1500)
    const encoded = encodeURIComponent(r.name)
    const url = platform === 'meituan'
      ? `https://i.waimai.meituan.com/search?keyword=${encoded}`
      : `https://h5.ele.me/search#/search?keyword=${encoded}`
    window.open(url, '_blank')
  }

  const saveToList = (r: Restaurant) => {
    const saved = JSON.parse(localStorage.getItem('saved_restaurants') || '[]')
    if (!saved.find((s: any) => s.id === r.id)) {
      const updated = [r, ...saved]
      localStorage.setItem('saved_restaurants', JSON.stringify(updated))
      setSavedList(updated)
    }
  }

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem('saved_restaurants') || '[]')
    setSavedList(saved)
  }, [])

  const decide = () => {
    if (filteredResults.length === 0) return
    setIsRolling(true)
    setShowResult(false)
    setDecideResult(null)
    let count = 0
    const max = 20 + Math.floor(Math.random() * 15)
    intervalRef.current = setInterval(() => {
      const rand = filteredResults[Math.floor(Math.random() * filteredResults.length)]
      setDecideResult(rand)
      count++
      if (count > max) {
        clearInterval(intervalRef.current!)
        setIsRolling(false)
        setShowResult(true)
      }
    }, 80)
  }

  const filteredResults = results.filter(r => {
    if (!filterDistance || filterDistance === '0') return true
    const d = Number(r.distance)
    if (filterDistance === '1000') return d <= 1000
    if (filterDistance === '2000') return d <= 2000
    if (filterDistance === '3000') return d <= 3000
    return true
  })

  const distanceColor = (dist: string) => {
    const n = Number(dist)
    if (dist.includes('km')) return 'text-green-500'
    if (n < 500) return 'text-green-500'
    if (n < 1000) return 'text-orange-500'
    return 'text-red-500'
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 max-w-md mx-auto relative">
      <div className="flex flex-col min-h-screen bg-white relative overflow-hidden shadow-2xl">

        {/* 顶部 */}
        <div className="bg-gradient-to-r from-orange-400 to-amber-400 text-white px-4 py-4 flex-shrink-0">
          <div className="flex items-center justify-between mb-1">
            <div>
              <h1 className="text-xl font-bold">🍜 附近吃什么</h1>
              <p className="text-xs opacity-80 mt-0.5">帮你找附近的店</p>
            </div>
            <button
              onClick={() => setShowKeyModal(true)}
              className="text-xs bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-full transition-colors"
            >
              ⚙️ API设置
            </button>
          </div>

          {/* 搜索框 */}
          <div className="mt-3 flex gap-2">
            <input
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="想找什么吃的？如：黄焖鸡、火锅..."
              className="flex-1 bg-white/90 text-gray-700 text-sm rounded-xl px-3 py-2.5 outline-none placeholder-gray-400"
            />
            <button
              onClick={handleSearch}
              disabled={loading}
              className="bg-white text-orange-400 font-bold text-sm px-4 py-2.5 rounded-xl disabled:opacity-50"
            >
              {loading ? '...' : '搜索'}
            </button>
          </div>

          {/* 类型筛选 */}
          <div className="mt-2.5 overflow-x-auto">
            <div className="flex gap-1.5 w-max">
              {CUISINE_TYPES.map(c => (
                <button
                  key={c.value}
                  onClick={() => setCuisineType(c.value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${cuisineType === c.value ? 'bg-white text-orange-400 shadow' : 'bg-white/20 text-white/80'}`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* 范围 */}
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-white/70">范围：</span>
            {['1000', '2000', '3000', '5000'].map(r => (
              <button
                key={r}
                onClick={() => { setRadius(r); handleSearch() }}
                className={`text-xs px-2 py-1 rounded-full transition-all ${radius === r ? 'bg-white text-orange-400' : 'text-white/70 bg-white/20'}`}
              >
                {Number(r) / 1000}km
              </button>
            ))}
          </div>
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-y-auto pb-20">
          {/* 定位状态 */}
          {!hasLocation && !loading && (
            <div className="p-4 text-center">
              <div className="text-5xl mb-3">📍</div>
              <p className="text-gray-500 text-sm mb-1">需要获取你的位置</p>
              <p className="text-gray-400 text-xs mb-4">才能搜索附近的餐厅</p>
              <button
                onClick={getLocation}
                className="bg-gradient-to-r from-orange-400 to-amber-400 text-white px-8 py-3 rounded-xl font-semibold shadow-lg"
              >
                📍 获取位置并搜索
              </button>
            </div>
          )}

          {loading && (
            <div className="p-8 text-center">
              <div className="text-4xl animate-bounce mb-2">🔍</div>
              <p className="text-gray-400 text-sm">搜索附近商家中...</p>
            </div>
          )}

          {error && !loading && (
            <div className="p-4 text-center">
              <div className="text-4xl mb-2">⚠️</div>
              <p className="text-gray-400 text-sm">{error}</p>
              {error.includes('Key') && (
                <button onClick={() => setShowKeyModal(true)} className="mt-2 text-orange-400 text-sm underline">
                  去设置API Key
                </button>
              )}
            </div>
          )}

          {/* 结果列表 */}
          {results.length > 0 && (
            <div className="p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-gray-400">
                  找到 <span className="text-orange-400 font-bold">{results.length}</span> 家
                </p>
                <select
                  value={filterDistance}
                  onChange={e => setFilterDistance(e.target.value)}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1 text-gray-500"
                >
                  <option value="0">全部距离</option>
                  <option value="1000">1km内</option>
                  <option value="2000">2km内</option>
                  <option value="3000">3km内</option>
                </select>
              </div>

              {filteredResults.length === 0 && (
                <p className="text-center text-gray-400 text-sm py-4">没有符合条件的商家</p>
              )}

              <div className="space-y-2.5">
                {filteredResults.map(r => (
                  <div key={r.id} className="bg-white rounded-xl border border-gray-100 p-3.5 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-gray-800 text-sm truncate">{r.name}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-orange-400 bg-orange-50 px-2 py-0.5 rounded-full">{r.type}</span>
                          <span className={`text-xs font-medium ${distanceColor(r.distance)}`}>
                            📍 {r.distance}
                          </span>
                        </div>
                        <div className="text-xs text-gray-400 mt-1 truncate">{r.address}</div>
                      </div>

                      <div className="flex flex-col gap-1 items-end flex-shrink-0">
                        <button
                          onClick={() => saveToList(r)}
                          className="text-xs text-gray-400 hover:text-orange-400 transition-colors px-2"
                          title="收藏"
                        >
                          ☆
                        </button>
                      </div>
                    </div>

                    {/* 快捷操作 */}
                    <div className="flex gap-2 mt-2.5">
                      <button
                        onClick={() => copyAndJump(r, 'meituan')}
                        className={`flex-1 text-xs py-2 rounded-lg font-medium transition-all ${copied === r.id ? 'bg-green-100 text-green-500' : 'bg-orange-50 text-orange-400 hover:bg-orange-100'}`}
                      >
                        {copied === r.id ? '✅ 已复制' : '📋 美团下单'}
                      </button>
                      <button
                        onClick={() => copyAndJump(r, 'ele')}
                        className="flex-1 text-xs py-2 rounded-lg font-medium bg-blue-50 text-blue-400 hover:bg-blue-100 transition-all"
                      >
                        🟠 饿了么下单
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 底部 Tab */}
        <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex max-w-md mx-auto shadow-lg">
          {[
            { key: 'nearby' as Tab, icon: '🔍', label: '附近' },
            { key: 'decide' as Tab, icon: '🎲', label: '决定' },
            { key: 'saved' as Tab, icon: '⭐', label: '收藏' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 flex flex-col items-center py-3 gap-0.5 transition-colors relative ${tab === t.key ? 'text-orange-400' : 'text-gray-300'}`}
            >
              <span className="text-xl">{t.icon}</span>
              <span className="text-xs font-medium">{t.label}</span>
              {tab === t.key && <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-orange-400 rounded-full" />}
            </button>
          ))}
        </div>

        {/* ===== 决定页 ===== */}
        {tab === 'decide' && (
          <div className="absolute inset-0 bg-white z-10 flex flex-col p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-gray-700">🎲 随机决定</h2>
              <button onClick={() => setTab('nearby')} className="text-gray-400 text-xl">✕</button>
            </div>
            <p className="text-xs text-gray-400 mb-3">从当前 {filteredResults.length} 家店中随机选择</p>

            {showResult && decideResult && (
              <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl p-5 text-center mb-4 animate-result">
                <div className="text-5xl mb-2">{(decideResult as any).emoji || '🍱'}</div>
                <div className="text-xl font-bold text-gray-800">{decideResult.name}</div>
                <div className="flex justify-center gap-3 mt-2">
                  <span className="text-xs text-orange-400 bg-orange-100 px-2 py-0.5 rounded-full">{decideResult.type}</span>
                  <span className="text-xs text-gray-400">{decideResult.address}</span>
                </div>
                <div className="flex gap-2 mt-4">
                  <button onClick={() => copyAndJump(decideResult, 'meituan')} className="flex-1 bg-orange-400 text-white py-2.5 rounded-xl text-sm font-semibold">
                    📋 美团下单
                  </button>
                  <button onClick={() => copyAndJump(decideResult, 'ele')} className="flex-1 bg-blue-400 text-white py-2.5 rounded-xl text-sm font-semibold">
                    🟠 饿了么下单
                  </button>
                </div>
              </div>
            )}

            <div className="mt-auto">
              <button
                onClick={decide}
                disabled={isRolling || filteredResults.length === 0}
                className="w-full py-5 rounded-2xl bg-gradient-to-r from-orange-400 via-amber-400 to-orange-400 text-white text-xl font-bold shadow-xl disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all"
              >
                {isRolling ? '🌀 决定中...' : '🎲 开始决定！'}
              </button>
              {filteredResults.length === 0 && (
                <p className="text-center text-xs text-gray-400 mt-2">先在「附近」搜索商家后再使用</p>
              )}
            </div>
          </div>
        )}

        {/* ===== 收藏页 ===== */}
        {tab === 'saved' && (
          <div className="absolute inset-0 bg-white z-10 flex flex-col">
            <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-700">⭐ 我的收藏</h2>
              <button onClick={() => setTab('nearby')} className="text-gray-400 text-xl">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              {savedList.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-5xl mb-3">☆</div>
                  <p className="text-gray-400 text-sm">还没有收藏的店</p>
                  <p className="text-gray-300 text-xs mt-1">搜索结果点「☆」收藏</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {savedList.map(r => (
                    <div key={r.id} className="bg-white rounded-xl border border-gray-100 p-3.5 shadow-sm">
                      <div className="font-bold text-gray-800 text-sm">{r.name}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-orange-400 bg-orange-50 px-2 py-0.5 rounded-full">{r.type}</span>
                        <span className="text-xs text-gray-400">{r.address}</span>
                      </div>
                      <div className="flex gap-2 mt-2">
                        <button onClick={() => copyAndJump(r, 'meituan')} className="flex-1 bg-orange-50 text-orange-400 py-2 rounded-lg text-xs font-medium">
                          📋 美团下单
                        </button>
                        <button onClick={() => copyAndJump(r, 'ele')} className="flex-1 bg-blue-50 text-blue-400 py-2 rounded-lg text-xs font-medium">
                          🟠 饿了么下单
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* API Key 设置弹窗 */}
        {showKeyModal && (
          <div className="absolute inset-0 bg-black/40 z-50 flex items-end">
            <div className="bg-white w-full rounded-t-3xl p-5 animate-slideUp">
              <div className="w-12 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
              <h3 className="text-base font-bold text-gray-800 mb-1">⚙️ 高德地图 API Key</h3>
              <p className="text-xs text-gray-400 mb-4">
                申请地址：<a href="https://lbs.amap.com/" target="_blank" className="text-orange-400 underline">lbs.amap.com</a>
                <br />免费额度：每天5000次，个人用绑绑够
              </p>
              <input
                value={userKey}
                onChange={e => setUserKey(e.target.value)}
                placeholder="请输入高德 API Key"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-orange-300"
              />
              <div className="flex gap-2 mt-3">
                <button onClick={() => setShowKeyModal(false)} className="flex-1 py-2.5 rounded-xl text-gray-400 text-sm">取消</button>
                <button onClick={saveKey} className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-orange-400 to-amber-400 text-white text-sm font-semibold">
                  保存并搜索
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes resultPop {
          0% { transform: scale(0.8); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-result { animation: resultPop 0.4s ease-out; }
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-slideUp { animation: slideUp 0.3s ease-out; }
      `}</style>
    </div>
  )
}
