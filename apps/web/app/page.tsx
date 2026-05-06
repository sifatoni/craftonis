import { Logo } from '@/components/ui/Logo'

export default function Home() {
  return (
    <main 
      className="min-h-screen flex items-center justify-center"
      style={{ background: 'var(--bg-base)' }}
    >
      <div className="text-center flex flex-col items-center gap-6">
        <Logo variant="dark" width={280} height={70} />
        <p 
          className="font-body text-lg"
          style={{ color: 'var(--text-secondary)' }}
        >
          HR Intelligence Platform — Coming Soon
        </p>
      </div>
    </main>
  )
}
