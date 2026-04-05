'use client'

import { useState } from 'react'
import { CheckIcon, CopyIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from "@/lib/utils"
import { toast } from 'sonner'

interface CopyButtonProps{
    copyString: string
    showText: boolean
}

const CopyButton = (props: CopyButtonProps) => {
  const [copied, setCopied] = useState<boolean>(false)

  const handleCopy = async () => {
    try {      
      await navigator.clipboard.writeText(props.copyString)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch (err) {
      toast.error("Failed to copy room ID to clipboard...")
      console.error('Failed to copy text: ', err)
    }
  }

  return (
    <Button variant='outline' className='relative disabled:opacity-100' onClick={handleCopy} disabled={copied}>
      <span className={cn('transition-all', copied ? 'scale-100 opacity-100' : 'scale-0 opacity-0')}>
        <CheckIcon className='stroke-green-600 dark:stroke-green-400' />
      </span>
      <span className={cn('absolute left-3 transition-all', copied ? 'scale-0 opacity-0' : 'scale-100 opacity-100')}>
        <CopyIcon />
      </span>
      {copied ? 'Copied!' : 'Copy'}
    </Button>
  )
}

export default CopyButton
