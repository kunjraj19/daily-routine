import React, { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { 
  Lock, LogOut, Settings, Save, AlertCircle, Sparkles, CheckCircle2, 
  Coffee, Utensils, Moon, Candy, CupSoda, Calendar
} from 'lucide-react'
import { 
  ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis, Tooltip, 
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar 
} from 'recharts'

const sha256 = async (string) => {
  const utf8 = new TextEncoder().encode(string)
  const hashBuffer = await crypto.subtle.digest('SHA-256', utf8)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map((bytes) => bytes.toString(16).padStart(2, '0')).join('')
  return hashHex
}

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('app_token') || '')
  const [role, setRole] = useState(localStorage.getItem('app_role') || '')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [showSettings, setShowSettings] = useState(false)
  const [alert, setAlert] = useState(null)
  
  const [meals, setMeals] = useState({
    breakfast: '',
    lunch: '',
    dinner: '',
    snack: '',
    juice: ''
  })
  
  const [loggedMeals, setLoggedMeals] = useState({
    breakfast: [],
    lunch: [],
    dinner: [],
    snack: [],
    juice: []
  })
  
  const [saveStates, setSaveStates] = useState({
    breakfast: 'idle',
    lunch: 'idle',
    dinner: 'idle',
    snack: 'idle',
    juice: 'idle'
  })
  
  const [nutrientData, setNutrientData] = useState([])
  const [microData, setMicroData] = useState([])
  const [aiAnalysis, setAiAnalysis] = useState('')
  const [loadingAi, setLoadingAi] = useState(false)
  const [adminReport, setAdminReport] = useState([])
  
  const [settings, setSettings] = useState({
    openrouter_key: localStorage.getItem('openrouter_key') || '',
    openrouter_model: localStorage.getItem('openrouter_model') || 'google/gemini-2.5-flash',
    user_password: localStorage.getItem('user_password') || '',
    admin_password: localStorage.getItem('admin_password') || '',
    user_weakness: localStorage.getItem('user_weakness') || '',
    supabase_url: import.meta.env.VITE_SUPABASE_URL || localStorage.getItem('supabase_url') || '',
    supabase_key: import.meta.env.VITE_SUPABASE_ANON_KEY || localStorage.getItem('supabase_key') || ''
  })

  useEffect(() => {
    localStorage.setItem('user_password', settings.user_password)
    localStorage.setItem('admin_password', settings.admin_password)
    localStorage.setItem('openrouter_key', settings.openrouter_key)
    localStorage.setItem('openrouter_model', settings.openrouter_model)
    localStorage.setItem('user_weakness', settings.user_weakness)
    localStorage.setItem('supabase_url', settings.supabase_url)
    localStorage.setItem('supabase_key', settings.supabase_key)
  }, [settings])

  const isSupabaseConfigured = !!(settings.supabase_url && settings.supabase_key)

  const getSupabase = () => {
    const url = settings.supabase_url || localStorage.getItem('supabase_url')
    const key = settings.supabase_key || localStorage.getItem('supabase_key')
    if (!url || !key) return null
    return createClient(url, key)
  }

  const loadSupabaseSettings = async (supabase) => {
    if (!supabase) return
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('*')
      if (!error && data) {
        const updates = {}
        data.forEach(row => {
          if (row.key === 'openrouter_key') updates.openrouter_key = row.value
          if (row.key === 'openrouter_model') updates.openrouter_model = row.value
        })
        if (Object.keys(updates).length > 0) {
          setSettings(prev => ({ ...prev, ...updates }))
        }
      }
    } catch (err) {
      console.error("Error loading Supabase settings", err)
    }
  }

  useEffect(() => {
    if (token) {
      const supabase = getSupabase()
      if (supabase) {
        loadSupabaseSettings(supabase)
      }
    }
  }, [token])

  useEffect(() => {
    if (token && role === 'user') {
      loadDayData()
    }
  }, [token, selectedDate, role])

  useEffect(() => {
    if (token && role === 'admin') {
      loadAdminReport()
    }
  }, [token, role])

  const triggerAlert = (type, message) => {
    setAlert({ type, message })
    setTimeout(() => setAlert(null), 4000)
  }

  const getLocalDb = () => {
    const data = localStorage.getItem('meals_db')
    return data ? JSON.parse(data) : []
  }

  const saveLocalDb = (db) => {
    localStorage.setItem('meals_db', JSON.stringify(db))
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    if (!password) return
    const enteredHash = await sha256(password)
    const defaultUserHash = '734a50d580ecbde812d24bf5c17158861df0a70ad0c5718abdd79324e14f1025'
    const defaultAdminHash = '594fa62c44abdf558688108c75141450c625fd9f72185f4248208ea98a92064b'
    
    const customUserPass = settings.user_password
    const customAdminPass = settings.admin_password

    let isUser = false
    let isAdmin = false

    if (customUserPass) {
      isUser = (password === customUserPass)
    } else {
      isUser = (enteredHash === defaultUserHash)
    }

    if (customAdminPass) {
      isAdmin = (password === customAdminPass)
    } else {
      isAdmin = (enteredHash === defaultAdminHash)
    }

    if (isUser) {
      localStorage.setItem('app_token', password)
      localStorage.setItem('app_role', 'user')
      setToken(password)
      setRole('user')
      setLoginError('')
    } else if (isAdmin) {
      localStorage.setItem('app_token', password)
      localStorage.setItem('app_role', 'admin')
      setToken(password)
      setRole('admin')
      setLoginError('')
    } else {
      setLoginError('Invalid credentials')
    }
  }

  const handleResetApp = () => {
    if (window.confirm("This will reset all data and passwords to defaults. Continue?")) {
      localStorage.clear()
      window.location.reload()
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('app_token')
    localStorage.removeItem('app_role')
    setToken('')
    setRole('')
  }

  const loadDayData = async () => {
    let dayMeals = []
    const supabase = getSupabase()
    
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('meals')
          .select('*')
          .eq('date', selectedDate)
          .eq('sports', 'nutrition')
        if (!error && data) {
          dayMeals = data
        }
      } catch (err) {
        console.error("Supabase load error", err)
      }
    } else {
      const db = getLocalDb()
      dayMeals = db.filter(m => m.date === selectedDate)
    }

    const newLoggedMeals = { breakfast: [], lunch: [], dinner: [], snack: [], juice: [] }
    let macros = { calories: 0, protein: 0, carbs: 0, fat: 0 }
    let micros = { vitamin_c: 0, vitamin_d: 0, vitamin_a: 0, calcium: 0, iron: 0 }

    dayMeals.forEach(m => {
      if (m.meal_type in newLoggedMeals) {
        newLoggedMeals[m.meal_type].push(m.food_name)
      }
      macros.calories += m.calories || 0
      macros.protein += m.protein || 0
      macros.carbs += m.carbs || 0
      macros.fat += m.fat || 0

      micros.vitamin_c += m.vitamin_c || 0
      micros.vitamin_d += m.vitamin_d || 0
      micros.vitamin_a += m.vitamin_a || 0
      micros.calcium += m.calcium || 0
      micros.iron += m.iron || 0
    })

    setLoggedMeals(newLoggedMeals)
    
    setNutrientData([
      { name: 'Calories (kcal/10)', value: Math.round(macros.calories / 10) },
      { name: 'Protein (g)', value: Math.round(macros.protein) },
      { name: 'Carbs (g)', value: Math.round(macros.carbs) },
      { name: 'Fat (g)', value: Math.round(macros.fat) }
    ])

    setMicroData([
      { subject: 'Vit C (mg)', A: Math.round(micros.vitamin_c), fullMark: 100 },
      { subject: 'Vit D (mcg)', A: Math.round(micros.vitamin_d * 5), fullMark: 100 },
      { subject: 'Vit A (mcg/10)', A: Math.round(micros.vitamin_a / 10), fullMark: 100 },
      { subject: 'Calcium (mg/10)', A: Math.round(micros.calcium / 10), fullMark: 100 },
      { subject: 'Iron (mg)', A: Math.round(micros.iron * 5), fullMark: 100 }
    ])
    
    setAiAnalysis('')
    if (dayMeals.length > 0) {
      setTimeout(() => {
        runAiAnalysis(selectedDate)
      }, 100)
    }
  }

  const saveMeal = async (type) => {
    if (!meals[type] || !meals[type].trim()) return
    const foodName = meals[type]
    setSaveStates(prev => ({ ...prev, [type]: 'saving' }))
    
    let nutrients = {
      calories: 150.0,
      protein: 5.0,
      carbs: 20.0,
      fat: 5.0,
      vitamin_c: 10.0,
      vitamin_d: 1.0,
      vitamin_a: 50.0,
      calcium: 20.0,
      iron: 1.0
    }

    const key = settings.openrouter_key
    const model = settings.openrouter_model

    if (key && foodName.trim()) {
      try {
        const prompt = `Analyze nutrients for a portion of: ${foodName}. Return strictly valid JSON object with keys: calories (kcal), protein (g), carbs (g), fat (g), vitamin_c (mg), vitamin_d (mcg), vitamin_a (mcg), calcium (mg), iron (mg). No markdown, no comments, no extra text.`
        const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${key}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: model,
            messages: [{ role: "user", content: prompt }]
          })
        })
        if (res.ok) {
          const data = await res.json()
          let content = data.choices[0].message.content.strip ? data.choices[0].message.content.strip() : data.choices[0].message.content.trim()
          if (content.includes("```json")) {
            content = content.split("```json")[1].split("```")[0].trim()
          } else if (content.includes("```")) {
            content = content.split("```")[1].split("```")[0].trim()
          }
          const parsed = JSON.parse(content)
          Object.keys(nutrients).forEach(k => {
            if (k in parsed) {
              nutrients[k] = parseFloat(parsed[k])
            }
          })
        }
      } catch (e) {
        console.error("OpenRouter analysis error", e)
      }
    }

    const newMeal = {
      id: Date.now(),
      date: selectedDate,
      meal_type: type,
      food_name: foodName,
      ...nutrients,
      sports: 'nutrition'
    }

    const supabase = getSupabase()
    if (supabase) {
      try {
        const { id, ...supabaseMeal } = newMeal
        await supabase
          .from('meals')
          .insert([supabaseMeal])
      } catch (err) {
        console.error("Supabase insert error", err)
      }
    } else {
      const db = getLocalDb()
      db.push(newMeal)
      saveLocalDb(db)
    }

    triggerAlert('success', `Saved ${type} successfully!`)
    setMeals(prev => ({ ...prev, [type]: '' }))
    loadDayData()
    setSaveStates(prev => ({ ...prev, [type]: 'saved' }))
    setTimeout(() => {
      setSaveStates(prev => ({ ...prev, [type]: 'idle' }))
    }, 1500)
  }

  const runAiAnalysis = async (customDate) => {
    const activeDate = customDate || selectedDate
    let dayMeals = []
    const supabase = getSupabase()
    
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('meals')
          .select('*')
          .eq('date', activeDate)
          .eq('sports', 'nutrition')
        if (!error && data) {
          dayMeals = data
        }
      } catch (err) {
        console.error("Supabase load error in AI analysis", err)
      }
    } else {
      const db = getLocalDb()
      dayMeals = db.filter(m => m.date === activeDate)
    }
    
    if (dayMeals.length === 0) {
      setAiAnalysis("No meals logged for today yet. Add meals to see analysis.")
      return
    }

    const key = settings.openrouter_key
    const model = settings.openrouter_model

    if (!key) {
      setAiAnalysis("Please configure your OpenRouter API Key in settings to get detailed AI feedback.")
      return
    }

    setLoadingAi(true)

    const mealsSummary = dayMeals.map(m => `${m.meal_type}: ${m.food_name}`).join('\n')
    let totalNutrients = {
      calories: 0, protein: 0, carbs: 0, fat: 0,
      vitamin_c: 0, vitamin_d: 0, vitamin_a: 0, calcium: 0, iron: 0
    }
    dayMeals.forEach(m => {
      Object.keys(totalNutrients).forEach(k => {
        totalNutrients[k] += m[k] || 0
      })
    })

    const weaknessInstruction = settings.user_weakness ? `\nTake into account that the user has the following health conditions/weaknesses: ${settings.user_weakness}. Structure recommendations to specifically address and mitigate these issues.` : ""
    
    const prompt = `Today is ${activeDate}. Here is my food intake for today:
${mealsSummary}

Calculated nutrient totals:
${JSON.stringify(totalNutrients, null, 2)}

Assume the user is a vegetarian from Gujarat, India. Analyze this intake. Point out what was missed, if I lack vitamins or minerals, and give constructive suggestions. Suggestions must be strictly vegetarian and tailored to Indian/Gujarati cuisine. Keep your response bulleted, concise and action-oriented.${weaknessInstruction}`

    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${key}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: model,
          messages: [{ role: "user", content: prompt }]
        })
      })
      if (res.ok) {
        const data = await res.json()
        setAiAnalysis(data.choices[0].message.content)
      } else {
        setAiAnalysis('Analysis service unavailable')
      }
    } catch (err) {
      setAiAnalysis('Network error requesting AI feedback')
    } finally {
      setLoadingAi(false)
    }
  }

  const loadAdminReport = async () => {
    let db = []
    const supabase = getSupabase()

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('meals')
          .select('*')
          .eq('sports', 'nutrition')
        if (!error && data) {
          db = data
        }
      } catch (err) {
        console.error("Supabase report load error", err)
      }
    } else {
      db = getLocalDb()
    }

    const report = {}
    db.forEach(r => {
      const dateStr = r.date
      if (!report[dateStr]) {
        report[dateStr] = {
          date: dateStr,
          meals: [],
          calories: 0.0,
          protein: 0.0,
          carbs: 0.0,
          fat: 0.0,
          vitamin_c: 0.0,
          vitamin_d: 0.0,
          vitamin_a: 0.0,
          calcium: 0.0,
          iron: 0.0
        }
      }
      const day = report[dateStr]
      day.meals.push(`${r.meal_type.toUpperCase()}: ${r.food_name}`)
      day.calories += r.calories || 0.0
      day.protein += r.protein || 0.0
      day.carbs += r.carbs || 0.0
      day.fat += r.fat || 0.0
      day.vitamin_c += r.vitamin_c || 0.0
      day.vitamin_d += r.vitamin_d || 0.0
      day.vitamin_a += r.vitamin_a || 0.0
      day.calcium += r.calcium || 0.0
      day.iron += r.iron || 0.0
    })

    const finalReport = Object.values(report).map(day => {
      const lacking = []
      if (day.calories < 2000) lacking.push("Calories")
      if (day.protein < 50) lacking.push("Protein")
      if (day.vitamin_c < 90) lacking.push("Vitamin C")
      if (day.vitamin_d < 15) lacking.push("Vitamin D")
      if (day.vitamin_a < 900) lacking.push("Vitamin A")
      if (day.calcium < 1000) lacking.push("Calcium")
      if (day.iron < 18) lacking.push("Iron")
      return { ...day, lacking }
    })

    setAdminReport(finalReport.sort((a, b) => b.date.localeCompare(a.date)))
  }

  const openSettingsModal = () => {
    setShowSettings(true)
  }

  const saveSettingsModal = (e) => {
    e.preventDefault()
    setShowSettings(false)
    triggerAlert('success', 'Configuration updated')
    if (role === 'user' && settings.user_password !== token) {
      localStorage.setItem('app_token', settings.user_password)
      setToken(settings.user_password)
    } else if (role === 'admin' && settings.admin_password !== token) {
      localStorage.setItem('app_token', settings.admin_password)
      setToken(settings.admin_password)
    }
  }

  const clearAllData = async () => {
    if (window.confirm("Are you sure you want to delete all logged meals and reset the database?")) {
      const supabase = getSupabase()
      if (supabase) {
        try {
          await supabase
            .from('meals')
            .delete()
            .eq('sports', 'nutrition')
        } catch (err) {
          console.error("Supabase clear error", err)
        }
      } else {
        localStorage.removeItem('meals_db')
      }

      triggerAlert('success', 'Database cleared successfully!')
      loadDayData()
      if (role === 'admin') {
        loadAdminReport()
      }
      setShowSettings(false)
    }
  }

  const mealIcons = {
    breakfast: <Coffee className="w-5 h-5" />,
    lunch: <Utensils className="w-5 h-5" />,
    dinner: <Moon className="w-5 h-5" />,
    snack: <Candy className="w-5 h-5" />,
    juice: <CupSoda className="w-5 h-5" />
  }

  if (!token) {
    return (
      <div className="login-wrapper">
        <div className="glass-card login-card">
          <form className="login-content" onSubmit={handleLogin}>
            <div className="title-glow">Routine Tracker</div>
            <div className="subtitle">Secure entry to health analytics dashboard</div>
            {loginError && (
              <div className="alert-message error">
                <AlertCircle className="w-4 h-4" />
                <span>{loginError}</span>
              </div>
            )}
            <div className="input-group">
              <label className="input-label">Access Password</label>
              <div style={{ position: 'relative' }}>
                <input 
                  type="password" 
                  className="glass-input" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter user or admin password"
                  required
                />
              </div>
            </div>
            <button type="submit" className="glow-button">
              <Lock className="w-4 h-4" />
              <span>Unlock Dashboard</span>
            </button>
            <div style={{ textAlign: 'center', marginTop: '1.2rem' }}>
              <button 
                type="button" 
                onClick={handleResetApp} 
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  fontSize: '0.75rem',
                  textDecoration: 'underline',
                  cursor: 'pointer',
                  opacity: 0.6
                }}
              >
                Reset App Database & Passwords
              </button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  if (role === 'admin') {
    return (
      <div className="app-container">
        {alert && (
          <div className={`alert-message ${alert.type}`} style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 9999 }}>
            {alert.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <span>{alert.message}</span>
          </div>
        )}

        <header className="glass-card dashboard-header">
          <div className="header-title-section">
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h1 style={{ margin: 0 }}>Daily Routine Tracker - Admin Panel</h1>
              {isSupabaseConfigured ? (
                <span style={{ 
                  background: 'rgba(16, 185, 129, 0.15)', 
                  color: '#a7f3d0', 
                  border: '1px solid rgba(16, 185, 129, 0.3)', 
                  padding: '0.2rem 0.6rem', 
                  borderRadius: '20px', 
                  fontSize: '0.72rem', 
                  fontWeight: '700',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem'
                }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span>
                  Cloud Synced
                </span>
              ) : (
                <span style={{ 
                  background: 'rgba(245, 158, 11, 0.15)', 
                  color: '#fde68a', 
                  border: '1px solid rgba(245, 158, 11, 0.3)', 
                  padding: '0.2rem 0.6rem', 
                  borderRadius: '20px', 
                  fontSize: '0.72rem', 
                  fontWeight: '700',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem'
                }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }}></span>
                  Offline Mode
                </span>
              )}
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.2rem' }}>
              System reports & lacking nutrition records
            </p>
          </div>
          <div className="header-controls">
            <button className="control-btn" onClick={openSettingsModal}>
              <Settings className="w-4 h-4" />
              <span>Settings</span>
            </button>
            <button className="control-btn" style={{ borderColor: 'rgba(239, 68, 68, 0.3)', color: '#fca5a5' }} onClick={handleLogout}>
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>
        </header>

        <section className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="chart-title">
            <Calendar style={{ color: 'var(--accent-purple)' }} className="w-5 h-5" />
            <span>Day-wise Nutritional Gaps Report</span>
          </div>
          
          {adminReport.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-secondary)' }}>
              No health data logged in the database yet.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--glass-border)', color: 'var(--text-secondary)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    <th style={{ padding: '1rem' }}>Date</th>
                    <th style={{ padding: '1rem' }}>Meals Eaten</th>
                    <th style={{ padding: '1rem' }}>Nutrients Total</th>
                    <th style={{ padding: '1rem' }}>Nutritional Deficiencies</th>
                  </tr>
                </thead>
                <tbody>
                  {adminReport.map((day, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', verticalAlign: 'top' }}>
                      <td style={{ padding: '1rem', fontWeight: '700', color: 'var(--accent-cyan)' }}>{day.date}</td>
                      <td style={{ padding: '1rem', maxWidth: '300px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                          {day.meals.map((meal, mIdx) => (
                            <span key={mIdx} style={{ fontSize: '0.9rem' }}>{meal}</span>
                          ))}
                        </div>
                      </td>
                      <td style={{ padding: '1rem', fontSize: '0.9rem' }}>
                        <div><strong>Calories:</strong> {Math.round(day.calories)} kcal</div>
                        <div><strong>Protein:</strong> {Math.round(day.protein)}g</div>
                        <div><strong>Vitamins A/C/D:</strong> {Math.round(day.vitamin_a)}mcg / {Math.round(day.vitamin_c)}mg / {Math.round(day.vitamin_d)}mcg</div>
                        <div><strong>Calcium / Iron:</strong> {Math.round(day.calcium)}mg / {Math.round(day.iron)}mg</div>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        {day.lacking.length === 0 ? (
                          <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#a7f3d0', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '700' }}>
                            Adequate Nutrition
                          </span>
                        ) : (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                            {day.lacking.map((item, lIdx) => (
                              <span key={lIdx} style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '700' }}>
                                Lacking {item}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {showSettings && (
          <div className="settings-modal-overlay">
            <div className="glass-card settings-modal">
              <form onSubmit={saveSettingsModal}>
                <div className="modal-header">
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Configuration</h2>
                </div>
                <div className="input-group">
                  <label className="input-label">OpenRouter API Key</label>
                  <input 
                    type="password" 
                    className="glass-input" 
                    value={settings.openrouter_key}
                    onChange={(e) => setSettings({ ...settings, openrouter_key: e.target.value })}
                    placeholder="sk-or-..."
                  />
                </div>
                <div className="input-group">
                  <label className="input-label">OpenRouter Model Name</label>
                  <input 
                    type="text" 
                    className="glass-input" 
                    value={settings.openrouter_model}
                    onChange={(e) => setSettings({ ...settings, openrouter_model: e.target.value })}
                    placeholder="google/gemini-2.5-flash"
                  />
                </div>
                <div className="input-group">
                  <label className="input-label">Change User Password</label>
                  <input 
                    type="text" 
                    className="glass-input" 
                    value={settings.user_password || ''}
                    onChange={(e) => setSettings({ ...settings, user_password: e.target.value })}
                  />
                </div>
                <div className="input-group">
                  <label className="input-label">Change Admin Password</label>
                  <input 
                    type="text" 
                    className="glass-input" 
                    value={settings.admin_password || ''}
                    onChange={(e) => setSettings({ ...settings, admin_password: e.target.value })}
                  />
                </div>
                <div className="input-group">
                  <label className="input-label">Supabase URL (Optional)</label>
                  <input 
                    type="text" 
                    className="glass-input" 
                    value={settings.supabase_url || ''}
                    onChange={(e) => setSettings({ ...settings, supabase_url: e.target.value })}
                    placeholder="https://your-project.supabase.co"
                  />
                </div>
                <div className="input-group">
                  <label className="input-label">Supabase Anon Key (Optional)</label>
                  <input 
                    type="password" 
                    className="glass-input" 
                    value={settings.supabase_key || ''}
                    onChange={(e) => setSettings({ ...settings, supabase_key: e.target.value })}
                    placeholder="eyJhbGci..."
                  />
                </div>
                <div className="modal-footer">
                  <button type="button" className="control-btn" style={{ borderColor: 'rgba(239, 68, 68, 0.3)', color: '#fca5a5', marginRight: 'auto' }} onClick={clearAllData}>
                    Clear Data
                  </button>
                  <button type="button" className="control-btn" onClick={() => setShowSettings(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="glow-button" style={{ width: 'auto' }}>
                    Save Configuration
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="app-container">
      {alert && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 9999
        }} className={`alert-message ${alert.type}`}>
          {alert.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span>{alert.message}</span>
        </div>
      )}

      <header className="glass-card dashboard-header">
        <div className="header-title-section">
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h1 style={{ margin: 0 }}>Daily Routine Tracker</h1>
            {isSupabaseConfigured ? (
              <span style={{ 
                background: 'rgba(16, 185, 129, 0.15)', 
                color: '#a7f3d0', 
                border: '1px solid rgba(16, 185, 129, 0.3)', 
                padding: '0.2rem 0.6rem', 
                borderRadius: '20px', 
                fontSize: '0.72rem', 
                fontWeight: '700',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem'
              }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span>
                Cloud Synced
              </span>
            ) : (
              <span style={{ 
                background: 'rgba(245, 158, 11, 0.15)', 
                color: '#fde68a', 
                border: '1px solid rgba(245, 158, 11, 0.3)', 
                padding: '0.2rem 0.6rem', 
                borderRadius: '20px', 
                fontSize: '0.72rem', 
                fontWeight: '700',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem'
              }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }}></span>
                Offline Mode
              </span>
            )}
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.2rem' }}>
            Smart nutrition planner & analytics
          </p>
        </div>
        <div className="header-controls">
          <div className="date-picker-wrapper">
            <input 
              type="date" 
              className="date-input" 
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>
          <button className="control-btn" onClick={openSettingsModal}>
            <Settings className="w-4 h-4" />
            <span>Settings</span>
          </button>
          <button className="control-btn" style={{ borderColor: 'rgba(239, 68, 68, 0.3)', color: '#fca5a5' }} onClick={handleLogout}>
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      </header>

      <div className="grid-layout">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <section className="glass-card">
            <div className="chart-title">
              <Utensils style={{ color: 'var(--accent-cyan)' }} className="w-5 h-5" />
              <span>Log Meals</span>
            </div>
            <div className="meal-cards-grid">
              {['breakfast', 'lunch', 'dinner', 'snack', 'juice'].map((type) => (
                <div key={type} className="glass-card meal-row-card" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', width: '100%' }}>
                    <div className={`meal-type-badge ${type}`}>
                      {mealIcons[type]}
                      <span>{type}</span>
                    </div>
                    <div className="meal-input-wrapper">
                      <input 
                        type="text" 
                        className="glass-input" 
                        value={meals[type] || ''}
                        onChange={(e) => setMeals({ ...meals, [type]: e.target.value })}
                        placeholder={`What did you eat for ${type}?`}
                      />
                      <button className="save-meal-btn" onClick={() => saveMeal(type)} disabled={saveStates[type] !== 'idle'}>
                        {saveStates[type] === 'saving' && (
                          <div className="loading-spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }}></div>
                        )}
                        {saveStates[type] === 'saved' && (
                          <CheckCircle2 className="w-4 h-4" style={{ color: '#10b981' }} />
                        )}
                        {saveStates[type] === 'idle' && (
                          <Save className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                  {loggedMeals[type] && loggedMeals[type].length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.8rem', paddingLeft: '2.5rem' }}>
                      {loggedMeals[type].map((item, idx) => (
                        <span key={idx} style={{
                          background: 'rgba(255,255,255,0.06)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          padding: '0.3rem 0.7rem',
                          borderRadius: '8px',
                          fontSize: '0.85rem',
                          color: 'var(--text-secondary)'
                        }}>
                          {item}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>
            <section className="glass-card chart-card">
              <div className="chart-title">
                <Sparkles style={{ color: 'var(--accent-purple)' }} className="w-5 h-5" />
                <span>Macronutrient Breakdown</span>
              </div>
              <div style={{ width: '100%', height: 300 }}>
                <ResponsiveContainer>
                  <BarChart data={nutrientData}>
                    <XAxis dataKey="name" stroke="var(--text-secondary)" />
                    <YAxis stroke="var(--text-secondary)" />
                    <Tooltip 
                      contentStyle={{ background: '#1e293b', borderColor: 'var(--glass-border)', color: '#fff' }}
                      cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                    />
                    <Bar dataKey="value" radius={[10, 10, 0, 0]}>
                      {nutrientData.map((entry, index) => {
                        const colors = ['var(--accent-amber)', 'var(--accent-cyan)', 'var(--accent-purple)', 'var(--accent-pink)'];
                        return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="glass-card chart-card">
              <div className="chart-title">
                <Sparkles style={{ color: 'var(--accent-pink)' }} className="w-5 h-5" />
                <span>Vitamins & Minerals (Normalized)</span>
              </div>
              <div style={{ width: '100%', height: 300, display: 'flex', justifyContent: 'center' }}>
                <ResponsiveContainer>
                  <RadarChart cx="50%" cy="50%" outerRadius="70%" data={microData}>
                    <PolarGrid stroke="var(--glass-border)" />
                    <PolarAngleAxis dataKey="subject" stroke="var(--text-secondary)" />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="var(--text-secondary)" />
                    <Radar name="Intake" dataKey="A" stroke="var(--accent-pink)" fill="var(--accent-pink)" fillOpacity={0.3} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>
        </div>

        <div>
          <section className="glass-card ai-card">
            <div className="ai-header">
              <div className="ai-title">
                <Sparkles style={{ color: 'var(--accent-purple)' }} className="w-5 h-5" />
                <span>AI Daily Gap Analysis</span>
              </div>
              <button 
                className="glow-button" 
                style={{ width: 'auto', padding: '0.5rem 1rem', fontSize: '0.85rem' }} 
                onClick={() => runAiAnalysis(selectedDate)}
                disabled={loadingAi}
              >
                {loadingAi ? <div className="loading-spinner"></div> : <span>Analyze Day</span>}
              </button>
            </div>
            <div className="ai-content">
              {aiAnalysis ? (
                <div className="bullet-list">
                  {aiAnalysis.split('\n').filter(line => line.trim()).map((line, i) => {
                    const cleanLine = line.replace(/^-\s*/, '').replace(/^\*\s*/, '').replace(/^\d+\.\s*/, '');
                    const parts = cleanLine.split(/\*\*([^*]+)\*\*/g);
                    return (
                      <div key={i} className="bullet-item">
                        {parts.map((part, idx) => idx % 2 === 1 ? <strong key={idx} style={{ color: 'var(--accent-cyan)', fontWeight: '700' }}>{part}</strong> : part)}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <span style={{ color: 'var(--text-secondary)', display: 'block', textAlign: 'center', marginTop: '3rem' }}>
                  Click "Analyze Day" to let OpenRouter review your food intake and nutritional balance.
                </span>
              )}
            </div>
          </section>
        </div>
      </div>

      {showSettings && (
        <div className="settings-modal-overlay">
          <div className="glass-card settings-modal">
            <form onSubmit={saveSettingsModal}>
              <div className="modal-header">
                <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Configuration</h2>
              </div>
              <div className="input-group">
                <label className="input-label">OpenRouter API Key</label>
                <input 
                  type="password" 
                  className="glass-input" 
                  value={settings.openrouter_key}
                  onChange={(e) => setSettings({ ...settings, openrouter_key: e.target.value })}
                  placeholder="sk-or-..."
                />
              </div>
              <div className="input-group">
                <label className="input-label">OpenRouter Model Name</label>
                <input 
                  type="text" 
                  className="glass-input" 
                  value={settings.openrouter_model}
                  onChange={(e) => setSettings({ ...settings, openrouter_model: e.target.value })}
                  placeholder="google/gemini-2.5-flash"
                />
              </div>
              <div className="input-group">
                <label className="input-label">Change User Password</label>
                <input 
                  type="text" 
                  className="glass-input" 
                  value={settings.user_password || ''}
                  onChange={(e) => setSettings({ ...settings, user_password: e.target.value })}
                />
              </div>
              <div className="input-group">
                <label className="input-label">Change Admin Password</label>
                <input 
                  type="text" 
                  className="glass-input" 
                  value={settings.admin_password || ''}
                  onChange={(e) => setSettings({ ...settings, admin_password: e.target.value })}
                />
              </div>
              <div className="input-group">
                <label className="input-label">Supabase URL (Optional)</label>
                <input 
                  type="text" 
                  className="glass-input" 
                  value={settings.supabase_url || ''}
                  onChange={(e) => setSettings({ ...settings, supabase_url: e.target.value })}
                  placeholder="https://your-project.supabase.co"
                />
              </div>
              <div className="input-group">
                <label className="input-label">Supabase Anon Key (Optional)</label>
                <input 
                  type="password" 
                  className="glass-input" 
                  value={settings.supabase_key || ''}
                  onChange={(e) => setSettings({ ...settings, supabase_key: e.target.value })}
                  placeholder="eyJhbGci..."
                />
              </div>
              <div className="modal-footer">
                <button type="button" className="control-btn" style={{ borderColor: 'rgba(239, 68, 68, 0.3)', color: '#fca5a5', marginRight: 'auto' }} onClick={clearAllData}>
                  Clear Data
                </button>
                <button type="button" className="control-btn" onClick={() => setShowSettings(false)}>
                  Cancel
                </button>
                <button type="submit" className="glow-button" style={{ width: 'auto' }}>
                  Save Configuration
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
