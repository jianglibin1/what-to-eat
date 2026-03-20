import { useState, useEffect } from 'react'

const HARDcoded_AMAP_KEY = '813c103982fabded232c064002c01245'

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
  const [decideResult, setDecideResult] = useState<Restaurant | null>(null)
  const [isRolling, setIsRolling] = useState(false)
  const [showResult, setShowResult] = useState(false)
  const [copied, setCopied] = useState('')
  const [savedList, setSavedList] = useState<Restaurant[]>([])
  const [filterDistance, setFilterDistance] = useState('0')

  const intervalRef = { current: null as ReturnType<typeof setInterval> | null }

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem('saved_restaurants') || '[]')
    setSavedList(saved)
  }, [])

  const getKey = () => HARDcoded_AMAP_KEY

  const getLocation = () => {
    setLoading(true)
    setError('')
    if (!navigator.geolocation) {
      setLoading(false)
      setError('浏览器不支持定位')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        setLocationInfo({ lat, lng })
        setHasLocation(true)
        setLoading(false)
        searchNearby(lat, lng, '', '')
      },
      () => {
        const defaultLng = 120.1551
        const defaultLat = 30.2741
        setLocationInfo({ lat: defaultLat, lng: defaultLng })
        setHasLocation(true)
        setLoading(false)
        searchNearby(defaultLat, defaultLng, '', '')
      }
    )
  }

  const searchNearby = (lat: number, lng: number, kw: string, type: string) => {
    const key = getKey()
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
        if (pois.length === 0) setError('附近没有找到商家，试试扩大范围或换个位置')
      })
      .catch(() => { setLoading(false); setError('网络请求失败') })
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
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-md mx-auto">
      {/* 顶部 */}
      <div className="bg-gradient-to-r from-orange-400 to-amber-400 text-white px-4 pt-10 pb-4 flex-shrink-0">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold">🍜 附近吃什么</h1>
            <p className="text-xs opacity-80 mt-0.5">帮你找附近的店</p>
          </div>
        </div>

        <div className="mt-3 flex gap-2">
          <input
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="搜索店名，如：黄焖鸡..."
            className="flex-1 bg-white/90 text-gray-700 text-sm rounded-xl px-3 py-2.5 outline-none placeholder-gray-400"
          />
          <button
            onClick={handleSearch}
            disabled={loading}
            className="bg-white text-orange-400 font-bold text-base px-4 py-2.5 rounded-xl disabled:opacity-50 min-w-[52px]"
          >
            {loading ? '...' : '🔍'}
          </button>
        </div>

        <div className="mt-2.5 overflow-x-auto">
          <div className="flex gap-1.5 w-max">
            {CUISINE_TYPES.map(c => (
              <button
                key={c.value}
                onClick={() => setCuisineType(c.value)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all ${cuisineType === c.value ? 'bg-white text-orange-400 shadow' : 'bg-white/20 text-white/80'}`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-2 flex items-center gap-2">
          <span className="text-xs text-white/70">范围：</span>
          {['1000', '2000', '3000', '5000'].map(r => (
            <button
              key={r}
              onClick={() => { setRadius(r); handleSearch() }}
              className={`text-sm px-2 py-1 rounded-full transition-all ${radius === r ? 'bg-white text-orange-400' : 'text-white/70 bg-white/20'}`}
            >
              {Number(r) / 1000}km
            </button>
          ))}
        </div>
      </div>

      {/* 内容 */}
      <div className="flex-1 overflow-y-auto pb-24">
        {tab === 'nearby' && (
          <div className="p-3">
            {!hasLocation && !loading && (
              <div className="text-center py-10">
                <div className="text-6xl mb-4">📍</div>
                <p className="text-gray-500 text-base mb-4">获取你的位置来搜索附近商家</p>
                <button onClick={getLocation} className="bg-gradient-to-r from-orange-400 to-amber-400 text-white px-10 py-4 rounded-2xl font-bold text-lg shadow-lg">
                  📍 获取位置
                </button>
              </div>
            )}

            {loading && (
              <div className="text-center py-10">
                <div className="text-5xl animate-bounce mb-3">🔍</div>
                <p className="text-gray-400 text-sm">搜索中...</p>
              </div>
            )}

            {error && !loading && (
              <div className="text-center py-8">
                <div className="text-5xl mb-3">😢</div>
                <p className="text-gray-400 text-sm">{error}</p>
              </div>
            )}

            {results.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-gray-500">找到 <span className="text-orange-400 font-bold">{results.length}</span> 家</p>
                  <select value={filterDistance} onChange={e => setFilterDistance(e.target.value)} className="text-sm border border-gray-200 rounded-xl px-3 py-1.5 text-gray-500 bg-white">
                    <option value="0">全部</option>
                    <option value="1000">1km内</option>
                    <option value="2000">2km内</option>
                    <option value="3000">3km内</option>
                  </select>
                </div>

                {filteredResults.length === 0 && <p className="text-center text-gray-400 text-sm py-4">没有符合条件的商家</p>}

                <div className="space-y-2.5">
                  {filteredResults.map(r => (
                    <div key={r.id} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-gray-800 text-base truncate">{r.name}</div>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-sm text-orange-400 bg-orange-50 px-2.5 py-0.5 rounded-full">{r.type}</span>
                            <span className={`text-sm font-medium ${distanceColor(r.distance)}`}>📍 {r.distance}</span>
                          </div>
                          <div className="text-sm text-gray-400 mt-1 truncate">{r.address}</div>
                        </div>
                        <button onClick={() => saveToList(r)} className="text-gray-300 hover:text-orange-400 text-2xl px-1 flex-shrink-0 transition-colors">☆</button>
                      </div>
                      <div className="flex gap-2.5 mt-3">
                        <button onClick={() => copyAndJump(r, 'meituan')} className={`flex-1 text-base py-3 rounded-xl font-semibold transition-all ${copied === r.id ? 'bg-green-100 text-green-500' : 'bg-orange-50 text-orange-400 active:bg-orange-100'}`}>
                          {copied === r.id ? '✅ 已复制' : '📋 美团下单'}
                        </button>
                        <button onClick={() => copyAndJump(r, 'ele')} className="flex-1 text-base py-3 rounded-xl font-semibold bg-blue-50 text-blue-400 active:bg-blue-100 transition-all">
                          🟠 饿了么
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'decide' && (
          <div className="p-4 flex flex-col min-h-full">
            <h2 className="text-lg font-bold text-gray-700 mb-1">🎲 随机决定</h2>
            <p className="text-sm text-gray-400 mb-4">从 {filteredResults.length} 家店中随机选择</p>

            {showResult && decideResult && (
              <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl p-6 text-center mb-4">
                <div className="text-6xl mb-2">🍱</div>
                <div className="text-2xl font-bold text-gray-800">{decideResult.name}</div>
                <div className="flex justify-center gap-3 mt-2">
                  <span className="text-sm text-orange-400 bg-orange-100 px-3 py-1 rounded-full">{decideResult.type}</span>
                  <span className="text-sm text-gray-400">{decideResult.address}</span>
                </div>
                <div className="flex gap-2.5 mt-4">
                  <button onClick={() => copyAndJump(decideResult, 'meituan')} className="flex-1 bg-orange-400 text-white py-3.5 rounded-xl text-base font-bold">
                    📋 美团下单
                  </button>
                  <button onClick={() => copyAndJump(decideResult, 'ele')} className="flex-1 bg-blue-400 text-white py-3.5 rounded-xl text-base font-bold">
                    🟠 饿了么
                  </button>
                </div>
              </div>
            )}

            <div className="mt-auto">
              <button
                onClick={decide}
                disabled={isRolling || filteredResults.length === 0}
                className="w-full py-7 rounded-2xl bg-gradient-to-r from-orange-400 via-amber-400 to-orange-400 text-white text-2xl font-bold shadow-xl disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-transform"
              >
                {isRolling ? '🌀 决定中...' : '🎲 开始决定！'}
              </button>
              {filteredResults.length === 0 && (
                <p className="text-center text-sm text-gray-400 mt-3">先去「附近」搜索商家后再使用</p>
              )}
            </div>
          </div>
        )}

        {tab === 'saved' && (
          <div className="p-3">
            <h2 className="text-lg font-bold text-gray-700 mb-3">⭐ 收藏列表</h2>
            {savedList.length === 0 ? (
              <div className="text-center py-14">
                <div className="text-6xl mb-3">☆</div>
                <p className="text-gray-400 text-base">还没有收藏的店</p>
                <p className="text-gray-300 text-sm mt-1">搜索结果点「☆」收藏</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {savedList.map(r => (
                  <div key={r.id} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                    <div className="font-bold text-gray-800 text-base">{r.name}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm text-orange-400 bg-orange-50 px-2.5 py-0.5 rounded-full">{r.type}</span>
                      <span className="text-sm text-gray-400">{r.address}</span>
                    </div>
                    <div className="flex gap-2.5 mt-3">
                      <button onClick={() => copyAndJump(r, 'meituan')} className="flex-1 bg-orange-50 text-orange-400 py-3 rounded-xl text-base font-semibold">
                        📋 美团下单
                      </button>
                      <button onClick={() => copyAndJump(r, 'ele')} className="flex-1 bg-blue-50 text-blue-400 py-3 rounded-xl text-base font-semibold">
                        🟠 饿了么
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 底部 Tab */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-gray-100 flex max-w-md mx-auto z-50 shadow-lg">
        {[
          { key: 'nearby' as Tab, icon: '🔍', label: '附近' },
          { key: 'decide' as Tab, icon: '🎲', label: '决定' },
          { key: 'saved' as Tab, icon: '⭐', label: '收藏' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 flex flex-col items-center py-4 gap-1.5 transition-colors relative ${tab === t.key ? 'text-orange-400' : 'text-gray-400'}`}
          >
            <span className="text-2xl">{t.icon}</span>
            <span className="text-base font-semibold">{t.label}</span>
            {tab === t.key && <div className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-orange-400 rounded-full" />}
          </button>
        ))}
      </div>
    </div>
  )
}
