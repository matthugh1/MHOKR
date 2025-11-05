'use client'

import { useState } from 'react'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChevronDown, ChevronUp } from 'lucide-react'

interface JsonContextEditorProps {
  value?: Record<string, any>
  onChange: (context: Record<string, any>) => void
}

export function JsonContextEditor({ value, onChange }: JsonContextEditorProps) {
  const [expanded, setExpanded] = useState(false)
  const [jsonText, setJsonText] = useState(() => {
    try {
      return JSON.stringify(value || {}, null, 2)
    } catch {
      return '{}'
    }
  })

  const handleJsonChange = (text: string) => {
    setJsonText(text)
    try {
      const parsed = JSON.parse(text)
      onChange(parsed)
    } catch {
      // Invalid JSON, don't update
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Additional Context (JSON)</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      {expanded && (
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="json-context">JSON Context</Label>
            <Textarea
              id="json-context"
              placeholder='{"key": "value"}'
              value={jsonText}
              onChange={(e) => handleJsonChange(e.target.value)}
              className="font-mono text-sm"
              rows={8}
            />
            <p className="text-xs text-muted-foreground">
              Valid JSON object. Leave empty or use {} if not needed.
            </p>
          </div>
        </CardContent>
      )}
    </Card>
  )
}

