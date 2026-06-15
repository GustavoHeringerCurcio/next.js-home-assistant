"use client"

import { useEffect, useRef, useState } from "react"
import {
  Bot,
  Mic,
  Send,
  Square,
  Volume2,
  VolumeX,
  Sparkles
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { ThemeToggle } from "@/components/theme-toggle"
import { cn } from "@/lib/utils"

const conversationId =
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `local-${Date.now()}`

const initialMessages = [
  {
    role: "assistant",
    content: "Hi! I'm your Tuya Custom Agent. How can I help you control your home today?",
  },
]

export function AgentConsole() {
  const [messages, setMessages] = useState(initialMessages)
  const [input, setInput] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [voiceOutput, setVoiceOutput] = useState(true)
  const recognitionRef = useRef(null)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages])

  function speak(text) {
    if (!voiceOutput || typeof window === "undefined" || !window.speechSynthesis) {
      return
    }

    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 1
    utterance.pitch = 1
    window.speechSynthesis.speak(utterance)
  }

  async function sendMessage(nextInput = input) {
    const content = nextInput.trim()

    if (!content || isSending) {
      return
    }

    const userMessage = { role: "user", content }
    const nextMessages = [...messages, userMessage]

    setMessages(nextMessages)
    setInput("")
    setIsSending(true)

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          conversationId,
          messages: nextMessages,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Agent request failed.")
      }

      const assistantMessage = {
        role: "assistant",
        content: data.content,
        model: data.model,
      }

      setMessages((current) => [...current, assistantMessage])
      speak(data.content)
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: `Request failed: ${error.message}`,
          error: true,
        },
      ])
    } finally {
      setIsSending(false)
    }
  }

  function toggleListening() {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition

    if (!SpeechRecognition) {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content:
            "This browser does not expose SpeechRecognition. Try Chrome or Edge for local voice input.",
          error: true,
        },
      ])
      return
    }

    if (isListening) {
      recognitionRef.current?.stop()
      setIsListening(false)
      return
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = "en-US"

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript || "")
        .join("")

      setInput(transcript)

      const lastResult = event.results[event.results.length - 1]
      if (lastResult?.isFinal) {
        sendMessage(transcript)
      }
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    recognitionRef.current = recognition
    setIsListening(true)
    recognition.start()
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
      {/* Premium Sticky Header */}
      <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-background/80 backdrop-blur-md px-6 shrink-0">
        <div className="flex items-center gap-3">
          <SidebarTrigger className="-ml-1 text-foreground/80 hover:text-foreground" />
          <div className="h-4 w-[1px] bg-border" />
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-semibold text-foreground">Tuya Agent Console</h1>
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" title="System Ready" />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/60 dark:bg-muted/30 rounded-full px-3 py-1 border border-border">
            <span>Voice output</span>
            <Switch
              checked={voiceOutput}
              onCheckedChange={setVoiceOutput}
              className="scale-75 origin-right"
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="rounded-full size-8 text-foreground/70 hover:text-foreground"
            aria-label={voiceOutput ? "Disable voice output" : "Enable voice output"}
            title={voiceOutput ? "Disable voice output" : "Enable voice output"}
            onClick={() => setVoiceOutput((value) => !value)}
          >
            {voiceOutput ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
          </Button>
          <ThemeToggle />
        </div>
      </header>

      {/* Message Area */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="max-w-3xl mx-auto w-full px-4 py-8 flex flex-col gap-6">
          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={cn(
                "flex gap-4 w-full",
                message.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              {message.role !== "user" && (
                <Avatar className="size-8 shrink-0 border bg-muted flex items-center justify-center">
                  <Bot className="size-4 text-primary" />
                </Avatar>
              )}
              
              <div
                className={cn(
                  "flex flex-col max-w-[80%]",
                  message.role === "user" ? "items-end" : "items-start"
                )}
              >
                <div
                  className={cn(
                    "text-sm leading-relaxed whitespace-pre-wrap transition-all duration-200",
                    message.role === "user"
                      ? "bg-muted text-foreground rounded-2xl px-4 py-2.5 rounded-tr-none shadow-xs border border-border"
                      : "text-foreground pt-1",
                    message.error && "text-destructive font-medium border border-destructive/20 rounded-xl p-3 bg-destructive/5"
                  )}
                >
                  {message.content}
                </div>
                {message.role === "assistant" && message.model && (
                  <span className="text-[10px] text-muted-foreground/60 mt-1 select-none flex items-center gap-1">
                    <Sparkles className="size-2.5 text-primary" />
                    Generated by {message.model}
                  </span>
                )}
              </div>

              {message.role === "user" && (
                <Avatar className="size-8 shrink-0 border bg-primary/10 text-primary flex items-center justify-center">
                  <AvatarFallback className="bg-transparent text-primary text-xs font-semibold">
                    U
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
          ))}
          <div ref={bottomRef} className="h-4" />
        </div>
      </ScrollArea>

      {/* Gemini-style Pill Input Area */}
      <div className="w-full bg-gradient-to-t from-background via-background/95 to-transparent shrink-0">
        <div className="max-w-3xl mx-auto px-4 pb-6 pt-2">
          <form
            onSubmit={(event) => {
              event.preventDefault()
              sendMessage()
            }}
          >
            <div className="relative flex items-end w-full bg-muted/40 focus-within:bg-background border border-border focus-within:border-ring rounded-[2rem] pl-4 pr-2 py-1.5 shadow-xs transition-all duration-200">
              <Textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Ask anything..."
                className="flex-1 min-h-[40px] max-h-[160px] resize-none border-0 bg-transparent py-2.5 focus-visible:ring-0 focus-visible:ring-offset-0 text-sm shadow-none outline-none"
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault()
                    sendMessage()
                  }
                }}
              />
              <div className="flex items-center gap-1.5 ml-2 shrink-0 mb-0.5">
                <Button
                  type="button"
                  variant={isListening ? "default" : "ghost"}
                  size="icon"
                  className="rounded-full size-9 text-foreground/75"
                  aria-label={isListening ? "Stop voice input" : "Start voice input"}
                  title={isListening ? "Stop voice input" : "Start voice input"}
                  onClick={toggleListening}
                >
                  {isListening ? <Square className="size-4 animate-pulse" /> : <Mic className="size-4" />}
                </Button>
                <Button
                  type="submit"
                  size="icon"
                  className="rounded-full size-9"
                  aria-label="Send message"
                  title="Send message"
                  disabled={isSending || !input.trim()}
                >
                  <Send className="size-4" />
                </Button>
              </div>
            </div>
          </form>
          <div className="text-[10px] text-center text-muted-foreground/60 mt-2">
            Tuya Custom Agent may control physical devices. Monitor your devices for safety.
          </div>
        </div>
      </div>
    </div>
  )
}
