'use client'

import React from 'react'
import { Sparkles, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface FocusSuggestionProps {
  suggestion: string | null
  onFocus?: () => void
}

export function FocusSuggestion({ suggestion, onFocus }: FocusSuggestionProps) {
  if (!suggestion) {
    return null
  }

  return (
    <Card className="bg-gradient-to-r from-violet-500/10 via-fuchsia-500/10 to-violet-500/10 border-violet-500/20">
      <CardContent className="pt-6">
        <div className="flex items-start gap-3">
          <div className="flex items-center justify-center h-8 w-8 rounded-full bg-violet-500/20 text-violet-300 flex-shrink-0 mt-0.5">
            <Sparkles size={16} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-card-foreground mb-2">AI Focus Suggestion</p>
            <p className="text-sm text-muted-foreground mb-3">{suggestion}</p>
            {onFocus && (
              <Button
                variant="outline"
                size="sm"
                onClick={onFocus}
                className="gap-2"
              >
                Focus on this
                <ArrowRight className="w-3 h-3" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

