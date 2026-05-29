"use client"

import { useEffect, useRef, useState } from "react"
import {
  Bot,
  Mic,
  Send,
  Square,
  Volume2,
  VolumeX,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

const conversationId =
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `local-${Date.now()}`

const initialMessages = [
  {
    role: "assistant",
    content: "I am ready. You can type or speak to me.",
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
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-4 sm:px-6 lg:px-8">
        <header className="flex min-h-14 items-center justify-between gap-4 border-b">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-md border bg-background">
              <Bot className="size-4" />
            </div>
            <div>
              <h1 className="text-base font-semibold leading-none">Tuya Custom Agent</h1>
              <p className="mt-1 text-xs text-muted-foreground">
                Local chatbot and talkbot with memory
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden rounded-md border px-2 py-1 text-xs text-muted-foreground sm:inline-flex">
              gpt-5-nano
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={voiceOutput ? "Disable voice output" : "Enable voice output"}
              title={voiceOutput ? "Disable voice output" : "Enable voice output"}
              onClick={() => setVoiceOutput((value) => !value)}
            >
              {voiceOutput ? <Volume2 /> : <VolumeX />}
            </Button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 justify-center py-4">
          <section className="flex min-h-[620px] w-full max-w-4xl flex-col rounded-md border bg-background">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div>
                <h2 className="text-sm font-medium">Conversation</h2>
                <p className="text-xs text-muted-foreground">
                  Type or speak naturally.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Voice output</span>
                <Switch checked={voiceOutput} onCheckedChange={setVoiceOutput} />
              </div>
            </div>

            <ScrollArea className="min-h-0 flex-1">
              <div className="space-y-4 p-4">
                {messages.map((message, index) => (
                  <div
                    key={`${message.role}-${index}`}
                    className={cn(
                      "flex",
                      message.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[82%] rounded-md border px-3 py-2 text-sm leading-6",
                        message.role === "user"
                          ? "bg-foreground text-background"
                          : "bg-background",
                        message.error && "border-destructive/40 text-destructive"
                      )}
                    >
                      <div className="whitespace-pre-wrap">{message.content}</div>
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
            </ScrollArea>

            <form
              className="border-t p-3"
              onSubmit={(event) => {
                event.preventDefault()
                sendMessage()
              }}
            >
              <div className="flex gap-2">
                <Textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="Ask anything..."
                  className="min-h-11 resize-none rounded-md"
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault()
                      sendMessage()
                    }
                  }}
                />
                <div className="flex flex-col gap-2">
                  <Button
                    type="button"
                    variant={isListening ? "default" : "outline"}
                    size="icon"
                    aria-label={isListening ? "Stop voice input" : "Start voice input"}
                    title={isListening ? "Stop voice input" : "Start voice input"}
                    onClick={toggleListening}
                  >
                    {isListening ? <Square /> : <Mic />}
                  </Button>
                  <Button
                    type="submit"
                    size="icon"
                    aria-label="Send message"
                    title="Send message"
                    disabled={isSending || !input.trim()}
                  >
                    <Send />
                  </Button>
                </div>
              </div>
            </form>
          </section>
        </div>
      </div>
    </main>
  )
}
