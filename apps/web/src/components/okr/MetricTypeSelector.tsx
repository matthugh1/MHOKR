'use client'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Info } from 'lucide-react'
import { MetricType } from '@okr-nexus/types'

interface MetricTypeSelectorProps {
  value: MetricType | string
  onValueChange: (value: MetricType) => void
  disabled?: boolean
  id?: string
  label?: string
  showTooltip?: boolean
}

const METRIC_TYPE_INFO: Record<MetricType, { label: string; description: string; examples: string[] }> = {
  [MetricType.INCREASE]: {
    label: 'Increase',
    description: 'Increase from a baseline value to a target value',
    examples: ['Increase revenue from $1M to $2M', 'Increase users from 100 to 500', 'Increase CARR from 458M to 556M'],
  },
  [MetricType.DECREASE]: {
    label: 'Decrease',
    description: 'Decrease from a baseline value to a target value',
    examples: ['Decrease response time from 5s to 2s', 'Decrease churn from 5% to 2%', 'Decrease vulnerabilities from 100 to 50'],
  },
  [MetricType.REACH]: {
    label: 'Reach',
    description: 'Reach a specific target value (typically starting from 0)',
    examples: ['Reach 134M EBITDA', 'Reach 100 customers', 'Reach 95% uptime'],
  },
  [MetricType.MAINTAIN]: {
    label: 'Maintain',
    description: 'Maintain a value above or below a threshold',
    examples: ['Stay above 1.45 CAC Payback', 'Stay below 60 days DSO', 'Maintain 99.9% uptime'],
  },
}

export function MetricTypeSelector({
  value,
  onValueChange,
  disabled = false,
  id = 'metric-type',
  label = 'Metric Type',
  showTooltip = true,
}: MetricTypeSelectorProps) {
  const selectedInfo = value && METRIC_TYPE_INFO[value as MetricType]

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label htmlFor={id} className="text-sm font-medium text-slate-200">{label}</Label>
        {showTooltip && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center p-0 border-0 bg-transparent cursor-help hover:text-slate-300 transition-colors"
                  aria-label="Metric type information"
                >
                  <Info className="h-3.5 w-3.5 text-slate-400" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs bg-slate-800 border-slate-700">
                {selectedInfo ? (
                  <div className="space-y-2">
                    <p className="font-medium text-white">{selectedInfo.label}</p>
                    <p className="text-sm text-slate-300">{selectedInfo.description}</p>
                    {selectedInfo.examples.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-slate-700">
                        <p className="text-xs font-medium mb-1 text-slate-300">Examples:</p>
                        <ul className="text-xs space-y-1">
                          {selectedInfo.examples.map((example, idx) => (
                            <li key={idx} className="text-slate-400">• {example}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="font-medium text-white mb-2">Metric Types:</p>
                    {Object.entries(METRIC_TYPE_INFO).map(([type, info]) => (
                      <div key={type} className="mb-2">
                        <p className="text-sm font-medium text-white">{info.label}</p>
                        <p className="text-xs text-slate-300">{info.description}</p>
                      </div>
                    ))}
                  </div>
                )}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      <Select
        value={value}
        onValueChange={(val: string) => onValueChange(val as MetricType)}
        disabled={disabled}
      >
        <SelectTrigger id={id} className="h-10 bg-slate-800/50 border-slate-700 text-white hover:bg-slate-700 focus:border-indigo-500 focus:ring-indigo-500">
          <SelectValue placeholder="Select metric type" />
        </SelectTrigger>
        <SelectContent className="bg-slate-800 border-slate-700 text-white">
          {Object.entries(METRIC_TYPE_INFO).map(([type, info]) => (
            <SelectItem key={type} value={type} className="text-white focus:bg-slate-700">
              {info.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}


