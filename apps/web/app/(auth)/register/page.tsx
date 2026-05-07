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

const registerSchema = z.object({
  companyName: z.string().min(2, 'Company name must be at least 2 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Enter a valid email'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain an uppercase letter')
    .regex(/[0-9]/, 'Must contain a number'),
})

type RegisterForm = z.infer<typeof registerSchema>

export default function RegisterPage() {
  const router = useRouter()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  })

  const onSubmit = async (data: RegisterForm) => {
    setIsLoading(true)
    try {
      const res = await api.post('/auth/register', data)
      setAuth(res.data.user, res.data.tenant, res.data.accessToken)
      toast.success(`Workspace created! Welcome, ${res.data.user.name}!`)
      router.push('/dashboard')
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Registration failed')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-8"
      style={{ background: 'var(--bg-base)' }}
    >
      <motion.div
        className="w-full max-w-md"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="mb-8 flex justify-center">
          <Image src="/logo-dark.svg" alt="Craftonis" width={160} height={40} priority />
        </div>

        <div className="mb-8 text-center">
          <h2
            className="text-3xl font-bold mb-2"
            style={{ fontFamily: 'var(--font-syne)', color: '#FFFFFF' }}
          >
            Create your workspace
          </h2>
          <p style={{ color: '#606060' }}>
            Set up Craftonis for your company in seconds
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {[
            {
              id: 'companyName',
              label: 'COMPANY NAME',
              placeholder: 'Craftonis Inc',
              type: 'text',
              error: errors.companyName,
            },
            {
              id: 'name',
              label: 'YOUR NAME',
              placeholder: 'Oni',
              type: 'text',
              error: errors.name,
            },
            {
              id: 'email',
              label: 'WORK EMAIL',
              placeholder: 'oni@company.com',
              type: 'email',
              error: errors.email,
            },
          ].map((field) => (
            <div key={field.id} className="space-y-2">
              <Label
                htmlFor={field.id}
                style={{ color: '#A0A0A0', fontSize: '0.8125rem', fontWeight: 600 }}
              >
                {field.label}
              </Label>
              <Input
                id={field.id}
                type={field.type}
                placeholder={field.placeholder}
                {...register(field.id as keyof RegisterForm)}
                className="h-12"
                style={{
                  background: '#111111',
                  border: field.error ? '1px solid #A50000' : '1px solid #2E2E2E',
                  color: '#FFFFFF',
                }}
              />
              {field.error && (
                <p className="text-xs" style={{ color: '#DC2626' }}>
                  {field.error.message}
                </p>
              )}
            </div>
          ))}

          <div className="space-y-2">
            <Label
              htmlFor="password"
              style={{ color: '#A0A0A0', fontSize: '0.8125rem', fontWeight: 600 }}
            >
              PASSWORD
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Min 8 chars, 1 uppercase, 1 number"
                {...register('password')}
                className="h-12 pr-12"
                style={{
                  background: '#111111',
                  border: errors.password ? '1px solid #A50000' : '1px solid #2E2E2E',
                  color: '#FFFFFF',
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: '#606060' }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.password && (
              <p className="text-xs" style={{ color: '#DC2626' }}>
                {errors.password.message}
              </p>
            )}
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full h-12 text-base font-semibold mt-2"
            style={{ background: '#A50000', color: '#FFFFFF', border: 'none' }}
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <Loader2 size={18} className="animate-spin" />
                Creating workspace...
              </span>
            ) : (
              'Create Workspace'
            )}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm" style={{ color: '#606060' }}>
          Already have an account?{' '}
          <Link href="/login" style={{ color: '#A50000', fontWeight: 600 }}>
            Sign in
          </Link>
        </p>
      </motion.div>
    </div>
  )
}
