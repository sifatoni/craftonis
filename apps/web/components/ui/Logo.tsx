'use client'

import Image from 'next/image'

interface LogoProps {
  variant?: 'dark' | 'light' | 'auto'
  width?: number
  height?: number
  className?: string
}

export function Logo({ 
  variant = 'auto', 
  width = 160, 
  height = 40,
  className = '' 
}: LogoProps) {
  if (variant === 'dark') {
    return (
      <Image
        src="/logo-dark.svg"
        alt="Craftonis"
        width={width}
        height={height}
        className={className}
        priority
      />
    )
  }

  if (variant === 'light') {
    return (
      <Image
        src="/logo-light.svg"
        alt="Craftonis"
        width={width}
        height={height}
        className={className}
        priority
      />
    )
  }

  // auto — switches based on data-theme
  return (
    <>
      <Image
        src="/logo-dark.svg"
        alt="Craftonis"
        width={width}
        height={height}
        className={`${className} block dark-mode-logo`}
        priority
      />
      <Image
        src="/logo-light.svg"
        alt="Craftonis"
        width={width}
        height={height}
        className={`${className} hidden light-mode-logo`}
        priority
      />
    </>
  )
}
