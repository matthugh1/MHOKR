'use client'

import { useState } from 'react'
import { ProtectedRoute } from '@/components/protected-route'
import { DashboardLayout } from '@/components/dashboard-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Bot, Send, Sparkles } from 'lucide-react'

type Message = {
  role: 'user' | 'assistant'
  content: string
  persona?: string
}

export default function AIAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Hi! I'm your OKR AI Assistant. I can help you write better OKRs, suggest alignments, analyze progress, and provide insights. What would you like help with?",
      persona: 'OKR Coach'
    }
  ])
  const [input, setInput] = useState('')
  const [selectedPersona, setSelectedPersona] = useState('okr-coach')

  const personas = [
    { id: 'okr-coach', name: 'OKR Coach', color: 'blue', description: 'Helps write better OKRs' },
    { id: 'cascade-assistant', name: 'Cascade Assistant', color: 'green', description: 'Suggests alignments' },
    { id: 'progress-analyst', name: 'Progress Analyst', color: 'purple', description: 'Analyzes performance' },
  ]

  const handleSend = () => {
    if (!input.trim()) return

    setMessages([...messages, { role: 'user', content: input }])
    setInput('')

    // Simulate AI response
    setTimeout(() => {
      const persona = personas.find(p => p.id === selectedPersona)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "I understand you want help with that. In a production environment, this would connect to the AI service to provide intelligent assistance.",
        persona: persona?.name
      }])
    }, 1000)
  }

  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="h-full flex">
          {/* Sidebar - Persona Selection */}
          <div className="w-80 border-r bg-white p-6">
            <h2 className="text-lg font-semibold mb-4">AI Personas</h2>
            <div className="space-y-3">
              {personas.map((persona) => (
                <button
                  key={persona.id}
                  onClick={() => setSelectedPersona(persona.id)}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                    selectedPersona === persona.id
                      ? 'border-primary bg-primary/5'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <Bot className="h-5 w-5" />
                    <span className="font-semibold">{persona.name}</span>
                  </div>
                  <p className="text-sm text-slate-600">{persona.description}</p>
                </button>
              ))}
            </div>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="text-sm">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" size="sm" className="w-full justify-start">
                  <Sparkles className="h-4 w-4 mr-2" />
                  Suggest OKR improvements
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start">
                  <Sparkles className="h-4 w-4 mr-2" />
                  Check alignment
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start">
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate report
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Chat Interface */}
          <div className="flex-1 flex flex-col">
            <div className="p-6 border-b bg-white">
              <h1 className="text-2xl font-bold text-slate-900">AI Assistant</h1>
              <p className="text-slate-600 text-sm mt-1">
                Get intelligent help with your OKRs
              </p>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-auto p-6 space-y-4">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[70%] rounded-lg p-4 ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-slate-100 text-slate-900'
                    }`}
                  >
                    {message.role === 'assistant' && message.persona && (
                      <Badge variant="secondary" className="mb-2 text-xs">
                        {message.persona}
                      </Badge>
                    )}
                    <p className="text-sm">{message.content}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Input */}
            <div className="p-6 border-t bg-white">
              <div className="flex gap-2">
                <Input
                  placeholder="Ask me anything about your OKRs..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                />
                <Button onClick={handleSend}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}



