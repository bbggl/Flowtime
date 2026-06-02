import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Zap } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

export default function AuthPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const { user, loading, signIn, signUp } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading && user) {
      navigate('/', { replace: true })
    }
  }, [user, loading, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    const { error: authError } =
      mode === 'login'
        ? await signIn(email, password)
        : await signUp(email, password)

    setSubmitting(false)

    if (authError) {
      setError(authError.message)
    } else {
      navigate('/')
    }
  }

  const switchMode = (nextMode: 'login' | 'register') => {
    setMode(nextMode)
    setError('')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-light-bg dark:bg-dark-bg">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-light-bg dark:bg-dark-bg px-4">
      <div className="w-full max-w-md bg-light-card dark:bg-dark-card rounded-2xl shadow-lg p-8">
        {/* Branding */}
        <div className="flex flex-col items-center mb-8">
          <Zap className="w-10 h-10 text-primary dark:text-primary-dark mb-2" />
          <h1 className="text-2xl font-bold text-light-text dark:text-dark-text">
            FlowTime
          </h1>
        </div>

        {/* Tab toggle */}
        <div className="flex mb-6 bg-light-bg dark:bg-dark-bg rounded-lg p-1">
          <button
            type="button"
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
              mode === 'login'
                ? 'bg-primary text-white'
                : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text'
            }`}
            onClick={() => switchMode('login')}
          >
            登录
          </button>
          <button
            type="button"
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
              mode === 'register'
                ? 'bg-primary text-white'
                : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text'
            }`}
            onClick={() => switchMode('register')}
          >
            注册
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-light-text dark:text-dark-text mb-1"
            >
              邮箱
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2 rounded-lg border border-light-border dark:border-dark-border bg-light-bg dark:bg-dark-bg text-light-text dark:text-dark-text placeholder:text-light-text-secondary dark:placeholder:text-dark-text-secondary focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="your@email.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-light-text dark:text-dark-text mb-1"
            >
              密码
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-4 py-2 rounded-lg border border-light-border dark:border-dark-border bg-light-bg dark:bg-dark-bg text-light-text dark:text-dark-text placeholder:text-light-text-secondary dark:placeholder:text-dark-text-secondary focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="••••••"
            />
          </div>

          {error && (
            <div className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 bg-primary hover:bg-primary/90 disabled:opacity-60 text-white font-medium rounded-lg transition-colors"
          >
            {mode === 'login' ? '登录' : '注册'}
          </button>
        </form>

        {/* Toggle link */}
        <p className="mt-6 text-center text-sm text-light-text-secondary dark:text-dark-text-secondary">
          {mode === 'login' ? '还没有账号？' : '已有账号？'}
          <button
            type="button"
            onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
            className="ml-1 text-primary dark:text-primary-dark font-medium hover:underline"
          >
            {mode === 'login' ? '立即注册' : '去登录'}
          </button>
        </p>
      </div>
    </div>
  )
}
