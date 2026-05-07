'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion } from 'framer-motion'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/axios'
import { useAuthStore } from '@/store/auth.store'

const loginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

type LoginForm = z.infer<typeof loginSchema>

export default function LoginPage() {
  const router = useRouter()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true)
    try {
      const res = await api.post('/auth/login', data)
      setAuth(res.data.user, res.data.tenant, res.data.accessToken)
      toast.success(`Welcome back, ${res.data.user.name}!`)
      router.push('/dashboard')
    } catch (err: any) {
      const message = err.response?.data?.message || 'Login failed'
      toast.error(message)
      setError('email', { message: ' ' })
      setError('password', { message: 'Invalid email or password' })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg-base)' }}>

      {/* Left — Brand Panel */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: '#0D0D0D', borderRight: '1px solid #1A1A1A' }}
      >
        {/* Background pattern */}
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, #A50000 1px, transparent 0)`,
            backgroundSize: '32px 32px',
          }}
        />

        {/* Logo */}
        <div className="relative z-10">
          <Image
            src="/logo-dark.svg"
            alt="Craftonis"
            width={180}
            height={45}
            priority
          />
        </div>

        {/* Center content */}
        <motion.div
          className="relative z-10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <h1
            className="text-5xl font-bold mb-6 leading-tight"
            style={{ fontFamily: 'var(--font-syne)', color: '#FFFFFF' }}
          >
            Hire Smart.<br />
            Manage Better.<br />
            <span style={{ color: '#A50000' }}>Grow Faster.</span>
          </h1>
          <p style={{ color: '#606060', fontSize: '1.1rem', lineHeight: '1.7' }}>
            The all-in-one HR intelligence platform for modern teams.
            From lead generation to onboarding — everything in one place.
          </p>
        </motion.div>

        {/* Bottom stats */}
        <div className="relative z-10 flex gap-8">
          {[
            { value: '10', label: 'Modules' },
            { value: '70%', label: 'Faster Hiring' },
            { value: '0', label: '3rd Party Tools' },
          ].map((stat) => (
            <div key={stat.label}>
              <div
                className="text-2xl font-bold"
                style={{ fontFamily: 'var(--font-syne)', color: '#A50000' }}
              >
                {stat.value}
              </div>
              <div className="text-sm" style={{ color: '#606060' }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right — Login Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <motion.div
          className="w-full max-w-md"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          {/* Mobile logo */}
          <div className="lg:hidden mb-8 flex justify-center">
            <Image src="/logo-dark.svg" alt="Craftonis" width={160} height={40} priority />
          </div>

          <div className="mb-8">
            <h2
              className="text-3xl font-bold mb-2"
              style={{ fontFamily: 'var(--font-syne)', color: '#FFFFFF' }}
            >
              Welcome back
            </h2>
            <p style={{ color: '#606060' }}>
              Sign in to your Craftonis workspace
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Email */}
            <div className="space-y-2">
              <Label
                htmlFor="email"
                style={{ color: '#A0A0A0', fontSize: '0.8125rem', fontWeight: 600 }}
              >
                EMAIL ADDRESS
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="oni@craftonis.com"
                autoComplete="email"
                {...register('email')}
                className="h-12"
                style={{
                  background: '#111111',
                  border: errors.email ? '1px solid #A50000' : '1px solid #2E2E2E',
                  color: '#FFFFFF',
                  fontSize: '0.9375rem',
                }}
              />
              {errors.email && errors.email.message !== ' ' && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-xs"
                  style={{ color: '#DC2626' }}
                >
                  {errors.email.message}
                </motion.p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="password"
                  style={{ color: '#A0A0A0', fontSize: '0.8125rem', fontWeight: 600 }}
                >
                  PASSWORD
                </Label>
                <Link
                  href="/forgot-password"
                  className="text-xs transition-colors"
                  style={{ color: '#606060' }}
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  {...register('password')}
                  className="h-12 pr-12"
                  style={{
                    background: '#111111',
                    border: errors.password ? '1px solid #A50000' : '1px solid #2E2E2E',
                    color: '#FFFFFF',
                    fontSize: '0.9375rem',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: '#606060' }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-xs"
                  style={{ color: '#DC2626' }}
                >
                  {errors.password.message}
                </motion.p>
              )}
            </div>

            {/* Submit */}
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 text-base font-semibold transition-all"
              style={{
                background: isLoading ? '#6B0000' : '#A50000',
                color: '#FFFFFF',
                border: 'none',
              }}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <Loader2 size={18} className="animate-spin" />
                  Signing in...
                </span>
              ) : (
                'Sign in to Craftonis'
              )}
            </Button>
          </form>

          {/* Register link */}
          <p className="mt-6 text-center text-sm" style={{ color: '#606060' }}>
            Don&apos;t have an account?{' '}
            <Link
              href="/register"
              className="font-semibold transition-colors"
              style={{ color: '#A50000' }}
            >
              Create workspace
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  )
}
